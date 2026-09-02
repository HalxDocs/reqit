package onceo

import (
	"errors"
	"testing"
)

func TestSentinelErrors(t *testing.T) {
	tests := []struct {
		err         error
		sentinel    error
		shouldMatch bool
	}{
		{ErrInvalidSignature, ErrInvalidSignature, true},
		{ErrDuplicateEvent, ErrDuplicateEvent, true},
		{ErrUnknownProvider, ErrUnknownProvider, true},
		{ErrMalformedPayload, ErrMalformedPayload, true},
		{ErrMissingHeader, ErrMissingHeader, true},
		{ErrEventParseFailed, ErrEventParseFailed, true},
		{ErrStoreFailed, ErrStoreFailed, true},
		{ErrInvalidSignature, ErrDuplicateEvent, false},
		{nil, nil, true},
	}

	for _, tt := range tests {
		if tt.shouldMatch && !errors.Is(tt.err, tt.sentinel) {
			t.Errorf("errors.Is(%v, %v) = false, want true", tt.err, tt.sentinel)
		}
		if !tt.shouldMatch && errors.Is(tt.err, tt.sentinel) {
			t.Errorf("errors.Is(%v, %v) = true, want false", tt.err, tt.sentinel)
		}
	}
}

func TestProviderError(t *testing.T) {
	err := &ProviderError{
		Provider: "paystack",
		Err:      ErrInvalidSignature,
	}

	if !errors.Is(err, ErrInvalidSignature) {
		t.Error("ProviderError should unwrap to ErrInvalidSignature")
	}

	if err.Error() != "paystack: invalid webhook signature" {
		t.Errorf("unexpected error message: %s", err.Error())
	}
}

func TestWrapProviderError(t *testing.T) {
	err := WrapProviderError("paystack", ErrInvalidSignature)
	if err == nil {
		t.Fatal("expected non-nil error")
	}

	var pErr *ProviderError
	if !errors.As(err, &pErr) {
		t.Fatal("expected *ProviderError")
	}
	if pErr.Provider != "paystack" {
		t.Errorf("expected provider paystack, got %s", pErr.Provider)
	}

	if WrapProviderError("paystack", nil) != nil {
		t.Error("expected nil for nil input")
	}
}
