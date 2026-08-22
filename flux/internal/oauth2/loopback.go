package oauth2

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// LoopbackOptions configures the loopback callback listener.
type LoopbackOptions struct {
	// Port is the exact loopback port to bind. Zero (the default) binds an
	// OS-assigned ephemeral port per RFC 8252 §7.3. A fixed port is only
	// needed for providers that require a pre-registered exact redirect URI
	// (e.g. GitHub, Slack, Spotify).
	Port int
}

// Loopback is an HTTP listener on 127.0.0.1 that receives the provider's
// authorization redirect. It is intentionally loopback-only: never binds a
// routable address, and every request is Host-header checked (DNS-rebinding
// protection) before being handled.
type Loopback struct {
	ln     net.Listener // primary IPv4 listener (127.0.0.1)
	ln6    net.Listener // optional IPv6 listener ([::1]), same port
	port   int
	srv    *http.Server
	srv6   *http.Server // serves ln6 when present
	mu     sync.Mutex
	closed bool
}

// NewLoopback binds a TCP listener on 127.0.0.1 (IPv4). Binding failures
// (port in use, no loopback interface) surface as ErrPortBindFailed.
//
// When the primary IPv4 listener succeeds, NewLoopback also tries to bind
// [::1] on the same port (dual-stack). Browsers on modern Windows resolve
// localhost to ::1 first; without the IPv6 listener the callback gets a
// TCP-rst and shows "This site can't be reached". The IPv6 bind is
// best-effort — if it fails (e.g. another process holds the IPv6 port)
// the IPv4 listener still works.
func NewLoopback(opts LoopbackOptions) (*Loopback, error) {
	addr := "127.0.0.1:0"
	if opts.Port >= 1 && opts.Port <= 65535 {
		addr = fmt.Sprintf("127.0.0.1:%d", opts.Port)
	}
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, PortBindFailedError("loopback", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port

	// Best-effort IPv6 dual-stack. If the IPv6 port is already taken we
	// silently skip — IPv4-only is still correct for most providers.
	var ln6 net.Listener
	v6addr := fmt.Sprintf("[::1]:%d", port)
	ln6, _ = net.Listen("tcp", v6addr) //nolint:errcheck // best-effort

	return &Loopback{ln: ln, ln6: ln6, port: port}, nil
}

// Port returns the bound port.
func (l *Loopback) Port() int { return l.port }

// URL returns the listener root, e.g. http://127.0.0.1:41234.
func (l *Loopback) URL() string {
	return fmt.Sprintf("http://127.0.0.1:%d", l.port)
}

// RedirectURI returns the canonical redirect URI for this listener. When a
// flow uses a configured (fixed-port or custom-path) redirect URI, the
// configured value is used instead — see PrepareLoopbackFlow.
func (l *Loopback) RedirectURI() string {
	return l.URL() + "/callback"
}

// Serve starts serving h on the primary (IPv4) listener, and the secondary
// (IPv6) listener when present. Both share the same handler. The method
// returns when the primary listener is closed; the IPv6 server is shut
// down in Close.
func (l *Loopback) Serve(h http.Handler) error {
	newServer := func() *http.Server {
		return &http.Server{
			Handler:           h,
			ReadHeaderTimeout: 5 * time.Second,
			ReadTimeout:       15 * time.Second,
			WriteTimeout:      30 * time.Second,
			IdleTimeout:       60 * time.Second,
		}
	}
	l.mu.Lock()
	l.srv = newServer()
	if l.ln6 != nil {
		l.srv6 = newServer()
		go func() { _ = l.srv6.Serve(l.ln6) }()
	}
	l.mu.Unlock()
	return l.srv.Serve(l.ln)
} // Close tears the listener down. It uses a bounded graceful shutdown so an
// in-flight callback response is delivered before the socket closes; on the
// timeout path (no active requests) it returns immediately.
func (l *Loopback) Close() error {
	l.mu.Lock()
	if l.closed {
		l.mu.Unlock()
		return nil
	}
	l.closed = true
	srv, srv6, ln6 := l.srv, l.srv6, l.ln6
	l.mu.Unlock()

	// Shutdown IPv6 first (it was started as a background goroutine).
	if srv6 != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		_ = srv6.Shutdown(ctx)
		cancel()
	}
	if ln6 != nil {
		_ = ln6.Close()
	}

	if srv != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = srv.Shutdown(ctx)
	}
	err := l.ln.Close()
	if errors.Is(err, net.ErrClosed) {
		return nil
	}
	return err
}

// FlowOptions configures an interactive loopback flow.
type FlowOptions struct {
	// Port binds a fixed loopback port instead of an ephemeral one. Zero
	// means ephemeral (the default). A fixed port is derived automatically
	// from cfg.RedirectURI when it points at a loopback address.
	Port int
	// Timeout bounds the whole interactive flow. Zero defaults to 5 minutes.
	Timeout time.Duration
	// LaunchBrowser, when true, opens the authorize URL in the OS default
	// browser via OpenURL. Leave false when the calling layer opens the URL
	// itself (e.g. the Wails renderer via BrowserOpenURL).
	LaunchBrowser bool
	// ClientSecret is a confidential client's secret (RFC 6749 §2.3). It is
	// transient for the flow's lifetime and is only ever sent when the config
	// marks the client Confidential — never in a PKCE public-client exchange.
	ClientSecret string
}

const defaultFlowTimeout = 5 * time.Minute

// flowResult is delivered on the result channel once the callback has been
// processed. The channel is buffered so a late second callback is dropped
// without blocking its handler.
type flowResult struct {
	token *TokenResult
	err   error
}

// LoopbackFlow is a prepared interactive flow: the loopback listener is
// bound, the state and (for authorization_code) PKCE verifier are generated,
// and Wait blocks until the provider's callback arrives or the deadline
// passes. Callers must Close the flow after Wait returns (or on any early
// exit path) so the listener is torn down.
type LoopbackFlow struct {
	loopback     *Loopback
	flow         callbackFlow
	exchanger    Exchanger // non-nil for authorization_code flows
	authorizeURL string
	timeout      time.Duration
	result       chan flowResult
	finished     atomic.Bool
}

// callbackFlow is the subset of AuthCodeFlow / ImplicitFlow the loopback
// handler needs.
type callbackFlow interface {
	State() string
	ValidateState(state string) bool
	AuthorizeURL() (string, error)
}

// PrepareLoopbackFlow binds the loopback listener and prepares the in-flight
// flow for cfg.GrantType — authorization_code or implicit. It returns the
// flow handle and the RedirectResult (authorize URL, exact redirect URI,
// state). The caller opens (or displays) the authorize URL, then blocks on
// Wait. Always Close the flow when done.
func PrepareLoopbackFlow(cfg OAuthConfig, opts FlowOptions) (*LoopbackFlow, *RedirectResult, error) {
	if cfg.GrantType != GrantAuthorizationCode && cfg.GrantType != GrantImplicit {
		return nil, nil, InvalidConfigError("authorize",
			fmt.Sprintf("grant %q has no interactive redirect — use authorization_code or implicit", cfg.GrantType))
	}
	if opts.Timeout <= 0 {
		opts.Timeout = defaultFlowTimeout
	}

	// Derive the port to bind: explicit option wins, then the port of a
	// configured loopback redirect URI (fixed-port providers), else
	// ephemeral per RFC 8252 §7.3.
	port := opts.Port
	if port == 0 {
		if u, err := url.Parse(cfg.RedirectURI); err == nil && u.Port() != "" {
			if p, err := strconv.Atoi(u.Port()); err == nil && p >= 1 && p <= 65535 {
				port = p
			}
		}
	}

	// Bind the loopback listener. A fixed port that is already taken (a
	// stale reqit process, another dev server) no longer hard-fails the
	// flow: fall back to an OS-assigned ephemeral port and tell the caller
	// via RedirectResult.Note that the redirect URI changed, so the user can
	// update the provider registration if it requires an exact match.
	note := ""
	l, err := NewLoopback(LoopbackOptions{Port: port})
	if err != nil && port != 0 && errors.Is(err, ErrPortBindFailed) {
		fallback, ferr := NewLoopback(LoopbackOptions{Port: 0})
		if ferr != nil {
			return nil, nil, ferr // genuine failure (e.g. no loopback interface)
		}
		l = fallback
		note = fmt.Sprintf(
			"Loopback port %d is already in use, so this attempt used an auto-assigned port instead — the callback is %s. If your provider requires an exact registered redirect URI, update it to match (or free port %d and retry) or the provider will reject the redirect.",
			port, l.RedirectURI(), port)
	} else if err != nil {
		return nil, nil, err
	}

	// The flow must send the exact URI the listener will receive: the
	// configured one when set and bound, else the ephemeral loopback URI
	// (which also covers a fixed-port bind failure that fell back above).
	if cfg.RedirectURI == "" || note != "" {
		cfg.RedirectURI = l.RedirectURI()
	}

	f := &LoopbackFlow{
		loopback: l,
		timeout:  opts.Timeout,
		result:   make(chan flowResult, 1),
	}

	var state string
	switch cfg.GrantType {
	case GrantAuthorizationCode:
		af, err := NewAuthCodeFlow(cfg)
		if err != nil {
			l.Close()
			return nil, nil, err
		}
		af.WithClientSecret(opts.ClientSecret)
		f.flow = af
		f.exchanger = af
		state = af.State()
	case GrantImplicit:
		imf, err := NewImplicitFlow(cfg)
		if err != nil {
			l.Close()
			return nil, nil, err
		}
		f.flow = imf
		state = imf.State()
	}

	authURL, err := f.flow.AuthorizeURL()
	if err != nil {
		l.Close()
		return nil, nil, err
	}
	f.authorizeURL = authURL

	go func() { _ = l.Serve(http.HandlerFunc(f.handleCallback)) }()

	redir := &RedirectResult{
		AuthorizeURL: authURL,
		RedirectURI:  cfg.RedirectURI,
		State:        state,
		Mode:         RedirectLoopback,
		Note:         note,
	}
	return f, redir, nil
}

// AuthorizeURL returns the prepared authorize URL.
func (f *LoopbackFlow) AuthorizeURL() string { return f.authorizeURL }

// RedirectURI returns the exact redirect URI sent in the authorize request.
func (f *LoopbackFlow) RedirectURI() string { return f.loopback.RedirectURI() }

// Wait blocks until the provider's callback arrives, the flow timeout
// elapses, or ctx is done. It returns the token or a typed error:
// ErrStateMismatch, ErrProviderDenied (with the verbatim provider
// error/error_description), ErrMissingCallback, or ErrTimeout.
func (f *LoopbackFlow) Wait(ctx context.Context) (*TokenResult, error) {
	ctx, cancel := context.WithTimeout(ctx, f.timeout)
	defer cancel()
	select {
	case res := <-f.result:
		return res.token, res.err
	case <-ctx.Done():
		return nil, TimeoutError("authorize")
	}
}

// Close tears the loopback listener down. Safe to call multiple times.
func (f *LoopbackFlow) Close() error { return f.loopback.Close() }

// RunLoopbackFlow is the engine-level entry point: it prepares the flow,
// launches the OS browser when opts.LaunchBrowser is set, blocks until the
// callback (or timeout), and tears the listener down before returning. On a
// browser-launch failure it returns the RedirectResult alongside the error so
// the caller can still complete the flow manually.
func RunLoopbackFlow(ctx context.Context, cfg OAuthConfig, opts FlowOptions) (*TokenResult, *RedirectResult, error) {
	f, redir, err := PrepareLoopbackFlow(cfg, opts)
	if err != nil {
		return nil, nil, err
	}
	defer f.Close()

	if opts.LaunchBrowser {
		if err := OpenURL(redir.AuthorizeURL); err != nil {
			return nil, redir, fmt.Errorf("oauth2: launch browser: %w", err)
		}
	}
	token, err := f.Wait(ctx)
	return token, redir, err
}

// --- Callback handling ------------------------------------------------------

// fragmentPageHTML is served when the provider redirects with a URL fragment
// (Implicit grant). Fragments never reach the server over HTTP (RFC 6749
// §4.2.2), so the page re-POSTs the fragment back to the same listener as
// JSON. The page is fully static and CSP-locked; the response it renders is
// produced server-side with all provider text HTML-escaped.
const fragmentPageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'">
<title>reqit — completing sign-in</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0A0A0A; color: #E6EDF3; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  .card { background: #141414; border: 1px solid #2A2A2A; border-radius: 14px; padding: 44px 56px; max-width: 540px; text-align: center; box-shadow: 0 8px 40px rgba(0,0,0,.5); }
  .dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #00D9FF; box-shadow: 0 0 12px #00D9FF; margin-bottom: 18px; }
  h1 { font-size: 20px; font-weight: 600; margin: 0 0 10px; letter-spacing: .2px; }
  p { color: #9CA3AF; font-size: 14px; line-height: 1.6; margin: 0; word-break: break-word; }
</style>
</head>
<body>
<div class="card">
  <span class="dot"></span>
  <h1>reqit — completing sign-in</h1>
  <p>Processing the authorization response. You can close this tab when it finishes.</p>
</div>
<script>
(function () {
  var q = new URLSearchParams(window.location.search);
  var h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  var body = JSON.stringify({
    state: q.get("state") || h.get("state") || "",
    code: q.get("code") || "",
    error: q.get("error") || h.get("error") || "",
    errorDescription: q.get("error_description") || h.get("error_description") || "",
    errorUri: q.get("error_uri") || h.get("error_uri") || "",
    accessToken: h.get("access_token") || "",
    tokenType: h.get("token_type") || "",
    scope: h.get("scope") || "",
    expiresIn: h.get("expires_in") || ""
  });
  fetch("/fragment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body
  }).then(function (r) { return r.text(); }).then(function (html) {
    document.open();
    document.write(html);
    document.close();
  }).catch(function () {
    document.body.innerHTML = '<div class="card"><span class="dot" style="background:#FF6B6B;box-shadow:0 0 12px #FF6B6B"></span><h1>Authorization failed</h1><p>Could not deliver the authorization response to reqit. Return to the app and try again.</p></div>';
  });
})();
</script>
</body>
</html>`

// fragmentBody is the JSON the callback page re-POSTs when the provider
// delivered its response in a URL fragment (Implicit grant).
type fragmentBody struct {
	State            string `json:"state"`
	Code             string `json:"code"`
	Error            string `json:"error"`
	ErrorDescription string `json:"errorDescription"`
	ErrorURI         string `json:"errorUri"`
	AccessToken      string `json:"accessToken"`
	TokenType        string `json:"tokenType"`
	Scope            string `json:"scope"`
	ExpiresIn        string `json:"expiresIn"`
}

const maxFragmentBody = 64 << 10

// handleCallback is the listener's single entry point. GET requests are the
// provider's redirect (query params for authorization_code, or the fragment
// page for implicit). POST /fragment is the page re-POSTing the fragment
// (implicit grant). POST to any other path handles form_post response mode
// (RFC 4918 / Azure AD): the provider POSTs the code/state as
// application/x-www-form-urlencoded to the redirect URI.
func (f *LoopbackFlow) handleCallback(w http.ResponseWriter, r *http.Request) {
	if !isLoopbackHost(r.Host, f.loopback.Port()) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	if f.finished.Load() {
		http.Error(w, "callback already completed", http.StatusGone)
		return
	}
	switch {
	case r.Method == http.MethodPost && r.URL.Path == "/fragment":
		f.handleFragmentPost(w, r)
	case r.Method == http.MethodPost:
		// form_post response mode: the provider POSTs code/state as form
		// data (application/x-www-form-urlencoded) to the redirect URI.
		f.handleFormPost(w, r)
	case r.Method == http.MethodGet:
		f.handleGet(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleGet processes the provider's redirect. Query params carry the code
// (authorization_code); a query-less redirect is an Implicit-grant fragment
// delivery, which gets the re-POST page.
//
// SSO proxy support: some corporate SSO proxies redirect through an
// intermediate host and deliver the code/state in the path rather than
// query params (e.g. /callback/CODE/STATE). The handler extracts from
// both locations so the callback succeeds regardless of how the SSO proxy
// formats the redirect.
func (f *LoopbackFlow) handleGet(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	// Extract code and state from query params first (standard OAuth).
	code := q.Get("code")
	state := q.Get("state")
	errCode := q.Get("error")
	errDesc := q.Get("error_description")
	errURI := q.Get("error_uri")

	// SSO proxy fallback: extract code/state from path segments when query
	// params are empty. Accepts /callback/<code>/<state> and
	// /callback/<code> (state defaults to the in-flight state).
	if code == "" && errCode == "" {
		segments := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		// Find the "callback" segment and take the next 1-2 segments.
		for i, seg := range segments {
			if strings.EqualFold(seg, "callback") && i+1 < len(segments) {
				code = segments[i+1]
				if i+2 < len(segments) {
					state = segments[i+2]
				}
				break
			}
		}
	}

	if code == "" && errCode == "" {
		// No code, no error — this is either an implicit-grant fragment
		// delivery (the JS page will re-POST it) or an SSO proxy
		// intermediate page. Serve the fragment page which handles both.
		writeHTML(w, fragmentPageHTML)
		return
	}

	page, token, err := f.resolve(r.Context(), state, code,
		errCode, errDesc, errURI, 0, "", "", "")
	writeHTML(w, page)
	if token != nil || err != nil {
		f.finish(token, err)
	}
}

// handleFormPost processes a form_post response mode redirect (e.g. Azure
// AD). The provider POSTs the authorization response as
// application/x-www-form-urlencoded to the redirect URI. The fields are
// identical to the query-string params in a GET redirect.
//
// SSO proxy fallback: when the form body is empty (the proxy did a
// server-side redirect that stripped the body), fall back to extracting
// code/state from query params or path segments.
func (f *LoopbackFlow) handleFormPost(w http.ResponseWriter, r *http.Request) {
	var code, state, errCode, errDesc, errURI string
	if err := r.ParseForm(); err == nil {
		code = r.FormValue("code")
		state = r.FormValue("state")
		errCode = r.FormValue("error")
		errDesc = r.FormValue("error_description")
		errURI = r.FormValue("error_uri")
	}

	// SSO proxy fallback: extract from query params or path segments when
	// the form body is empty.
	if code == "" && errCode == "" {
		q := r.URL.Query()
		code = q.Get("code")
		state = q.Get("state")
		errCode = q.Get("error")
		errDesc = q.Get("error_description")
		errURI = q.Get("error_uri")
	}
	if code == "" && errCode == "" {
		segments := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		for i, seg := range segments {
			if strings.EqualFold(seg, "callback") && i+1 < len(segments) {
				code = segments[i+1]
				if i+2 < len(segments) {
					state = segments[i+2]
				}
				break
			}
		}
	}

	if code == "" && errCode == "" {
		e := MissingCallbackError("callback")
		writeHTML(w, errorPage(e))
		return
	}

	page, token, err := f.resolve(r.Context(), state, code,
		errCode, errDesc, errURI, 0, "", "", "")
	writeHTML(w, page)
	if token != nil || err != nil {
		f.finish(token, err)
	}
}

// handleFragmentPost receives the fragment JSON re-POSTed by the callback
// page and completes the flow.
func (f *LoopbackFlow) handleFragmentPost(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(io.LimitReader(r.Body, maxFragmentBody+1))
	if err != nil || len(raw) > maxFragmentBody {
		e := &OAuthError{Op: "callback", Kind: ErrMissingCallback, Msg: "fragment payload too large"}
		writeHTML(w, errorPage(e))
		f.finish(nil, e)
		return
	}
	var fb fragmentBody
	if err := json.Unmarshal(raw, &fb); err != nil {
		e := MissingCallbackError("callback")
		writeHTML(w, errorPage(e))
		f.finish(nil, e)
		return
	}
	expiresIn, _ := strconv.Atoi(fb.ExpiresIn)
	page, token, err := f.resolve(r.Context(), fb.State, fb.Code,
		fb.Error, fb.ErrorDescription, fb.ErrorURI, expiresIn,
		fb.AccessToken, fb.TokenType, fb.Scope)
	writeHTML(w, page)
	if token != nil || err != nil {
		f.finish(token, err)
	}
}

// resolve validates the callback and produces the token (exchanging the code
// for authorization_code, or building the result from a fragment token for
// implicit). It returns the page to render alongside the outcome.
func (f *LoopbackFlow) resolve(ctx context.Context, state, code, errCode, errDesc, errURI string, expiresIn int, accessToken, tokenType, scope string) (string, *TokenResult, error) {
	if errCode != "" {
		e := ProviderDeniedError("authorize", &ProviderError{Code: errCode, Description: errDesc, URI: errURI})
		return errorPage(e), nil, e
	}
	if state != "" && !f.flow.ValidateState(state) {
		e := StateMismatchError("callback")
		return errorPage(e), nil, e
	}
	if state == "" {
		e := MissingCallbackError("callback")
		return errorPage(e), nil, e
	}
	if code != "" {
		if f.exchanger == nil {
			e := InvalidConfigError("callback", "received an authorization code but this flow cannot exchange it")
			return errorPage(e), nil, e
		}
		token, err := f.exchanger.ExchangeCode(ctx, code)
		if err != nil {
			return errorPage(err), nil, err
		}
		return successPage(), token, nil
	}
	if accessToken != "" {
		tr := &TokenResult{AccessToken: accessToken, TokenType: tokenType, Scope: scope}
		if tr.TokenType == "" {
			tr.TokenType = "Bearer"
		}
		if expiresIn > 0 {
			tr.ExpiresIn = expiresIn
			// Milliseconds — the unit the renderer compares against Date.now().
			tr.ExpiresAtMs = time.Now().UnixMilli() + int64(expiresIn)*1000
		}
		return successPage(), tr, nil
	}
	e := MissingCallbackError("callback")
	return errorPage(e), nil, e
}

// finish delivers the outcome to Wait. Only the first outcome wins — the
// buffer absorbs a stray second callback without blocking its handler.
func (f *LoopbackFlow) finish(token *TokenResult, err error) {
	f.finished.Store(true)
	select {
	case f.result <- flowResult{token: token, err: err}:
	default:
	}
}

// isLoopbackHost rejects requests whose Host header doesn't point at this
// listener — DNS-rebinding protection. Both 127.0.0.1 and localhost aliases
// are accepted (the exact registered redirect URI decides which is used).
func isLoopbackHost(host string, port int) bool {
	h, p, err := net.SplitHostPort(host)
	if err != nil {
		// Host header may be bare IP/hostname without port (some HTTP/2
		// clients omit the port for non-standard ports). Treat it as a
		// match only if the hostname itself is a loopback address.
		h = strings.TrimSpace(host)
		// Fall through to the hostname check below with an empty port
		// so the caller can accept it when the port isn't present.
		switch strings.ToLower(h) {
		case "127.0.0.1", "localhost", "::1":
			return true
		}
		return false
	}
	if p != strconv.Itoa(port) {
		return false
	}
	switch strings.ToLower(h) {
	case "127.0.0.1", "localhost", "::1":
		return true
	}
	return false
}

// --- Branded result pages ---------------------------------------------------

const pageCSS = `:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0A0A0A;color:#E6EDF3;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}.card{background:#141414;border:1px solid #2A2A2A;border-radius:14px;padding:44px 56px;max-width:540px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.5)}.dot{display:inline-block;width:12px;height:12px;border-radius:50%;margin-bottom:18px}h1{font-size:20px;font-weight:600;margin:0 0 10px;letter-spacing:.2px}p{color:#9CA3AF;font-size:14px;line-height:1.6;margin:0;word-break:break-word}`

// renderStatusPage builds a branded Obsidian Plasma status page. title,
// dotColor, and message must be pre-escaped / from a fixed palette — no raw
// provider input may reach the HTML unescaped.
func renderStatusPage(title, dotColor, message string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>%s</title>
<style>%s</style>
</head>
<body>
<div class="card">
  <span class="dot" style="background:%s;box-shadow:0 0 12px %s"></span>
  <h1>%s</h1>
  <p>%s</p>
</div>
</body>
</html>`, title, pageCSS, dotColor, dotColor, title, message)
}

func successPage() string {
	return renderStatusPage("Sign-in complete", "#00D9FF",
		"You can close this tab and return to reqit.")
}

// errorPage renders the verbatim error (including the provider's
// error_description) with every byte HTML-escaped.
func errorPage(err error) string {
	detail := html.EscapeString(err.Error())
	return renderStatusPage("Authorization failed", "#FF6B6B", detail)
}

func writeHTML(w http.ResponseWriter, page string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = io.WriteString(w, page)
}

// --- Implicit flow ----------------------------------------------------------

// ImplicitFlow is an in-flight Implicit grant flow (RFC 6749 §4.2, deprecated
// by RFC 9700): it owns the state and builds the authorize URL with
// response_type=token, but there is no token exchange — the token arrives in
// the redirect URL fragment and is recovered by the loopback callback page.
type ImplicitFlow struct {
	cfg   OAuthConfig
	state string
}

// NewImplicitFlow validates the config and generates the state for the
// authorize request.
func NewImplicitFlow(cfg OAuthConfig) (*ImplicitFlow, error) {
	if cfg.AuthURL == "" || cfg.ClientID == "" {
		return nil, InvalidConfigError("authorize", "authorization URL and client ID are required")
	}
	return &ImplicitFlow{cfg: cfg, state: NewStateToken()}, nil
}

// State returns the state bound to this flow's authorize request.
func (f *ImplicitFlow) State() string { return f.state }

// ValidateState reports whether the provider's returned state matches the one
// issued for this specific request.
func (f *ImplicitFlow) ValidateState(state string) bool {
	return f.state != "" && state == f.state
}

// AuthorizeURL builds the authorization endpoint URL with
// response_type=token, client_id, redirect_uri, scope, and state.
func (f *ImplicitFlow) AuthorizeURL() (string, error) {
	u, err := url.Parse(f.cfg.AuthURL)
	if err != nil {
		return "", fmt.Errorf("oauth2: invalid authorization URL %q: %w", f.cfg.AuthURL, err)
	}
	q := u.Query()
	q.Set("response_type", "token")
	q.Set("client_id", f.cfg.ClientID)
	if f.cfg.RedirectURI != "" {
		q.Set("redirect_uri", f.cfg.RedirectURI)
	}
	q.Set("state", f.state)
	if f.cfg.Scopes != "" {
		q.Set("scope", f.cfg.Scopes)
	}
	u.RawQuery = q.Encode()
	return u.String(), nil
}
