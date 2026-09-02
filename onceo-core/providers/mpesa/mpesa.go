// Package mpesa implements the onceo Provider for Safaricom M-Pesa callbacks.
//
// # Security
//
// M-Pesa's native security model is IP whitelisting at the network layer.
// This library does NOT rely on IP whitelisting. Instead, every callback
// must carry a shared secret in the X-Onceo-Mpesa-Callback-Token header,
// which is compared using ConstantTimeCompare.
//
// The callback token is a static bearer credential:
//   - An attacker who observes ONE legitimate callback (e.g., via an HTTP
//     log, TLS inspection proxy, or compromised intermediary) captures a
//     token that is valid for ALL future callbacks until the merchant
//     rotates it.
//   - Body integrity relies entirely on TLS.
//   - The token length is enforced at minimum 32 bytes, but entropy is
//     not measured. Use a cryptographically random token with at least
//     128 bits of entropy.
//
// Integrators should supplement this with M-Pesa's IP whitelisting or
// additional per-request checks.
package mpesa

import (
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"

	onceo "github.com/HalxDocs/onceo-core"
)

const ProviderName = "mpesa"

type STKCallbackPayload struct {
	Body struct {
		StkCallback struct {
			MerchantRequestID string `json:"MerchantRequestID"`
			CheckoutRequestID string `json:"CheckoutRequestID"`
			ResultCode        int    `json:"ResultCode"`
			ResultDesc        string `json:"ResultDesc"`
			CallbackMetadata  *struct {
				Item []struct {
					Name  string      `json:"Name"`
					Value interface{} `json:"Value"`
				} `json:"Item"`
			} `json:"CallbackMetadata"`
		} `json:"stkCallback"`
	} `json:"Body"`
}

type C2BPayload struct {
	TransactionType   string `json:"TransactionType"`
	TransID           string `json:"TransID"`
	TransTime         string `json:"TransTime"`
	TransAmount       string `json:"TransAmount"`
	BusinessShortCode string `json:"BusinessShortCode"`
	BillRefNumber     string `json:"BillRefNumber"`
	InvoiceNumber     string `json:"InvoiceNumber"`
	OrgAccountBalance string `json:"OrgAccountBalance"`
	ThirdPartyTransID string `json:"ThirdPartyTransID"`
	MSISDN            string `json:"MSISDN"`
	FirstName         string `json:"FirstName"`
	MiddleName        string `json:"MiddleName"`
	LastName          string `json:"LastName"`
}

type Provider struct {
	callbackToken string
}

func New(callbackToken string) (*Provider, error) {
	if len(callbackToken) < 32 {
		return nil, fmt.Errorf("mpesa: callback token must be at least 32 bytes")
	}
	return &Provider{callbackToken: callbackToken}, nil
}

func (p *Provider) Name() string {
	return ProviderName
}

func (p *Provider) BodyBound() bool { return true }

func (p *Provider) VerifySignature(headers http.Header, body []byte) error {
	token, err := onceo.SingleHeader(headers, "X-Onceo-Mpesa-Callback-Token")
	if err != nil {
		return err
	}
	if subtle.ConstantTimeCompare([]byte(token), []byte(p.callbackToken)) != 1 {
		return onceo.ErrInvalidSignature
	}
	return nil
}

func (p *Provider) Parse(body []byte) (STKCallbackPayload, error) {
	var payload STKCallbackPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return payload, onceo.ErrMalformedPayload
	}
	if payload.Body.StkCallback.CheckoutRequestID == "" {
		return payload, onceo.ErrMalformedPayload
	}
	return payload, nil
}

func (p *Provider) Normalize(raw STKCallbackPayload) (onceo.Event, error) {
	cb := raw.Body.StkCallback

	event := onceo.Event{
		Provider:        ProviderName,
		ProviderEventID: cb.CheckoutRequestID,
		Type:            "stk.push",
		Reference:       cb.MerchantRequestID,
	}

	switch cb.ResultCode {
	case 0:
		event.Status = onceo.StatusSuccess
		amountFound := false
		if cb.CallbackMetadata != nil {
			for _, item := range cb.CallbackMetadata.Item {
				switch item.Name {
				case "Amount":
					var err error
					event.AmountMinor, err = parseMpesaAmount(item.Value)
					if err != nil {
						return onceo.Event{}, fmt.Errorf("mpesa: normalize: %w", err)
					}
					amountFound = true
				case "MpesaReceiptNumber":
					if s, ok := item.Value.(string); ok && s != "" {
						event.Reference = s
					}
				}
			}
		}
		if !amountFound {
			return onceo.Event{}, fmt.Errorf("mpesa: successful stk push missing Amount in CallbackMetadata")
		}
		event.Currency = "KES"
	case 1037:
		event.Status = onceo.StatusFailed
	case 1032:
		event.Status = onceo.StatusFailed
	default:
		event.Status = onceo.StatusFailed
	}

	return event, nil
}

func (p *Provider) ParseC2B(body []byte) (C2BPayload, error) {
	var payload C2BPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return payload, onceo.ErrMalformedPayload
	}
	if payload.TransID == "" {
		return payload, onceo.ErrMalformedPayload
	}
	return payload, nil
}

func parseC2BAmount(raw string) (int64, error) {
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

func (p *Provider) NormalizeC2B(raw C2BPayload) (onceo.Event, error) {
	status, err := mapC2BStatus(raw.TransactionType)
	if err != nil {
		return onceo.Event{}, err
	}

	amount, err := parseC2BAmount(raw.TransAmount)
	if err != nil {
		return onceo.Event{}, fmt.Errorf("mpesa: c2b amount: %w", err)
	}

	event := onceo.Event{
		Provider:        ProviderName,
		ProviderEventID: raw.TransID,
		Type:            "c2b." + strings.ReplaceAll(strings.ToLower(raw.TransactionType), " ", "_"),
		Status:          status,
		AmountMinor:     amount,
		Currency:        "KES",
		Reference:       raw.BillRefNumber,
	}

	return event, nil
}

func mapC2BStatus(transactionType string) (onceo.Status, error) {
	switch strings.ToLower(transactionType) {
	case "pay bill", "buy goods":
		return onceo.StatusSuccess, nil
	case "reversal":
		return onceo.StatusReversed, nil
	default:
		return onceo.StatusPending, fmt.Errorf("mpesa: unknown C2B transaction type %q", transactionType)
	}
}

func parseMpesaAmount(v interface{}) (int64, error) {
	switch val := v.(type) {
	case float64:
		if val < 0 {
			return 0, fmt.Errorf("negative amount %v", v)
		}
		if val > 1e15 {
			return 0, fmt.Errorf("amount %v exceeds maximum", v)
		}
		// Route floats through the decimal string parser so rounding is
		// based on the decimal representation (e.g. 0.1) rather than the
		// binary float64 approximation, which would otherwise produce
		// off-by-one values like 10 for 0.10.
		raw := strconv.FormatFloat(val, 'f', -1, 64)
		return parseAmountString(raw, v)
	case int:
		if val < 0 {
			return 0, fmt.Errorf("negative amount %v", v)
		}
		v := int64(val)
		if v > math.MaxInt64/100 {
			return 0, fmt.Errorf("amount %v exceeds maximum", v)
		}
		return v * 100, nil
	case int64:
		if val < 0 {
			return 0, fmt.Errorf("negative amount %v", v)
		}
		if val > math.MaxInt64/100 {
			return 0, fmt.Errorf("amount %v exceeds maximum", v)
		}
		return val * 100, nil
	case string:
		return parseAmountString(strings.TrimSpace(val), v)
	case json.Number:
		return parseAmountString(string(val), v)
	default:
		return 0, fmt.Errorf("unexpected amount type %T", v)
	}
}

func parseAmountString(raw string, orig interface{}) (int64, error) {
	if raw == "" {
		return 0, fmt.Errorf("empty amount")
	}
	if strings.HasPrefix(raw, "-") {
		return 0, fmt.Errorf("negative amount %v", orig)
	}
	parts := strings.SplitN(raw, ".", 2)
	wholeStr := parts[0]
	if wholeStr == "" {
		wholeStr = "0"
	}
	whole, err := strconv.ParseInt(wholeStr, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid amount %v: %w", orig, err)
	}
	frac := int64(0)
	if len(parts) == 2 {
		if len(parts[1]) > 2 {
			return 0, fmt.Errorf("invalid amount %v: more than 2 decimal places", orig)
		}
		fracStr := parts[1]
		for _, c := range fracStr {
			if c < '0' || c > '9' {
				return 0, fmt.Errorf("invalid amount %v: non-digit in fractional part", orig)
			}
		}
		for len(fracStr) < 2 {
			fracStr += "0"
		}
		frac, err = strconv.ParseInt(fracStr, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid amount %v: %w", orig, err)
		}
	}
	if whole > math.MaxInt64/100 {
		return 0, fmt.Errorf("amount %v exceeds maximum", orig)
	}
	result := whole * 100
	if result > math.MaxInt64-frac {
		return 0, fmt.Errorf("amount %v exceeds maximum", orig)
	}
	return result + frac, nil
}
