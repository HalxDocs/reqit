package oauth2

import (
	"errors"
	"strings"
	"testing"
	"time"
)

// TestOAuthErrorsAreDistinctSentinels: every sentinel must be a distinct
// error so errors.Is disambiguates failure classes.
func TestOAuthErrorsAreDistinctSentinels(t *testing.T) {
	sentinels := []error{
		ErrStateMismatch, ErrTimeout, ErrProviderDenied, ErrPortBindFailed,
		ErrRefreshFailed, ErrFlowInProgress, ErrMissingCallback,
		ErrNoRefreshToken, ErrInvalidConfig, ErrDiscoveryFailed, ErrTokenStore,
	}
	for i, a := range sentinels {
		for j, b := range sentinels {
			if i != j && a == b {
				t.Errorf("sentinel %d and %d are the same error: %v", i, j, a)
			}
		}
	}
}

// TestErrorsIsMatchesSentinel: every constructor unwraps to its sentinel so
// errors.Is(err, ErrX) works on the wrapped value.
func TestErrorsIsMatchesSentinel(t *testing.T) {
	cases := []struct {
		name     string
		err      error
		sentinel error
	}{
		{"state mismatch", StateMismatchError("authorize"), ErrStateMismatch},
		{"timeout", TimeoutError("authorize"), ErrTimeout},
		{"port bind", PortBindFailedError("authorize", errors.New("address in use")), ErrPortBindFailed},
		{"flow in progress", FlowInProgressError("authorize"), ErrFlowInProgress},
		{"missing callback", MissingCallbackError("callback"), ErrMissingCallback},
		{"invalid config", InvalidConfigError("exchange", "client_id required"), ErrInvalidConfig},
		{"provider denied", ProviderDeniedError("exchange", &ProviderError{Code: "access_denied"}), ErrProviderDenied},
		{"refresh failed", RefreshFailedError("refresh", &ProviderError{Code: "invalid_grant"}), ErrRefreshFailed},
		{"discovery failed", DiscoveryFailedError("discover", errors.New("404")), ErrDiscoveryFailed},
		{"token store", TokenStoreError("store", errors.New("dbus")), ErrTokenStore},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if !errors.Is(c.err, c.sentinel) {
				t.Errorf("errors.Is(%v, %v) = false", c.err, c.sentinel)
			}
		})
	}
}

// TestErrorsIsRejectsWrongSentinel: an OAuthError must NOT match an unrelated
// sentinel.
func TestErrorsIsRejectsWrongSentinel(t *testing.T) {
	err := StateMismatchError("authorize")
	if errors.Is(err, ErrTimeout) {
		t.Error("state mismatch error should not match ErrTimeout")
	}
}

// TestProviderErrorFormatting covers the RFC 6749 §5.2 error rendering, which
// is what gets shown to the user verbatim.
func TestProviderErrorFormatting(t *testing.T) {
	cases := []struct {
		name string
		p    *ProviderError
		want string
	}{
		{"code only", &ProviderError{Code: "invalid_request"}, "invalid_request"},
		{"code+desc", &ProviderError{Code: "access_denied", Description: "The user denied the request"}, "access_denied: The user denied the request"},
		{"code+desc+uri", &ProviderError{Code: "server_error", Description: "boom", URI: "https://idp/errors/42"}, "server_error: boom (https://idp/errors/42)"},
		{"code+uri", &ProviderError{Code: "temporarily_unavailable", URI: "https://idp/errors/7"}, "temporarily_unavailable (https://idp/errors/7)"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := c.p.Error(); got != c.want {
				t.Errorf("Error() = %q, want %q", got, c.want)
			}
		})
	}
	if (&ProviderError{}).Error() != "" {
		t.Error("empty ProviderError should render empty")
	}
	var nilP *ProviderError
	if nilP.Error() != "" {
		t.Error("nil ProviderError should render empty")
	}
}

// TestOAuthErrorMessage: op + kind + verbatim provider description, in that
// order, without swallowing the provider text into a generic message.
func TestOAuthErrorMessage(t *testing.T) {
	e := ProviderDeniedError("exchange", &ProviderError{
		Code:        "invalid_grant",
		Description: "The authorization code is expired",
	})
	msg := e.Error()
	if !strings.HasPrefix(msg, "exchange: ") {
		t.Errorf("message should start with the operation: %q", msg)
	}
	if !strings.Contains(msg, "invalid_grant") || !strings.Contains(msg, "The authorization code is expired") {
		t.Errorf("provider error text missing from message: %q", msg)
	}
	if e.ProviderCode() != "invalid_grant" {
		t.Errorf("ProviderCode() = %q", e.ProviderCode())
	}
	if e.ProviderDescription() != "The authorization code is expired" {
		t.Errorf("ProviderDescription() = %q", e.ProviderDescription())
	}
}

// TestOAuthErrorAccessorsOnNil are safe to call on a nil *OAuthError.
func TestOAuthErrorAccessorsOnNil(t *testing.T) {
	var e *OAuthError
	if e.ProviderCode() != "" || e.ProviderDescription() != "" {
		t.Error("nil *OAuthError accessors should be empty")
	}
}

// TestTokenResultExpired: ExpiresAtMs is compared against a now+skew window in
// milliseconds (the unit the renderer uses via Date.now()).
func TestTokenResultExpired(t *testing.T) {
	nowMs := time.Now().UnixMilli()
	ok := &TokenResult{AccessToken: "t", ExpiresAtMs: nowMs + 3600_000}
	if ok.Expired(nowMs, 60_000) {
		t.Error("fresh token should not be expired")
	}
	withinSkew := &TokenResult{AccessToken: "t", ExpiresAtMs: nowMs + 30_000}
	if !withinSkew.Expired(nowMs, 60_000) {
		t.Error("token inside the skew buffer should count as expired so it refreshes early")
	}
	expired := &TokenResult{AccessToken: "t", ExpiresAtMs: nowMs - 1}
	if !expired.Expired(nowMs, 0) {
		t.Error("expired token should report expired")
	}
	noExpiry := &TokenResult{AccessToken: "t", ExpiresAtMs: 0}
	if !noExpiry.Expired(nowMs, 60_000) {
		t.Error("token with unknown expiry should be treated as expired")
	}
	var nilTok *TokenResult
	if !nilTok.Expired(nowMs, 60_000) {
		t.Error("nil token should be treated as expired")
	}
}
