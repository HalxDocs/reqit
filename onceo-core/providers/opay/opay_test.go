package opay

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
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

func signedHeaders(secret string, body []byte) http.Header {
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write(body)
	sig := hex.EncodeToString(mac.Sum(nil))

	headers := http.Header{}
	headers.Set("Authorization", sig)
	return headers
}

func TestVerifySignatureWithOpaySignature(t *testing.T) {
	secret := "opay_secret_key_123"
	body := loadFixture(t, "payment_successful.json")

	p, err := New(secret)
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}

	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write(body)
	sig := hex.EncodeToString(mac.Sum(nil))

	headers := http.Header{}
	headers.Set("Opay-Signature", sig)

	err = p.VerifySignature(headers, body)
	if err != nil {
		t.Fatalf("VerifySignature failed with Opay-Signature: %v", err)
	}
}

func TestVerifySignatureDuplicateAuthorization(t *testing.T) {
	secret := "opay_secret_key_123"
	body := loadFixture(t, "payment_successful.json")

	p, err := New(secret)
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}

	headers := http.Header{}
	headers.Add("Authorization", "sig1")
	headers.Add("Authorization", "sig2")

	err = p.VerifySignature(headers, body)
	if err == nil {
		t.Fatal("expected error for duplicate Authorization headers")
	}
}

func TestVerifySignature(t *testing.T) {
	secret := "opay_secret_key_123"
	body := loadFixture(t, "payment_successful.json")

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

func TestParse(t *testing.T) {
	p, _ := New("dummy_key")

	tests := []struct {
		name    string
		body    []byte
		wantErr bool
		wantEvt string
	}{
		{
			name:    "payment successful",
			body:    loadFixture(t, "payment_successful.json"),
			wantErr: false,
			wantEvt: "PAYMENT_SUCCESSFUL",
		},
		{
			name:    "payment failed",
			body:    loadFixture(t, "payment_failed.json"),
			wantErr: false,
			wantEvt: "PAYMENT_FAILED",
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
			if !tt.wantErr && got.EventType != tt.wantEvt {
				t.Errorf("Parse() event = %q, want %q", got.EventType, tt.wantEvt)
			}
		})
	}
}

func TestNormalizePaymentSuccessful(t *testing.T) {
	p, _ := New("dummy_key")
	body := loadFixture(t, "payment_successful.json")

	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	event, err := p.Normalize(parsed)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}

	if event.Provider != "opay" {
		t.Errorf("Provider = %q, want %q", event.Provider, "opay")
	}
	if event.ProviderEventID != "ORDER_12345" {
		t.Errorf("ProviderEventID = %q, want %q", event.ProviderEventID, "ORDER_12345")
	}
	if event.Type != "PAYMENT_SUCCESSFUL" {
		t.Errorf("Type = %q, want %q", event.Type, "PAYMENT_SUCCESSFUL")
	}
	if event.Status != onceo.StatusSuccess {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusSuccess)
	}
	if event.AmountMinor != 45000 {
		t.Errorf("AmountMinor = %d, want %d", event.AmountMinor, 45000)
	}
	if event.Currency != "NGN" {
		t.Errorf("Currency = %q, want %q", event.Currency, "NGN")
	}
	if event.Reference != "opay_ref_001" {
		t.Errorf("Reference = %q, want %q", event.Reference, "opay_ref_001")
	}
}

func TestNormalizeRefundSuccessful(t *testing.T) {
	p, _ := New("dummy_key")
	body, _ := json.Marshal(struct {
		EventType string          `json:"eventType"`
		Data      json.RawMessage `json:"data"`
	}{
		EventType: "REFUND_SUCCESSFUL",
		Data:      json.RawMessage(`{"reference":"r","amount":"50.00","currency":"NGN","status":"SUCCESS","orderNo":"o_refund"}`),
	})

	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	event, err := p.Normalize(parsed)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Status != onceo.StatusReversed {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusReversed)
	}
	if event.AmountMinor != 5000 {
		t.Errorf("AmountMinor = %d, want %d", event.AmountMinor, 5000)
	}
}

func TestNormalizePaymentFailed(t *testing.T) {
	p, _ := New("dummy_key")
	body := loadFixture(t, "payment_failed.json")

	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	event, err := p.Normalize(parsed)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}

	if event.Type != "PAYMENT_FAILED" {
		t.Errorf("Type = %q, want %q", event.Type, "PAYMENT_FAILED")
	}
	if event.Status != onceo.StatusFailed {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusFailed)
	}
}

func TestNormalizeUnknownEvent(t *testing.T) {
	raw := struct {
		EventType string          `json:"eventType"`
		Data      json.RawMessage `json:"data"`
	}{
		EventType: "UNKNOWN_EVENT",
		Data:      json.RawMessage(`{}`),
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

func TestProviderName(t *testing.T) {
	p, _ := New("dummy_key")
	if name := p.Name(); name != "opay" {
		t.Errorf("Name() = %q, want %q", name, "opay")
	}
}

func TestNormalizeInvalidCurrency(t *testing.T) {
	raw := struct {
		EventType string          `json:"eventType"`
		Data      json.RawMessage `json:"data"`
	}{
		EventType: "PAYMENT_SUCCESSFUL",
		Data:      json.RawMessage(`{"reference":"r","amount":"100.00","currency":"XYZ","status":"SUCCESS","orderNo":"o123"}`),
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

func TestNormalizeEmptyOrderNo(t *testing.T) {
	raw := struct {
		EventType string          `json:"eventType"`
		Data      json.RawMessage `json:"data"`
	}{
		EventType: "PAYMENT_SUCCESSFUL",
		Data:      json.RawMessage(`{"reference":"r","amount":"100.00","currency":"NGN","status":"SUCCESS","orderNo":""}`),
	}

	body, _ := json.Marshal(raw)
	p, _ := New("dummy_key")
	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	_, err = p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for empty orderNo")
	}
}

func TestNormalizeInvalidAmount(t *testing.T) {
	raw := struct {
		EventType string          `json:"eventType"`
		Data      json.RawMessage `json:"data"`
	}{
		EventType: "PAYMENT_SUCCESSFUL",
		Data:      json.RawMessage(`{"reference":"r","amount":"not_a_number","currency":"NGN","status":"SUCCESS","orderNo":"o"}`),
	}

	body, _ := json.Marshal(raw)
	p, _ := New("dummy_key")
	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	_, err = p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for invalid amount")
	}
}

func TestParseOpayEmptyAmount(t *testing.T) {
	_, err := parseOpayAmount("")
	if err == nil {
		t.Fatal("expected error for empty amount")
	}
}

func TestParseOpayLeadingDecimal(t *testing.T) {
	got, err := parseOpayAmount(".50")
	if err != nil {
		t.Fatalf("parseOpayAmount failed: %v", err)
	}
	if got != 50 {
		t.Errorf("got %d, want 50", got)
	}
}

func TestParseOpayTooManyDecimals(t *testing.T) {
	_, err := parseOpayAmount("100.123")
	if err == nil {
		t.Fatal("expected error for too many decimal places")
	}
}

func TestParseOpayNonDigitFraction(t *testing.T) {
	_, err := parseOpayAmount("100.5a")
	if err == nil {
		t.Fatal("expected error for non-digit in fraction")
	}
}

func TestParseOpayNegativeAmount(t *testing.T) {
	_, err := parseOpayAmount("-100.00")
	if err == nil {
		t.Fatal("expected error for negative amount")
	}
}

func TestParseOpayOverflowWhole(t *testing.T) {
	_, err := parseOpayAmount("92233720368547759.00")
	if err == nil {
		t.Fatal("expected error for overflow amount")
	}
}

func TestParseOpayOverflowFrac(t *testing.T) {
	_, err := parseOpayAmount("92233720368547758.50")
	if err == nil {
		t.Fatal("expected error for overflow amount with fraction")
	}
}

func TestNewEmptyKey(t *testing.T) {
	_, err := New("")
	if err == nil {
		t.Error("expected error for empty secret key")
	}
}

func TestProcessFullFlow(t *testing.T) {
	secret := "opay_secret_key_123"
	body := loadFixture(t, "payment_successful.json")
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

	if event.Provider != "opay" {
		t.Errorf("Provider = %q, want %q", event.Provider, "opay")
	}
	if event.Reference != "opay_ref_001" {
		t.Errorf("Reference = %q, want %q", event.Reference, "opay_ref_001")
	}
}

func FuzzParse(f *testing.F) {
	fixtures := []string{"payment_successful.json", "payment_failed.json"}
	for _, name := range fixtures {
		data, err := os.ReadFile("testdata/" + name)
		if err == nil {
			f.Add(data)
		}
	}
	f.Add([]byte(`{}`))
	f.Add([]byte(`{"event_type":""}`))
	f.Add([]byte(`not json`))
	f.Add([]byte(`{"event_type":"PAYMENT_SUCCESSFUL","data":{}}`))

	p, _ := New("dummy_key")

	f.Fuzz(func(t *testing.T, body []byte) {
		_, err := p.Parse(body)
		if err != nil && err != onceo.ErrMalformedPayload {
			t.Errorf("unexpected error: %v", err)
		}
	})
}
