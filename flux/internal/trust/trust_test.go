package trust

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"flux/internal/models"
)

// sentinel is a value that must never reach disk. It is used as a token, a
// header value, a query value and a body field at once.
const sentinel = "sk-live-THIS-MUST-NEVER-BE-WRITTEN-9f3a"

func newTestStore(t *testing.T) (*Store, string) {
	t.Helper()
	dir := t.TempDir()
	s := NewStore(dir)
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	s.SetSigningKey(key)
	return s, dir
}

func TestExecuteWritesAReceipt(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"ok":true}`)
	}))
	defer srv.Close()

	store, dir := newTestStore(t)
	payload := models.RequestPayload{Method: "GET", URL: srv.URL + "/users/42"}

	res, id := Execute(context.Background(), payload, nil, Options{Store: store, Source: SourceCLI})
	if res.Error != "" {
		t.Fatalf("request failed: %s", res.Error)
	}
	if id == "" {
		t.Fatal("no receipt id returned")
	}

	receipts, err := store.List(0)
	if err != nil {
		t.Fatal(err)
	}
	if len(receipts) != 1 {
		t.Fatalf("want 1 receipt, got %d", len(receipts))
	}
	r := receipts[0]
	if r.Request.URL != srv.URL+"/users/42" {
		t.Errorf("wrong URL: %q", r.Request.URL)
	}
	if r.Response.StatusCode != 200 {
		t.Errorf("wrong status: %d", r.Response.StatusCode)
	}
	if r.Source != SourceCLI {
		t.Errorf("wrong source: %q", r.Source)
	}
	if r.Hash == "" {
		t.Error("receipt has no hash")
	}

	// The receipt is a file, not just an in-memory value.
	path := filepath.Join(dir, ".reqit", "runs", id+".json")
	if _, err := os.Stat(path); err != nil {
		t.Errorf("receipt file missing: %v", err)
	}
}

// TestReceiptNeverContainsASecret is the security promise of the whole
// package. It exercises every place a credential can hide: query, header,
// auth, request body and a response that echoes it back.
func TestReceiptNeverContainsASecret(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Set-Cookie", "session="+sentinel)
		w.Header().Set("X-Secret", sentinel)
		io.WriteString(w, `{"echo":"`+sentinel+`"}`)
	}))
	defer srv.Close()

	store, dir := newTestStore(t)
	payload := models.RequestPayload{
		Method:    "POST",
		URL:       srv.URL + "/charge?api_key=" + sentinel,
		BodyType:  "json",
		Body:      `{"card_token":"` + sentinel + `"}`,
		AuthType:  "bearer",
		AuthValue: sentinel,
		Headers: []models.Header{
			{Key: "Authorization", Value: "Bearer " + sentinel, Enabled: true},
			{Key: "X-Api-Key", Value: sentinel, Enabled: true},
			{Key: "Content-Type", Value: "application/json", Enabled: true},
		},
		Params: []models.Header{
			{Key: "token", Value: sentinel, Enabled: true},
			{Key: "page", Value: "2", Enabled: true},
		},
	}

	res, id := Execute(context.Background(), payload, nil, Options{Store: store, Source: SourceMCP})
	if res.Error != "" {
		t.Fatalf("request failed: %s", res.Error)
	}
	if id == "" {
		t.Fatal("no receipt written")
	}

	// Read every file in the store, not just the one we know about: a leak in
	// an index or a temp file would be just as bad.
	err := filepath.Walk(filepath.Join(dir, ".reqit", "runs"), func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return err
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if strings.Contains(string(data), sentinel) {
			t.Errorf("secret leaked into %s", path)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestOriginIsRecordedInsteadOfTheResolvedRequest(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	defer srv.Close()

	store, _ := newTestStore(t)
	payload := models.RequestPayload{
		Method: "GET",
		URL:    srv.URL + "/users?token=" + sentinel,
		Origin: &models.RequestOrigin{
			URL:        srv.URL + "/users?token={{TOKEN}}",
			VarSources: map[string]string{"TOKEN": "vault"},
		},
	}

	_, id := Execute(context.Background(), payload, nil, Options{Store: store, Source: SourceApp})
	r, err := store.Get(id)
	if err != nil {
		t.Fatal(err)
	}

	if !strings.Contains(r.Request.URL, "{{TOKEN}}") {
		t.Errorf("the templated URL was not recorded: %q", r.Request.URL)
	}
	if strings.Contains(r.Request.URL, sentinel) {
		t.Error("the resolved secret reached the receipt URL")
	}
	if len(r.Resolution) != 1 || r.Resolution[0].Name != "TOKEN" || r.Resolution[0].Source != "vault" {
		t.Errorf("resolution not recorded: %+v", r.Resolution)
	}
}

// TestConcurrentExecutionsKeepOneChain covers the app's normal case: several
// requests are in flight at once and all finish through the same store.
func TestConcurrentExecutionsKeepOneChain(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer srv.Close()

	store, _ := newTestStore(t)
	const n = 25
	ids := make([]string, n)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, id := Execute(context.Background(), models.RequestPayload{Method: "GET", URL: srv.URL}, nil, Options{Store: store})
			ids[i] = id
		}(i)
	}
	wg.Wait()

	seen := make(map[string]bool, n)
	for _, id := range ids {
		if id == "" {
			t.Fatal("an execution did not record a receipt")
		}
		if seen[id] {
			t.Fatalf("duplicate receipt id %q", id)
		}
		seen[id] = true
	}

	receipts, err := store.List(0)
	if err != nil {
		t.Fatal(err)
	}
	if len(receipts) != n {
		t.Fatalf("want %d receipts, got %d", n, len(receipts))
	}
	if _, err := store.VerifyChain(); err != nil {
		t.Fatalf("concurrent writes broke the chain: %v", err)
	}
}

// TestTwoStoresShareOneChain simulates the app and the CLI writing to the same
// workspace at once: separate Store values (separate mutexes, as separate
// processes would have) must still produce one chain.
func TestTwoStoresShareOneChain(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer srv.Close()

	dir := t.TempDir()
	appStore := NewStore(dir)
	cliStore := NewStore(dir)
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	appStore.SetSigningKey(key)
	cliStore.SetSigningKey(key)

	const n = 20
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			store := appStore
			if i%2 == 0 {
				store = cliStore
			}
			_, id := Execute(context.Background(), models.RequestPayload{Method: "GET", URL: srv.URL}, nil, Options{Store: store})
			if id == "" {
				t.Error("an execution did not record a receipt")
			}
		}(i)
	}
	wg.Wait()

	receipts, err := appStore.List(0)
	if err != nil {
		t.Fatal(err)
	}
	if len(receipts) != n {
		t.Fatalf("want %d receipts, got %d", n, len(receipts))
	}
	report, err := appStore.VerifyChainReport()
	if err != nil {
		t.Fatalf("two writers forked the chain: %v", err)
	}
	if report.Signed != n {
		t.Errorf("want %d signed receipts, got %d", n, report.Signed)
	}
}

func TestHashChainLinksConsecutiveReceipts(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer srv.Close()

	store, _ := newTestStore(t)
	payload := models.RequestPayload{Method: "GET", URL: srv.URL}

	_, firstID := Execute(context.Background(), payload, nil, Options{Store: store})
	_, secondID := Execute(context.Background(), payload, nil, Options{Store: store})

	first, _ := store.Get(firstID)
	second, _ := store.Get(secondID)

	if first.PrevHash != "" {
		t.Errorf("first receipt should not have a predecessor, got %q", first.PrevHash)
	}
	if second.PrevHash != first.Hash {
		t.Errorf("chain broken: second.prev=%q first.hash=%q", second.PrevHash, first.Hash)
	}
}

func TestGetAcceptsAnUnambiguousPrefix(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer srv.Close()

	store, _ := newTestStore(t)
	_, id := Execute(context.Background(), models.RequestPayload{Method: "GET", URL: srv.URL}, nil, Options{Store: store})

	got, err := store.Get(id[:12])
	if err != nil {
		t.Fatalf("prefix lookup failed: %v", err)
	}
	if got.ID != id {
		t.Errorf("prefix resolved to %q, want %q", got.ID, id)
	}
}

func TestAnnotateAttachesValidation(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer srv.Close()

	store, _ := newTestStore(t)
	_, id := Execute(context.Background(), models.RequestPayload{Method: "GET", URL: srv.URL}, nil, Options{Store: store})

	Annotate(store, id, func(r *Receipt) {
		r.Validation = &models.ValidationResult{Valid: false}
	})

	r, _ := store.Get(id)
	if r.Validation == nil || r.Validation.Valid {
		t.Fatalf("validation not attached: %+v", r.Validation)
	}
	if r.Hash == "" {
		t.Error("hash was not recomputed after annotation")
	}
}

// TestAnnotateKeepsTheChainValid covers the case that made the chain fragile:
// the app annotates a receipt with validation after the request completes, so
// a concurrent run can already be the newer receipt. Rewriting the annotated
// receipt must re-link its successors instead of leaving a broken chain.
func TestAnnotateKeepsTheChainValid(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer srv.Close()

	store, _ := newTestStore(t)
	payload := models.RequestPayload{Method: "GET", URL: srv.URL}
	_, firstID := Execute(context.Background(), payload, nil, Options{Store: store})
	_, secondID := Execute(context.Background(), payload, nil, Options{Store: store})
	_, thirdID := Execute(context.Background(), payload, nil, Options{Store: store})

	// Annotate the middle receipt, with successors already on disk.
	Annotate(store, secondID, func(r *Receipt) {
		r.Validation = &models.ValidationResult{Valid: true}
	})

	if n, err := store.VerifyChain(); err != nil {
		t.Fatalf("chain broken after annotation (%d checked): %v", n, err)
	}

	// The first receipt must still link to nothing, and the third to the
	// rewritten second.
	first, _ := store.Get(firstID)
	second, _ := store.Get(secondID)
	third, _ := store.Get(thirdID)
	if first.PrevHash != "" {
		t.Errorf("first receipt gained a predecessor: %q", first.PrevHash)
	}
	if third.PrevHash != second.Hash {
		t.Errorf("third receipt not re-linked: prev=%q second=%q", third.PrevHash, second.Hash)
	}
}

func TestVerifyChainDetectsAnEdit(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer srv.Close()

	store, dir := newTestStore(t)
	_, id := Execute(context.Background(), models.RequestPayload{Method: "GET", URL: srv.URL}, nil, Options{Store: store})

	path := filepath.Join(dir, ".reqit", "runs", id+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	edited := strings.Replace(string(data), srv.URL, srv.URL+"/tampered", 1)
	if edited == string(data) {
		t.Fatal("test did not change the receipt")
	}
	if err := os.WriteFile(path, []byte(edited), 0o644); err != nil {
		t.Fatal(err)
	}

	if _, err := store.VerifyChain(); err == nil {
		t.Fatal("an edited receipt was reported as intact")
	}
}

func TestSkipRecordsNothing(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer srv.Close()

	store, _ := newTestStore(t)
	_, id := Execute(context.Background(), models.RequestPayload{Method: "GET", URL: srv.URL}, nil, Options{Store: store, Skip: true})
	if id != "" {
		t.Errorf("Skip still recorded a receipt: %q", id)
	}
	if list, _ := store.List(0); len(list) != 0 {
		t.Errorf("Skip wrote %d receipts", len(list))
	}
}

func TestOriginFromMarksPlaceholders(t *testing.T) {
	p := models.RequestPayload{
		URL:  "https://api.example.com/{{VERSION}}/users",
		Body: `{"key":"{{API_KEY}}"}`,
	}
	origin := OriginFrom(p, "environment")
	if origin.URL != p.URL {
		t.Errorf("origin URL changed: %q", origin.URL)
	}
	if origin.VarSources["VERSION"] != "environment" || origin.VarSources["API_KEY"] != "environment" {
		t.Errorf("sources not marked: %+v", origin.VarSources)
	}
}

func TestRedactURLKeepsStructureAndMasksValues(t *testing.T) {
	got := redactURL("https://user:pass@api.example.com/v1/users?api_key=" + sentinel + "&page=2#frag")
	if strings.Contains(got, sentinel) || strings.Contains(got, "pass") {
		t.Errorf("credential survived redaction: %q", got)
	}
	if !strings.Contains(got, "api.example.com/v1/users") || !strings.Contains(got, "page=2") {
		t.Errorf("useful structure was lost: %q", got)
	}
	if strings.Contains(got, "#frag") {
		t.Errorf("fragment should be dropped: %q", got)
	}
}

func TestRedactHeadersMasksUnknownValues(t *testing.T) {
	headers := []models.Header{
		{Key: "Content-Type", Value: "application/json", Enabled: true},
		{Key: "X-Custom", Value: sentinel, Enabled: true},
		{Key: "Authorization", Value: "Bearer " + sentinel, Enabled: true},
	}
	got := redactHeaders(headers)
	for _, h := range got {
		if strings.Contains(h.Value, sentinel) {
			t.Errorf("%s leaked its value", h.Name)
		}
	}
	if got[0].Value != "application/json" {
		t.Errorf("safe header value was lost: %+v", got[0])
	}
	if !got[1].Redacted || !got[2].Redacted {
		t.Errorf("unsafe headers were not marked redacted: %+v", got)
	}
}

// TestSignatureRejectsARehashedEdit covers the attack the hash chain alone
// cannot stop: erase the URL, recompute the hash, leave the signature alone.
func TestSignatureRejectsARehashedEdit(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer srv.Close()

	store, dir := newTestStore(t)
	_, id := Execute(context.Background(), models.RequestPayload{Method: "GET", URL: srv.URL + "/before"}, nil, Options{Store: store})

	path := filepath.Join(dir, ".reqit", "runs", id+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var r Receipt
	if err := json.Unmarshal(data, &r); err != nil {
		t.Fatal(err)
	}
	r.Request.URL = srv.URL + "/after"
	hash, err := r.computeHash()
	if err != nil {
		t.Fatal(err)
	}
	r.Hash = hash
	forged, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, forged, 0o644); err != nil {
		t.Fatal(err)
	}

	if _, err := store.VerifyChain(); err == nil || !strings.Contains(err.Error(), "signature") {
		t.Fatalf("a rehashed edit was not caught by the signature: %v", err)
	}
}

func TestUnsignedReceiptsVerifyButAreReported(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer srv.Close()

	store, _ := newTestStore(t)
	store.SetSigningKey(nil)
	_, id := Execute(context.Background(), models.RequestPayload{Method: "GET", URL: srv.URL}, nil, Options{Store: store})
	if id == "" {
		t.Fatal("no receipt written")
	}

	report, err := store.VerifyChainReport()
	if err != nil {
		t.Fatalf("unsigned receipts should verify: %v", err)
	}
	if report.Unsigned != 1 || report.Signed != 0 {
		t.Errorf("wrong report: %+v", report)
	}
}

func TestRedactURLMasksSecretsInPathAndAnyQueryValue(t *testing.T) {
	raw := "https://api.example.com/users/sk_live_51NxYzAbC123/detail?page=2&id=sk_live_OTHER&sort=asc"
	got := redactURL(raw)

	if strings.Contains(got, "sk_live_") {
		t.Errorf("a credential survived in the URL: %q", got)
	}
	if !strings.Contains(got, "/users/") || !strings.Contains(got, "/detail") {
		t.Errorf("useful path structure was lost: %q", got)
	}
	// Values under an allowlisted, non-sensitive name are kept.
	if !strings.Contains(got, "page=2") || !strings.Contains(got, "sort=asc") {
		t.Errorf("safe query values were lost: %q", got)
	}
	// An innocuously named parameter still has its value masked.
	if !strings.Contains(got, "id=") || strings.Contains(got, "id=sk_live_OTHER") {
		t.Errorf("an innocuous parameter leaked its value: %q", got)
	}
}

func TestRedactURLMasksHighEntropyPathSegments(t *testing.T) {
	secret := "AbCdEfGhIjKlMnOpQrStUvWx123456"
	got := redactURL("https://api.example.com/v1/items/" + secret + "/edges?limit=10")
	if strings.Contains(got, secret) {
		t.Errorf("high-entropy path segment survived: %q", got)
	}
	if !strings.Contains(got, "/v1/items/") || !strings.Contains(got, "limit=10") {
		t.Errorf("ordinary parts of the URL were lost: %q", got)
	}
}

func TestRecordLoadTestWritesOneSummary(t *testing.T) {
	store, _ := newTestStore(t)
	payload := models.RequestPayload{
		Method: "GET",
		URL:    "https://api.example.com/{{VERSION}}/search?page=1",
		Origin: &models.RequestOrigin{
			URL:        "https://api.example.com/{{VERSION}}/search?page=1",
			VarSources: map[string]string{"VERSION": "environment"},
		},
	}
	result := models.LoadTestResult{
		Config:      models.LoadTestConfig{VUs: 10, DurationSec: 30, Iterations: 100},
		TotalReqs:   100,
		Passed:      98,
		Failed:      2,
		AvgTimingMs: 12.5,
		P50TimingMs: 11,
		P95TimingMs: 30,
		P99TimingMs: 48,
		DurationMs:  30000,
	}

	id := RecordLoadTest(store, payload, result, Options{})
	if id == "" {
		t.Fatal("no load test receipt written")
	}

	receipts, err := store.List(0)
	if err != nil {
		t.Fatal(err)
	}
	if len(receipts) != 1 {
		t.Fatalf("want 1 summary receipt, got %d", len(receipts))
	}
	got := receipts[0]
	if got.Kind != "loadtest" || got.LoadTest == nil {
		t.Fatalf("not a load test receipt: %+v", got)
	}
	if got.LoadTest.TotalReqs != 100 || got.LoadTest.P95Ms != 30 || got.LoadTest.Failed != 2 {
		t.Errorf("wrong summary: %+v", got.LoadTest)
	}
	if _, err := store.VerifyChain(); err != nil {
		t.Errorf("summary receipt did not verify: %v", err)
	}
}

func TestRedactURLKeepsPathPlaceholdersReadable(t *testing.T) {
	got := redactURL("https://api.example.com/users/{{USER_ID}}/items?page=1")
	if !strings.Contains(got, "/users/{{USER_ID}}/items") {
		t.Errorf("the templated path was escaped: %q", got)
	}
}
