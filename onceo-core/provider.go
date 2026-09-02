package onceo

import (
	"context"
	"crypto/rand"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Provider adapts a payment provider's webhook format to the canonical
// Event schema. Implementations MUST verify body integrity unless
// BodyBound() returns false.
//
// BodyBound() indicates whether VerifySignature includes the request body
// in its signature computation. Providers that return false (e.g.,
// Flutterwave) provide NO application-level body integrity — they rely
// entirely on TLS. Callers SHOULD check BodyBound() and refuse to use
// providers that return false in untrusted network environments.
//
// WARNING: Flutterwave's VerifySignature computes a static
// SHA256(secretHash) that does NOT include the request body.
// One captured Verif-Hash permits arbitrary body forgery for ALL
// future webhooks until the secret hash is rotated.
type Provider[T any] interface {
	Name() string
	BodyBound() bool
	VerifySignature(headers http.Header, body []byte) error
	Parse(body []byte) (T, error)
	Normalize(parsed T) (Event, error)
}

// HeaderDedupKeyer is an optional interface a Provider may implement when
// its dedup key lives in a request header (e.g. Svix's svix-id) rather than
// in the body. Process calls it after signature verification succeeds and
// uses the returned value as the canonical ProviderEventID.
//
// Implementations MUST be safe for concurrent use: they must not carry
// per-request mutable state on the Provider, because Process may run
// concurrently for different requests sharing one provider instance.
// Return an error (e.g. a missing or duplicate header) to fail the request.
type HeaderDedupKeyer interface {
	HeaderDedupKey(headers http.Header) (string, error)
}

func generateID(r io.Reader) (string, error) {
	b := make([]byte, 16)
	if _, err := io.ReadFull(r, b); err != nil {
		return "", fmt.Errorf("generating event id: %w", err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16]), nil
}

func checkCtx(ctx context.Context, providerName string) error {
	select {
	case <-ctx.Done():
		return WrapProviderError(providerName, ctx.Err())
	default:
		return nil
	}
}

func validateProviderName(name string) error {
	if name == "" {
		return fmt.Errorf("provider name must not be empty")
	}
	if strings.ContainsAny(name, ":\\") {
		return fmt.Errorf("provider name %q must not contain ':' or '\\'", name)
	}
	return nil
}

func Process[T any](ctx context.Context, p Provider[T], store Store, headers http.Header, body []byte) (Event, error) {
	name := p.Name()

	if err := checkCtx(ctx, name); err != nil {
		return Event{}, err
	}

	if err := validateProviderName(name); err != nil {
		return Event{}, WrapProviderError(name, err)
	}

	if len(body) > MaxBodySize {
		return Event{}, WrapProviderError(name, fmt.Errorf("body exceeds maximum size of %d bytes", MaxBodySize))
	}

	if err := p.VerifySignature(headers, body); err != nil {
		return Event{}, WrapProviderError(name, err)
	}

	if err := checkCtx(ctx, name); err != nil {
		return Event{}, err
	}

	parsed, err := p.Parse(body)
	if err != nil {
		return Event{}, WrapProviderError(name, err)
	}

	if err := checkCtx(ctx, name); err != nil {
		return Event{}, err
	}

	event, err := p.Normalize(parsed)
	if err != nil {
		return Event{}, WrapProviderError(name, err)
	}

	// Providers whose dedup key is carried by a request header (Svix) derive
	// it here, after verification, instead of storing per-request state.
	if hd, ok := p.(HeaderDedupKeyer); ok {
		id, err := hd.HeaderDedupKey(headers)
		if err != nil {
			return Event{}, WrapProviderError(name, err)
		}
		event.ProviderEventID = id
	}

	if event.ProviderEventID == "" {
		return Event{}, WrapProviderError(name, ErrEventParseFailed)
	}
	if len(event.ProviderEventID) > MaxProviderEventIDLength {
		return Event{}, WrapProviderError(name, fmt.Errorf("%w: provider event id exceeds %d bytes", ErrEventParseFailed, MaxProviderEventIDLength))
	}
	if strings.ContainsAny(event.ProviderEventID, ":\\") {
		return Event{}, WrapProviderError(name, fmt.Errorf("%w: provider event id contains reserved characters", ErrEventParseFailed))
	}
	if event.Type == "" {
		return Event{}, WrapProviderError(name, fmt.Errorf("%w: event type is empty", ErrEventParseFailed))
	}
	if event.AmountMinor < 0 {
		return Event{}, WrapProviderError(name, fmt.Errorf("%w: negative amount", ErrEventParseFailed))
	}
	if event.Currency != "" && len(event.Currency) != 3 {
		return Event{}, WrapProviderError(name, fmt.Errorf("%w: invalid currency code %q", ErrEventParseFailed, event.Currency))
	}
	now := time.Now().UTC()
	if !event.ReceivedAt.IsZero() && (event.ReceivedAt.After(now.Add(5*time.Minute)) || event.ReceivedAt.Before(now.Add(-1*time.Hour))) {
		event.ReceivedAt = now
	}

	id, err := generateID(rand.Reader)
	if err != nil {
		return Event{}, WrapProviderError(name, fmt.Errorf("generate event id: %w", err))
	}
	event.ID = id
	event.Provider = name
	event.RawPayload = append([]byte{}, body...)
	if event.ReceivedAt.IsZero() {
		event.ReceivedAt = now
	}

	if err := checkCtx(ctx, name); err != nil {
		return Event{}, err
	}

	created, err := store.SaveIfNew(ctx, event)
	if err != nil {
		return Event{}, WrapProviderError(name, err)
	}
	if !created {
		return Event{}, WrapProviderError(name, ErrDuplicateEvent)
	}

	event.ProcessedAt = time.Now().UTC()
	return event, nil
}
