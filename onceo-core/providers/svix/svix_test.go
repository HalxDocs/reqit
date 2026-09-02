package svix

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	onceo "github.com/HalxDocs/onceo-core"
	"github.com/HalxDocs/onceo-core/internal/testutil"
)

func loadFixture(t *testing.T, name string) []byte {
	t.Helper()
	data, err := os.ReadFile("testdata/" + name)
	if err != nil {
		t.Fatalf("failed to read fixture %s: %v", name, err)
	}
	return data
}

func nowHeaders(secret, msgID string, body []byte) http.Header {
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	headers := http.Header{}
	headers.Set(headerID, msgID)
	headers.Set(headerTimestamp, ts)
	headers.Set(headerSignature, testutil.SignSvix(secret, msgID, ts, body))
	return headers
}

func TestNewEmptySecret(t *testing.T) {
	if _, err := New(""); err == nil {
		t.Fatal("expected error for empty signing secret")
	}
}

func TestProviderName(t *testing.T) {
	p, _ := New("whsec_ab cd==")
	if got := p.Name(); got != "svix" {
		t.Errorf("Name() = %q, want %q", got, "svix")
	}
}

func TestBodyBound(t *testing.T) {
	p, _ := New("whsec_ab")
	if !p.BodyBound() {
		t.Fatal("BodyBound() should be true: signature covers the body")
	}
}

func TestNewDecodesBase64Secret(t *testing.T) {
	// Secret bytes "s3cret"; prefix form must produce the same verified sig
	// as the raw ASCII secret.
	raw := "s3cret"
	encoded := "whsec_" + base64.StdEncoding.EncodeToString([]byte(raw))
	body := loadFixture(t, "payment_succeeded.json")
	msgID := "msg_test_1"
	ts := strconv.FormatInt(time.Now().Unix(), 10)

	rawSig := testutil.SignSvix(raw, msgID, ts, body)
	encodedSig := testutil.SignSvix(encoded, msgID, ts, body)
	if rawSig != encodedSig {
		t.Fatalf("whsec_ base64 secret must decode to the same key; got %s vs %s", encodedSig, rawSig)
	}

	p, err := New(encoded)
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}
	h := http.Header{}
	h.Set("svix-id", msgID)
	h.Set("svix-timestamp", ts)
	h.Set("svix-signature", rawSig)
	if err := p.VerifySignature(h, body); err != nil {
		t.Fatalf("VerifySignature failed: %v", err)
	}
}

func TestVerifySignatureValid(t *testing.T) {
	secret := "whsec_2rhuScZ1mQYt9wKx9mS0T2q5zZ3mY0dVc0gZ2v8UBUo="
	body := loadFixture(t, "payment_succeeded.json")
	p, err := New(secret)
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}

	headers := nowHeaders(secret, "msg_actual", body)
	if err := p.VerifySignature(headers, body); err != nil {
		t.Fatalf("VerifySignature failed: %v", err)
	}
}

func TestVerifySignatureValidEventTypeHeader(t *testing.T) {
	secret := "whsec_abc"
	body := loadFixture(t, "invoice_paid.json")
	p, _ := New(secret)
	if err := p.VerifySignature(nowHeaders(secret, "msg_inv", body), body); err != nil {
		t.Fatalf("VerifySignature failed: %v", err)
	}
}

func TestVerifySignatureMissingHeaders(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New(secret)

	tests := []struct {
		name    string
		headers http.Header
		wantErr error
	}{
		{"missing svix-id", http.Header{"svix-timestamp": []string{"0"}, "svix-signature": []string{"v1,xx"}}, onceo.ErrMissingHeader},
		{"missing svix-timestamp", http.Header{"svix-id": []string{"m"}, "svix-signature": []string{"v1,xx"}}, onceo.ErrMissingHeader},
		{"missing svix-signature", http.Header{"svix-id": []string{"m"}, "svix-timestamp": []string{"0"}}, onceo.ErrMissingHeader},
		{"empty headers", http.Header{}, onceo.ErrMissingHeader},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := p.VerifySignature(tt.headers, body)
			if !errors.Is(err, tt.wantErr) {
				t.Errorf("got error %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestVerifySignatureDuplicateID(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New(secret)
	headers := nowHeaders(secret, "msg_dup", body)
	headers.Add("svix-id", "msg_dup_second")
	if err := p.VerifySignature(headers, body); !errors.Is(err, onceo.ErrDuplicateHeader) {
		t.Errorf("got %v, want %v", err, onceo.ErrDuplicateHeader)
	}
}

func TestVerifySignatureTamperedBody(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New(secret)

	tampered := append(append([]byte{}, body[:len(body)-1]...), 'x')
	err := p.VerifySignature(nowHeaders(secret, "msg_tamper", body), tampered)
	if !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("got %v, want %v", err, onceo.ErrInvalidSignature)
	}
}

func TestVerifySignatureWrongSecret(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New("whsec_other")
	headers := nowHeaders(secret, "msg_wrong", body)
	if err := p.VerifySignature(headers, body); !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("got %v, want %v", err, onceo.ErrInvalidSignature)
	}
}

func TestVerifySignatureExpiredTimestamp(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New(secret)

	old := strconv.FormatInt(time.Now().Unix()-int64((DefaultTolerance+time.Minute).Seconds()), 10)
	headers := http.Header{}
	headers.Set("svix-id", "msg_old")
	headers.Set("svix-timestamp", old)
	headers.Set("svix-signature", testutil.SignSvix(secret, "msg_old", old, body))

	if err := p.VerifySignature(headers, body); !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("got %v, want %v", err, onceo.ErrInvalidSignature)
	}
}

func TestVerifySignatureFutureTimestamp(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New(secret)

	future := strconv.FormatInt(time.Now().Add(DefaultTolerance+time.Minute).Unix(), 10)
	headers := http.Header{}
	headers.Set("svix-id", "msg_future")
	headers.Set("svix-timestamp", future)
	headers.Set("svix-signature", testutil.SignSvix(secret, "msg_future", future, body))

	if err := p.VerifySignature(headers, body); !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("got %v, want %v", err, onceo.ErrInvalidSignature)
	}
}

func TestVerifySignatureNonNumericTimestamp(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New(secret)
	headers := http.Header{}
	headers.Set("svix-id", "msg_x")
	headers.Set("svix-timestamp", "now")
	headers.Set("svix-signature", "v1,AAAA")
	if err := p.VerifySignature(headers, body); !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("got %v, want %v", err, onceo.ErrInvalidSignature)
	}
}

func TestVerifySignatureMultiSignatureRotation(t *testing.T) {
	secret := "whsec_ab"
	oldSecret := "whsec_old"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New(secret)

	msgID := "msg_rotate"
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	oldSig := testutil.SignSvix(oldSecret, msgID, ts, body)
	newSig := testutil.SignSvix(secret, msgID, ts, body)

	headers := http.Header{}
	headers.Set("svix-id", msgID)
	headers.Set("svix-timestamp", ts)
	headers.Set("svix-signature", oldSig+" "+newSig)
	if err := p.VerifySignature(headers, body); err != nil {
		t.Errorf("rotation signing should accept any matching v1 signature: %v", err)
	}
}

func TestVerifySignatureMalformedSignatureHeader(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New(secret)

	ts := strconv.FormatInt(time.Now().Unix(), 10)
	headers := http.Header{}
	headers.Set("svix-id", "msg_badbase")
	headers.Set("svix-timestamp", ts)
	headers.Set("svix-signature", "v1,not_base64!!")

	if err := p.VerifySignature(headers, body); !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("got %v, want %v", err, onceo.ErrInvalidSignature)
	}
}

func TestVerifySignatureIgnoresNonV1Version(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New(secret)
	msgID := "msg_v2"
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	realSig := testutil.SignSvix(secret, msgID, ts, body)
	headers := http.Header{}
	headers.Set("svix-id", msgID)
	headers.Set("svix-timestamp", ts)
	headers.Set("svix-signature", "v2,"+realSig)
	if err := p.VerifySignature(headers, body); !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("v2 entries must not be accepted: got %v", err)
	}
}

func TestParseStandardEnvelope(t *testing.T) {
	p, _ := New("whsec_ab")
	body := loadFixture(t, "payment_succeeded.json")
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	if payload.Type != "payment.succeeded" {
		t.Errorf("Type = %q, want %q", payload.Type, "payment.succeeded")
	}
	if payload.APIUser != "usr_0123456789" {
		t.Errorf("APIUser = %q, want %q", payload.APIUser, "usr_0123456789")
	}
}

func TestParseEventTypeHeader(t *testing.T) {
	p, _ := New("secret")
	body := loadFixture(t, "invoice_paid.json")
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	if payload.EventType != "invoice.paid" {
		t.Errorf("EventType = %q, want %q", payload.EventType, "invoice.paid")
	}
	if payload.Type != "" {
		t.Errorf("Type = %q, want empty", payload.Type)
	}
}

func TestParseNestedEventType(t *testing.T) {
	p, _ := New("secret")
	body := loadFixture(t, "nested_event_type.json")
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	if payload.EventType != "customer.subscription.created" {
		t.Errorf("EventType = %q, want nested event_type", payload.EventType)
	}
	if payload.Type != "" {
		t.Errorf("Type = %q, want empty", payload.Type)
	}
}

func TestParseMalformed(t *testing.T) {
	p, _ := New("secret")
	tests := [][]byte{
		[]byte("not json"),
		[]byte(`{"data":{}}`),
		[]byte(`{}`),
	}
	for _, body := range tests {
		if _, err := p.Parse(body); !errors.Is(err, onceo.ErrMalformedPayload) {
			t.Errorf("Parse(%s) got %v, want %v", string(body), err, onceo.ErrMalformedPayload)
		}
	}
}

func TestNormalize(t *testing.T) {
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New("whsec_ab")
	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	event, err := p.Normalize(parsed)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Provider != "svix" {
		t.Errorf("Provider = %q, want %q", event.Provider, "svix")
	}
	// The dedup key is not part of the body; Normalize leaves it empty and
	// Process fills it from the verified svix-id header.
	if event.ProviderEventID != "" {
		t.Errorf("ProviderEventID = %q, want empty (set by Process)", event.ProviderEventID)
	}
	if event.Type != "payment.succeeded" {
		t.Errorf("Type = %q, want %q", event.Type, "payment.succeeded")
	}
	if event.Status != onceo.StatusPending {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusPending)
	}
}

func TestHeaderDedupKey(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New(secret)

	headers := nowHeaders(secret, "msg_dedupkey", body)
	if err := p.VerifySignature(headers, body); err != nil {
		t.Fatalf("VerifySignature failed: %v", err)
	}
	id, err := p.HeaderDedupKey(headers)
	if err != nil {
		t.Fatalf("HeaderDedupKey failed: %v", err)
	}
	if id != "msg_dedupkey" {
		t.Errorf("HeaderDedupKey = %q, want %q", id, "msg_dedupkey")
	}

	// Missing header must error rather than return an empty key.
	if _, err := p.HeaderDedupKey(http.Header{}); !errors.Is(err, onceo.ErrMissingHeader) {
		t.Errorf("missing header got %v, want %v", err, onceo.ErrMissingHeader)
	}
}

// TestConcurrentProcessSharedProvider proves the provider is safe to share
// across concurrent Process calls. Under -race (CI) this also proves there
// is no data race: the svix-id flows through headers, not provider state.
func TestConcurrentProcessSharedProvider(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New(secret)

	const n = 64
	var wg sync.WaitGroup
	errs := make(chan error, n)
	ids := make(chan string, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			store := onceo.NewMemoryStore()
			msgID := fmt.Sprintf("msg_concurrent_%d", i)
			headers := nowHeaders(secret, msgID, body)
			ev, err := onceo.Process(t.Context(), p, store, headers, body)
			if err != nil {
				errs <- fmt.Errorf("msg %s: %w", msgID, err)
				return
			}
			ids <- ev.ProviderEventID
		}(i)
	}
	wg.Wait()
	close(errs)
	close(ids)

	for err := range errs {
		t.Error(err)
	}
	seen := make(map[string]bool)
	count := 0
	for id := range ids {
		count++
		if seen[id] {
			t.Errorf("duplicate ProviderEventID %q", id)
		}
		seen[id] = true
	}
	if count != n {
		t.Errorf("got %d events, want %d", count, n)
	}
}

func TestProcessDedupSharedProvider(t *testing.T) {
	// Two deliveries of the same message through one shared provider must
	// dedup to the same svix-id key.
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New(secret)
	store := onceo.NewMemoryStore()
	headers := nowHeaders(secret, "msg_shared_dedup", body)

	if _, err := onceo.Process(t.Context(), p, store, headers, body); err != nil {
		t.Fatalf("first Process failed: %v", err)
	}
	if _, err := onceo.Process(t.Context(), p, store, headers, body); !errors.Is(err, onceo.ErrDuplicateEvent) {
		t.Errorf("second Process got %v, want %v", err, onceo.ErrDuplicateEvent)
	}
}

func TestProcessFullFlow(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	headers := nowHeaders(secret, "msg_process", body)

	p, _ := New(secret)
	store := onceo.NewMemoryStore()

	event, err := onceo.Process(t.Context(), p, store, headers, body)
	if err != nil {
		t.Fatalf("Process failed: %v", err)
	}
	if event.Provider != "svix" {
		t.Errorf("Provider = %q, want %q", event.Provider, "svix")
	}
	if event.ProviderEventID != "msg_process" {
		t.Errorf("ProviderEventID = %q, want %q", event.ProviderEventID, "msg_process")
	}
	if event.Type != "payment.succeeded" {
		t.Errorf("Type = %q, want %q", event.Type, "payment.succeeded")
	}
	if event.ReceivedAt.IsZero() {
		t.Error("ReceivedAt must be set")
	}
}

func TestProcessDedup(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New(secret)
	store := onceo.NewMemoryStore()
	headers := nowHeaders(secret, "msg_dedup", body)

	if _, err := onceo.Process(t.Context(), p, store, headers, body); err != nil {
		t.Fatalf("first Process failed: %v", err)
	}
	if _, err := onceo.Process(t.Context(), p, store, headers, body); !errors.Is(err, onceo.ErrDuplicateEvent) {
		t.Errorf("second Process got %v, want %v", err, onceo.ErrDuplicateEvent)
	}
}

func TestProcessInvalidSignature(t *testing.T) {
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New("whsec_wrong")
	store := onceo.NewMemoryStore()
	headers := nowHeaders("whsec_right", "msg_bad", body)

	_, err := onceo.Process(t.Context(), p, store, headers, body)
	if !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("got %v, want %v", err, onceo.ErrInvalidSignature)
	}
}

func TestWithTolerance(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")

	tolerant, err := New(secret, WithTolerance(10*time.Minute))
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}

	expiredID := "msg_tolerant"
	expired := strconv.FormatInt(time.Now().Add(-8*time.Minute).Unix(), 10)
	headers := http.Header{}
	headers.Set("svix-id", expiredID)
	headers.Set("svix-timestamp", expired)
	headers.Set("svix-signature", testutil.SignSvix(secret, expiredID, expired, body))

	if err := tolerant.VerifySignature(headers, body); err != nil {
		t.Errorf("8-minute-old message failed with 10-minute tolerance: %v", err)
	}

	strict, _ := New(secret)
	if err := strict.VerifySignature(headers, body); !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("8-minute-old message should fail with default 5-minute tolerance, got %v", err)
	}
}

func TestNew(t *testing.T) {
	if _, err := New("whsec_ab", WithTolerance(0)); err != nil {
		t.Fatalf("New with zero tolerance option failed: %v", err)
	}
	p, _ := New("whsec_ab", WithTolerance(0))
	if p.tolerance != DefaultTolerance {
		t.Errorf("zero tolerance option should keep default, got %v", p.tolerance)
	}
}

func TestVerifySignatureEmptySignature(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New(secret)
	msgID := "msg_empty"
	ts := strconv.FormatInt(time.Now().Unix(), 10)

	headers := http.Header{}
	headers.Set("svix-id", msgID)
	headers.Set("svix-timestamp", ts)
	headers.Set("svix-signature", "")

	if err := p.VerifySignature(headers, body); !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("empty signature must fail closed, got %v", err)
	}
}

func TestVerifySignatureValidInsideTolerance(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New(secret)

	for _, offset := range []int64{-60, 0, 60} {
		id := "msg_inside_" + strconv.FormatInt(offset, 10)
		ts := strconv.FormatInt(time.Now().Unix()+offset, 10)
		headers := http.Header{}
		headers.Set("svix-id", id)
		headers.Set("svix-timestamp", ts)
		headers.Set("svix-signature", testutil.SignSvix(secret, id, ts, body))
		if err := p.VerifySignature(headers, body); err != nil {
			t.Errorf("message %d seconds from now should be inside tolerance: %v", offset, err)
		}
	}
}

func TestVerifySignatureIgnoresExtraSpaceAndTrailing(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New(secret)
	msgID := "msg_spaces"
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	sig := testutil.SignSvix(secret, msgID, ts, body)

	headers := http.Header{}
	headers.Set("svix-id", msgID)
	headers.Set("svix-timestamp", ts)
	headers.Set("svix-signature", "  "+sig+"   ")

	if err := p.VerifySignature(headers, body); err != nil {
		t.Errorf("padded signature header should verify: %v", err)
	}
}

func TestVerifySignatureExceedsMaxEntries(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New(secret)
	msgID := "msg_cap"
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	realSig := testutil.SignSvix(secret, msgID, ts, body)

	// 9 garbage entries whose valid signature comes 9th: only the first
	// maxSignatureEntries (8) are examined, so the valid one is skipped.
	var entries []string
	for i := 0; i < maxSignatureEntries+1; i++ {
		entries = append(entries, "v1,AAAA"+strconv.Itoa(i))
	}
	header := strings.Join(append(entries, "v1,"+realSig), " ")

	headers := http.Header{}
	headers.Set("svix-id", msgID)
	headers.Set("svix-timestamp", ts)
	headers.Set("svix-signature", header)

	if err := p.VerifySignature(headers, body); !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("signature beyond the entry cap must be rejected, got %v", err)
	}
}

func TestVerifySignatureRejectsValidWithinCap(t *testing.T) {
	secret := "whsec_ab"
	body := loadFixture(t, "payment_succeeded.json")
	p, _ := New(secret)
	msgID := "msg_withincap"
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	realSig := testutil.SignSvix(secret, msgID, ts, body)

	// Valid key placed early within the cap: accepted (key rotation case).
	headers := http.Header{}
	headers.Set("svix-id", msgID)
	headers.Set("svix-timestamp", ts)
	headers.Set("svix-signature", "v1,AAAA "+realSig)

	if err := p.VerifySignature(headers, body); err != nil {
		t.Errorf("valid signature within cap should verify: %v", err)
	}
}

func FuzzParse(f *testing.F) {
	fixtures := []string{"payment_succeeded.json", "invoice_paid.json", "nested_event_type.json"}
	for _, name := range fixtures {
		data, err := os.ReadFile("testdata/" + name)
		if err == nil {
			f.Add(data)
		}
	}
	f.Add([]byte(`{}`))
	f.Add([]byte(`{"data":{}}`))
	f.Add([]byte(`not json`))
	f.Add([]byte(`{"type":"payment.succeeded","data":{"id":"abc"}}`))

	p, _ := New("whsec_ab")

	f.Fuzz(func(t *testing.T, body []byte) {
		_, err := p.Parse(body)
		if err != nil && err != onceo.ErrMalformedPayload {
			t.Errorf("unexpected error: %v", err)
		}
	})
}
