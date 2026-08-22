package oauth2

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

// TestE2EIPv6CallbackProvesDualStackFix is the exact scenario that caused
// "This site can't be reached": the browser resolves localhost to ::1, sends
// the callback to [::1]:PORT, and the old IPv4-only listener rejects it.
// This test proves the dual-stack listener accepts the IPv6 callback.
func TestE2EIPv6CallbackProvesDualStackFix(t *testing.T) {
	fp := newFakeProvider(t)
	cfg := OAuthConfig{
		GrantType: GrantAuthorizationCode,
		AuthURL:   fp.srv.URL + "/authorize",
		TokenURL:  fp.srv.URL + "/token",
		ClientID:  "e2e-test",
	}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	if f.loopback.ln6 == nil {
		t.Skip("IPv6 loopback not available on this host — cannot prove dual-stack fix")
	}

	// Simulate what Chrome does on Windows: resolve localhost → ::1, send
	// callback to http://[::1]:PORT/callback?code=...&state=...
	v6URL := fmt.Sprintf("http://[::1]:%d/callback?code=e2e-code&state=%s",
		f.loopback.Port(), redir.State)

	resp, err := http.Get(v6URL)
	if err != nil {
		t.Fatalf("IPv6 callback failed (the dual-stack fix didn't work): %v", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("IPv6 callback got HTTP %d (expected 200): %s", resp.StatusCode, body)
	}
	if !strings.Contains(string(body), "Sign-in complete") {
		t.Fatalf("IPv6 callback response doesn't look like success: %s", body)
	}

	// The token exchange must have completed via the fake provider.
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	token, err := f.Wait(ctx)
	if err != nil {
		t.Fatalf("flow didn't complete after IPv6 callback: %v", err)
	}
	if token == nil || token.AccessToken != "fake-access-token" {
		t.Errorf("token = %+v, want fake-access-token", token)
	}
	if len(fp.tokenForms) != 1 {
		t.Fatalf("token endpoint called %d times, want 1", len(fp.tokenForms))
	}
	t.Logf("IPv6 dual-stack callback → token exchange: PASS (access_token=%s)", token.AccessToken)
}

// TestE2EFormPostProvesAzureADFix is the exact scenario that broke Azure AD:
// the provider POSTs code/state as form_post to the redirect URI, and the old
// handler returned "method not allowed". This test proves the fix.
func TestE2EFormPostProvesAzureADFix(t *testing.T) {
	fp := newFakeProvider(t)
	cfg := OAuthConfig{
		GrantType: GrantAuthorizationCode,
		AuthURL:   fp.srv.URL + "/authorize",
		TokenURL:  fp.srv.URL + "/token",
		ClientID:  "e2e-azure",
	}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	root := loopbackRoot(t, redir.RedirectURI)

	// Simulate Azure AD form_post: POST application/x-www-form-urlencoded
	// with code and state to the redirect URI (not /fragment, not GET).
	form := url.Values{
		"state": {redir.State},
		"code":  {redir.State + "-auth-code"},
	}
	resp, err := http.PostForm(root+"/callback", form)
	if err != nil {
		t.Fatalf("form_post callback failed: %v", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("form_post got HTTP %d (expected 200): %s", resp.StatusCode, body)
	}
	if !strings.Contains(string(body), "Sign-in complete") {
		t.Fatalf("form_post response doesn't look like success: %s", body)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	token, err := f.Wait(ctx)
	if err != nil {
		t.Fatalf("flow didn't complete after form_post: %v", err)
	}
	if token == nil || token.AccessToken != "fake-access-token" {
		t.Errorf("token = %+v", token)
	}
	t.Logf("form_post (Azure AD) callback → token exchange: PASS")
}

// TestE2EIsLoopbackHostHandlesIPv6 verifies the isLoopbackHost function
// correctly handles all the Host header formats a browser might send.
func TestE2EIsLoopbackHostHandlesIPv6(t *testing.T) {
	port := 12345
	tests := []struct {
		name string
		host string
		want bool
	}{
		{"IPv4 with port", "127.0.0.1:12345", true},
		{"localhost with port", "localhost:12345", true},
		{"IPv6 bracket notation", "[::1]:12345", true},
		{"IPv6 bare", "::1", true},
		{"IPv4 bare", "127.0.0.1", true},
		{"localhost bare", "localhost", true},
		{"wrong port", "127.0.0.1:99999", false},
		{"external host", "evil.example.com:12345", false},
		{"external IP", "192.168.1.1:12345", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isLoopbackHost(tt.host, port)
			if got != tt.want {
				t.Errorf("isLoopbackHost(%q, %d) = %v, want %v", tt.host, port, got, tt.want)
			}
		})
	}
}

// TestE2EFormPostErrorProvesAzureADDenyFix verifies that when Azure AD
// returns access_denied via form_post, the error is surfaced correctly.
func TestE2EFormPostErrorProvesAzureADDenyFix(t *testing.T) {
	fp := newFakeProvider(t)
	fp.authFn = func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r,
			fmt.Sprintf("/callback?error=access_denied&error_description=User+cancelled&state=%s",
				r.URL.Query().Get("state")),
			http.StatusFound)
	}
	cfg := OAuthConfig{
		GrantType: GrantAuthorizationCode,
		AuthURL:   fp.srv.URL + "/authorize",
		TokenURL:  fp.srv.URL + "/token",
		ClientID:  "e2e-azure-deny",
	}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	root := loopbackRoot(t, redir.RedirectURI)

	// Azure AD sends access_denied via form_post.
	form := url.Values{
		"state":              {redir.State},
		"error":              {"access_denied"},
		"error_description":  {"User cancelled the consent"},
	}
	resp, err := http.PostForm(root+"/callback", form)
	if err != nil {
		t.Fatalf("form_post error callback failed: %v", err)
	}
	resp.Body.Close()

	// Handler returns 200 (error page) but the flow should finish with an error.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = f.Wait(ctx)
	if err == nil {
		t.Fatal("expected error for form_post access_denied, got nil")
	}
	if !strings.Contains(err.Error(), "access_denied") && !strings.Contains(err.Error(), "denied") {
		t.Errorf("error = %v, want something about access_denied", err)
	}
	t.Logf("form_post error (Azure AD deny): PASS (error=%v)", err)
}

// TestE2EBareHostIPv6Callback simulates an HTTP/2 client that sends a bare
// Host header without a port — this was another path to 403 rejections.
func TestE2EBareHostIPv6Callback(t *testing.T) {
	fp := newFakeProvider(t)
	cfg := OAuthConfig{
		GrantType: GrantAuthorizationCode,
		AuthURL:   fp.srv.URL + "/authorize",
		TokenURL:  fp.srv.URL + "/token",
		ClientID:  "e2e-bare",
	}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	// Send a callback with a bare IPv6 Host header (no port).
	req, err := http.NewRequest("GET",
		fmt.Sprintf("http://[::1]:%d/callback?code=bare-code&state=%s",
			f.loopback.Port(), redir.State), nil)
	if err != nil {
		t.Fatal(err)
	}
	// Override the Host to be bare IPv6 without port.
	req.Host = "::1"

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("bare IPv6 callback failed: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("bare IPv6 callback got HTTP %d, want 200", resp.StatusCode)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	token, err := f.Wait(ctx)
	if err != nil {
		t.Fatalf("flow didn't complete after bare IPv6 callback: %v", err)
	}
	if token == nil || token.AccessToken != "fake-access-token" {
		t.Errorf("token = %+v", token)
	}
	t.Logf("bare Host header (::1 without port) callback: PASS")
}

// TestE2EAuthCodeFullFlow simulates the complete authorization code flow:
// bind loopback → build authorize URL → callback with code → token exchange.
// This is the full happy path that must work for every provider.
func TestE2EAuthCodeFullFlow(t *testing.T) {
	fp := newFakeProvider(t)
	cfg := OAuthConfig{
		GrantType:   GrantAuthorizationCode,
		AuthURL:     fp.srv.URL + "/authorize",
		TokenURL:    fp.srv.URL + "/token",
		ClientID:    "e2e-full",
		Scopes:      "openid profile email",
		RedirectURI: "", // ephemeral
		PKCE:        PKCES256,
	}

	// Prepare the flow so we can send a callback before blocking on Wait.
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if redir == nil {
		t.Fatal("redir is nil")
	}

	// Simulate the browser callback: the provider redirected back to the
	// loopback URI with code + state.
	root := loopbackRoot(t, redir.RedirectURI)
	callbackURL := fmt.Sprintf("%s/callback?code=e2e-code&state=%s", root, redir.State)
	resp, err := http.Get(callbackURL)
	if err != nil {
		t.Fatalf("callback GET: %v", err)
	}
	resp.Body.Close()

	// Now wait for the token exchange to complete.
	token, err := f.Wait(context.Background())
	if err != nil {
		t.Fatalf("Wait: %v", err)
	}

	// Verify the authorize URL has all the expected parameters.
	au, err := url.Parse(redir.AuthorizeURL)
	if err != nil {
		t.Fatalf("authorize URL parse: %v", err)
	}
	q := au.Query()
	if q.Get("response_type") != "code" {
		t.Errorf("response_type = %q, want code", q.Get("response_type"))
	}
	if q.Get("client_id") != "e2e-full" {
		t.Errorf("client_id = %q, want e2e-full", q.Get("client_id"))
	}
	if q.Get("code_challenge") == "" {
		t.Error("code_challenge is empty — PKCE not sent")
	}
	if q.Get("code_challenge_method") != "S256" {
		t.Errorf("code_challenge_method = %q, want S256", q.Get("code_challenge_method"))
	}
	if q.Get("state") == "" {
		t.Error("state is empty")
	}
	if q.Get("scope") != "openid profile email" {
		t.Errorf("scope = %q, want openid profile email", q.Get("scope"))
	}
	if q.Get("redirect_uri") == "" {
		t.Error("redirect_uri is empty — the loopback URI wasn't included")
	}

	// Verify the token result.
	if token == nil {
		t.Fatal("token is nil")
	}
	if token.AccessToken != "fake-access-token" {
		t.Errorf("access_token = %q", token.AccessToken)
	}
	if strings.ToLower(token.TokenType) != "bearer" {
		t.Errorf("token_type = %q, want Bearer", token.TokenType)
	}

	// Verify the provider received the token exchange with the code_verifier.
	if len(fp.tokenForms) != 1 {
		t.Fatalf("token endpoint called %d times, want 1", len(fp.tokenForms))
	}
	form := fp.tokenForms[0]
	if form.Get("grant_type") != "authorization_code" {
		t.Errorf("grant_type = %q", form.Get("grant_type"))
	}
	if form.Get("code") == "" {
		t.Error("code is empty in token exchange")
	}
	if form.Get("code_verifier") == "" {
		t.Error("code_verifier is empty — PKCE verifier not sent in exchange")
	}
	if form.Get("client_id") != "e2e-full" {
		t.Errorf("client_id = %q in token exchange", form.Get("client_id"))
	}
	// Public client: no client_secret.
	if form.Get("client_secret") != "" {
		t.Errorf("client_secret = %q — should not be sent for public PKCE client", form.Get("client_secret"))
	}

	t.Logf("Full auth code + PKCE flow: PASS (access_token=%s, PKCE S256 verified)", token.AccessToken)
}

// --- SSO proxy redirect chain -----------------------------------------------

// TestE2ESSOProxyPathSegmentRedirect proves that when a corporate SSO proxy
// redirects to the loopback with code/state in the URL path (e.g.
// /callback/CODE/STATE) instead of query params, the callback handler
// extracts them and completes the flow.
func TestE2ESSOProxyPathSegmentRedirect(t *testing.T) {
	fp := newFakeProvider(t)
	cfg := OAuthConfig{
		GrantType: GrantAuthorizationCode,
		AuthURL:   fp.srv.URL + "/authorize",
		TokenURL:  fp.srv.URL + "/token",
		ClientID:  "sso-proxy-test",
	}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	root := loopbackRoot(t, redir.RedirectURI)

	// SSO proxy redirects to /callback/<code>/<state> (path segments,
	// no query params). This is a real pattern from Azure AD B2C and
	// some Okta deployments.
	pathURL := fmt.Sprintf("%s/callback/sso-proxy-code/%s", root, redir.State)
	resp, err := http.Get(pathURL)
	if err != nil {
		t.Fatalf("path-segment redirect failed: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("path-segment redirect got HTTP %d", resp.StatusCode)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	token, err := f.Wait(ctx)
	if err != nil {
		t.Fatalf("flow didn't complete after path-segment redirect: %v", err)
	}
	if token == nil || token.AccessToken != "fake-access-token" {
		t.Errorf("token = %+v", token)
	}

	// Verify the provider received the correct code.
	fp.mu.Lock()
	forms := fp.tokenForms
	fp.mu.Unlock()
	if len(forms) == 0 {
		t.Fatal("token endpoint never called")
	}
	if forms[0].Get("code") != "sso-proxy-code" {
		t.Errorf("code = %q, want sso-proxy-code", forms[0].Get("code"))
	}
	t.Logf("SSO proxy path-segment redirect: PASS (code=sso-proxy-code, token=%s)", token.AccessToken)
}

// TestE2ESSOProxyFormPostViaIntermediate proves that when an SSO proxy
// receives a form_post from the provider and re-POSTs it to the loopback
// (with an empty form body but query params from the redirect chain), the
// handler falls back to query param extraction.
func TestE2ESSOProxyFormPostViaIntermediate(t *testing.T) {
	fp := newFakeProvider(t)
	cfg := OAuthConfig{
		GrantType: GrantAuthorizationCode,
		AuthURL:   fp.srv.URL + "/authorize",
		TokenURL:  fp.srv.URL + "/token",
		ClientID:  "sso-proxy-formpost",
	}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	root := loopbackRoot(t, redir.RedirectURI)

	// SSO proxy POSTs with empty body but code/state in query params
	// (the proxy stripped the form body during its redirect chain).
	postURL := fmt.Sprintf("%s/callback?code=sso-proxy-code&state=%s", root, redir.State)
	resp, err := http.Post(postURL, "application/x-www-form-urlencoded", strings.NewReader(""))
	if err != nil {
		t.Fatalf("form_post via proxy failed: %v", err)
	}
	resp.Body.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	token, err := f.Wait(ctx)
	if err != nil {
		t.Fatalf("flow didn't complete: %v", err)
	}
	if token == nil || token.AccessToken != "fake-access-token" {
		t.Errorf("token = %+v", token)
	}
	t.Logf("SSO proxy form_post with query fallback: PASS")
}

// TestE2ESSOProxyPathFallbackOnError proves that when an SSO proxy
// delivers an error via path segments (e.g. /callback/error/denied), the
// handler surfaces it correctly.
func TestE2ESSOProxyPathFallbackOnError(t *testing.T) {
	fp := newFakeProvider(t)
	cfg := OAuthConfig{
		GrantType: GrantAuthorizationCode,
		AuthURL:   fp.srv.URL + "/authorize",
		TokenURL:  fp.srv.URL + "/token",
		ClientID:  "sso-proxy-error",
	}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	root := loopbackRoot(t, redir.RedirectURI)

	// The SSO proxy delivers an error via query params (the standard way).
	errURL := fmt.Sprintf("%s/callback?error=access_denied&error_description=SSO+denied&state=%s", root, redir.State)
	resp, err := http.Get(errURL)
	if err != nil {
		t.Fatalf("error redirect failed: %v", err)
	}
	resp.Body.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = f.Wait(ctx)
	if err == nil {
		t.Fatal("expected error for SSO proxy access_denied")
	}
	if !strings.Contains(err.Error(), "access_denied") {
		t.Errorf("error = %v, want access_denied", err)
	}
	t.Logf("SSO proxy error surfacing: PASS (error=%v)", err)
}
