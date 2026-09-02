package bachs

import (
	"errors"
	"net/http"
	"os"
	"strconv"
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

func nowHeaders(secret string, body []byte) http.Header {
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	headers := http.Header{}
	headers.Set(headerTimestamp, ts)
	headers.Set(headerSignature, testutil.SignBachs(secret, ts, body))
	return headers
}

func TestNewEmptySecret(t *testing.T) {
	if _, err := New(""); err == nil {
		t.Fatal("expected error for empty signing secret")
	}
}

func TestProviderName(t *testing.T) {
	p, _ := New("secret")
	if got := p.Name(); got != "bachs" {
		t.Errorf("Name() = %q, want %q", got, "bachs")
	}
}

func TestBodyBound(t *testing.T) {
	p, _ := New("secret")
	if !p.BodyBound() {
		t.Fatal("BodyBound() should be true: signature covers the body")
	}
}

func TestVerifySignatureValid(t *testing.T) {
	secret := "whsec_test_secret"
	body := loadFixture(t, "collection_succeeded.json")
	p, err := New(secret)
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}

	headers := nowHeaders(secret, body)
	if err := p.VerifySignature(headers, body); err != nil {
		t.Fatalf("VerifySignature failed: %v", err)
	}
}

func TestVerifySignatureMissingHeaders(t *testing.T) {
	secret := "whsec_test_secret"
	body := loadFixture(t, "collection_succeeded.json")
	p, _ := New(secret)

	tests := []struct {
		name    string
		headers http.Header
		wantErr error
	}{
		{"missing timestamp", http.Header{headerSignature: []string{"abc"}}, onceo.ErrMissingHeader},
		{"missing signature", http.Header{headerTimestamp: []string{strconv.FormatInt(time.Now().Unix(), 10)}}, onceo.ErrMissingHeader},
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

func TestVerifySignatureDuplicateTimestamp(t *testing.T) {
	secret := "whsec_test_secret"
	body := loadFixture(t, "collection_succeeded.json")
	p, _ := New(secret)
	headers := nowHeaders(secret, body)
	headers.Add(headerTimestamp, strconv.FormatInt(time.Now().Unix(), 10))
	if err := p.VerifySignature(headers, body); !errors.Is(err, onceo.ErrDuplicateHeader) {
		t.Errorf("got %v, want %v", err, onceo.ErrDuplicateHeader)
	}
}

func TestVerifySignatureTamperedBody(t *testing.T) {
	secret := "whsec_test_secret"
	body := loadFixture(t, "collection_succeeded.json")
	p, _ := New(secret)

	tampered := append(append([]byte{}, body[:len(body)-1]...), 'x')
	err := p.VerifySignature(nowHeaders(secret, body), tampered)
	if !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("got %v, want %v", err, onceo.ErrInvalidSignature)
	}
}

func TestVerifySignatureWrongSecret(t *testing.T) {
	secret := "whsec_test_secret"
	body := loadFixture(t, "collection_succeeded.json")
	p, _ := New("whsec_wrong_secret")
	if err := p.VerifySignature(nowHeaders(secret, body), body); !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("got %v, want %v", err, onceo.ErrInvalidSignature)
	}
}

func TestVerifySignatureExpiredTimestamp(t *testing.T) {
	secret := "whsec_test_secret"
	body := loadFixture(t, "collection_succeeded.json")
	p, _ := New(secret)

	old := strconv.FormatInt(time.Now().Unix()-int64((DefaultTolerance+time.Minute).Seconds()), 10)
	headers := http.Header{}
	headers.Set(headerTimestamp, old)
	headers.Set(headerSignature, testutil.SignBachs(secret, old, body))

	if err := p.VerifySignature(headers, body); !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("got %v, want %v", err, onceo.ErrInvalidSignature)
	}
}

func TestVerifySignatureFutureTimestamp(t *testing.T) {
	secret := "whsec_test_secret"
	body := loadFixture(t, "collection_succeeded.json")
	p, _ := New(secret)

	future := strconv.FormatInt(time.Now().Add(DefaultTolerance+time.Minute).Unix(), 10)
	headers := http.Header{}
	headers.Set(headerTimestamp, future)
	headers.Set(headerSignature, testutil.SignBachs(secret, future, body))

	if err := p.VerifySignature(headers, body); !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("got %v, want %v", err, onceo.ErrInvalidSignature)
	}
}

func TestVerifySignatureNonNumericTimestamp(t *testing.T) {
	secret := "whsec_test_secret"
	body := loadFixture(t, "collection_succeeded.json")
	p, _ := New(secret)
	headers := http.Header{}
	headers.Set(headerTimestamp, "not_a_timestamp")
	headers.Set(headerSignature, "abc123")
	if err := p.VerifySignature(headers, body); !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("got %v, want %v", err, onceo.ErrInvalidSignature)
	}
}

func TestVerifySignatureMalformedSignatureValue(t *testing.T) {
	secret := "whsec_test_secret"
	body := loadFixture(t, "collection_succeeded.json")
	p, _ := New(secret)
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	headers := http.Header{}
	headers.Set(headerTimestamp, ts)
	headers.Set(headerSignature, "not-hex!")
	if err := p.VerifySignature(headers, body); !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("got %v, want %v", err, onceo.ErrInvalidSignature)
	}
}

func TestWithTolerance(t *testing.T) {
	secret := "whsec_test_secret"
	body := loadFixture(t, "collection_succeeded.json")

	tolerant, err := New(secret, WithTolerance(10*time.Minute))
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}

	expiredID := strconv.FormatInt(time.Now().Add(-8*time.Minute).Unix(), 10)
	headers := http.Header{}
	headers.Set(headerTimestamp, expiredID)
	headers.Set(headerSignature, testutil.SignBachs(secret, expiredID, body))

	if err := tolerant.VerifySignature(headers, body); err != nil {
		t.Errorf("8-minute-old message failed with 10-minute tolerance: %v", err)
	}

	strict, _ := New(secret)
	if err := strict.VerifySignature(headers, body); !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("8-minute-old message should fail with default 5-minute tolerance, got %v", err)
	}
}

func TestMapEventStatus(t *testing.T) {
	// Every event type documented at docs.bachs.io/guides/webhooks/overview.
	tests := []struct {
		eventType string
		want      onceo.Status
	}{
		{"checkout.completed", onceo.StatusSuccess},
		{"checkout.expired", onceo.StatusPending},
		{"collection.succeeded", onceo.StatusSuccess},
		{"collection.failed", onceo.StatusFailed},
		{"collection.underpaid", onceo.StatusPending},
		{"customer.subscription.created", onceo.StatusPending},
		{"customer.subscription.updated", onceo.StatusPending},
		{"customer.subscription.deleted", onceo.StatusPending},
		{"invoice.created", onceo.StatusPending},
		{"invoice.paid", onceo.StatusSuccess},
		{"invoice.payment_failed", onceo.StatusFailed},
		{"payout.created", onceo.StatusPending},
		{"payout.paid", onceo.StatusSuccess},
		{"payout.failed", onceo.StatusFailed},
		{"refund.created", onceo.StatusPending},
		{"refund.paid", onceo.StatusReversed},
		{"refund.failed", onceo.StatusFailed},
		{"dispute.created", onceo.StatusPending},
		{"dispute.updated", onceo.StatusPending},
		{"conversion.completed", onceo.StatusSuccess},
		{"conversion.failed", onceo.StatusFailed},
		{"customer.created", onceo.StatusPending},
		{"customer.updated", onceo.StatusPending},
		{"account.updated", onceo.StatusPending},
		{"capability.updated", onceo.StatusPending},
		{"transfer.created", onceo.StatusPending},
	}
	for _, tt := range tests {
		t.Run(tt.eventType, func(t *testing.T) {
			if got := mapEventStatus(tt.eventType); got != tt.want {
				t.Errorf("mapEventStatus(%q) = %v, want %v", tt.eventType, got, tt.want)
			}
		})
	}
}

func TestParseConnectEnvelope(t *testing.T) {
	p, _ := New("secret")
	body := loadFixture(t, "transfer_created.json")
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	if payload.Account != "org_4d81fa9c2b6e0357" {
		t.Errorf("Account = %q, want connected account id", payload.Account)
	}
}

func TestParseCollectionSucceeded(t *testing.T) {
	p, _ := New("secret")
	body := loadFixture(t, "collection_succeeded.json")
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	if payload.ID != "evt_3ab4e0d5d27445cf8a52ab3d8cb8f0b1" {
		t.Errorf("ID = %q", payload.ID)
	}
	if payload.Type != "collection.succeeded" {
		t.Errorf("Type = %q", payload.Type)
	}
}

func TestParseMalformed(t *testing.T) {
	p, _ := New("secret")
	tests := [][]byte{
		[]byte("not json"),
		[]byte(`{"type":"collection.succeeded"}`), // missing id
		[]byte(`{"id":"evt_1"}`),                  // missing type
		[]byte(`{}`),
	}
	for _, body := range tests {
		if _, err := p.Parse(body); !errors.Is(err, onceo.ErrMalformedPayload) {
			t.Errorf("Parse(%s) got %v, want %v", string(body), err, onceo.ErrMalformedPayload)
		}
	}
}

func TestNormalizeCollectionSucceeded(t *testing.T) {
	p, _ := New("secret")
	body := loadFixture(t, "collection_succeeded.json")
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	event, err := p.Normalize(payload)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Provider != "bachs" {
		t.Errorf("Provider = %q, want %q", event.Provider, "bachs")
	}
	if event.ProviderEventID != "evt_3ab4e0d5d27445cf8a52ab3d8cb8f0b1" {
		t.Errorf("ProviderEventID = %q", event.ProviderEventID)
	}
	if event.Type != "collection.succeeded" {
		t.Errorf("Type = %q", event.Type)
	}
	if event.Status != onceo.StatusSuccess {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusSuccess)
	}
	if event.AmountMinor != 7500000 {
		t.Errorf("AmountMinor = %d, want 7500000", event.AmountMinor)
	}
	if event.Currency != "NGN" {
		t.Errorf("Currency = %q, want NGN", event.Currency)
	}
	if event.Reference != "pay_abc123def456" {
		t.Errorf("Reference = %q", event.Reference)
	}
}

func TestNormalizeInvoicePaid(t *testing.T) {
	p, _ := New("secret")
	body := loadFixture(t, "invoice_paid.json")
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	event, err := p.Normalize(payload)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Status != onceo.StatusSuccess {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusSuccess)
	}
	if event.AmountMinor != 250000 {
		t.Errorf("AmountMinor = %d, want 250000", event.AmountMinor)
	}
	if event.Currency != "KES" {
		t.Errorf("Currency = %q, want KES", event.Currency)
	}
}

func TestNormalizeCustomerUpdated(t *testing.T) {
	// Events without monetary data must still normalize successfully.
	p, _ := New("secret")
	body := loadFixture(t, "customer_updated.json")
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	event, err := p.Normalize(payload)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Type != "customer.updated" {
		t.Errorf("Type = %q", event.Type)
	}
	if event.Status != onceo.StatusPending {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusPending)
	}
	if event.AmountMinor != 0 {
		t.Errorf("AmountMinor = %d, want 0", event.AmountMinor)
	}
	if event.Currency != "" {
		t.Errorf("Currency = %q, want empty", event.Currency)
	}
}

func TestNormalizeInvalidCurrency(t *testing.T) {
	p, _ := New("secret")
	body := []byte(`{"id":"evt_1","type":"collection.succeeded","data":{"currency":"XYZ","amount":"100.00"}}`)
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	if _, err := p.Normalize(payload); err == nil {
		t.Error("expected error for unsupported currency")
	}
}

func TestNormalizeNegativeAmount(t *testing.T) {
	p, _ := New("secret")
	body := []byte(`{"id":"evt_1","type":"collection.succeeded","data":{"currency":"NGN","amount":"-5.00"}}`)
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	if _, err := p.Normalize(payload); err == nil {
		t.Error("expected error for negative amount")
	}
}

func TestNormalizeTooManyDecimals(t *testing.T) {
	p, _ := New("secret")
	body := []byte(`{"id":"evt_1","type":"collection.succeeded","data":{"currency":"NGN","amount":"10.123"}}`)
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	if _, err := p.Normalize(payload); err == nil {
		t.Error("expected error for more than 2 decimal places")
	}
}

func TestParseMinorUnits(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  int64
		err   bool
	}{
		{"string whole", `"1500"`, 150000, false},
		{"string decimal", `"12.50"`, 1250, false},
		{"string one decimal", `"12.5"`, 1250, false},
		{"string leading decimal", `".5"`, 50, false},
		{"string zero", `"0.00"`, 0, false},
		{"json number", `1500`, 150000, false},
		{"json number decimal", `19.99`, 1999, false},
		{"null", `null`, 0, false},
		{"empty", ``, 0, false},
		{"negative string", `"-100"`, 0, true},
		{"negative float", `-1.5`, 0, true},
		{"too many decimals", `"1.123"`, 0, true},
		{"non numeric", `"abc"`, 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseMinorUnits([]byte(tt.input))
			if (err != nil) != tt.err {
				t.Errorf("parseMinorUnits(%s) error = %v, wantErr %v", tt.input, err, tt.err)
				return
			}
			if got != tt.want {
				t.Errorf("parseMinorUnits(%s) = %d, want %d", tt.input, got, tt.want)
			}
		})
	}
}

func TestNormalizeCollectionUnderpaid(t *testing.T) {
	p, _ := New("secret")
	body := loadFixture(t, "collection_underpaid.json")
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	event, err := p.Normalize(payload)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Status != onceo.StatusPending {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusPending)
	}
	// The canonical amount is what actually arrived: amount_paid.
	if event.AmountMinor != 5000000 {
		t.Errorf("AmountMinor = %d, want 5000000", event.AmountMinor)
	}
	if event.Currency != "NGN" {
		t.Errorf("Currency = %q, want NGN", event.Currency)
	}
	if event.Reference != "pay_abc123def456" {
		t.Errorf("Reference = %q", event.Reference)
	}
}

func TestNormalizeCheckoutCompleted(t *testing.T) {
	p, _ := New("secret")
	body := loadFixture(t, "checkout_completed.json")
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	event, err := p.Normalize(payload)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Status != onceo.StatusSuccess {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusSuccess)
	}
	if event.AmountMinor != 1900 {
		t.Errorf("AmountMinor = %d, want 1900", event.AmountMinor)
	}
	if event.Currency != "USD" {
		t.Errorf("Currency = %q, want USD", event.Currency)
	}
	if event.Reference != "pay_abc123def456" {
		t.Errorf("Reference = %q", event.Reference)
	}
}

func TestNormalizeConversionCompleted(t *testing.T) {
	p, _ := New("secret")
	body := loadFixture(t, "conversion_completed.json")
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	event, err := p.Normalize(payload)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Status != onceo.StatusSuccess {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusSuccess)
	}
	// The conversion result: to_amount in to_currency.
	if event.AmountMinor != 16500000 {
		t.Errorf("AmountMinor = %d, want 16500000", event.AmountMinor)
	}
	if event.Currency != "NGN" {
		t.Errorf("Currency = %q, want NGN", event.Currency)
	}
}

func TestNormalizeConversionFailed(t *testing.T) {
	p, _ := New("secret")
	body := []byte(`{"id":"evt_2","type":"conversion.failed","data":{"from_currency":"USD","to_currency":"NGN","from_amount":"100.00","to_amount":"0.00","status":"failed"}}`)
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	event, err := p.Normalize(payload)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Status != onceo.StatusFailed {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusFailed)
	}
	if event.Currency != "NGN" {
		t.Errorf("Currency = %q, want NGN", event.Currency)
	}
}

func TestNormalizeRefundPaid(t *testing.T) {
	p, _ := New("secret")
	body := loadFixture(t, "refund_paid.json")
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	event, err := p.Normalize(payload)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Status != onceo.StatusReversed {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusReversed)
	}
	if event.AmountMinor != 1000 {
		t.Errorf("AmountMinor = %d, want 1000", event.AmountMinor)
	}
	// Bachs refund payloads carry no currency.
	if event.Currency != "" {
		t.Errorf("Currency = %q, want empty", event.Currency)
	}
	if event.Reference != "refund_9876" {
		t.Errorf("Reference = %q", event.Reference)
	}
}

func TestNormalizeRefundCreated(t *testing.T) {
	p, _ := New("secret")
	body := []byte(`{"id":"evt_3","type":"refund.created","data":{"refund_id":"ref_1","charge_id":"chr_1","status":"processing","requested_amount":"10.00","refunded_amount":"0.00"}}`)
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	event, err := p.Normalize(payload)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Status != onceo.StatusPending {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusPending)
	}
	if event.AmountMinor != 0 {
		t.Errorf("AmountMinor = %d, want 0", event.AmountMinor)
	}
}

func TestNormalizeTransferCreated(t *testing.T) {
	p, _ := New("secret")
	body := loadFixture(t, "transfer_created.json")
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	event, err := p.Normalize(payload)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Status != onceo.StatusPending {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusPending)
	}
	if event.AmountMinor != 700000 {
		t.Errorf("AmountMinor = %d, want 700000", event.AmountMinor)
	}
	if event.Currency != "NGN" {
		t.Errorf("Currency = %q, want NGN", event.Currency)
	}
}

func TestNormalizeCapabilityUpdated(t *testing.T) {
	p, _ := New("secret")
	body := loadFixture(t, "capability_updated.json")
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	event, err := p.Normalize(payload)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Status != onceo.StatusPending {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusPending)
	}
	if event.AmountMinor != 0 {
		t.Errorf("AmountMinor = %d, want 0", event.AmountMinor)
	}
	if event.Currency != "" {
		t.Errorf("Currency = %q, want empty", event.Currency)
	}
}

func TestNormalizeInvoicePaymentFailed(t *testing.T) {
	p, _ := New("secret")
	body := loadFixture(t, "invoice_payment_failed.json")
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	event, err := p.Normalize(payload)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Status != onceo.StatusFailed {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusFailed)
	}
	if event.AmountMinor != 0 {
		t.Errorf("AmountMinor = %d, want 0 (nothing collected)", event.AmountMinor)
	}
	if event.Currency != "USD" {
		t.Errorf("Currency = %q, want USD", event.Currency)
	}
}

func TestNormalizeDisputeCreated(t *testing.T) {
	p, _ := New("secret")
	body := loadFixture(t, "dispute_created.json")
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	event, err := p.Normalize(payload)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Status != onceo.StatusPending {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusPending)
	}
	if event.AmountMinor != 7500000 {
		t.Errorf("AmountMinor = %d, want 7500000", event.AmountMinor)
	}
	if event.Currency != "NGN" {
		t.Errorf("Currency = %q, want NGN", event.Currency)
	}
}

func TestNormalizePayoutPaid(t *testing.T) {
	p, _ := New("secret")
	body := loadFixture(t, "payout_paid.json")
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	event, err := p.Normalize(payload)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Status != onceo.StatusSuccess {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusSuccess)
	}
	if event.AmountMinor != 50000 {
		t.Errorf("AmountMinor = %d, want 50000", event.AmountMinor)
	}
	if event.Currency != "USD" {
		t.Errorf("Currency = %q, want USD", event.Currency)
	}
	if event.Reference != "payout_9876" {
		t.Errorf("Reference = %q", event.Reference)
	}
}

func TestNormalizeCustomerSubscriptionCreated(t *testing.T) {
	p, _ := New("secret")
	body := loadFixture(t, "customer_subscription_created.json")
	payload, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	event, err := p.Normalize(payload)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}
	if event.Status != onceo.StatusPending {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusPending)
	}
	if event.AmountMinor != 1000 {
		t.Errorf("AmountMinor = %d, want 1000", event.AmountMinor)
	}
	if event.Currency != "USD" {
		t.Errorf("Currency = %q, want USD", event.Currency)
	}
}

func TestProcessFullFlow(t *testing.T) {
	secret := "whsec_test_secret"
	body := loadFixture(t, "collection_succeeded.json")
	headers := nowHeaders(secret, body)

	p, _ := New(secret)
	store := onceo.NewMemoryStore()

	event, err := onceo.Process(t.Context(), p, store, headers, body)
	if err != nil {
		t.Fatalf("Process failed: %v", err)
	}
	if event.Provider != "bachs" {
		t.Errorf("Provider = %q, want %q", event.Provider, "bachs")
	}
	if event.ProviderEventID != "evt_3ab4e0d5d27445cf8a52ab3d8cb8f0b1" {
		t.Errorf("ProviderEventID = %q", event.ProviderEventID)
	}
	if event.Type != "collection.succeeded" {
		t.Errorf("Type = %q", event.Type)
	}
	if event.ReceivedAt.IsZero() {
		t.Error("ReceivedAt must be set")
	}
}

func TestProcessDedup(t *testing.T) {
	secret := "whsec_test_secret"
	body := loadFixture(t, "collection_succeeded.json")
	p, _ := New(secret)
	store := onceo.NewMemoryStore()
	headers := nowHeaders(secret, body)

	if _, err := onceo.Process(t.Context(), p, store, headers, body); err != nil {
		t.Fatalf("first Process failed: %v", err)
	}
	if _, err := onceo.Process(t.Context(), p, store, headers, body); !errors.Is(err, onceo.ErrDuplicateEvent) {
		t.Errorf("second Process got %v, want %v", err, onceo.ErrDuplicateEvent)
	}
}

func TestProcessInvalidSignature(t *testing.T) {
	body := loadFixture(t, "collection_succeeded.json")
	p, _ := New("whsec_wrong")
	store := onceo.NewMemoryStore()
	headers := nowHeaders("whsec_right", body)

	_, err := onceo.Process(t.Context(), p, store, headers, body)
	if !errors.Is(err, onceo.ErrInvalidSignature) {
		t.Errorf("got %v, want %v", err, onceo.ErrInvalidSignature)
	}
}

func TestProcessReplayWithinWindowAccepted(t *testing.T) {
	// A valid signature whose timestamp is seconds old must be accepted.
	secret := "whsec_test_secret"
	body := loadFixture(t, "collection_succeeded.json")
	p, _ := New(secret)
	store := onceo.NewMemoryStore()
	headers := nowHeaders(secret, body)

	if _, err := onceo.Process(t.Context(), p, store, headers, body); err != nil {
		t.Fatalf("Process failed: %v", err)
	}
}

func FuzzParse(f *testing.F) {
	fixtures := []string{
		"collection_succeeded.json", "collection_underpaid.json", "customer_updated.json",
		"invoice_paid.json", "invoice_payment_failed.json", "payout_paid.json",
		"dispute_created.json", "checkout_completed.json", "conversion_completed.json",
		"refund_paid.json", "transfer_created.json", "capability_updated.json",
		"customer_subscription_created.json",
	}
	for _, name := range fixtures {
		data, err := os.ReadFile("testdata/" + name)
		if err == nil {
			f.Add(data)
		}
	}
	f.Add([]byte(`{}`))
	f.Add([]byte(`{"type":"collection.succeeded"}`))
	f.Add([]byte(`not json`))
	f.Add([]byte(`{"id":"evt_1","type":"collection.succeeded","data":{}}`))

	p, _ := New("secret")

	f.Fuzz(func(t *testing.T, body []byte) {
		_, err := p.Parse(body)
		if err != nil && err != onceo.ErrMalformedPayload {
			t.Errorf("unexpected error: %v", err)
		}
	})
}
