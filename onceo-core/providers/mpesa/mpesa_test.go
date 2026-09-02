package mpesa

import (
	"encoding/json"
	"net/http"
	"os"
	"testing"

	onceo "github.com/HalxDocs/onceo-core"
)

const testToken = "abcdef1234567890abcdef1234567890abcdef12"

func loadFixture(t *testing.T, name string) []byte {
	t.Helper()
	data, err := os.ReadFile("testdata/" + name)
	if err != nil {
		t.Fatalf("failed to read fixture %s: %v", name, err)
	}
	return data
}

func TestVerifySignature(t *testing.T) {
	token := "abcdef1234567890abcdef1234567890abcdef12"

	p, err := New(token)
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}

	tests := []struct {
		name    string
		headers http.Header
		wantErr bool
	}{
		{
			name:    "valid token",
			headers: withCallbackToken(token),
			wantErr: false,
		},
		{
			name:    "missing token header",
			headers: http.Header{},
			wantErr: true,
		},
		{
			name:    "wrong token",
			headers: withCallbackToken("wrong_token_value_that_is_long_enough_32"),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := p.VerifySignature(tt.headers, nil)
			if (err != nil) != tt.wantErr {
				t.Errorf("VerifySignature() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func withCallbackToken(token string) http.Header {
	h := http.Header{}
	h.Set("X-Onceo-Mpesa-Callback-Token", token)
	return h
}

func TestNewShortToken(t *testing.T) {
	_, err := New("short")
	if err == nil {
		t.Error("expected error for short callback token")
	}
}

func TestParseSTK(t *testing.T) {
	p, _ := New(testToken)

	tests := []struct {
		name    string
		body    []byte
		wantErr bool
		wantID  string
	}{
		{
			name:    "stk success",
			body:    loadFixture(t, "stk_success.json"),
			wantErr: false,
			wantID:  "ws_CO_07072026123000000",
		},
		{
			name:    "stk failed",
			body:    loadFixture(t, "stk_failed.json"),
			wantErr: false,
			wantID:  "ws_CO_07072026123100000",
		},
		{
			name:    "malformed json",
			body:    []byte(`not json`),
			wantErr: true,
		},
		{
			name:    "empty body",
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
			if !tt.wantErr && got.Body.StkCallback.CheckoutRequestID != tt.wantID {
				t.Errorf("Parse() CheckoutRequestID = %q, want %q", got.Body.StkCallback.CheckoutRequestID, tt.wantID)
			}
		})
	}
}

func TestNormalizeSTKSuccess(t *testing.T) {
	p, _ := New(testToken)
	body := loadFixture(t, "stk_success.json")

	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	event, err := p.Normalize(parsed)
	if err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}

	if event.Provider != "mpesa" {
		t.Errorf("Provider = %q, want %q", event.Provider, "mpesa")
	}
	if event.Status != onceo.StatusSuccess {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusSuccess)
	}
	if event.Type != "stk.push" {
		t.Errorf("Type = %q, want %q", event.Type, "stk.push")
	}
	if event.AmountMinor != 150000 {
		t.Errorf("AmountMinor = %d, want %d", event.AmountMinor, 150000)
	}
	if event.Currency != "KES" {
		t.Errorf("Currency = %q, want %q", event.Currency, "KES")
	}
}

func TestNormalizeSTKFailed(t *testing.T) {
	p, _ := New(testToken)
	body := loadFixture(t, "stk_failed.json")

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
	if event.Type != "stk.push" {
		t.Errorf("Type = %q, want %q", event.Type, "stk.push")
	}
}

func TestProviderName(t *testing.T) {
	p, _ := New(testToken)
	if got := p.Name(); got != "mpesa" {
		t.Errorf("Name() = %q, want %q", got, "mpesa")
	}
}

func TestParseMpesaAmount(t *testing.T) {
	tests := []struct {
		name    string
		input   interface{}
		want    int64
		wantErr bool
	}{
		{"float64", float64(1500.0), 150000, false},
		{"float64 negative", float64(-100), 0, true},
		{"int", 1500, 150000, false},
		{"int negative", int(-100), 0, true},
		{"int64", int64(1500), 150000, false},
		{"int64 negative", int64(-100), 0, true},
		{"string", "1500", 150000, false},
		{"string decimal", "12.50", 1250, false},
		{"string negative", "-100", 0, true},
		{"string leading decimal", ".5", 50, false},
		{"string empty", "", 0, true},
		{"json.Number", json.Number("1500"), 150000, false},
		{"json.Number invalid", json.Number("abc"), 0, true},
		{"nil", nil, 0, true},
		{"invalid string", "abc", 0, true},
		{"bool", true, 0, true},
		{"int64 overflow", int64(92233720368547759), 0, true},
		{"int overflow", int(92233720368547759), 0, true},
		{"float64 overflow", float64(1e16), 0, true},
		{"float64 precision .10", 0.10, 10, false},
		{"float64 precision .1", 0.1, 10, false},
		{"float64 precision 19.99", 19.99, 1999, false},
		{"float64 precision 0.01", 0.01, 1, false},
		{"string overflow", "92233720368547759.00", 0, true},
		{"string overflow frac", "92233720368547758.50", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseMpesaAmount(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseMpesaAmount(%v) error = %v, wantErr %v", tt.input, err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("parseMpesaAmount(%v) = %d, want %d", tt.input, got, tt.want)
			}
		})
	}
}

func TestParseC2BEmptyTransID(t *testing.T) {
	p, _ := New(testToken)
	_, err := p.ParseC2B([]byte(`{"TransID":""}`))
	if err == nil {
		t.Fatal("expected error for empty TransID")
	}
}

func TestParseC2B(t *testing.T) {
	p, _ := New(testToken)
	body := loadFixture(t, "c2b_payment.json")

	payload, err := p.ParseC2B(body)
	if err != nil {
		t.Fatalf("ParseC2B failed: %v", err)
	}

	if payload.TransID != "LGR12G8H1" {
		t.Errorf("TransID = %q, want %q", payload.TransID, "LGR12G8H1")
	}
	if payload.BillRefNumber != "INV-001" {
		t.Errorf("BillRefNumber = %q, want %q", payload.BillRefNumber, "INV-001")
	}
	if payload.TransAmount != "2000" {
		t.Errorf("TransAmount = %q, want %q", payload.TransAmount, "2000")
	}
}

func TestParseC2BMalformed(t *testing.T) {
	p, _ := New(testToken)
	_, err := p.ParseC2B([]byte(`not json`))
	if err == nil {
		t.Fatal("expected error for malformed JSON")
	}
}

func TestNormalizeC2B(t *testing.T) {
	p, _ := New(testToken)
	body := loadFixture(t, "c2b_payment.json")

	parsed, err := p.ParseC2B(body)
	if err != nil {
		t.Fatalf("ParseC2B failed: %v", err)
	}

	event, err := p.NormalizeC2B(parsed)
	if err != nil {
		t.Fatalf("NormalizeC2B failed: %v", err)
	}

	if event.Provider != "mpesa" {
		t.Errorf("Provider = %q, want %q", event.Provider, "mpesa")
	}
	if event.Type != "c2b.pay_bill" {
		t.Errorf("Type = %q, want %q", event.Type, "c2b.pay_bill")
	}
	if event.Status != onceo.StatusSuccess {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusSuccess)
	}
	if event.ProviderEventID != "LGR12G8H1" {
		t.Errorf("ProviderEventID = %q, want %q", event.ProviderEventID, "LGR12G8H1")
	}
	if event.AmountMinor != 200000 {
		t.Errorf("AmountMinor = %d, want %d", event.AmountMinor, 200000)
	}
	if event.Currency != "KES" {
		t.Errorf("Currency = %q, want %q", event.Currency, "KES")
	}
	if event.Reference != "INV-001" {
		t.Errorf("Reference = %q, want %q", event.Reference, "INV-001")
	}
}

func TestNormalizeC2BNegativeAmount(t *testing.T) {
	p, _ := New(testToken)
	payload := C2BPayload{TransID: "t1", TransAmount: "-500", BillRefNumber: "r"}
	_, err := p.NormalizeC2B(payload)
	if err == nil {
		t.Fatal("expected error for negative C2B amount")
	}
}

func TestNormalizeC2BInvalidAmount(t *testing.T) {
	p, _ := New(testToken)
	payload := C2BPayload{TransID: "t1", TransAmount: "not_a_number", BillRefNumber: "r"}
	_, err := p.NormalizeC2B(payload)
	if err == nil {
		t.Fatal("expected error for invalid C2B amount")
	}
}

func TestParseC2BAmountDecimal(t *testing.T) {
	amount, err := parseC2BAmount("2000.00")
	if err != nil {
		t.Fatalf("parseC2BAmount failed: %v", err)
	}
	if amount != 200000 {
		t.Errorf("amount = %d, want %d", amount, 200000)
	}
}

func TestParseC2BAmountDecimalNoFraction(t *testing.T) {
	amount, err := parseC2BAmount("2000.5")
	if err != nil {
		t.Fatalf("parseC2BAmount failed: %v", err)
	}
	if amount != 200050 {
		t.Errorf("amount = %d, want %d", amount, 200050)
	}
}

func TestParseC2BAmountTooManyDecimals(t *testing.T) {
	_, err := parseC2BAmount("2000.123")
	if err == nil {
		t.Fatal("expected error for too many decimal places")
	}
}

func TestParseC2BAmountNonDigitFraction(t *testing.T) {
	_, err := parseC2BAmount("100.-5")
	if err == nil {
		t.Fatal("expected error for non-digit in fractional part")
	}
}

func TestParseC2BAmountOverflowWhole(t *testing.T) {
	_, err := parseC2BAmount("92233720368547759.00")
	if err == nil {
		t.Fatal("expected error for overflow amount")
	}
}

func TestParseC2BAmountOverflowFrac(t *testing.T) {
	_, err := parseC2BAmount("92233720368547758.50")
	if err == nil {
		t.Fatal("expected error for overflow amount with fraction")
	}
}

func TestParseC2BAmountEmpty(t *testing.T) {
	_, err := parseC2BAmount("")
	if err == nil {
		t.Fatal("expected error for empty amount")
	}
}

func TestParseC2BAmountLeadingDecimal(t *testing.T) {
	amount, err := parseC2BAmount(".99")
	if err != nil {
		t.Fatalf("parseC2BAmount failed: %v", err)
	}
	if amount != 99 {
		t.Errorf("amount = %d, want %d", amount, 99)
	}
}

func TestProcessFullFlow(t *testing.T) {
	body := loadFixture(t, "stk_success.json")

	p, err := New(testToken)
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}
	store := onceo.NewMemoryStore()

	headers := http.Header{}
	headers.Set("X-Onceo-Mpesa-Callback-Token", testToken)

	event, err := onceo.Process(t.Context(), p, store, headers, body)
	if err != nil {
		t.Fatalf("Process failed: %v", err)
	}

	if event.Provider != "mpesa" {
		t.Errorf("Provider = %q, want %q", event.Provider, "mpesa")
	}
	if event.Status != onceo.StatusSuccess {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusSuccess)
	}
	if event.Currency != "KES" {
		t.Errorf("Currency = %q, want %q", event.Currency, "KES")
	}
}

func TestNormalizeSTKResultCode1032(t *testing.T) {
	p, _ := New(testToken)
	payload := struct {
		Body struct {
			StkCallback struct {
				MerchantRequestID string `json:"MerchantRequestID"`
				CheckoutRequestID string `json:"CheckoutRequestID"`
				ResultCode        int    `json:"ResultCode"`
				ResultDesc        string `json:"ResultDesc"`
			} `json:"stkCallback"`
		} `json:"Body"`
	}{}
	payload.Body.StkCallback.CheckoutRequestID = "ws_test_1032"
	payload.Body.StkCallback.ResultCode = 1032
	payload.Body.StkCallback.ResultDesc = "Request cancelled by user"

	body, _ := json.Marshal(payload)
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
}

func TestNormalizeSTKAmountParseError(t *testing.T) {
	p, _ := New(testToken)
	payload := struct {
		Body struct {
			StkCallback struct {
				MerchantRequestID string      `json:"MerchantRequestID"`
				CheckoutRequestID string      `json:"CheckoutRequestID"`
				ResultCode        int         `json:"ResultCode"`
				ResultDesc        string      `json:"ResultDesc"`
				CallbackMetadata  interface{} `json:"CallbackMetadata"`
			} `json:"stkCallback"`
		} `json:"Body"`
	}{}
	payload.Body.StkCallback.CheckoutRequestID = "ws_test_bad_amt"
	payload.Body.StkCallback.ResultCode = 0
	payload.Body.StkCallback.ResultDesc = "Success"
	payload.Body.StkCallback.CallbackMetadata = map[string]any{
		"Item": []map[string]any{
			{"Name": "Amount", "Value": "not_a_number"},
		},
	}

	body, _ := json.Marshal(payload)
	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}
	_, err = p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for invalid Amount value")
	}
}

func TestNormalizeSTKSuccessNoMetadata(t *testing.T) {
	p, _ := New(testToken)
	payload := struct {
		Body struct {
			StkCallback struct {
				MerchantRequestID string      `json:"MerchantRequestID"`
				CheckoutRequestID string      `json:"CheckoutRequestID"`
				ResultCode        int         `json:"ResultCode"`
				ResultDesc        string      `json:"ResultDesc"`
				CallbackMetadata  interface{} `json:"CallbackMetadata"`
			} `json:"stkCallback"`
		} `json:"Body"`
	}{}
	payload.Body.StkCallback.CheckoutRequestID = "ws_test_no_meta"
	payload.Body.StkCallback.ResultCode = 0
	payload.Body.StkCallback.CallbackMetadata = nil
	payload.Body.StkCallback.ResultDesc = "Success"

	body, _ := json.Marshal(payload)
	parsed, err := p.Parse(body)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	_, err = p.Normalize(parsed)
	if err == nil {
		t.Fatal("expected error for successful STK push without Amount metadata")
	}
}

func TestNormalizeSTKDefaultResultCode(t *testing.T) {
	p, _ := New(testToken)
	payload := struct {
		Body struct {
			StkCallback struct {
				MerchantRequestID string `json:"MerchantRequestID"`
				CheckoutRequestID string `json:"CheckoutRequestID"`
				ResultCode        int    `json:"ResultCode"`
				ResultDesc        string `json:"ResultDesc"`
			} `json:"stkCallback"`
		} `json:"Body"`
	}{}
	payload.Body.StkCallback.CheckoutRequestID = "ws_test_9999"
	payload.Body.StkCallback.ResultCode = 9999

	body, _ := json.Marshal(payload)
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
}

func FuzzParse(f *testing.F) {
	fixtures := []string{"stk_success.json", "stk_failed.json"}
	for _, name := range fixtures {
		data, err := os.ReadFile("testdata/" + name)
		if err == nil {
			f.Add(data)
		}
	}
	f.Add([]byte(`{}`))
	f.Add([]byte(`not json`))

	p, _ := New(testToken)

	f.Fuzz(func(t *testing.T, body []byte) {
		_, err := p.Parse(body)
		if err != nil && err != onceo.ErrMalformedPayload {
			t.Errorf("unexpected error: %v", err)
		}
	})
}

func TestNormalizeC2BUnknownType(t *testing.T) {
	p, _ := New(testToken)
	payload := C2BPayload{TransID: "t1", TransAmount: "100", TransactionType: "UnknownType", BillRefNumber: "r"}
	_, err := p.NormalizeC2B(payload)
	if err == nil {
		t.Fatal("expected error for unknown C2B transaction type")
	}
}

func TestNormalizeC2BBuyGoods(t *testing.T) {
	p, _ := New(testToken)
	payload := C2BPayload{TransID: "t1", TransAmount: "100", TransactionType: "Buy Goods", BillRefNumber: "r"}
	event, err := p.NormalizeC2B(payload)
	if err != nil {
		t.Fatalf("NormalizeC2B failed: %v", err)
	}
	if event.Status != onceo.StatusSuccess {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusSuccess)
	}
	if event.Type != "c2b.buy_goods" {
		t.Errorf("Type = %q, want %q", event.Type, "c2b.buy_goods")
	}
}

func TestNormalizeC2BReversal(t *testing.T) {
	p, _ := New(testToken)
	payload := C2BPayload{TransID: "t1", TransAmount: "100", TransactionType: "Reversal", BillRefNumber: "r"}
	event, err := p.NormalizeC2B(payload)
	if err != nil {
		t.Fatalf("NormalizeC2B failed: %v", err)
	}
	if event.Status != onceo.StatusReversed {
		t.Errorf("Status = %v, want %v", event.Status, onceo.StatusReversed)
	}
	if event.Type != "c2b.reversal" {
		t.Errorf("Type = %q, want %q", event.Type, "c2b.reversal")
	}
}
