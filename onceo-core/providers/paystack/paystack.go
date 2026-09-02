package paystack

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	onceo "github.com/HalxDocs/onceo-core"
)

const ProviderName = "paystack"

type WebhookPayload struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

type ChargeSuccessData struct {
	ID        int    `json:"id"`
	Domain    string `json:"domain"`
	Status    string `json:"status"`
	Reference string `json:"reference"`
	Amount    int64  `json:"amount"`
	Currency  string `json:"currency"`
	PaidAt    string `json:"paid_at"`
	CreatedAt string `json:"created_at"`
}

type TransferSuccessData struct {
	ID        int    `json:"id"`
	Reference string `json:"reference"`
	Amount    int64  `json:"amount"`
	Currency  string `json:"currency"`
	Status    string `json:"status"`
	Recipient string `json:"recipient"`
	CreatedAt string `json:"created_at"`
}

type Provider struct {
	secretKey string
}

func New(secretKey string) (*Provider, error) {
	if len(secretKey) == 0 {
		return nil, fmt.Errorf("paystack: secret key must not be empty")
	}
	return &Provider{secretKey: secretKey}, nil
}

func (p *Provider) Name() string {
	return ProviderName
}

func (p *Provider) BodyBound() bool { return true }

func (p *Provider) VerifySignature(headers http.Header, body []byte) error {
	signature, err := onceo.SingleHeader(headers, "X-Paystack-Signature")
	if err != nil {
		return err
	}
	return onceo.VerifyHMACSHA512([]byte(p.secretKey), body, signature)
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
	case "charge.success":
		return normalizeChargeSuccess(raw.Data, event)
	case "charge.failed":
		return normalizeChargeFailed(raw.Data, event)
	case "transfer.success":
		return normalizeTransferSuccess(raw.Data, event)
	case "transfer.failed":
		return normalizeTransferFailed(raw.Data, event)
	default:
		return onceo.Event{}, fmt.Errorf("%w: unknown event type: %s", onceo.ErrEventParseFailed, raw.Event)
	}
}

func normalizeChargeSuccess(data json.RawMessage, e onceo.Event) (onceo.Event, error) {
	var d ChargeSuccessData
	if err := json.Unmarshal(data, &d); err != nil {
		return e, onceo.ErrMalformedPayload
	}

	if d.ID <= 0 {
		return e, fmt.Errorf("%w: charge success event missing id", onceo.ErrEventParseFailed)
	}
	e.ProviderEventID = strconv.Itoa(d.ID)
	s, err := mapStatus(d.Status)
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
	e.Reference = d.Reference

	return e, nil
}

func normalizeChargeFailed(data json.RawMessage, e onceo.Event) (onceo.Event, error) {
	var d ChargeSuccessData
	if err := json.Unmarshal(data, &d); err != nil {
		return e, onceo.ErrMalformedPayload
	}

	if d.ID <= 0 {
		return e, fmt.Errorf("%w: charge failed event missing id", onceo.ErrEventParseFailed)
	}
	e.ProviderEventID = strconv.Itoa(d.ID)
	e.Status = onceo.StatusFailed
	e.AmountMinor = d.Amount
	cur, err := sanitiseCurrency(d.Currency)
	if err != nil {
		return e, err
	}
	e.Currency = cur
	e.Reference = d.Reference

	return e, nil
}

func normalizeTransferSuccess(data json.RawMessage, e onceo.Event) (onceo.Event, error) {
	var d TransferSuccessData
	if err := json.Unmarshal(data, &d); err != nil {
		return e, onceo.ErrMalformedPayload
	}

	if d.ID <= 0 {
		return e, fmt.Errorf("%w: transfer success event missing id", onceo.ErrEventParseFailed)
	}
	e.ProviderEventID = strconv.Itoa(d.ID)
	s, err := mapStatus(d.Status)
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
	e.Reference = d.Reference

	return e, nil
}

func normalizeTransferFailed(data json.RawMessage, e onceo.Event) (onceo.Event, error) {
	var d TransferSuccessData
	if err := json.Unmarshal(data, &d); err != nil {
		return e, onceo.ErrMalformedPayload
	}

	if d.ID <= 0 {
		return e, fmt.Errorf("%w: transfer failed event missing id", onceo.ErrEventParseFailed)
	}
	e.ProviderEventID = strconv.Itoa(d.ID)
	e.Status = onceo.StatusFailed
	e.AmountMinor = d.Amount
	cur, err := sanitiseCurrency(d.Currency)
	if err != nil {
		return e, err
	}
	e.Currency = cur
	e.Reference = d.Reference

	return e, nil
}

func mapStatus(status string) (onceo.Status, error) {
	switch status {
	case "success":
		return onceo.StatusSuccess, nil
	case "failed":
		return onceo.StatusFailed, nil
	case "reversed":
		return onceo.StatusReversed, nil
	default:
		return onceo.StatusPending, fmt.Errorf("paystack: unknown status %q", status)
	}
}

var validCurrencies = map[string]bool{
	"NGN": true, "USD": true, "GBP": true, "ZAR": true, "GHS": true,
	"KES": true, "UGX": true, "TZS": true, "RWF": true, "XAF": true,
	"XOF": true, "ZMW": true, "MZN": true, "AOA": true, "BWP": true,
}

func sanitiseCurrency(raw string) (string, error) {
	c := strings.ToUpper(strings.TrimSpace(raw))
	if !validCurrencies[c] {
		return "", fmt.Errorf("paystack: invalid or unsupported currency code %q", raw)
	}
	return c, nil
}
