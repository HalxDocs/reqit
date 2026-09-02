package onceo

import (
	"errors"
	"fmt"
)

var (
	ErrInvalidSignature = errors.New("invalid webhook signature")
	ErrDuplicateEvent   = errors.New("duplicate event: already processed")
	ErrUnknownProvider  = errors.New("unknown payment provider")
	ErrMalformedPayload = errors.New("malformed webhook payload")
	ErrMissingHeader    = errors.New("missing required signature header")
	ErrDuplicateHeader  = errors.New("duplicate header present")
	ErrEventParseFailed = errors.New("malformed event: empty or unparseable provider event id")
	ErrStoreFailed      = errors.New("store operation failed")
)

type ProviderError struct {
	Provider string
	Err      error
}

func (e *ProviderError) Error() string {
	return fmt.Sprintf("%s: %v", e.Provider, e.Err)
}

func (e *ProviderError) Unwrap() error {
	return e.Err
}

func WrapProviderError(provider string, err error) error {
	if err == nil {
		return nil
	}
	return &ProviderError{Provider: provider, Err: err}
}
