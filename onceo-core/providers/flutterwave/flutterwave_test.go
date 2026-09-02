package flutterwave

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"testing"

	onceo "github.com/HalxDocs/onceo-core"
)

func loadFixture(t *testing.T, name string) []byte {
	t.Helper()
	data, err := os.ReadFile("testdata/" + name)
	if err != nil {
		t.Fatalf("failed to read fixture %s: %v", name, err)
	}
	return data
}

func signedHeaders(secretHash string, body []byte) http.Header {
	h := sha256.Sum256([]byte(secretHash))
	sig := hex.EncodeToString(h[:])

	headers := http.Header{}
	headers.Set("Verif-Hash", sig)
	return headers
}

func TestVerifySignature(t *testing.T) {
	secretHash := "flw_secret_hash"
	body := loadFixture(t, "charge_completed.json")

	p, err := New(secretHash)
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}

	tests := []struct {
		name    string
		headers http.Header
		body    []byte
		wantErr bool
	}{
		{
			name:    "valid signature",
			headers: signedHeaders(secretHash, body),
			body:    body,
			wantErr: false,
		},
		{
			name:    "missing header",
			headers: http.Header{},
			body:    body,
			wantErr: true,
		},
		{
			name:    "wrong secret",
			headers: signedHeaders("wrong_secret", body),
			body:    body,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := p.VerifySignature(tt.headers, tt.body)
			if (err != nil) != tt.wantErr {
				t.Errorf("VerifySignature() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestNewEmptyHash(t *testing.T) {
	_, err := New("")
	if err == nil {
		t.Error("expected error for empty secret hash")
	}
}

func TestParse(t *testing.T) {
	p, _ := New("dummy_hash")

	tests := []struct {
		name    string
		body    []byte
		wantErr bool
		wantEvt string
	}{
		{
			name:    "charge completed",
			body:    loadFixture(t, "charge_completed.json"),
			wantErr: false,
			wantEvt: "charge.completed",
		},
		{
			name:    "charge failed",
			body:    loadFixture(t, "charge_failed.json"),
			wantErr: false,
			wantEvt: "charge.failed",
		},
		{
			name:    "malformed json",
			body:    []byte(`not json`),
			wantErr: true,
		},
		{
			name:    "empty json",
			body:    []byte(`{}`),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := p.Parse(tt.body)
			if (err != nil) != tt.wantErr {
				t.Errorf("Parse() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got.Event != tt.wantEvt {
				t.Errorf("Parse() event = %q, want %q", got.Event, tt.wantEvt)
			}
		})
	}
}

func TestNormalizeChargeCompleted(t *testing.T) {
	p, _ := New("dummy_hash")
	body := loadFixture(t, "charge_completed.json")

	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	event, err := p.Normalize(parsed)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}

	if event.Provider != "flutterwave" {
		t.Errorf("Provider = %q, want %q", event.Provider, "flutterwave")
	}
	if event.ProviderEventID != "9876543" {
		t.Errorf("ProviderEventID = %q, want %q", event.ProviderEventID, "9876543")
	}
	if event.Type != "charge.completed" {
		t.Errorf("Type = %q, want %q", event.Type, "charge.completed")
	}
	if event.Status != onceo.StatusSuccess {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusSuccess)
	}
	if event.AmountMinor != 15000 {
		t.Errorf("AmountMinor = %d, want %d", event.AmountMinor, 15000)
	}
	if event.Currency != "NGN" {
		t.Errorf("Currency = %q, want %q", event.Currency, "NGN")
	}
	if event.Reference != "flw_ref_abc123" {
		t.Errorf("Reference = %q, want %q", event.Reference, "flw_ref_abc123")
	}
}

func TestNormalizeChargeFailed(t *testing.T) {
	p, _ := New("dummy_hash")
	body := loadFixture(t, "charge_failed.json")

	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	event, err := p.Normalize(parsed)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}

	if event.Type != "charge.failed" {
		t.Errorf("Type = %q, want %q", event.Type, "charge.failed")
	}
	if event.Status != onceo.StatusFailed {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusFailed)
	}
	if event.AmountMinor != 30000 {
		t.Errorf("AmountMinor = %d, want %d", event.AmountMinor, 30000)
	}
}

func TestNormalizeUnknownEvent(t *testing.T) {
	raw := struct {
		Event string          `json:"event"`
		Data  json.RawMessage `json:"data"`
	}{
		Event: "unknown.event",
		Data:  json.RawMessage(`{}`),
	}

	body, _ := json.Marshal(raw)
	p, _ := New("dummy_hash")
	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	_, err = p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for unknown event type")
	}
}

func TestNormalizeTransferCompleted(t *testing.T) {
	p, _ := New("dummy_hash")
	body := loadFixture(t, "transfer_completed.json")

	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	event, err := p.Normalize(parsed)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}

	if event.Provider != "flutterwave" {
		t.Errorf("Provider = %q, want %q", event.Provider, "flutterwave")
	}
	if event.ProviderEventID != "5555555" {
		t.Errorf("ProviderEventID = %q, want %q", event.ProviderEventID, "5555555")
	}
	if event.Type != "transfer.completed" {
		t.Errorf("Type = %q, want %q", event.Type, "transfer.completed")
	}
	if event.Status != onceo.StatusSuccess {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusSuccess)
	}
	if event.AmountMinor != 200000 {
		t.Errorf("AmountMinor = %d, want %d", event.AmountMinor, 200000)
	}
	if event.Currency != "NGN" {
		t.Errorf("Currency = %q, want %q", event.Currency, "NGN")
	}
	if event.Reference != "flw_transfer_ref_001" {
		t.Errorf("Reference = %q, want %q", event.Reference, "flw_transfer_ref_001")
	}
}

func TestNormalizeTransferFailed(t *testing.T) {
	p, _ := New("dummy_hash")
	body := loadFixture(t, "transfer_failed.json")

	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	event, err := p.Normalize(parsed)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}

	if event.Type != "transfer.failed" {
		t.Errorf("Type = %q, want %q", event.Type, "transfer.failed")
	}
	if event.Status != onceo.StatusFailed {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusFailed)
	}
}

func mustJSON(t *testing.T, v any) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("json.Marshal failed: %v", err)
	}
	return b
}

func TestNormalizeChargeInvalidCurrency(t *testing.T) {
	p, _ := New("dummy_hash")
	parsed, _ := p.Parse(mustJSON(t, map[string]any{
		"event": "charge.completed",
		"data":  map[string]any{"id": 1, "tx_ref": "r", "amount": 1000, "currency": "NGNx", "status": "successful"},
	}))
	_, err := p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for invalid currency")
	}
}

func TestNormalizeTransferInvalidCurrency(t *testing.T) {
	p, _ := New("dummy_hash")
	parsed, _ := p.Parse(mustJSON(t, map[string]any{
		"event": "transfer.completed",
		"data":  map[string]any{"id": 1, "reference": "r", "amount": 1000, "currency": "BAD", "status": "successful"},
	}))
	_, err := p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for invalid currency")
	}
}

func TestNormalizeChargeMissingID(t *testing.T) {
	p, _ := New("dummy_hash")
	parsed, _ := p.Parse(mustJSON(t, map[string]any{
		"event": "charge.completed",
		"data":  map[string]any{"tx_ref": "r", "amount": 1000, "currency": "NGN", "status": "successful"},
	}))
	_, err := p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for missing id")
	}
}

func TestNormalizeTransferMissingID(t *testing.T) {
	p, _ := New("dummy_hash")
	parsed, _ := p.Parse(mustJSON(t, map[string]any{
		"event": "transfer.completed",
		"data":  map[string]any{"reference": "r", "amount": 1000, "currency": "NGN", "status": "successful"},
	}))
	_, err := p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for missing id")
	}
}

func TestNormalizeChargePending(t *testing.T) {
	p, _ := New("dummy_hash")
	body := loadFixture(t, "charge_pending.json")

	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	_, err = p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for unknown charge status")
	}
}

func TestNormalizeChargeSuccessEvent(t *testing.T) {
	p, _ := New("dummy_hash")
	body := loadFixture(t, "charge_success.json")

	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	event, err := p.Normalize(parsed)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}

	if event.Type != "charge.success" {
		t.Errorf("Type = %q, want %q", event.Type, "charge.success")
	}
	if event.Status != onceo.StatusSuccess {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusSuccess)
	}
	if event.AmountMinor != 25000 {
		t.Errorf("AmountMinor = %d, want %d", event.AmountMinor, 25000)
	}
}

func TestProcessFullFlow(t *testing.T) {
	secretHash := "flw_secret_hash"
	body := loadFixture(t, "charge_completed.json")
	headers := signedHeaders(secretHash, body)

	p, err := New(secretHash)
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}
	store := onceo.NewMemoryStore()

	event, err := onceo.Process(t.Context(), p, store, headers, body)
	if err != nil {
		t.Fatalf("Process failed: %v", err)
	}

	if event.Provider != "flutterwave" {
		t.Errorf("Provider = %q, want %q", event.Provider, "flutterwave")
	}
	if event.Reference != "flw_ref_abc123" {
		t.Errorf("Reference = %q, want %q", event.Reference, "flw_ref_abc123")
	}
}

func TestNormalizeTransferUnknownStatus(t *testing.T) {
	p, _ := New("dummy_hash")
	body := loadFixture(t, "transfer_unknown_status.json")

	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	_, err = p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for unknown transfer status")
	}
}

func TestProcessDuplicate(t *testing.T) {
	secretHash := "flw_secret_hash"
	body := loadFixture(t, "charge_completed.json")
	headers := signedHeaders(secretHash, body)

	p, err := New(secretHash)
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}
	store := onceo.NewMemoryStore()

	_, err = onceo.Process(t.Context(), p, store, headers, body)
	if err != nil {
		t.Fatalf("first Process failed: %v", err)
	}

	_, err = onceo.Process(t.Context(), p, store, headers, body)
	if !errors.Is(err, onceo.ErrDuplicateEvent) {
		t.Errorf("expected ErrDuplicateEvent, got %v", err)
	}
}

func FuzzParse(f *testing.F) {
	fixtures := []string{"charge_completed.json", "charge_failed.json", "charge_success.json", "transfer_completed.json", "transfer_failed.json"}
	for _, name := range fixtures {
		data, err := os.ReadFile("testdata/" + name)
		if err == nil {
			f.Add(data)
		}
	}
	f.Add([]byte(`{}`))
	f.Add([]byte(`{"event":""}`))
	f.Add([]byte(`not json`))

	p, _ := New("dummy_hash")

	f.Fuzz(func(t *testing.T, body []byte) {
		_, err := p.Parse(body)
		if err != nil && err != onceo.ErrMalformedPayload {
			t.Errorf("unexpected error: %v", err)
		}
	})
}
