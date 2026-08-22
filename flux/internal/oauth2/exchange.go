package oauth2

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// tokenClient is the HTTP client used for token-endpoint requests.
var tokenClient = &http.Client{Timeout: 30 * time.Second}

// Exchanger turns a successful authorization code into a token result. The
// loopback callback handler depends on this interface so it can be unit-tested
// with a fake provider and wired to the real engine in production.
type Exchanger interface {
	ExchangeCode(ctx context.Context, code string) (*TokenResult, error)
}

// ExchangeOptions carries the grant-specific parameters for Exchange.
// ClientSecret is resolved from the OS keychain by the caller and is only ever
// sent when the config marks the client Confidential — never in a PKCE
// public-client exchange.
type ExchangeOptions struct {
	Code         string // GrantAuthorizationCode
	CodeVerifier string // PKCE verifier for GrantAuthorizationCode
	RedirectURI  string // overrides cfg.RedirectURI for the token request
	RefreshToken string // GrantRefreshToken
	Username     string // GrantPassword
	Password     string // GrantPassword
	DeviceCode   string // GrantDeviceCode (see DevicePoll)
	Scope        string // GrantClientCredentials / GrantPassword
	ClientSecret string
}

// Exchange performs the token request for cfg.GrantType against cfg.TokenURL
// with the correct parameter set per RFC 6749 / 7636 / 8628. Provider errors
// (RFC 6749 §5.2) are surfaced verbatim through the typed OAuthError.
func Exchange(ctx context.Context, cfg OAuthConfig, opts ExchangeOptions) (*TokenResult, error) {
	if cfg.TokenURL == "" {
		return nil, InvalidConfigError("exchange", "token URL is required")
	}
	switch cfg.GrantType {
	case GrantAuthorizationCode:
		if opts.Code == "" {
			return nil, InvalidConfigError("exchange", "authorization code is required")
		}
		return exchangeAuthorizationCode(ctx, cfg, opts)
	case GrantRefreshToken:
		if opts.RefreshToken == "" {
			return nil, InvalidConfigError("exchange", "refresh token is required")
		}
		return exchangeRefreshToken(ctx, cfg, opts)
	case GrantClientCredentials:
		return exchangeClientCredentials(ctx, cfg, opts)
	case GrantPassword:
		return exchangePassword(ctx, cfg, opts)
	case GrantDeviceCode:
		// RFC 8628 has a pending/slow_down lifecycle a single call cannot
		// express — use DeviceStart/DevicePoll.
		return nil, InvalidConfigError("exchange", "device code flow requires StartDevice/PollDevice")
	case GrantImplicit, "":
		return nil, InvalidConfigError("exchange", fmt.Sprintf("grant %q does not use the token endpoint", cfg.GrantType))
	default:
		return nil, InvalidConfigError("exchange", fmt.Sprintf("unsupported grant type %q", cfg.GrantType))
	}
}

func exchangeAuthorizationCode(ctx context.Context, cfg OAuthConfig, opts ExchangeOptions) (*TokenResult, error) {
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", opts.Code)
	redirectURI := opts.RedirectURI
	if redirectURI == "" {
		redirectURI = cfg.RedirectURI
	}
	if redirectURI != "" {
		form.Set("redirect_uri", redirectURI)
	}
	if opts.CodeVerifier != "" {
		form.Set("code_verifier", opts.CodeVerifier)
	}

	tr, err := doTokenRequest(ctx, cfg, opts, form)
	if err != nil {
		// GitHub reports a redirect_uri mismatch as bad_verification_code and
		// documents retrying without redirect_uri (the callback URL is taken
		// from the app registration).
		var pe *ProviderError
		if errors.As(err, &pe) && pe.Code == "bad_verification_code" && form.Get("redirect_uri") != "" {
			form.Del("redirect_uri")
			if tr2, err2 := doTokenRequest(ctx, cfg, opts, form); err2 == nil {
				return tr2, nil
			}
		}
		return nil, ProviderDeniedError("exchange", asProviderError(err))
	}
	return tr, nil
}

func exchangeRefreshToken(ctx context.Context, cfg OAuthConfig, opts ExchangeOptions) (*TokenResult, error) {
	form := url.Values{}
	form.Set("grant_type", "refresh_token")
	form.Set("refresh_token", opts.RefreshToken)
	tr, err := doTokenRequest(ctx, cfg, opts, form)
	if err != nil {
		return nil, RefreshFailedError("refresh", asProviderError(err))
	}
	return tr, nil
}

func exchangeClientCredentials(ctx context.Context, cfg OAuthConfig, opts ExchangeOptions) (*TokenResult, error) {
	form := url.Values{}
	form.Set("grant_type", "client_credentials")
	if opts.Scope != "" {
		form.Set("scope", opts.Scope)
	}
	tr, err := doTokenRequest(ctx, cfg, opts, form)
	if err != nil {
		return nil, ProviderDeniedError("client_credentials", asProviderError(err))
	}
	return tr, nil
}

func exchangePassword(ctx context.Context, cfg OAuthConfig, opts ExchangeOptions) (*TokenResult, error) {
	if opts.Username == "" || opts.Password == "" {
		return nil, InvalidConfigError("password", "username and password are required")
	}
	form := url.Values{}
	form.Set("grant_type", "password")
	form.Set("username", opts.Username)
	form.Set("password", opts.Password)
	if opts.Scope != "" {
		form.Set("scope", opts.Scope)
	}
	tr, err := doTokenRequest(ctx, cfg, opts, form)
	if err != nil {
		return nil, ProviderDeniedError("password", asProviderError(err))
	}
	return tr, nil
}

// doTokenRequest POSTs the form to cfg.TokenURL with client authentication
// applied, then parses the response. Provider errors are returned as
// *ProviderError (errors.As-comparable); transport/config errors are wrapped
// plain errors.
func doTokenRequest(ctx context.Context, cfg OAuthConfig, opts ExchangeOptions, form url.Values) (*TokenResult, error) {
	req, err := http.NewRequestWithContext(ctx, "POST", cfg.TokenURL, nil)
	if err != nil {
		return nil, fmt.Errorf("oauth2: build token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	applyClientAuth(cfg, opts.ClientSecret, form, req)
	req.Body = io.NopCloser(strings.NewReader(form.Encode()))

	resp, err := tokenClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("oauth2: token request failed: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))

	tr, perr := parseTokenResponse(body, resp.StatusCode)
	if perr != nil {
		return nil, perr
	}
	if tr == nil {
		return nil, fmt.Errorf("oauth2: empty token response from %s", cfg.TokenURL)
	}
	return tr, nil
}

// applyClientAuth adds client credentials per RFC 6749 §2.3: client_id in the
// body for public clients; for confidential clients the client_secret in the
// body (default) or HTTP Basic (ClientAuthBasic). A client_secret is only sent
// when the config marks the client Confidential — a PKCE public-client
// exchange never includes it, even if a secret was supplied.
func applyClientAuth(cfg OAuthConfig, clientSecret string, form url.Values, req *http.Request) {
	hasSecret := cfg.Confidential && clientSecret != ""
	switch {
	case cfg.ClientAuth == ClientAuthBasic && hasSecret:
		req.SetBasicAuth(cfg.ClientID, clientSecret)
	default:
		if cfg.ClientID != "" {
			form.Set("client_id", cfg.ClientID)
		}
		if hasSecret && cfg.ClientAuth != ClientAuthBasic {
			form.Set("client_secret", clientSecret)
		}
	}
}

// parseTokenResponse decodes a token endpoint response (JSON preferred, with
// application/x-www-form-urlencoded fallback for GitHub-style providers) into
// a TokenResult, or a verbatim ProviderError when the server reported one.
// Returns (nil, nil) for an unparseable-but-2xx response without a token.
func parseTokenResponse(body []byte, statusCode int) (*TokenResult, *ProviderError) {
	var raw struct {
		AccessToken      string `json:"access_token"`
		RefreshToken     string `json:"refresh_token"`
		TokenType        string `json:"token_type"`
		ExpiresIn        int    `json:"expires_in"`
		Scope            string `json:"scope"`
		IDToken          string `json:"id_token"`
		Error            string `json:"error"`
		ErrorDescription string `json:"error_description"`
		ErrorURI         string `json:"error_uri"`
	}
	if err := json.Unmarshal(body, &raw); err != nil || (raw.AccessToken == "" && raw.Error == "") {
		if vals, perr := url.ParseQuery(string(body)); perr == nil &&
			(vals.Get("access_token") != "" || vals.Get("error") != "") {
			raw.AccessToken = vals.Get("access_token")
			raw.RefreshToken = vals.Get("refresh_token")
			raw.TokenType = vals.Get("token_type")
			raw.Scope = vals.Get("scope")
			raw.IDToken = vals.Get("id_token")
			raw.Error = vals.Get("error")
			raw.ErrorDescription = vals.Get("error_description")
			raw.ErrorURI = vals.Get("error_uri")
			_, _ = fmt.Sscanf(vals.Get("expires_in"), "%d", &raw.ExpiresIn)
		}
	}

	if raw.Error != "" {
		return nil, &ProviderError{
			Code:        raw.Error,
			Description: raw.ErrorDescription,
			URI:         raw.ErrorURI,
			StatusCode:  statusCode,
		}
	}
	if statusCode >= 400 && raw.AccessToken == "" {
		return nil, &ProviderError{
			Code:        fmt.Sprintf("http_%d", statusCode),
			Description: http.StatusText(statusCode),
			StatusCode:  statusCode,
		}
	}
	if raw.AccessToken == "" {
		return nil, nil
	}

	tr := &TokenResult{
		AccessToken:  raw.AccessToken,
		RefreshToken: raw.RefreshToken,
		TokenType:    raw.TokenType,
		Scope:        raw.Scope,
		ExpiresIn:    raw.ExpiresIn,
		IDToken:      raw.IDToken,
	}
	if raw.ExpiresIn > 0 {
		// Milliseconds — the unit the renderer compares against Date.now().
		tr.ExpiresAtMs = time.Now().UnixMilli() + int64(raw.ExpiresIn)*1000
	}
	return tr, nil
}

func asProviderError(err error) *ProviderError {
	var pe *ProviderError
	if errors.As(err, &pe) {
		return pe
	}
	return &ProviderError{Code: "network_error", Description: err.Error()}
}

// --- RFC 8628 device authorization grant ------------------------------------

// DeviceStartResult is the RFC 8628 §3.2 device authorization response.
type DeviceStartResult struct {
	DeviceCode              string
	UserCode                string
	VerificationURI         string
	VerificationURIComplete string
	ExpiresIn               int
	Interval                int
}

// StartDevice begins the device flow: it POSTs client_id (+ scope, + secret
// for confidential clients) to the device authorization endpoint — cfg.DeviceURL,
// falling back to cfg.TokenURL. No grant_type is sent (RFC 8628 §3.1).
func StartDevice(ctx context.Context, cfg OAuthConfig, clientSecret string) (*DeviceStartResult, error) {
	endpoint := cfg.DeviceURL
	if endpoint == "" {
		endpoint = cfg.TokenURL
	}
	if endpoint == "" {
		return nil, InvalidConfigError("device_start", "device authorization endpoint is required")
	}

	form := url.Values{}
	if cfg.Scopes != "" {
		form.Set("scope", cfg.Scopes)
	}
	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("oauth2: build device start request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	applyClientAuth(cfg, clientSecret, form, req)
	req.Body = io.NopCloser(strings.NewReader(form.Encode()))

	resp, err := tokenClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("oauth2: device start request failed: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))

	var raw struct {
		DeviceCode              string `json:"device_code"`
		UserCode                string `json:"user_code"`
		VerificationURI         string `json:"verification_uri"`
		VerificationURIComplete string `json:"verification_uri_complete"`
		ExpiresIn               int    `json:"expires_in"`
		Interval                int    `json:"interval"`
		Error                   string `json:"error"`
		ErrorDescription        string `json:"error_description"`
	}
	if err := json.Unmarshal(body, &raw); err != nil && resp.StatusCode < 400 {
		return nil, fmt.Errorf("oauth2: parse device start response: %w", err)
	}
	if raw.Error != "" {
		return nil, ProviderDeniedError("device_start", &ProviderError{
			Code:        raw.Error,
			Description: raw.ErrorDescription,
			StatusCode:  resp.StatusCode,
		})
	}
	if raw.DeviceCode == "" || raw.UserCode == "" {
		return nil, &OAuthError{Op: "device_start", Kind: ErrProviderDenied,
			Msg: "device authorization response missing device_code or user_code"}
	}
	return &DeviceStartResult{
		DeviceCode:              raw.DeviceCode,
		UserCode:                raw.UserCode,
		VerificationURI:         raw.VerificationURI,
		VerificationURIComplete: raw.VerificationURIComplete,
		ExpiresIn:               raw.ExpiresIn,
		Interval:                raw.Interval,
	}, nil
}

// DevicePollStatus is the RFC 8628 §3.5 polling lifecycle.
type DevicePollStatus string

const (
	DevicePollSuccess  DevicePollStatus = "success"
	DevicePollPending  DevicePollStatus = "pending"
	DevicePollSlowDown DevicePollStatus = "slow_down"
	DevicePollDenied   DevicePollStatus = "denied"
	DevicePollExpired  DevicePollStatus = "expired"
	DevicePollError    DevicePollStatus = "error"
)

// DevicePollResult is one poll of the token endpoint during a device flow.
type DevicePollResult struct {
	Status DevicePollStatus
	Token  *TokenResult
	Error  *ProviderError
}

// PollDevice polls the token endpoint with the RFC 8628 device_code grant.
// The status reflects the full lifecycle: success, pending, slow_down,
// denied, expired, or error.
func PollDevice(ctx context.Context, cfg OAuthConfig, clientSecret, deviceCode string) (*DevicePollResult, error) {
	if cfg.TokenURL == "" {
		return nil, InvalidConfigError("device_poll", "token URL is required")
	}
	if deviceCode == "" {
		return nil, InvalidConfigError("device_poll", "device code is required")
	}

	form := url.Values{}
	form.Set("grant_type", "urn:ietf:params:oauth:grant-type:device_code")
	form.Set("device_code", deviceCode)

	req, err := http.NewRequestWithContext(ctx, "POST", cfg.TokenURL, nil)
	if err != nil {
		return nil, fmt.Errorf("oauth2: build device poll request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	applyClientAuth(cfg, clientSecret, form, req)
	req.Body = io.NopCloser(strings.NewReader(form.Encode()))

	resp, err := tokenClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("oauth2: device poll request failed: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))

	tr, perr := parseTokenResponse(body, resp.StatusCode)
	if perr != nil {
		switch perr.Code {
		case "authorization_pending":
			return &DevicePollResult{Status: DevicePollPending}, nil
		case "slow_down":
			return &DevicePollResult{Status: DevicePollSlowDown}, nil
		case "access_denied":
			return &DevicePollResult{Status: DevicePollDenied, Error: perr}, nil
		case "expired_token":
			return &DevicePollResult{Status: DevicePollExpired, Error: perr}, nil
		default:
			return &DevicePollResult{Status: DevicePollError, Error: perr}, nil
		}
	}
	if tr == nil {
		return &DevicePollResult{Status: DevicePollError}, nil
	}
	return &DevicePollResult{Status: DevicePollSuccess, Token: tr}, nil
}

// --- In-flight authorization-code flow ---------------------------------------

// AuthCodeFlow is an in-flight authorization-code flow. It owns the state and
// PKCE verifier generated for the authorize request and can exchange the code
// for a token. It implements Exchanger so the loopback callback handler can
// drive it without knowing engine internals.
type AuthCodeFlow struct {
	cfg          OAuthConfig
	state        string
	verifier     string
	pkce         PKCEMethod
	clientSecret string
}

// NewAuthCodeFlow validates the config and generates the state + PKCE
// verifier for the authorize request. PKCE (S256) is on by default; use
// PKCENone only for legacy providers that reject unknown parameters.
func NewAuthCodeFlow(cfg OAuthConfig) (*AuthCodeFlow, error) {
	if cfg.AuthURL == "" || cfg.ClientID == "" {
		return nil, InvalidConfigError("authorize", "authorization URL and client ID are required")
	}
	if cfg.PKCE == "" {
		cfg.PKCE = PKCES256
	}
	f := &AuthCodeFlow{cfg: cfg, state: NewStateToken(), pkce: cfg.PKCE}
	if cfg.PKCE != PKCENone {
		v, err := NewCodeVerifier()
		if err != nil {
			return nil, err
		}
		f.verifier = v
	}
	return f, nil
}

// State returns the state bound to this flow's authorize request.
func (f *AuthCodeFlow) State() string { return f.state }

// Verifier returns the PKCE code_verifier (empty when PKCE is disabled). It is
// transient, in-memory state — never persisted or sent except in the token
// exchange.
func (f *AuthCodeFlow) Verifier() string { return f.verifier }

// PKCEMethod returns the challenge method in use for this flow.
func (f *AuthCodeFlow) PKCEMethod() PKCEMethod { return f.pkce }

// Config returns the flow's (secret-free) configuration.
func (f *AuthCodeFlow) Config() OAuthConfig { return f.cfg }

// ValidateState reports whether the provider's returned state matches the one
// issued for this specific request. Must pass before any exchange is attempted.
func (f *AuthCodeFlow) ValidateState(state string) bool {
	return f.state != "" && state == f.state
}

// AuthorizeURL builds the authorization endpoint URL with response_type=code,
// client_id, redirect_uri, scope, state, and the PKCE challenge.
func (f *AuthCodeFlow) AuthorizeURL() (string, error) {
	u, err := url.Parse(f.cfg.AuthURL)
	if err != nil {
		return "", fmt.Errorf("oauth2: invalid authorization URL %q: %w", f.cfg.AuthURL, err)
	}
	q := u.Query()
	q.Set("response_type", "code")
	q.Set("client_id", f.cfg.ClientID)
	if f.cfg.RedirectURI != "" {
		q.Set("redirect_uri", f.cfg.RedirectURI)
	}
	q.Set("state", f.state)
	if f.cfg.Scopes != "" {
		q.Set("scope", f.cfg.Scopes)
	}
	if f.verifier != "" {
		challenge, err := ChallengeFor(f.verifier, f.pkce)
		if err != nil {
			return "", err
		}
		q.Set("code_challenge", challenge)
		q.Set("code_challenge_method", string(f.pkce))
	}
	u.RawQuery = q.Encode()
	return u.String(), nil
}

// WithClientSecret configures a confidential client's secret (RFC 6749 §2.3)
// for the code-for-token exchange. It is only ever sent when the config marks
// the client Confidential — a PKCE public-client exchange never includes it,
// even if a secret was supplied (RFC 8252 §8.5). Returns the flow for
// chaining.
func (f *AuthCodeFlow) WithClientSecret(secret string) *AuthCodeFlow {
	f.clientSecret = secret
	return f
}

// ExchangeCode implements Exchanger.
func (f *AuthCodeFlow) ExchangeCode(ctx context.Context, code string) (*TokenResult, error) {
	return Exchange(ctx, f.cfg, ExchangeOptions{
		Code:         code,
		CodeVerifier: f.verifier,
		RedirectURI:  f.cfg.RedirectURI,
		ClientSecret: f.clientSecret,
	})
}

var _ Exchanger = (*AuthCodeFlow)(nil)
