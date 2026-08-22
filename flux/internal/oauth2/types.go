package oauth2

// Canonical OAuth 2.0 types for the reqit engine. This file is the single
// source of truth for the wire/JSON shape exchanged with the Wails bindings
// and, later, the OS keychain store. The legacy OAuth2Config / TokenResponse
// types in oauth2.go are kept until the bindings migrate to these types.

// GrantType identifies the OAuth 2.0 flow a request uses. The values are the
// flow identifiers used throughout reqit; the exact wire value sent to a
// token endpoint (e.g. the RFC 8628 URN for device_code) is resolved by the
// exchange layer.
type GrantType string

const (
	GrantAuthorizationCode GrantType = "authorization_code"
	GrantClientCredentials GrantType = "client_credentials"
	GrantDeviceCode        GrantType = "device_code" // RFC 8628 — polling flow, no redirect_uri
	GrantPassword          GrantType = "password"    // deprecated by RFC 9700
	GrantImplicit          GrantType = "implicit"    // deprecated by RFC 9700 — fragment, no token endpoint
	GrantRefreshToken      GrantType = "refresh_token"
)

// ClientAuthMode controls how a (confidential) client authenticates to the
// token endpoint, per RFC 6749 §2.3. Body is the default; Basic is required
// by providers that reject credentials in the request body.
type ClientAuthMode string

const (
	ClientAuthBody  ClientAuthMode = "body"  // client_id (+ client_secret) in the POST body
	ClientAuthBasic ClientAuthMode = "basic" // HTTP Basic header (RFC 6749 §2.3.1)
)

// PKCEMethod is the code challenge method from RFC 7636 §4.3.
type PKCEMethod string

const (
	PKCES256  PKCEMethod = "S256"
	PKCEPlain PKCEMethod = "plain"
	// PKCENone disables PKCE entirely, for legacy providers that reject
	// unknown parameters. Never the default — PKCE is always on for public
	// clients (RFC 8252 §8.5); this is the "advanced/legacy" escape hatch.
	PKCENone PKCEMethod = "none"
)

// RedirectMode describes how an interactive authorization flow is completed.
type RedirectMode string

const (
	// RedirectLoopback: the engine listens on 127.0.0.1:0 (ephemeral) or a
	// user-registered fixed port and receives the callback itself.
	RedirectLoopback RedirectMode = "loopback"
	// RedirectManual: the full authorize URL is shown and the user pastes the
	// provider's redirect URL back into reqit (Postman-style fallback).
	RedirectManual RedirectMode = "manual"
)

// OAuthConfig is the canonical OAuth 2.0 configuration for a request, folder,
// or collection. Only non-secret fields may ever be written to git-tracked
// collection JSON: ClientSecret is never stored here, and live tokens are kept
// in the OS keychain referenced by TokenRef.
type OAuthConfig struct {
	GrantType GrantType `json:"grantType"`

	// Issuer, when set, triggers OIDC discovery ({issuer}/.well-known/
	// openid-configuration) to autofill AuthURL/TokenURL/DeviceURL.
	Issuer    string `json:"issuer,omitempty"`
	AuthURL   string `json:"authUrl"`
	TokenURL  string `json:"tokenUrl"`
	DeviceURL string `json:"deviceUrl,omitempty"`

	ClientID string `json:"clientId"`
	// Confidential marks a client that the provider issued a client_secret
	// for. A public/native client (the default for reqit) must never send
	// client_secret — RFC 8252 §8.5. The secret itself lives in the keychain.
	Confidential bool           `json:"confidential,omitempty"`
	ClientAuth   ClientAuthMode `json:"clientAuth,omitempty"`

	Scopes string `json:"scopes"`
	// RedirectURI is the exact pre-registered redirect URI (e.g. a fixed
	// loopback port for GitHub/Slack-style providers), or empty to let the
	// engine bind an ephemeral loopback port per RFC 8252 §7.3.
	RedirectURI string `json:"redirectUri,omitempty"`

	// PKCE is the code challenge method. Empty means S256 for
	// authorization_code — PKCE is always on by default for public clients.
	PKCE PKCEMethod `json:"pkce,omitempty"`

	// TokenRef names the keyring entry holding this client's live tokens,
	// keyed reqit:{workspaceID}:{ref}:{providerHost}. Never store the tokens
	// themselves in the collection file.
	TokenRef string `json:"tokenRef,omitempty"`
}

// TokenResult is the normalized outcome of a successful token exchange.
// ExpiresAtMs is the Unix epoch in milliseconds (JavaScript-compatible) so the
// renderer can compare it directly against Date.now() without unit drift.
type TokenResult struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken,omitempty"`
	TokenType    string `json:"tokenType"`
	Scope        string `json:"scope,omitempty"`
	ExpiresIn    int    `json:"expiresIn"` // seconds, per RFC 6749 §5.1
	ExpiresAtMs  int64  `json:"expiresAtMs"`
	IDToken      string `json:"idToken,omitempty"` // OIDC, when issued
}

// Expired reports whether the token is expired or within skew of expiry.
// skew is a duration buffer (typically 60s) so a token is refreshed before
// it actually dies.
func (t *TokenResult) Expired(nowMs, skewMs int64) bool {
	return t == nil || t.ExpiresAtMs == 0 || nowMs+skewMs >= t.ExpiresAtMs
}

// ProviderError is an RFC 6749 §5.2 error returned by an authorization or
// token endpoint. Code, Description, and URI map directly to the error,
// error_description, and error_uri parameters and must be surfaced to the
// user verbatim — never swallowed into a generic failure message.
type ProviderError struct {
	Code        string `json:"error"`
	Description string `json:"error_description,omitempty"`
	URI         string `json:"error_uri,omitempty"`
	StatusCode  int    `json:"-"` // HTTP status the provider returned, 0 if unknown
}

func (e *ProviderError) Error() string {
	if e == nil {
		return ""
	}
	switch {
	case e.Description != "" && e.URI != "":
		return e.Code + ": " + e.Description + " (" + e.URI + ")"
	case e.Description != "":
		return e.Code + ": " + e.Description
	case e.URI != "":
		return e.Code + " (" + e.URI + ")"
	default:
		return e.Code
	}
}

// RedirectResult describes how an interactive flow should proceed once the
// engine has prepared it: which authorize URL to open, the exact redirect_uri
// that was sent (needed by the user to register it, and by manual mode), the
// state bound to this in-flight request, and how the callback will be
// received.
//
// Note is non-empty when the engine had to deviate from the configured
// redirect URI (e.g. a fixed loopback port that was already in use fell back
// to an auto-assigned port). The UI must surface it — the user may need to
// update the redirect URI registered with their provider.
type RedirectResult struct {
	AuthorizeURL string       `json:"authorizeUrl"`
	RedirectURI  string       `json:"redirectUri"`
	State        string       `json:"state"`
	Mode         RedirectMode `json:"mode"`
	Note         string       `json:"note,omitempty"`
}
