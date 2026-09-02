// Package bachs implements the onceo Provider for Bachs webhooks.
//
// Bachs signs every delivery with HMAC-SHA256 over the string
// "{X-Bachs-Timestamp}.{raw-body}" and sends the hex-encoded digest in the
// "X-Bachs-Signature" header. The "X-Bachs-Timestamp" header is a Unix
// timestamp in seconds; deliveries older than the tolerance window are
// rejected to prevent replay.
//
// The delivered body is a JSON envelope: an event "id" (the recommended
// idempotency key), a "type", and a divergent "data" object. Money fields
// are decimal strings paired with an ISO-4217 currency. This provider maps
// the envelope to the canonical Event schema and derives AmountMinor at
// 2-decimal precision from the decimal string. Envelopes for Connect
// events also carry a top-level "account" field identifying the connected
// account the event is attributed to.
package bachs

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	onceo "github.com/HalxDocs/onceo-core"
)

const ProviderName = "bachs"

const (
	headerTimestamp = "X-Bachs-Timestamp"
	headerSignature = "X-Bachs-Signature"
)

// DefaultTolerance is the maximum age, in seconds, that a delivery timestamp
// may be before the current time (matches Bachs' reference tolerance of 300s).
const DefaultTolerance = 5 * time.Minute

type WebhookPayload struct {
	ID             string          `json:"id"`
	Type           string          `json:"type"`
	CreatedAt      string          `json:"created_at"`
	OrganizationID string          `json:"organization_id"`
	Account        string          `json:"account"`
	Data           json.RawMessage `json:"data"`
}

// CollectionData carries the payment fields found across Bachs event
// families. Only the fields relevant to the delivered event type are
// populated; the rest are zero-valued.
type CollectionData struct {
	ChargeID   string          `json:"charge_id"`
	CheckoutID string          `json:"checkout_id"`
	Reference  string          `json:"reference"`
	Status     string          `json:"status"`
	Amount     json.RawMessage `json:"amount"`
	Currency   string          `json:"currency"`

	// collection.underpaid
	AmountPaid      json.RawMessage `json:"amount_paid"`
	AmountExpected  json.RawMessage `json:"amount_expected"`
	AmountRemaining json.RawMessage `json:"amount_remaining"`

	// invoice.*
	Subtotal json.RawMessage `json:"subtotal"`
	Total    json.RawMessage `json:"total"`

	// refund.*
	RequestedAmount json.RawMessage `json:"requested_amount"`
	RefundedAmount  json.RawMessage `json:"refunded_amount"`

	// conversion.*
	FromCurrency string          `json:"from_currency"`
	ToCurrency   string          `json:"to_currency"`
	FromAmount   json.RawMessage `json:"from_amount"`
	ToAmount     json.RawMessage `json:"to_amount"`
}

type Provider struct {
	secret    []byte
	tolerance time.Duration
}

type Option func(*Provider)

// WithTolerance overrides the default timestamp tolerance window used when
// verifying the "X-Bachs-Timestamp" header.
func WithTolerance(d time.Duration) Option {
	return func(p *Provider) {
		if d > 0 {
			p.tolerance = d
		}
	}
}

// New returns a provider that verifies Bachs webhooks signed with the
// endpoint's signing secret.
func New(secret string, opts ...Option) (*Provider, error) {
	if len(secret) == 0 {
		return nil, fmt.Errorf("bachs: signing secret must not be empty")
	}
	p := &Provider{
		secret:    []byte(secret),
		tolerance: DefaultTolerance,
	}
	for _, opt := range opts {
		opt(p)
	}
	return p, nil
}

func (p *Provider) Name() string { return ProviderName }

// BodyBound reports true: Bachs signs the raw request body so a valid
// signature proves body integrity.
func (p *Provider) BodyBound() bool { return true }

func (p *Provider) VerifySignature(headers http.Header, body []byte) error {
	timestamp, err := onceo.SingleHeader(headers, headerTimestamp)
	if err != nil {
		return fmt.Errorf("bachs: %w", err)
	}

	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return fmt.Errorf("bachs: %w: non-numeric timestamp", onceo.ErrInvalidSignature)
	}
	delta := time.Now().Unix() - ts
	if delta > int64(p.tolerance.Seconds()) || delta < -int64(p.tolerance.Seconds()) {
		return fmt.Errorf("bachs: %w: timestamp outside tolerance", onceo.ErrInvalidSignature)
	}

	got, err := onceo.SingleHeader(headers, headerSignature)
	if err != nil {
		return fmt.Errorf("bachs: %w", err)
	}
	expected := sign(p.secret, timestamp, body)
	if subtle.ConstantTimeCompare([]byte(expected), []byte(got)) != 1 {
		return onceo.ErrInvalidSignature
	}
	return nil
}

func (p *Provider) Parse(body []byte) (WebhookPayload, error) {
	var payload WebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return payload, onceo.ErrMalformedPayload
	}
	if payload.ID == "" || payload.Type == "" {
		return payload, onceo.ErrMalformedPayload
	}
	return payload, nil
}

func (p *Provider) Normalize(raw WebhookPayload) (onceo.Event, error) {
	e := onceo.Event{
		Provider:        ProviderName,
		ProviderEventID: raw.ID,
		Type:            raw.Type,
		Status:          mapEventStatus(raw.Type),
	}

	// Pull monetary/reference fields from data when the event carries them.
	data, err := decodeData(raw.Data)
	if err != nil {
		return e, err
	}
	if data == nil {
		return e, nil
	}

	if data.Reference != "" {
		e.Reference = data.Reference
	}

	// Currency is normally the data.currency field; conversions carry
	// from_currency/to_currency instead, and refunds carry none.
	currency := data.Currency
	if currency == "" {
		currency = data.ToCurrency
	}
	if currency != "" {
		cur, perr := sanitiseCurrency(currency)
		if perr != nil {
			return e, perr
		}
		e.Currency = cur
	}

	amount, aerr := eventAmount(raw.Type, data)
	if aerr != nil {
		return e, aerr
	}
	e.AmountMinor = amount

	return e, nil
}

// eventAmount resolves the monetary value of an event from its data object.
// Each event family reports its amount under a different key, so the source
// is chosen per type: collection/checkout/payout/dispute/transfer events use
// "amount", an underpaid collection reports amount_paid (what actually
// arrived), invoices report amount_paid (falling back to total), refunds
// report refunded_amount (falling back to requested_amount), and conversions
// report to_amount in to_currency.
func eventAmount(eventType string, d *CollectionData) (int64, error) {
	var raw json.RawMessage
	switch {
	case d.Amount != nil:
		raw = d.Amount
	case strings.HasPrefix(eventType, "invoice."):
		raw = firstNonNil(d.AmountPaid, d.Total)
	case eventType == "collection.underpaid":
		raw = d.AmountPaid
	case strings.HasPrefix(eventType, "refund."):
		raw = firstNonNil(d.RefundedAmount, d.RequestedAmount)
	case strings.HasPrefix(eventType, "conversion."):
		raw = d.ToAmount
	}
	if raw == nil {
		return 0, nil
	}
	return parseMinorUnits(raw)
}

// firstNonNil returns the first non-empty, non-null raw value.
func firstNonNil(vals ...json.RawMessage) json.RawMessage {
	for _, v := range vals {
		if len(v) > 0 && string(v) != "null" {
			return v
		}
	}
	return nil
}

// decodeData returns a parsed CollectionData only when raw.Data contains
// recognizable Bachs payment fields; a nil result (empty object) is not an
// error for events that carry no monetary payload (e.g. customer.updated).
func decodeData(raw json.RawMessage) (*CollectionData, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var d CollectionData
	if err := json.Unmarshal(raw, &d); err != nil {
		return nil, onceo.ErrMalformedPayload
	}
	return &d, nil
}

func mapEventStatus(eventType string) onceo.Status {
	switch eventType {
	case "checkout.completed", "collection.succeeded", "conversion.completed", "invoice.paid", "payout.paid":
		return onceo.StatusSuccess
	case "collection.failed", "conversion.failed", "invoice.payment_failed", "payout.failed", "refund.failed":
		return onceo.StatusFailed
	case "refund.paid":
		return onceo.StatusReversed
	default:
		// checkout.expired, collection.underpaid, invoice.created,
		// payout.created, refund.created, dispute.*, customer.*,
		// customer.subscription.*, account.updated, capability.updated,
		// transfer.created, and any future event types resolve to pending.
		return onceo.StatusPending
	}
}

// parseMinorUnits turns a decimal-amount value into minor units at 2-decimal
// precision. Accepts strings ("75000.00"), json.Number, and float64. A nil
// value returns 0 with no error so callers can ignore absent amounts.
func parseMinorUnits(v json.RawMessage) (int64, error) {
	if len(v) == 0 || string(v) == "null" {
		return 0, nil
	}
	var val interface{}
	if err := json.Unmarshal(v, &val); err != nil {
		return 0, fmt.Errorf("bachs: invalid amount value %s", v)
	}
	raw, ok := amountToDecimalString(val)
	if !ok {
		return 0, fmt.Errorf("bachs: unexpected amount type %T", val)
	}
	if raw == "" {
		return 0, fmt.Errorf("bachs: empty amount")
	}
	if strings.HasPrefix(strings.TrimSpace(raw), "-") {
		return 0, fmt.Errorf("bachs: negative amount %q", raw)
	}

	parts := strings.Split(raw, ".")
	wholeStr := parts[0]
	if wholeStr == "" {
		wholeStr = "0"
	}
	whole, err := strconv.ParseInt(wholeStr, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("bachs: invalid amount %q", raw)
	}
	frac := int64(0)
	if len(parts) == 2 {
		if len(parts[1]) > 2 {
			return 0, fmt.Errorf("bachs: more than 2 decimal places in amount %q", raw)
		}
		fracStr := parts[1]
		for _, c := range fracStr {
			if c < '0' || c > '9' {
				return 0, fmt.Errorf("bachs: invalid amount %q", raw)
			}
		}
		for len(fracStr) < 2 {
			fracStr += "0"
		}
		frac, err = strconv.ParseInt(fracStr, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("bachs: invalid amount %q", raw)
		}
	}
	if whole > (1<<62)/100 {
		return 0, fmt.Errorf("bachs: amount %q exceeds maximum", raw)
	}
	return whole*100 + frac, nil
}

func amountToDecimalString(v interface{}) (string, bool) {
	switch val := v.(type) {
	case string:
		return strings.TrimSpace(val), true
	case json.Number:
		return string(val), true
	case float64:
		if val < 0 {
			return "", true
		}
		return strconv.FormatFloat(val, 'f', -1, 64), true
	default:
		return "", false
	}
}

var validCurrencies = map[string]bool{
	"NGN": true, "USD": true, "GBP": true, "EUR": true, "ZAR": true,
	"KES": true, "UGX": true, "TZS": true, "RWF": true, "XAF": true,
	"XOF": true, "ZMW": true, "MZN": true, "AOA": true, "BWP": true,
	"GHS": true, "EGP": true, "MAD": true, "GNF": true, "ZWL": true,
	"MWK": true, "NAD": true, "SZL": true, "LSL": true, "ZWD": true,
}

func sanitiseCurrency(raw string) (string, error) {
	c := strings.ToUpper(strings.TrimSpace(raw))
	if !validCurrencies[c] {
		return "", fmt.Errorf("bachs: invalid or unsupported currency code %q", raw)
	}
	return c, nil
}

func sign(key []byte, timestamp string, body []byte) string {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(timestamp))
	mac.Write([]byte("."))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}
