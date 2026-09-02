package opay

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"

	onceo "github.com/HalxDocs/onceo-core"
)

const ProviderName = "opay"

type WebhookPayload struct {
	EventType string          `json:"eventType"`
	Data      json.RawMessage `json:"data"`
}

type PaymentData struct {
	Reference    string `json:"reference"`
	Amount       string `json:"amount"`
	Currency     string `json:"currency"`
	OrderNo      string `json:"orderNo"`
	CompleteTime string `json:"completeTime"`
}

type Provider struct {
	secretKey string
}

func New(secretKey string) (*Provider, error) {
	if len(secretKey) == 0 {
		return nil, fmt.Errorf("opay: secret key must not be empty")
	}
	return &Provider{secretKey: secretKey}, nil
}

func (p *Provider) Name() string {
	return ProviderName
}

func (p *Provider) BodyBound() bool { return true }

func (p *Provider) VerifySignature(headers http.Header, body []byte) error {
	sig, err := onceo.SingleHeader(headers, "Authorization")
	if err == nil {
		return onceo.VerifyHMACSHA512([]byte(p.secretKey), body, sig)
	}
	if !errors.Is(err, onceo.ErrMissingHeader) {
		return fmt.Errorf("opay: %w", err)
	}
	sig2, err2 := onceo.SingleHeader(headers, "Opay-Signature")
	if err2 != nil {
		return fmt.Errorf("opay: %w: no valid signature header found", onceo.ErrInvalidSignature)
	}
	return onceo.VerifyHMACSHA512([]byte(p.secretKey), body, sig2)
}

func (p *Provider) Parse(body []byte) (WebhookPayload, error) {
	var payload WebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return payload, onceo.ErrMalformedPayload
	}
	if payload.EventType == "" {
		return payload, onceo.ErrMalformedPayload
	}
	return payload, nil
}

func (p *Provider) Normalize(raw WebhookPayload) (onceo.Event, error) {
	event := onceo.Event{
		Provider: ProviderName,
		Type:     raw.EventType,
	}

	switch raw.EventType {
	case "PAYMENT_SUCCESSFUL":
		return normalizePayment(raw.Data, event, onceo.StatusSuccess)
	case "PAYMENT_FAILED":
		return normalizePayment(raw.Data, event, onceo.StatusFailed)
	case "REFUND_SUCCESSFUL":
		return normalizePayment(raw.Data, event, onceo.StatusReversed)
	default:
		return onceo.Event{}, fmt.Errorf("%w: unknown event type: %s", onceo.ErrEventParseFailed, raw.EventType)
	}
}

var validCurrencies = map[string]bool{
	"NGN": true, "USD": true, "GBP": true, "EUR": true, "ZAR": true,
	"GHS": true, "KES": true, "UGX": true, "TZS": true, "RWF": true,
	"XAF": true, "XOF": true, "ZMW": true, "MZN": true, "AOA": true,
	"BWP": true, "MAD": true, "EGP": true, "GNF": true, "ZWL": true,
}

func sanitiseCurrency(raw string) (string, error) {
	c := strings.ToUpper(strings.TrimSpace(raw))
	if !validCurrencies[c] {
		return "", fmt.Errorf("opay: invalid or unsupported currency code %q", raw)
	}
	return c, nil
}

func normalizePayment(data json.RawMessage, e onceo.Event, status onceo.Status) (onceo.Event, error) {
	var d PaymentData
	if err := json.Unmarshal(data, &d); err != nil {
		return e, onceo.ErrMalformedPayload
	}

	if d.OrderNo == "" {
		return e, fmt.Errorf("%w: payment event missing orderNo", onceo.ErrEventParseFailed)
	}
	e.ProviderEventID = d.OrderNo
	e.Status = status
	e.Reference = d.Reference
	cur, err := sanitiseCurrency(d.Currency)
	if err != nil {
		return e, err
	}
	e.Currency = cur

	amount, err := parseOpayAmount(d.Amount)
	if err != nil {
		return e, fmt.Errorf("opay: normalize: %w", err)
	}
	e.AmountMinor = amount

	return e, nil
}

func parseOpayAmount(raw string) (int64, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return 0, fmt.Errorf("empty amount")
	}
	if strings.HasPrefix(s, "-") {
		return 0, fmt.Errorf("negative amount %q", raw)
	}
	parts := strings.SplitN(s, ".", 2)
	wholeStr := parts[0]
	if wholeStr == "" {
		wholeStr = "0"
	}
	whole, err := strconv.ParseInt(wholeStr, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid amount %q: %w", raw, err)
	}
	frac := int64(0)
	if len(parts) == 2 {
		if len(parts[1]) > 2 {
			return 0, fmt.Errorf("invalid amount %q: more than 2 decimal places", raw)
		}
		fracStr := parts[1]
		for _, c := range fracStr {
			if c < '0' || c > '9' {
				return 0, fmt.Errorf("invalid amount %q: non-digit in fractional part", raw)
			}
		}
		for len(fracStr) < 2 {
			fracStr += "0"
		}
		frac, err = strconv.ParseInt(fracStr, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid amount %q: %w", raw, err)
		}
	}
	if whole > math.MaxInt64/100 {
		return 0, fmt.Errorf("amount %q exceeds maximum", raw)
	}
	result := whole * 100
	if result > math.MaxInt64-frac {
		return 0, fmt.Errorf("amount %q exceeds maximum", raw)
	}
	return result + frac, nil
}
