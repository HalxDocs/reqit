// Package svix verifies and normalizes webhooks delivered through Svix.
//
// Svix is the standard webhook delivery layer used by platforms such as
// Flexprice. It signs every delivery with an HMAC-SHA256 over the string
// "{svix-id}.{svix-timestamp}.{raw-body}" using a base64-encoded secret
// (typically prefixed with "whsec_"), and sends the resulting base64
// signature in the "svix-signature" header as "v1,<signature>".
//
// The delivered body is the *platform's* original webhook payload; the
// svix-* headers carried the delivery envelope. This provider therefore
// treats the body generically and derives the canonical event type from
// the standard envelope "type" field, falling back to "event_type".
//
// The Provider is stateless and safe for concurrent reuse: the svix-id
// dedup key is verified from the headers and surfaced to Process through
// onceo.HeaderDedupKeyer, never stored on the Provider.
package svix

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	onceo "github.com/HalxDocs/onceo-core"
)

const ProviderName = "svix"

const (
	headerID        = "svix-id"
	headerTimestamp = "svix-timestamp"
	headerSignature = "svix-signature"
	signaturePrefix = "whsec_"
	algoVersion     = "v1"

	// maxSignatureEntries bounds the number of space-separated signatures we
	// will attempt to verify. Svix sends a handful (key rotation); capping
	// protects against a forged header that would otherwise drive an
	// unbounded HMAC loop (CPU/amplification DoS).
	maxSignatureEntries = 8
)

// DefaultTolerance is the maximum age, per Svix's standard, that a message
// timestamp may be before the current time.
const DefaultTolerance = 5 * time.Minute

type WebhookPayload struct {
	Type      string          `json:"type"`
	EventType string          `json:"event_type"`
	Data      json.RawMessage `json:"data"`
	APIUser   string          `json:"api_user"`
}

type Provider struct {
	key       []byte
	tolerance time.Duration
}

type Option func(*Provider)

// WithTolerance overrides the default timestamp tolerance window used when
// verifying the "svix-timestamp" header.
func WithTolerance(d time.Duration) Option {
	return func(p *Provider) {
		if d > 0 {
			p.tolerance = d
		}
	}
}

// New returns a provider that verifies Svix webhooks signed with secret.
//
// The secret may be the full "whsec_<base64>" form or a raw key. In the
// whsec_ form, the base64-decoded remainder is used as the HMAC key,
// matching the Svix signing scheme.
func New(secret string, opts ...Option) (*Provider, error) {
	if len(secret) == 0 {
		return nil, fmt.Errorf("svix: signing secret must not be empty")
	}
	p := &Provider{key: decodeKey(secret), tolerance: DefaultTolerance}
	for _, opt := range opts {
		opt(p)
	}
	return p, nil
}

func decodeKey(secret string) []byte {
	raw := strings.TrimPrefix(secret, signaturePrefix)
	if key, err := base64.StdEncoding.DecodeString(raw); err == nil && len(key) > 0 {
		return key
	}
	return []byte(secret)
}

func (p *Provider) Name() string { return ProviderName }

// BodyBound reports true: Svix signs the raw request body so a valid
// signature proves body integrity.
func (p *Provider) BodyBound() bool { return true }

func (p *Provider) VerifySignature(headers http.Header, body []byte) error {
	signedMsg, err := onceo.SingleHeader(headers, headerTimestamp)
	if err != nil {
		return fmt.Errorf("svix: %w", err)
	}

	id, err := onceo.SingleHeader(headers, headerID)
	if err != nil {
		return fmt.Errorf("svix: %w", err)
	}

	ts, err := strconv.ParseInt(signedMsg, 10, 64)
	if err != nil {
		return fmt.Errorf("svix: %w: non-numeric timestamp", onceo.ErrInvalidSignature)
	}
	if delta := ageSeconds(ts); delta > int64(p.tolerance.Seconds()) {
		return fmt.Errorf("svix: %w: timestamp outside tolerance", onceo.ErrInvalidSignature)
	}

	got, err := onceo.SingleHeader(headers, headerSignature)
	if err != nil {
		return fmt.Errorf("svix: %w", err)
	}

	return p.verifySignatures(got, id, signedMsg, body)
}

// HeaderDedupKey returns the verified svix-id header, which Process uses as
// the canonical ProviderEventID. It is only meaningful after VerifySignature
// has succeeded; the id is part of the signed message, so an unverified
// header never reaches Process.
func (p *Provider) HeaderDedupKey(headers http.Header) (string, error) {
	return onceo.SingleHeader(headers, headerID)
}

func ageSeconds(ts int64) int64 {
	d := time.Now().Unix() - ts
	if d < 0 {
		return -d
	}
	return d
}

func (p *Provider) verifySignatures(header, msgID, timestamp string, body []byte) error {
	expected := sign(p.key, msgID, timestamp, body)
	checked := 0
	for _, entry := range strings.Split(header, " ") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		if checked >= maxSignatureEntries {
			break
		}
		checked++
		parts := strings.SplitN(entry, ",", 2)
		if len(parts) != 2 || parts[0] != algoVersion {
			continue
		}
		got, err := base64.StdEncoding.DecodeString(parts[1])
		if err != nil {
			continue
		}
		if subtle.ConstantTimeCompare(got, expected) == 1 {
			return nil
		}
	}
	return fmt.Errorf("svix: %w", onceo.ErrInvalidSignature)
}

func sign(key []byte, id, timestamp string, body []byte) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(id))
	mac.Write([]byte("."))
	mac.Write([]byte(timestamp))
	mac.Write([]byte("."))
	mac.Write(body)
	return mac.Sum(nil)
}

func (p *Provider) Parse(body []byte) (WebhookPayload, error) {
	var payload WebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return payload, onceo.ErrMalformedPayload
	}
	if payload.Type == "" && payload.EventType == "" {
		var nested struct {
			Type      string `json:"type"`
			EventType string `json:"event_type"`
		}
		if len(payload.Data) > 0 {
			_ = json.Unmarshal(payload.Data, &nested)
		}
		if nested.Type != "" {
			payload.Type = nested.Type
		}
		if nested.EventType != "" {
			payload.EventType = nested.EventType
		}
	}
	if payload.Type == "" && payload.EventType == "" {
		return payload, onceo.ErrMalformedPayload
	}
	return payload, nil
}

func (p *Provider) Normalize(parsed WebhookPayload) (onceo.Event, error) {
	if parsed.EventType != "" {
		parsed.Type = parsed.EventType
	}
	if parsed.Type == "" {
		return onceo.Event{}, onceo.ErrMalformedPayload
	}

	// ProviderEventID is left empty here: it is the verified svix-id, which
	// Process fills in from the headers via HeaderDedupKey after verification.
	return onceo.Event{
		Provider: ProviderName,
		Type:     parsed.Type,
		Status:   onceo.StatusPending,
	}, nil
}
