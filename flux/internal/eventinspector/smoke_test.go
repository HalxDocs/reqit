package eventinspector

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"testing"
	"time"

	"flux/internal/models"
)

func TestLiveSmokeTCP(t *testing.T) {
	store := newTestStore(t)
	secretStore := NewSecretStore()
	if err := secretStore.Set("whsec_livesmoke"); err != nil {
		t.Skipf("keyring unavailable: %v", err)
	}
	defer secretStore.Delete()

	l := NewListener(store, secretStore)
	var captured []models.EventRecord
	l.OnCapture(func(rec models.EventRecord) { captured = append(captured, rec) })
	port, err := l.Start()
	if err != nil {
		t.Fatal(err)
	}
	defer l.Stop()

	body, _ := json.Marshal(map[string]interface{}{
		"type": "invoice.paid",
		"data": map[string]interface{}{"amount": 1200, "currency": "usd"},
	})
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	req, _ := http.NewRequest(http.MethodPost,
		"http://127.0.0.1:"+strconv.Itoa(port)+"/webhooks/flexprice",
		bytes.NewReader(body))
	req.Header = svixHeaders("whsec_livesmoke", "msg_live_001", ts, body)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, rb)
	}

	recs, _ := store.GetAll()
	if len(recs) != 1 {
		t.Fatalf("expected 1 event stored, got %d", len(recs))
	}
	rec := recs[0]
	if rec.VerifyStatus != "verified" {
		t.Fatalf("expected verified over real TCP, got %q (%s)", rec.VerifyStatus, rec.VerifyError)
	}
	if rec.ProviderEventID != "msg_live_001" {
		t.Errorf("svix-id mismatch: %q", rec.ProviderEventID)
	}
	if len(captured) != 1 {
		t.Fatalf("expected 1 OnCapture, got %d", len(captured))
	}

	// Duplicate delivery of the same svix-id is captured (visible in the UI
	// as a "duplicate" delivery) but never re-marked verified.
	req2, _ := http.NewRequest(http.MethodPost,
		"http://127.0.0.1:"+strconv.Itoa(port)+"/webhooks/flexprice",
		bytes.NewReader(body))
	req2.Header = svixHeaders("whsec_livesmoke", "msg_live_001", ts, body)
	resp2, _ := http.DefaultClient.Do(req2)
	io.Copy(io.Discard, resp2.Body)
	resp2.Body.Close()
	recs2, _ := store.GetAll()
	if len(recs2) != 2 {
		t.Fatalf("expected 2 captured deliveries, got %d", len(recs2))
	}
	if recs2[0].VerifyStatus != "duplicate" {
		t.Fatalf("expected duplicate status on redelivery, got %q", recs2[0].VerifyStatus)
	}
	if recs2[1].VerifyStatus != "verified" {
		t.Fatalf("expected first delivery still verified, got %q", recs2[1].VerifyStatus)
	}

	t.Logf("OK: real TCP capture+verify+dedupe via 127.0.0.1:%d, statuses=%s,%s", port, recs2[0].VerifyStatus, recs2[1].VerifyStatus)
}

func TestLiveSmokeWrongSecret(t *testing.T) {
	store := newTestStore(t)
	secretStore := NewSecretStore()
	if err := secretStore.Set("whsec_realsecret"); err != nil {
		t.Skipf("keyring unavailable: %v", err)
	}
	defer secretStore.Delete()

	l := NewListener(store, secretStore)
	port, err := l.Start()
	if err != nil {
		t.Fatal(err)
	}
	defer l.Stop()

	body := []byte(`{"type":"invoice.paid","data":{"amount":1200}}`)
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	req, _ := http.NewRequest(http.MethodPost,
		"http://127.0.0.1:"+strconv.Itoa(port)+"/webhooks/flexprice",
		bytes.NewReader(body))
	req.Header = svixHeaders("whsec_WRONGSECRET", "msg_bad_001", ts, body)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	recs, _ := store.GetAll()
	if len(recs) != 1 {
		t.Fatalf("expected event stored even with bad signature, got %d", len(recs))
	}
	if recs[0].VerifyStatus != "unverified" {
		t.Fatalf("expected unverified with wrong secret, got %q", recs[0].VerifyStatus)
	}
	t.Logf("OK: bad signature -> stored as unverified")
}
