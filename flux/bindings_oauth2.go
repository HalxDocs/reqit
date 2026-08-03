package main

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"flux/internal/models"
	"flux/internal/oauth2"
)

// DefaultOAuthPort is the loopback port used for the built-in callback server.
// Register http://127.0.0.1:7317/callback in your OAuth app.
const DefaultOAuthPort = 7317

type OAuth2AuthorizeResult struct {
	AuthorizeURL string `json:"authorizeUrl"`
	RedirectURI  string `json:"redirectUri"`
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

// OAuth2Authorize starts the loopback callback server, builds the authorize
// URL for cfg.RedirectURI, and returns it. The frontend opens the URL in the
// system browser; when the provider redirects back, the code is exchanged
// automatically and the result is emitted as the "oauth2:complete" event.
func (a *App) OAuth2Authorize(cfg oauth2.OAuth2Config) (*OAuth2AuthorizeResult, error) {
	a.oauthMu.Lock()
	defer a.oauthMu.Unlock()

	if a.oauthServer != nil {
		return nil, errors.New("an OAuth2 flow is already in progress — cancel it first")
	}
	if cfg.RedirectURI == "" {
		return nil, errors.New("redirect URI is required (e.g. http://127.0.0.1:7317/callback)")
	}

	u, err := url.Parse(cfg.RedirectURI)
	if err != nil {
		return nil, fmt.Errorf("invalid redirect URI: %w", err)
	}
	host := u.Hostname()
	port := u.Port()
	if port == "" {
		port = fmt.Sprintf("%d", DefaultOAuthPort)
	}

	// Listen on both IPv4 and IPv6 loopbacks so the redirect works whether the
	// browser resolves localhost to 127.0.0.1 or ::1. Prefer the host requested
	// in the redirect URI, then the other loopback, then any loopback.
	candidates := []string{}
	switch host {
	case "localhost", "::1":
		candidates = []string{"::1", "127.0.0.1"}
	case "127.0.0.1", "":
		candidates = []string{"127.0.0.1", "::1"}
	default:
		candidates = []string{host}
	}

	lns := make([]net.Listener, 0, 2)
	var boundErr error
	var boundOK bool
	for _, h := range candidates {
		ln, lerr := net.Listen("tcp", net.JoinHostPort(h, port))
		if lerr != nil {
			if boundErr == nil {
				boundErr = lerr
			}
			continue
		}
		lns = append(lns, ln)
		boundOK = true
	}
	if !boundOK {
		return nil, fmt.Errorf("cannot start local callback server on port %s: %w — make sure this exact redirect URI is registered in your app: %s", port, boundErr, cfg.RedirectURI)
	}

	o := oauth2.New(cfg)
	authURL, state, err := o.AuthorizeURL()
	if err != nil {
		for _, ln := range lns {
			_ = ln.Close()
		}
		return nil, err
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", a.oauthCallbackHandler(o))
	srv := &http.Server{Handler: mux}

	a.oauthState = o
	a.oauthServer = srv
	a.oauthListeners = lns

	for _, ln := range lns {
		go func(l net.Listener) {
			_ = srv.Serve(l)
		}(ln)
	}

	// Auto-cancel if the user never completes the flow so listeners don't
	// linger on the port.
	time.AfterFunc(5*time.Minute, func() {
		a.stopOAuthServer()
	})

	return &OAuth2AuthorizeResult{
		AuthorizeURL: authURL,
		RedirectURI:  cfg.RedirectURI,
		State:        state,
	}, nil
}

// OAuth2Cancel aborts any in-flight authorization flow and frees the callback
// port.
func (a *App) OAuth2Cancel() error {
	a.stopOAuthServer()
	return nil
}

// OAuth2StartDevice begins the OAuth 2.0 Device Authorization Grant (RFC 8628)
// for the given config. The user code + verification URI should be displayed so
// the user can authorize on any device. GitHub supports this flow.
func (a *App) OAuth2StartDevice(cfg oauth2.OAuth2Config) (*OAuth2DeviceStart, error) {
	o := oauth2.New(cfg)
	ds, err := o.DeviceStart(context.Background())
	if err != nil {
		return nil, err
	}
	if ds.Error != "" {
		msg := ds.Error
		if ds.ErrorDescription != "" {
			msg += ": " + ds.ErrorDescription
		}
		return nil, errors.New(msg)
	}

	a.oauthMu.Lock()
	a.oauthState = o
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
	o := a.oauthState
	a.oauthMu.Unlock()
	if o == nil {
		return nil, errors.New("no device flow in progress")
	}

	poll, err := o.DevicePoll(context.Background(), deviceCode)
	if err != nil {
		return nil, err
	}
	res := &OAuth2DevicePoll{Status: poll.Status, Message: poll.Message}
	if poll.Token != nil {
		res.Token = &models.OAuth2TokenResponse{
			AccessToken:  poll.Token.AccessToken,
			RefreshToken: poll.Token.RefreshToken,
			TokenType:    poll.Token.TokenType,
			ExpiresIn:    poll.Token.ExpiresIn,
			ExpiresAt:    poll.Token.ExpiresAt,
		}
	}
	return res, nil
}

// OAuth2Refresh exchanges a refresh token for a fresh access token. Only
// providers that actually issue refresh tokens (e.g. Google) support this;
// GitHub OAuth apps never return refresh tokens.
func (a *App) OAuth2Refresh(cfg oauth2.OAuth2Config, refreshToken string) (*models.OAuth2TokenResponse, error) {
	o := oauth2.New(cfg)
	token, err := o.Refresh(context.Background(), refreshToken)
	if err != nil {
		return nil, err
	}
	if token.Error != "" {
		msg := token.Error
		if token.ErrorDescription != "" {
			msg += ": " + token.ErrorDescription
		}
		return nil, errors.New(msg)
	}
	return &models.OAuth2TokenResponse{
		AccessToken:  token.AccessToken,
		RefreshToken: token.RefreshToken,
		TokenType:    token.TokenType,
		ExpiresIn:    token.ExpiresIn,
		ExpiresAt:    token.ExpiresAt,
	}, nil
}

func (a *App) oauthCallbackHandler(o *oauth2.State) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()

		if !o.ValidateState(q.Get("state")) {
			a.emitOAuthComplete(false, nil, "state_mismatch", "The state parameter did not match the flow request. Authorization was aborted for security.")
			http.Error(w, "State mismatch — authorization aborted", http.StatusBadRequest)
			a.stopOAuthServer()
			return
		}

		if errParam := q.Get("error"); errParam != "" {
			desc := q.Get("error_description")
			a.emitOAuthComplete(false, nil, errParam, desc)
			a.serveOAuthResultPage(w, "Authorization failed", errParam+": "+desc)
			a.stopOAuthServer()
			return
		}

		code := q.Get("code")
		if code == "" {
			a.emitOAuthComplete(false, nil, "missing_code", "No authorization code was returned by the provider.")
			http.Error(w, "Missing authorization code", http.StatusBadRequest)
			a.stopOAuthServer()
			return
		}

		token, err := o.Exchange(r.Context(), code)
		if err != nil {
			a.emitOAuthComplete(false, nil, "exchange_failed", err.Error())
			a.serveOAuthResultPage(w, "Token exchange failed", err.Error())
			a.stopOAuthServer()
			return
		}
		if token.Error != "" {
			msg := token.Error
			if token.ErrorDescription != "" {
				msg += ": " + token.ErrorDescription
			}
			a.emitOAuthComplete(false, nil, token.Error, token.ErrorDescription)
			a.serveOAuthResultPage(w, "Authorization failed", msg)
			a.stopOAuthServer()
			return
		}

		a.emitOAuthComplete(true, token, "", "")
		a.serveOAuthResultPage(w, "Authorized", "You can close this tab and return to reqit.")
		a.stopOAuthServer()
	}
}

func (a *App) emitOAuthComplete(success bool, token *oauth2.TokenResponse, errCode, errDesc string) {
	payload := map[string]interface{}{
		"success": success,
	}
	if token != nil {
		payload["token"] = models.OAuth2TokenResponse{
			AccessToken:  token.AccessToken,
			RefreshToken: token.RefreshToken,
			TokenType:    token.TokenType,
			ExpiresIn:    token.ExpiresIn,
			ExpiresAt:    token.ExpiresAt,
		}
	}
	if errCode != "" {
		payload["error"] = errCode
		payload["errorDescription"] = errDesc
	}
	runtime.EventsEmit(a.ctx, "oauth2:complete", payload)
}

func (a *App) serveOAuthResultPage(w http.ResponseWriter, title, message string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	body := `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>` + title + `</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Inter, sans-serif; background: #0d0d0d; color: #e6e6e6; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 40px 48px; max-width: 420px; text-align: center; }
  .dot { width: 48px; height: 48px; border-radius: 50%; margin: 0 auto 20px; background: #22c55e; display: flex; align-items: center; justify-content: center; font-size: 24px; }
  h1 { font-size: 18px; margin-bottom: 10px; }
  p { font-size: 14px; color: #9ca3af; line-height: 1.5; }
</style>
</head>
<body>
<div class="card">
  <div class="dot">✓</div>
  <h1>` + title + `</h1>
  <p>` + message + `</p>
</div>
<script>setTimeout(function(){ try { window.close(); } catch(e) {} }, 3000);</script>
</body>
</html>`
	_, _ = w.Write([]byte(body))
}

func (a *App) stopOAuthServer() {
	a.oauthMu.Lock()
	defer a.oauthMu.Unlock()
	if a.oauthServer != nil {
		_ = a.oauthServer.Close()
		a.oauthServer = nil
	}
	for _, ln := range a.oauthListeners {
		_ = ln.Close()
	}
	a.oauthListeners = nil
	a.oauthState = nil
}
