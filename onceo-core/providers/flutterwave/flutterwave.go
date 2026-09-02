// Package flutterwave implements the onceo Provider for Flutterwave webhooks.
//
// # Security warning
//
// Flutterwave's webhook authentication scheme differs fundamentally from
// HMAC-based providers (Paystack, OPay). The Verif-Hash header is a static
// SHA256(secretHash) that does not change between requests and does not
// include the webhook body. This is equivalent to a static bearer token:
//
//   - One captured Verif-Hash value is valid for all future webhooks
//     until the secret hash is rotated at the Flutterwave dashboard.
//   - There is no per-request binding to the webhook body.
//   - Body integrity relies entirely on TLS.
//
// Integrators should consider additional protections: IP whitelisting,
// rotating the secret hash regularly, or supplemental shared secrets.
package flutterwave

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	onceo "github.com/HalxDocs/onceo-core"
)

const ProviderName = "flutterwave"

type WebhookPayload struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

type ChargeData struct {
	ID            int    `json:"id"`
	TxRef         string `json:"tx_ref"`
	FlwRef        string `json:"flw_ref"`
	Status        string `json:"status"`
	Amount        int64  `json:"amount"`
	ChargedAmount int64  `json:"charged_amount"`
	Currency      string `json:"currency"`
	CreatedAt     string `json:"created_at"`
}

type TransferData struct {
	ID       int    `json:"id"`
	Ref      string `json:"reference"`
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
	Status   string `json:"status"`
}

type Provider struct {
	secretHash string
}

func New(secretHash string) (*Provider, error) {
	if len(secretHash) == 0 {
		return nil, fmt.Errorf("flutterwave: secret hash must not be empty")
	}
	return &Provider{secretHash: secretHash}, nil
}

func (p *Provider) Name() string {
	return ProviderName
}

func (p *Provider) BodyBound() bool { return false }

// VerifySignature checks the Flutterwave Verif-Hash header.
//
// WARNING: Flutterwave computes Verif-Hash as SHA256(secretHash). The
// result is STATIC — every webhook from the same merchant account carries
// the identical header value. Unlike HMAC-based providers where the
// signature is bound to each request body, Flutterwave's scheme is
// equivalent to a static bearer token:
//
//   - An attacker who observes ONE legitimate webhook (HTTP log, TLS
//     inspection proxy, compromised intermediary) captures a Verif-Hash
//     value that is valid for ALL future webhooks forever (until the
//     merchant rotates their secret hash at the Flutterwave dashboard).
//
//   - The webhook body is NOT part of the hash. This function provides NO
//     body integrity at the application layer. Body integrity relies
//     entirely on TLS.
//
//   - Treat your webhook endpoint as if it has no application-level
//     authentication. The only mitigation is secret hash rotation or
//     supplemental checks (IP whitelisting, additional shared secrets).
func (p *Provider) VerifySignature(headers http.Header, body []byte) error {
	signature, err := onceo.SingleHeader(headers, "Verif-Hash")
	if err != nil {
		return err
	}
	h := sha256.Sum256([]byte(p.secretHash))
	expected := hex.EncodeToString(h[:])
	if subtle.ConstantTimeCompare([]byte(expected), []byte(signature)) != 1 {
		return onceo.ErrInvalidSignature
	}
	return nil
}

func (p *Provider) Parse(body []byte) (WebhookPayload, error) {
	var payload WebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return payload, onceo.ErrMalformedPayload
	}
	if payload.Event == "" {
		return payload, onceo.ErrMalformedPayload
	}
	return payload, nil
}

func (p *Provider) Normalize(raw WebhookPayload) (onceo.Event, error) {
	event := onceo.Event{
		Provider: ProviderName,
		Type:     raw.Event,
	}

	switch raw.Event {
	case "charge.completed", "charge.success":
		return normalizeCharge(raw.Data, event, onceo.StatusSuccess)
	case "charge.failed":
		return normalizeCharge(raw.Data, event, onceo.StatusFailed)
	case "transfer.completed":
		return normalizeTransfer(raw.Data, event, onceo.StatusSuccess)
	case "transfer.failed":
		return normalizeTransfer(raw.Data, event, onceo.StatusFailed)
	default:
		return onceo.Event{}, fmt.Errorf("%w: unknown event type: %s", onceo.ErrEventParseFailed, raw.Event)
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
		return "", fmt.Errorf("flutterwave: invalid or unsupported currency code %q", raw)
	}
	return c, nil
}

func normalizeCharge(data json.RawMessage, e onceo.Event, status onceo.Status) (onceo.Event, error) {
	var d ChargeData
	if err := json.Unmarshal(data, &d); err != nil {
		return e, onceo.ErrMalformedPayload
	}

	if d.ID <= 0 {
		return e, fmt.Errorf("%w: charge event missing id", onceo.ErrEventParseFailed)
	}
	e.ProviderEventID = fmt.Sprintf("%d", d.ID)
	s, err := mapStatus(d.Status, status)
	if err != nil {
		return e, err
	}
	e.Status = s
	amount := d.Amount
	if d.ChargedAmount > 0 {
		amount = d.ChargedAmount
	}
	e.AmountMinor = amount
	cur, err2 := sanitiseCurrency(d.Currency)
	if err2 != nil {
		return e, err2
	}
	e.Currency = cur
	e.Reference = d.TxRef

	return e, nil
}

func normalizeTransfer(data json.RawMessage, e onceo.Event, status onceo.Status) (onceo.Event, error) {
	var d TransferData
	if err := json.Unmarshal(data, &d); err != nil {
		return e, onceo.ErrMalformedPayload
	}

	if d.ID <= 0 {
		return e, fmt.Errorf("%w: transfer event missing id", onceo.ErrEventParseFailed)
	}
	e.ProviderEventID = fmt.Sprintf("%d", d.ID)
	s, err := mapStatus(d.Status, status)
	if err != nil {
		return e, err
	}
	e.Status = s
	e.AmountMinor = d.Amount
	cur, err2 := sanitiseCurrency(d.Currency)
	if err2 != nil {
		return e, err2
	}
	e.Currency = cur
	e.Reference = d.Ref

	return e, nil
}

func mapStatus(providerStatus string, defaultStatus onceo.Status) (onceo.Status, error) {
	switch providerStatus {
	case "successful", "success":
		return onceo.StatusSuccess, nil
	case "failed":
		return onceo.StatusFailed, nil
	default:
		return onceo.StatusPending, fmt.Errorf("flutterwave: unknown status %q", providerStatus)
	}
}
