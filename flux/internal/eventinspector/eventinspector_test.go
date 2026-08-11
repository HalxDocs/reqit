package eventinspector

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"flux/internal/models"
)

// signSvix produces a Svix signature header value "v1,<sig>" exactly as the
// onceo-core svix provider expects: HMAC-SHA256 over "{id}.{ts}.{body}".
func signSvix(secret, id, ts string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(id))
	mac.Write([]byte("."))
	mac.Write([]byte(ts))
	mac.Write([]byte("."))
	mac.Write(body)
	return "v1," + base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func svixHeaders(secret, id, ts string, body []byte) http.Header {
	h := http.Header{}
	h.Set("svix-id", id)
	h.Set("svix-timestamp", ts)
	h.Set("svix-signature", signSvix(secret, id, ts, body))
	h.Set("Content-Type", "application/json")
	return h
}

func newTestStore(t *testing.T) *Store {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "workspace")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	return NewStore(dir)
}

func validBody() []byte {
	return []byte(`{"type":"invoice.paid","data":{"id":"inv_123"}}`)
}

func TestVerifyValidSignature(t *testing.T) {
	store := newTestStore(t)
	secret := "whsec_testsecret"
	body := validBody()
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	h := svixHeaders(secret, "msg_1", ts, body)

	res := Verify(h, body, secret, store)
	if res.Status != "verified" {
		t.Fatalf("expected verified, got %q (%s)", res.Status, res.Error)
	}
	if res.Provider != "svix" {
		t.Errorf("expected provider svix, got %q", res.Provider)
	}
	if res.ProviderEventID != "msg_1" {
		t.Errorf("expected providerEventId msg_1, got %q", res.ProviderEventID)
	}
	if res.EventType != "invoice.paid" {
		t.Errorf("expected eventType invoice.paid, got %q", res.EventType)
	}
}

func TestVerifyNoSecret(t *testing.T) {
	store := newTestStore(t)
	h := svixHeaders("whsec_x", "msg_1", "1", validBody())
	res := Verify(h, validBody(), "", store)
	if res.Status != "unverified" {
		t.Fatalf("expected unverified without secret, got %q", res.Status)
	}
	if res.Error == "" {
		t.Fatal("expected a hint error when no secret configured")
	}
}

func TestVerifyWrongSecret(t *testing.T) {
	store := newTestStore(t)
	body := validBody()
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	h := svixHeaders("whsec_correct", "msg_1", ts, body)

	res := Verify(h, body, "whsec_wrong", store)
	if res.Status != "unverified" {
		t.Fatalf("expected unverified for wrong secret, got %q", res.Status)
	}
	if !strings.Contains(res.Error, "signature") {
		t.Errorf("expected signature error, got %q", res.Error)
	}
}

func TestVerifyDuplicate(t *testing.T) {
	store := newTestStore(t)
	secret := "whsec_testsecret"
	body := validBody()
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	h := svixHeaders(secret, "msg_dup", ts, body)

	first := Verify(h, body, secret, store)
	if first.Status != "verified" {
		t.Fatalf("first verify should be verified, got %q", first.Status)
	}
	second := Verify(h, body, secret, store)
	if second.Status != "duplicate" {
		t.Fatalf("second verify should be duplicate, got %q", second.Status)
	}
}

func TestListenerCapturesAndVerifies(t *testing.T) {
	store := newTestStore(t)
	secretStore := NewSecretStore()
	if err := secretStore.Set("whsec_testsecret"); err != nil {
		t.Fatal(err)
	}

	l := NewListener(store, secretStore)
	var captured []models.EventRecord
	l.OnCapture(func(rec models.EventRecord) { captured = append(captured, rec) })

	port, err := l.Start()
	if err != nil {
		t.Fatal(err)
	}
	defer l.Stop()

	body := validBody()
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:"+strconv.Itoa(port)+"/webhook", bytes.NewReader(body))
	req.Header = svixHeaders("whsec_testsecret", "msg_live", ts, body)
	w := httptest.NewRecorder()

	l.handle(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	recs, err := store.GetAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(recs) != 1 {
		t.Fatalf("expected 1 event, got %d", len(recs))
	}
	rec := recs[0]
	if rec.VerifyStatus != "verified" {
		t.Fatalf("expected verified, got %q (%s)", rec.VerifyStatus, rec.VerifyError)
	}
	if rec.ProviderEventID != "msg_live" {
		t.Errorf("expected svix-id msg_live, got %q", rec.ProviderEventID)
	}
	if rec.Body != string(body) {
		t.Errorf("captured body mismatch")
	}
	if len(captured) != 1 {
		t.Fatalf("expected 1 OnCapture callback, got %d", len(captured))
	}
}

func TestListenerRejectsNonPost(t *testing.T) {
	store := newTestStore(t)
	l := NewListener(store, NewSecretStore())
	req := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/", nil)
	w := httptest.NewRecorder()
	l.handle(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Code)
	}
	if n, _ := store.Count(); n != 0 {
		t.Fatalf("expected no stored events for GET, got %d", n)
	}
}

func TestListenerRejectsOversizedBody(t *testing.T) {
	store := newTestStore(t)
	l := NewListener(store, NewSecretStore())
	big := bytes.Repeat([]byte("x"), maxBodySize+1024)
	req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1/", bytes.NewReader(big))
	w := httptest.NewRecorder()
	l.handle(w, req)
	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413, got %d", w.Code)
	}
}

func TestStoreCap(t *testing.T) {
	store := newTestStore(t)
	for i := 0; i < Cap+50; i++ {
		rec := models.EventRecord{ID: "id-" + strconv.Itoa(i), VerifyStatus: "unverified"}
		if _, err := store.Append(rec); err != nil {
			t.Fatal(err)
		}
	}
	recs, err := store.GetAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(recs) != Cap {
		t.Fatalf("expected cap %d, got %d", Cap, len(recs))
	}
	// Newest first.
	if recs[0].ID != "id-" + strconv.Itoa(Cap+49) {
		t.Errorf("expected newest-first ordering, got %q", recs[0].ID)
	}
}

func TestStorePersistsAcrossReload(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "workspace")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	s1 := NewStore(dir)
	rec := models.EventRecord{
		ID:              "e1",
		Provider:        "svix",
		ProviderEventID: "msg_persist",
		VerifyStatus:    "verified",
		Body:            "{}",
	}
	if _, err := s1.Append(rec); err != nil {
		t.Fatal(err)
	}
	if err := s1.UpdateVerify("e1", models.VerifyResult{Status: "verified", Provider: "svix", ProviderEventID: "msg_persist"}); err != nil {
		t.Fatal(err)
	}

	s2 := NewStore(dir)
	if !s2.IsKnown("svix", "msg_persist") {
		t.Fatal("verified key should survive reload")
	}
	recs, err := s2.GetAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(recs) != 1 || recs[0].ID != "e1" {
		t.Fatalf("expected reloaded event, got %+v", recs)
	}
}

func TestSecretStoreRoundtrip(t *testing.T) {
	// Uses the real OS keyring; skip when unavailable (CI/headless).
	ss := NewSecretStore()
	defer ss.Delete()
	if err := ss.Set("whsec_ci_test"); err != nil {
		t.Skipf("keyring unavailable: %v", err)
	}
	if got := ss.Get(); got != "whsec_ci_test" {
		t.Fatalf("expected roundtripped secret, got %q", got)
	}
	if !ss.Has() {
		t.Fatal("Has() should be true after Set")
	}
	if err := ss.Delete(); err != nil {
		t.Fatal(err)
	}
	if ss.Has() {
		t.Fatal("Has() should be false after Delete")
	}
}

var _ = json.Marshal
var _ = io.ReadAll
