package oauth2

import (
	"errors"
	"fmt"
	"strings"
)

// Sentinel errors. All are errors.Is-comparable via OAuthError.Unwrap; use
// errors.Is(err, ErrStateMismatch) etc. rather than ==.
var (
	// ErrStateMismatch: the state returned by the provider did not match the
	// value generated for this specific in-flight request.
	ErrStateMismatch = errors.New("oauth2: state mismatch — the callback did not originate from this request")
	// ErrTimeout: the interactive flow was not completed before the deadline.
	ErrTimeout = errors.New("oauth2: authorization flow timed out")
	// ErrProviderDenied: the provider refused the request (access_denied or a
	// provider-side error). The wrapped ProviderError carries the verbatim
	// error/error_description.
	ErrProviderDenied = errors.New("oauth2: the provider denied the request")
	// ErrPortBindFailed: the loopback callback listener could not bind.
	ErrPortBindFailed = errors.New("oauth2: could not bind the loopback callback listener")
	// ErrRefreshFailed: the refresh_token grant failed (revoked or expired
	// refresh token). Callers must fall back to a re-authorization prompt.
	ErrRefreshFailed = errors.New("oauth2: token refresh failed — re-authorization required")
	// ErrFlowInProgress: a single interactive flow is already running.
	ErrFlowInProgress = errors.New("oauth2: an authorization flow is already in progress")
	// ErrMissingCallback: no code/token/state was present in the callback.
	ErrMissingCallback = errors.New("oauth2: the provider callback was missing required parameters")
	// ErrNoRefreshToken: the provider issued no refresh token (e.g. GitHub
	// classic OAuth apps). Not a failure per se — callers should re-authorize.
	ErrNoRefreshToken = errors.New("oauth2: the provider issued no refresh token")
	// ErrInvalidConfig: the OAuthConfig was incomplete or malformed.
	ErrInvalidConfig = errors.New("oauth2: invalid OAuth configuration")
	// ErrDiscoveryFailed: OIDC/.well-known metadata could not be fetched/parsed.
	ErrDiscoveryFailed = errors.New("oauth2: OpenID Connect discovery failed")
	// ErrTokenStore: the OS keychain read/write failed.
	ErrTokenStore = errors.New("oauth2: token store (keychain) operation failed")
)

// OAuthError wraps a sentinel kind with operation context and, when the
// failure came from the provider, the verbatim ProviderError so the UI can
// render error/error_description exactly as the server returned them.
type OAuthError struct {
	// Op is the high-level operation, e.g. "authorize", "exchange",
	// "refresh", "device_start".
	Op string
	// Kind is one of the sentinels above; Error/Unwrap expose it for
	// errors.Is.
	Kind error
	// Msg is additional local context (never a replacement for a provider
	// description).
	Msg string
	// Provider carries the verbatim server error, if any.
	Provider *ProviderError
}

func (e *OAuthError) Error() string {
	var sb strings.Builder
	if e.Op != "" {
		sb.WriteString(e.Op)
		sb.WriteString(": ")
	}
	sb.WriteString(e.Kind.Error())
	if e.Msg != "" {
		sb.WriteString(": ")
		sb.WriteString(e.Msg)
	}
	if e.Provider != nil {
		if p := e.Provider.Error(); p != "" {
			sb.WriteString(": ")
			sb.WriteString(p)
		}
	}
	return sb.String()
}

// Unwrap exposes the sentinel so errors.Is(err, ErrStateMismatch) works.
func (e *OAuthError) Unwrap() error { return e.Kind }

// ProviderCode returns the provider's verbatim error code, or "" if none.
func (e *OAuthError) ProviderCode() string {
	if e == nil || e.Provider == nil {
		return ""
	}
	return e.Provider.Code
}

// ProviderDescription returns the provider's verbatim error_description,
// or "" if none.
func (e *OAuthError) ProviderDescription() string {
	if e == nil || e.Provider == nil {
		return ""
	}
	return e.Provider.Description
}

// --- Constructors ----------------------------------------------------------

func newOAuthError(kind error, op, msg string) *OAuthError {
	return &OAuthError{Op: op, Kind: kind, Msg: msg}
}

// StateMismatchError is returned when the provider's state parameter does not
// match the one generated for the in-flight request.
func StateMismatchError(op string) *OAuthError {
	return newOAuthError(ErrStateMismatch, op, "")
}

// TimeoutError is returned when the interactive flow exceeds its deadline.
func TimeoutError(op string) *OAuthError {
	return newOAuthError(ErrTimeout, op, "")
}

// PortBindFailedError wraps the underlying bind failure (port in use, no
// loopback, etc.).
func PortBindFailedError(op string, cause error) *OAuthError {
	return &OAuthError{Op: op, Kind: ErrPortBindFailed, Msg: causeStr(cause)}
}

// FlowInProgressError is returned when a flow is already running.
func FlowInProgressError(op string) *OAuthError {
	return newOAuthError(ErrFlowInProgress, op, "")
}

// MissingCallbackError is returned when the callback lacks code/state.
func MissingCallbackError(op string) *OAuthError {
	return newOAuthError(ErrMissingCallback, op, "")
}

// InvalidConfigError reports a malformed or incomplete configuration.
func InvalidConfigError(op, msg string) *OAuthError {
	return newOAuthError(ErrInvalidConfig, op, msg)
}

// ProviderDeniedError wraps a verbatim provider error (RFC 6749 §5.2).
func ProviderDeniedError(op string, p *ProviderError) *OAuthError {
	return &OAuthError{Op: op, Kind: ErrProviderDenied, Provider: p}
}

// RefreshFailedError wraps a verbatim provider error from a failed
// refresh_token grant.
func RefreshFailedError(op string, p *ProviderError) *OAuthError {
	return &OAuthError{Op: op, Kind: ErrRefreshFailed, Provider: p}
}

// DiscoveryFailedError wraps a discovery fetch/parse failure.
func DiscoveryFailedError(op string, cause error) *OAuthError {
	return &OAuthError{Op: op, Kind: ErrDiscoveryFailed, Msg: causeStr(cause)}
}

// TokenStoreError wraps a keyring failure.
func TokenStoreError(op string, cause error) *OAuthError {
	return &OAuthError{Op: op, Kind: ErrTokenStore, Msg: causeStr(cause)}
}

func causeStr(cause error) string {
	if cause == nil {
		return ""
	}
	return fmt.Sprintf("%v", cause)
}
