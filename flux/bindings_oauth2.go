package main

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"flux/internal/models"
	"flux/internal/oauth2"
)

// DefaultOAuthPort is the loopback port suggested for providers that require
// a pre-registered exact redirect URI (e.g. GitHub, Slack, Spotify). The
// engine binds an OS-assigned ephemeral port per RFC 8252 §7.3 whenever the
// configured redirect URI is empty.
const DefaultOAuthPort = 7317

type OAuth2AuthorizeResult struct {
	AuthorizeURL string `json:"authorizeUrl"`
	RedirectURI  string `json:"redirectUri"`
	State        string `json:"state"`
	// Note is non-empty when the engine deviated from the configured
	// redirect URI (e.g. a fixed loopback port that was in use fell back to
	// an auto-assigned port) — the UI must surface it because the provider's
	// registered redirect URI may need updating.
	Note string `json:"note,omitempty"`
}

type OAuth2ManualAuthorizeResult struct {
	AuthorizeURL string `json:"authorizeUrl"`
	State        string `json:"state"`
}

type OAuth2DeviceStart struct {
	DeviceCode              string `json:"deviceCode"`
	UserCode                string `json:"userCode"`
	VerificationURI         string `json:"verificationUri"`
	VerificationURIComplete string `json:"verificationUriComplete"`
	ExpiresIn               int    `json:"expiresIn"`
	Interval                int    `json:"interval"`
}

type OAuth2DevicePoll struct {
	Status  string                      `json:"status"`
	Token   *models.OAuth2TokenResponse `json:"token,omitempty"`
	Message string                      `json:"message,omitempty"`
}

type OAuth2DiscoveryResult struct {
	Issuer                      string   `json:"issuer"`
	AuthorizationEndpoint       string   `json:"authorizationEndpoint"`
	TokenEndpoint               string   `json:"tokenEndpoint"`
	DeviceAuthorizationEndpoint string   `json:"deviceAuthorizationEndpoint,omitempty"`
	CodeChallengeMethods        []string `json:"codeChallengeMethods,omitempty"`
	ScopesSupported             []string `json:"scopesSupported,omitempty"`
}

// oauthFlowState tracks the single in-flight OAuth flow. The engine config
// and (for confidential clients) the secret are kept so device polling and
// refresh can reuse them without the renderer resending the secret.
type oauthFlowState struct {
	cfg    oauth2.OAuthConfig
	secret string
	flow   *oauth2.LoopbackFlow // non-nil for the interactive loopback flow
	manual *oauth2.ManualFlow   // non-nil for the paste-back fallback flow
}

// OAuth2Authorize prepares the interactive authorization-code flow: the
// engine binds an ephemeral (or configured) loopback listener, generates
// state + PKCE (S256, always on), and builds the authorize URL. The frontend
// opens the URL in the OS browser; when the provider redirects back, the
// engine validates state, exchanges the code, and emits the result as the
// "oauth2:complete" event.
func (a *App) OAuth2Authorize(cfg oauth2.OAuth2Config) (*OAuth2AuthorizeResult, error) {
	a.oauthMu.Lock()
	if a.oauthFlow != nil {
		a.oauthMu.Unlock()
		return nil, oauth2.FlowInProgressError("authorize")
	}
	a.oauthMu.Unlock()

	nc := mapOAuthConfig(cfg, oauth2.GrantAuthorizationCode)
	if nc.RedirectURI != "" && !isLoopbackRedirect(nc.RedirectURI) {
		return nil, fmt.Errorf("oauth2: redirect URI %q is not a loopback address — use http://127.0.0.1:PORT/callback, or leave it empty for an OS-assigned ephemeral port", nc.RedirectURI)
	}

	flowOpts := oauth2.FlowOptions{ClientSecret: cfg.ClientSecret}
	if cfg.FlowTimeoutSec > 0 {
		flowOpts.Timeout = time.Duration(cfg.FlowTimeoutSec) * time.Second
	}
	f, redir, err := oauth2.PrepareLoopbackFlow(nc, flowOpts)
	if err != nil {
		if errors.Is(err, oauth2.ErrPortBindFailed) {
			// Port collisions are the #1 cause of "this site can't be
			// reached" on the callback — the listener never bound. Tell the
			// user exactly how to recover.
			return nil, fmt.Errorf("%w — the loopback port is already in use by another process. Stop that process, change the Redirect URI to a free port, or clear it to use an auto-assigned port", err)
		}
		return nil, err
	}

	ctx, cancel := context.WithCancel(context.Background())
	a.oauthMu.Lock()
	a.oauthFlow = &oauthFlowState{cfg: nc, secret: cfg.ClientSecret, flow: f}
	a.oauthFlowCancel = cancel
	a.oauthMu.Unlock()

	// Wait blocks until the callback arrives (engine timeout: 5 minutes).
	// The listener is torn down before the goroutine exits, success or not.
	go func() {
		defer f.Close()
		token, err := f.Wait(ctx)

		a.oauthMu.Lock()
		current := a.oauthFlow != nil && a.oauthFlow.flow == f
		if current {
			a.oauthFlow = nil
			a.oauthFlowCancel = nil
		}
		a.oauthMu.Unlock()
		if !current {
			return // cancelled or superseded — no completion event
		}
		a.emitProgress(map[string]any{"stage": "complete"})
		a.emitOAuthComplete(token, err)
	}()

	a.emitProgress(map[string]any{"stage": "waiting_for_browser"})
	return &OAuth2AuthorizeResult{
		AuthorizeURL: redir.AuthorizeURL,
		RedirectURI:  redir.RedirectURI,
		State:        redir.State,
		Note:         redir.Note,
	}, nil
}

// OAuth2ManualAuthorize prepares the paste-back fallback (RedirectManual): no
// loopback listener is bound — the authorize URL is returned for the user to
// open (and copy) in any browser. Complete the flow by pasting the provider's
// redirect URL back into OAuth2ManualComplete. State + PKCE (S256) are
// enforced exactly as in the loopback path, so this is a safe fallback when a
// local listener cannot bind or the provider rejects loopback redirect URIs.
func (a *App) OAuth2ManualAuthorize(cfg oauth2.OAuth2Config) (*OAuth2ManualAuthorizeResult, error) {
	a.oauthMu.Lock()
	if a.oauthFlow != nil {
		a.oauthMu.Unlock()
		return nil, oauth2.FlowInProgressError("manual_authorize")
	}
	a.oauthMu.Unlock()

	nc := mapOAuthConfig(cfg, oauth2.GrantAuthorizationCode)
	mf, err := oauth2.NewManualFlow(nc)
	if err != nil {
		return nil, err
	}
	mf.WithClientSecret(cfg.ClientSecret)
	authURL, err := mf.AuthorizeURL()
	if err != nil {
		return nil, err
	}

	a.oauthMu.Lock()
	a.oauthFlow = &oauthFlowState{cfg: nc, secret: cfg.ClientSecret, manual: mf}
	a.oauthMu.Unlock()

	return &OAuth2ManualAuthorizeResult{
		AuthorizeURL: authURL,
		State:        mf.State(),
	}, nil
}

// OAuth2ManualComplete completes the paste-back flow: it validates the pasted
// redirect URL against the in-flight flow (state check, PKCE exchange) and
// returns the token, or the provider's verbatim error.
func (a *App) OAuth2ManualComplete(redirectURL string) (*models.OAuth2TokenResponse, error) {
	a.oauthMu.Lock()
	fs := a.oauthFlow
	a.oauthMu.Unlock()
	if fs == nil || fs.manual == nil {
		return nil, errors.New("no manual OAuth flow in progress — start one with OAuth2ManualAuthorize")
	}
	token, err := fs.manual.Complete(context.Background(), redirectURL)
	if err != nil {
		return nil, err
	}

	a.oauthMu.Lock()
	if a.oauthFlow == fs {
		a.oauthFlow = nil
	}
	a.oauthMu.Unlock()
	return toModelToken(token), nil
}

// OAuth2DiagnoseLoopback starts the one-click browser-to-loopback
// connectivity check and returns immediately with a request id — the check
// itself runs on a goroutine, so the main thread (and the rest of the app)
// never blocks. The engine binds a test listener on 127.0.0.1:0, opens it in
// the OS default browser, and waits up to 12s for the browser to reach it.
// The outcome is delivered on the "oauth2:diagnostics" event with the
// matching id: {id, url, success, detail}. This is the exact path an OAuth
// callback takes, so it isolates "This site can't be reached"
// (proxy/firewall/launcher problems) from OAuth configuration issues.
func (a *App) OAuth2DiagnoseLoopback() (string, error) {
	id := fmt.Sprintf("diag-%d", time.Now().UnixNano())
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		payload := map[string]interface{}{"id": id, "url": "", "success": false, "detail": "", "findings": []map[string]string{}}
		res, err := oauth2.DiagnoseLoopback(ctx, 12*time.Second)
		if err != nil {
			payload["detail"] = "Loopback diagnostics failed: " + err.Error()
		} else {
			payload["url"] = res.URL
			payload["success"] = res.Success
			payload["detail"] = res.Detail
			// Serialize findings as a list of {severity, label, detail} maps
			// so the frontend can render them as a structured checklist.
			findings := make([]map[string]string, 0, len(res.Findings))
			for _, f := range res.Findings {
				findings = append(findings, map[string]string{
					"severity": f.Severity,
					"label":    f.Label,
					"detail":   f.Detail,
				})
			}
			payload["findings"] = findings
		}
		runtime.EventsEmit(a.ctx, "oauth2:diagnostics", payload)
	}()
	return id, nil
}

// OAuth2OpenBrowser opens rawURL in the OS default browser via the engine's
// launcher and returns an error when the launcher cannot be started. The
// renderer uses this instead of the Wails runtime BrowserOpenURL (which is
// fire-and-forget) so a failed launch is observable — the frontend can then
// fall back to the paste-back flow with the authorize URL copied.
func (a *App) OAuth2OpenBrowser(rawURL string) error {
	if err := oauth2.OpenURL(rawURL); err != nil {
		return err
	}
	return nil
}

// OAuth2Cancel aborts any in-flight flow and frees the loopback listener.
func (a *App) OAuth2Cancel() error {
	a.cleanupOAuthFlow()
	return nil
}

// OAuth2StartDevice begins the OAuth 2.0 Device Authorization Grant (RFC 8628)
// for the given config. The user code + verification URI should be displayed so
// the user can authorize on any device. GitHub supports this flow.
func (a *App) OAuth2StartDevice(cfg oauth2.OAuth2Config) (*OAuth2DeviceStart, error) {
	nc := mapOAuthConfig(cfg, oauth2.GrantDeviceCode)
	ds, err := oauth2.StartDevice(context.Background(), nc, cfg.ClientSecret)
	if err != nil {
		return nil, err
	}

	a.oauthMu.Lock()
	a.oauthFlow = &oauthFlowState{cfg: nc, secret: cfg.ClientSecret}
	a.oauthMu.Unlock()

	return &OAuth2DeviceStart{
		DeviceCode:              ds.DeviceCode,
		UserCode:                ds.UserCode,
		VerificationURI:         ds.VerificationURI,
		VerificationURIComplete: ds.VerificationURIComplete,
		ExpiresIn:               ds.ExpiresIn,
		Interval:                ds.Interval,
	}, nil
}

// OAuth2PollDevice polls the token endpoint during a device flow. It returns a
// status of "success" when a token is ready, or "pending"/"slow_down"/"denied"/
// "expired"/"error" so the frontend can keep polling or surface an error.
func (a *App) OAuth2PollDevice(deviceCode string) (*OAuth2DevicePoll, error) {
	a.oauthMu.Lock()
	fs := a.oauthFlow
	a.oauthMu.Unlock()
	if fs == nil || fs.cfg.GrantType != oauth2.GrantDeviceCode {
		return nil, errors.New("no device flow in progress — start one first")
	}

	poll, err := oauth2.PollDevice(context.Background(), fs.cfg, fs.secret, deviceCode)
	if err != nil {
		return nil, err
	}
	res := &OAuth2DevicePoll{Status: string(poll.Status)}
	if poll.Token != nil {
		res.Token = toModelToken(poll.Token)
	}
	if poll.Error != nil {
		res.Message = poll.Error.Error()
	}
	return res, nil
}

// OAuth2Discover fetches {issuer}/.well-known/openid-configuration (RFC 8414 /
// OIDC Discovery) so the OAuth form can autofill the authorize/token/device
// endpoints and scopes from a single issuer URL (guided setup). Results are
// cached in the engine for 5 minutes per issuer. The engine always defaults
// PKCE to S256, so a missing code_challenge_methods_supported list (Entra) is
// not treated as "PKCE unsupported" — see the Entra smoke.
func (a *App) OAuth2Discover(issuer string) (*OAuth2DiscoveryResult, error) {
	meta, err := oauth2.Discover(context.Background(), issuer)
	if err != nil {
		return nil, err
	}
	return &OAuth2DiscoveryResult{
		Issuer:                      meta.Issuer,
		AuthorizationEndpoint:       meta.AuthorizationEndpoint,
		TokenEndpoint:               meta.TokenEndpoint,
		DeviceAuthorizationEndpoint: meta.DeviceAuthorizationEndpoint,
		CodeChallengeMethods:        meta.CodeChallengeMethods,
		ScopesSupported:             meta.ScopesSupported,
	}, nil
}

// OAuth2Refresh exchanges a refresh token for a fresh access token. Only
// providers that actually issue refresh tokens (e.g. Google) support this;
// GitHub OAuth apps never return refresh tokens.
func (a *App) OAuth2Refresh(cfg oauth2.OAuth2Config, refreshToken string) (*models.OAuth2TokenResponse, error) {
	nc := mapOAuthConfig(cfg, oauth2.GrantRefreshToken)
	token, err := oauth2.Exchange(context.Background(), nc, oauth2.ExchangeOptions{
		RefreshToken: refreshToken,
		ClientSecret: cfg.ClientSecret,
	})
	if err != nil {
		return nil, err
	}
	return toModelToken(token), nil
}

// OAuth2ClientCredentials performs the client_credentials grant entirely in Go
// (no browser, no redirect). It respects ClientAuth ("body" vs "basic") so
// providers that are strict about where client_id/secret appear work correctly
// (Hoppscotch parity).
func (a *App) OAuth2ClientCredentials(cfg oauth2.OAuth2Config) (*models.OAuth2TokenResponse, error) {
	nc := mapOAuthConfig(cfg, oauth2.GrantClientCredentials)
	token, err := oauth2.Exchange(context.Background(), nc, oauth2.ExchangeOptions{
		Scope:        cfg.Scopes,
		ClientSecret: cfg.ClientSecret,
	})
	if err != nil {
		return nil, err
	}
	return toModelToken(token), nil
}

// OAuth2Password performs the resource-owner password grant (RFC 6749
// 4.3, deprecated by RFC 9700) entirely in Go. The UI must show a
// persistent deprecation banner before allowing this flow.
func (a *App) OAuth2Password(cfg oauth2.OAuth2Config, username, password string) (*models.OAuth2TokenResponse, error) {
	nc := mapOAuthConfig(cfg, oauth2.GrantPassword)
	token, err := oauth2.Exchange(context.Background(), nc, oauth2.ExchangeOptions{
		Username:     username,
		Password:     password,
		Scope:        cfg.Scopes,
		ClientSecret: cfg.ClientSecret,
	})
	if err != nil {
		return nil, err
	}
	return toModelToken(token), nil
}

// OAuth2ImplicitAuthorize prepares the implicit grant (response_type=token,
// RFC 6749 4.2, deprecated by RFC 9700). The token returns in the URL
// fragment and is recovered via the loopback's fragment HTML+JS re-POST.
// It is behind the same legacy gate as the password grant.
func (a *App) OAuth2ImplicitAuthorize(cfg oauth2.OAuth2Config) (*OAuth2AuthorizeResult, error) {
	a.oauthMu.Lock()
	if a.oauthFlow != nil {
		a.oauthMu.Unlock()
		return nil, oauth2.FlowInProgressError("implicit_authorize")
	}
	a.oauthMu.Unlock()

	nc := mapOAuthConfig(cfg, oauth2.GrantImplicit)
	if nc.RedirectURI != "" && !isLoopbackRedirect(nc.RedirectURI) {
		return nil, fmt.Errorf("oauth2: redirect URI %q is not a loopback address — use http://127.0.0.1:PORT/callback, or leave it empty for an OS-assigned ephemeral port", nc.RedirectURI)
	}

	flowOpts := oauth2.FlowOptions{ClientSecret: cfg.ClientSecret}
	if cfg.FlowTimeoutSec > 0 {
		flowOpts.Timeout = time.Duration(cfg.FlowTimeoutSec) * time.Second
	}
	f, redir, err := oauth2.PrepareLoopbackFlow(nc, flowOpts)
	if err != nil {
		if errors.Is(err, oauth2.ErrPortBindFailed) {
			return nil, fmt.Errorf("%w — the loopback port is already in use by another process. Stop that process, change the Redirect URI to a free port, or clear it to use an auto-assigned port", err)
		}
		return nil, err
	}

	ctx, cancel := context.WithCancel(context.Background())
	a.oauthMu.Lock()
	a.oauthFlow = &oauthFlowState{cfg: nc, secret: cfg.ClientSecret, flow: f}
	a.oauthFlowCancel = cancel
	a.oauthMu.Unlock()

	go func() {
		defer f.Close()
		token, err := f.Wait(ctx)
		a.oauthMu.Lock()
		current := a.oauthFlow != nil && a.oauthFlow.flow == f
		if current {
			a.oauthFlow = nil
			a.oauthFlowCancel = nil
		}
		a.oauthMu.Unlock()
		if !current {
			return
		}
		a.emitProgress(map[string]any{"stage": "complete"})
		a.emitOAuthComplete(token, err)
	}()

	a.emitProgress(map[string]any{"stage": "waiting_for_browser"})
	return &OAuth2AuthorizeResult{
		AuthorizeURL: redir.AuthorizeURL,
		RedirectURI:  redir.RedirectURI,
		State:        redir.State,
		Note:         redir.Note,
	}, nil
}

// --- helpers ---------------------------------------------------------------

// mapOAuthConfig converts the legacy (frontend-facing) OAuth2Config into the
// new engine config. PKCE (S256) is always on — the legacy UsePKCE checkbox
// can no longer disable it; only an explicit PKCENone on the new OAuthConfig
// turns it off. A filled client secret marks the client Confidential so the
// engine knows to send it (and only for confidential clients — never in a
// PKCE public-client exchange).
func mapOAuthConfig(c oauth2.OAuth2Config, grant oauth2.GrantType) oauth2.OAuthConfig {
	nc := oauth2.OAuthConfig{
		GrantType:   grant,
		AuthURL:     c.AuthURL,
		TokenURL:    c.TokenURL,
		DeviceURL:   c.DeviceURL,
		ClientID:    c.ClientID,
		Scopes:      c.Scopes,
		RedirectURI: c.RedirectURI,
		PKCE:        oauth2.PKCES256,
	}
	if c.ClientSecret != "" {
		nc.Confidential = true
	}
	if c.ClientAuth == "basic" {
		nc.ClientAuth = oauth2.ClientAuthBasic
	} else if c.ClientAuth == "body" {
		nc.ClientAuth = oauth2.ClientAuthBody
	}
	return nc
}

// isLoopbackRedirect reports whether raw is an http:// loopback redirect URI
// the engine's local listener can actually receive (RFC 8252 §7.3).
func isLoopbackRedirect(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	if u.Scheme != "http" {
		return false
	}
	switch strings.ToLower(u.Hostname()) {
	case "127.0.0.1", "localhost", "::1":
		return true
	}
	return false
}

func toModelToken(t *oauth2.TokenResult) *models.OAuth2TokenResponse {
	return &models.OAuth2TokenResponse{
		AccessToken:  t.AccessToken,
		RefreshToken: t.RefreshToken,
		TokenType:    t.TokenType,
		ExpiresIn:    t.ExpiresIn,
		// Milliseconds — the unit the renderer compares against Date.now().
		ExpiresAt: t.ExpiresAtMs,
	}
}

// emitOAuthComplete delivers the flow outcome on the "oauth2:complete" event,
// preserving the wire shape the renderer already consumes: {success, token,
// error, errorDescription}. Provider error/error_description text is surfaced
// verbatim, never swallowed into a generic failure message.
func (a *App) emitOAuthComplete(token *oauth2.TokenResult, err error) {
	payload := map[string]interface{}{"success": err == nil && token != nil}
	if token != nil {
		payload["token"] = toModelToken(token)
	}
	if err != nil {
		payload["error"] = oauthErrorCode(err)
		payload["errorDescription"] = err.Error()
	}
	runtime.EventsEmit(a.ctx, "oauth2:complete", payload)
}

// emitProgress sends a lifecycle stage on the "oauth2:progress" event
// (waiting_for_browser, complete). Additive — the renderer only listens to
// oauth2:complete today.
func (a *App) emitProgress(payload map[string]any) {
	runtime.EventsEmit(a.ctx, "oauth2:progress", payload)
}

// oauthErrorCode returns the provider's verbatim error code when one was
// returned, else a stable local code the frontend can key off.
func oauthErrorCode(err error) string {
	var oe *oauth2.OAuthError
	if errors.As(err, &oe) {
		if code := oe.ProviderCode(); code != "" {
			return code
		}
		if oe.Op != "" {
			return oe.Op + "_failed"
		}
	}
	return "authorization_failed"
}

// cleanupOAuthFlow aborts any in-flight flow and frees the loopback listener.
func (a *App) cleanupOAuthFlow() {
	a.oauthMu.Lock()
	defer a.oauthMu.Unlock()
	if a.oauthFlowCancel != nil {
		a.oauthFlowCancel()
		a.oauthFlowCancel = nil
	}
	if a.oauthFlow != nil {
		if a.oauthFlow.flow != nil {
			_ = a.oauthFlow.flow.Close()
		}
		a.oauthFlow = nil
	}
}
