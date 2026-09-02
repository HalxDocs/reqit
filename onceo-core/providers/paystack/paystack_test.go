package paystack

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"testing"

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

func signedHeaders(secret string, body []byte) http.Header {
	headers := http.Header{}
	headers.Set("X-Paystack-Signature", testutil.SignHMACSHA512([]byte(secret), body))
	return headers
}

func TestVerifySignature(t *testing.T) {
	secret := "sk_test_abc123"
	body := loadFixture(t, "charge_success.json")

	p, err := New(secret)
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
			headers: signedHeaders(secret, body),
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
		{
			name:    "tampered body",
			headers: signedHeaders(secret, body),
			body:    []byte(`{"event":"charge.failed"}`),
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

func TestNewEmptyKey(t *testing.T) {
	_, err := New("")
	if err == nil {
		t.Error("expected error for empty secret key")
	}
}

func TestParse(t *testing.T) {
	p, _ := New("sk_test_dummy")

	tests := []struct {
		name    string
		body    []byte
		wantErr bool
		wantEvt string
	}{
		{
			name:    "charge success",
			body:    loadFixture(t, "charge_success.json"),
			wantErr: false,
			wantEvt: "charge.success",
		},
		{
			name:    "charge failed",
			body:    loadFixture(t, "charge_failed.json"),
			wantErr: false,
			wantEvt: "charge.failed",
		},
		{
			name:    "transfer success",
			body:    loadFixture(t, "transfer_success.json"),
			wantErr: false,
			wantEvt: "transfer.success",
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
			wantEvt: "",
		},
		{
			name:    "empty body",
			body:    []byte{},
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

func TestNormalizeChargeSuccess(t *testing.T) {
	p, _ := New("dummy_key")
	body := loadFixture(t, "charge_success.json")

	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	event, err := p.Normalize(parsed)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}

	if event.Provider != "paystack" {
		t.Errorf("Provider = %q, want %q", event.Provider, "paystack")
	}
	if event.ProviderEventID != "123456789" {
		t.Errorf("ProviderEventID = %q, want %q", event.ProviderEventID, "123456789")
	}
	if event.Type != "charge.success" {
		t.Errorf("Type = %q, want %q", event.Type, "charge.success")
	}
	if event.Status != onceo.StatusSuccess {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusSuccess)
	}
	if event.AmountMinor != 50000 {
		t.Errorf("AmountMinor = %d, want %d", event.AmountMinor, 50000)
	}
	if event.Currency != "NGN" {
		t.Errorf("Currency = %q, want %q", event.Currency, "NGN")
	}
	if event.Reference != "ref_abc123" {
		t.Errorf("Reference = %q, want %q", event.Reference, "ref_abc123")
	}
}

func TestNormalizeChargeFailed(t *testing.T) {
	p, _ := New("dummy_key")
	body := loadFixture(t, "charge_failed.json")

	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	event, err := p.Normalize(parsed)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}

	if event.Status != onceo.StatusFailed {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusFailed)
	}
	if event.ProviderEventID != "123456790" {
		t.Errorf("ProviderEventID = %q, want %q", event.ProviderEventID, "123456790")
	}
	if event.AmountMinor != 25000 {
		t.Errorf("AmountMinor = %d, want %d", event.AmountMinor, 25000)
	}
}

func TestNormalizeTransferSuccess(t *testing.T) {
	p, _ := New("dummy_key")
	body := loadFixture(t, "transfer_success.json")

	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	event, err := p.Normalize(parsed)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}

	if event.Type != "transfer.success" {
		t.Errorf("Type = %q, want %q", event.Type, "transfer.success")
	}
	if event.ProviderEventID != "987654321" {
		t.Errorf("ProviderEventID = %q, want %q", event.ProviderEventID, "987654321")
	}
	if event.Status != onceo.StatusSuccess {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusSuccess)
	}
	if event.AmountMinor != 100000 {
		t.Errorf("AmountMinor = %d, want %d", event.AmountMinor, 100000)
	}
}

func TestNormalizeTransferFailed(t *testing.T) {
	p, _ := New("dummy_key")
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

func TestNormalizeUnknownEvent(t *testing.T) {
	raw := struct {
		Event string          `json:"event"`
		Data  json.RawMessage `json:"data"`
	}{
		Event: "unknown.event",
		Data:  json.RawMessage(`{}`),
	}

	body, _ := json.Marshal(raw)
	p, _ := New("dummy_key")
	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	_, err = p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for unknown event type")
	}
}

func TestNormalizeInvalidCurrency(t *testing.T) {
	raw := struct {
		Event string          `json:"event"`
		Data  json.RawMessage `json:"data"`
	}{
		Event: "charge.success",
		Data:  json.RawMessage(`{"id":1,"status":"success","reference":"r","amount":1000,"currency":"NGNx"}`),
	}

	body, _ := json.Marshal(raw)
	p, _ := New("dummy_key")
	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	_, err = p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for invalid currency")
	}
}

func TestNormalizeChargeSuccessMissingID(t *testing.T) {
	p, _ := New("dummy_key")
	parsed, _ := p.Parse(mustJSON(t, map[string]any{
		"event": "charge.success",
		"data":  map[string]any{"status": "success", "reference": "r", "amount": 1000, "currency": "NGN"},
	}))
	_, err := p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for missing id")
	}
}

func TestNormalizeChargeFailedMissingID(t *testing.T) {
	p, _ := New("dummy_key")
	parsed, _ := p.Parse(mustJSON(t, map[string]any{
		"event": "charge.failed",
		"data":  map[string]any{"status": "failed", "reference": "r", "amount": 1000, "currency": "NGN"},
	}))
	_, err := p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for missing id")
	}
}

func TestNormalizeTransferSuccessMissingID(t *testing.T) {
	p, _ := New("dummy_key")
	parsed, _ := p.Parse(mustJSON(t, map[string]any{
		"event": "transfer.success",
		"data":  map[string]any{"status": "success", "reference": "r", "amount": 1000, "currency": "NGN"},
	}))
	_, err := p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for missing id")
	}
}

func TestNormalizeTransferFailedMissingID(t *testing.T) {
	p, _ := New("dummy_key")
	parsed, _ := p.Parse(mustJSON(t, map[string]any{
		"event": "transfer.failed",
		"data":  map[string]any{"status": "failed", "reference": "r", "amount": 1000, "currency": "NGN"},
	}))
	_, err := p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for missing id")
	}
}

func TestNormalizeChargeSuccessReversed(t *testing.T) {
	p, _ := New("dummy_key")
	parsed, _ := p.Parse(mustJSON(t, map[string]any{
		"event": "charge.success",
		"data":  map[string]any{"id": 1, "status": "reversed", "reference": "r", "amount": 1000, "currency": "NGN"},
	}))
	event, err := p.Normalize(parsed)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Status != onceo.StatusReversed {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusReversed)
	}
}

func TestNormalizeChargeSuccessMapStatusFailed(t *testing.T) {
	p, _ := New("dummy_key")
	parsed, _ := p.Parse(mustJSON(t, map[string]any{
		"event": "charge.success",
		"data":  map[string]any{"id": 1, "status": "failed", "reference": "r", "amount": 1000, "currency": "NGN"},
	}))
	event, err := p.Normalize(parsed)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Status != onceo.StatusFailed {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusFailed)
	}
}

func TestNormalizeChargeSuccessPendingStatus(t *testing.T) {
	p, _ := New("dummy_key")
	parsed, _ := p.Parse(mustJSON(t, map[string]any{
		"event": "charge.success",
		"data":  map[string]any{"id": 1, "status": "unknown", "reference": "r", "amount": 1000, "currency": "NGN"},
	}))
	_, err := p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for unknown Paystack status")
	}
}

func TestNormalizeChargeFailedInvalidCurrency(t *testing.T) {
	p, _ := New("dummy_key")
	parsed, _ := p.Parse(mustJSON(t, map[string]any{
		"event": "charge.failed",
		"data":  map[string]any{"id": 1, "status": "failed", "reference": "r", "amount": 1000, "currency": "NGNx"},
	}))
	_, err := p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for invalid currency")
	}
}

func TestNormalizeTransferSuccessUnknownStatus(t *testing.T) {
	p, _ := New("dummy_key")
	parsed, _ := p.Parse(mustJSON(t, map[string]any{
		"event": "transfer.success",
		"data":  map[string]any{"id": 1, "status": "unknown", "reference": "r", "amount": 1000, "currency": "NGN"},
	}))
	_, err := p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for unknown transfer status")
	}
}

func TestNormalizeTransferSuccessInvalidCurrency(t *testing.T) {
	p, _ := New("dummy_key")
	parsed, _ := p.Parse(mustJSON(t, map[string]any{
		"event": "transfer.success",
		"data":  map[string]any{"id": 1, "status": "success", "reference": "r", "amount": 1000, "currency": "NGNx"},
	}))
	_, err := p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for invalid currency")
	}
}

func TestNormalizeTransferFailedInvalidCurrency(t *testing.T) {
	p, _ := New("dummy_key")
	parsed, _ := p.Parse(mustJSON(t, map[string]any{
		"event": "transfer.failed",
		"data":  map[string]any{"id": 1, "status": "failed", "reference": "r", "amount": 1000, "currency": "NGNx"},
	}))
	_, err := p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for invalid currency")
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

func TestProcessFullFlow(t *testing.T) {
	secret := "sk_test_abc123"
	body := loadFixture(t, "charge_success.json")
	headers := signedHeaders(secret, body)

	p, err := New(secret)
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}
	store := onceo.NewMemoryStore()

	event, err := onceo.Process(t.Context(), p, store, headers, body)
	if err != nil {
		t.Fatalf("Process failed: %v", err)
	}

	if event.Provider != "paystack" {
		t.Errorf("Provider = %q, want %q", event.Provider, "paystack")
	}
	if event.Reference != "ref_abc123" {
		t.Errorf("Reference = %q, want %q", event.Reference, "ref_abc123")
	}
}

func TestProcessDuplicate(t *testing.T) {
	secret := "sk_test_abc123"
	body := loadFixture(t, "charge_success.json")
	headers := signedHeaders(secret, body)

	p, err := New(secret)
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
	fixtures := []string{"charge_success.json", "charge_failed.json", "transfer_success.json", "transfer_failed.json"}
	for _, name := range fixtures {
		data, err := os.ReadFile("testdata/" + name)
		if err == nil {
			f.Add(data)
		}
	}
	f.Add([]byte(`{}`))
	f.Add([]byte(`{"event":""}`))
	f.Add([]byte(`not json`))
	f.Add([]byte(`{"event":"charge.success","data":{"id":"abc"}}`))

	p, _ := New("dummy_key")

	f.Fuzz(func(t *testing.T, body []byte) {
		_, err := p.Parse(body)
		if err != nil && err != onceo.ErrMalformedPayload {
			t.Errorf("unexpected error: %v", err)
		}
	})
}
