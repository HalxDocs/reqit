package oauth2

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakeProvider is an in-process authorization + token server. The authorize
// handler defaults to echoing the state back and redirecting to the
// redirect_uri with a code (mimicking a real IdP); tests can override it.
type fakeProvider struct {
	t           *testing.T
	mu          sync.Mutex
	authFn      func(w http.ResponseWriter, r *http.Request)
	tokenForms  []url.Values
	tokenBody   string
	tokenStatus int
	srv         *httptest.Server
}

func newFakeProvider(t *testing.T) *fakeProvider {
	fp := &fakeProvider{
		t:           t,
		tokenBody:   `{"access_token":"fake-access-token","token_type":"Bearer","expires_in":3600}`,
		tokenStatus: http.StatusOK,
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/authorize", func(w http.ResponseWriter, r *http.Request) {
		fp.mu.Lock()
		fn := fp.authFn
		fp.mu.Unlock()
		if fn != nil {
			fn(w, r)
			return
		}
		q := r.URL.Query()
		redirect := q.Get("redirect_uri")
		state := q.Get("state")
		if redirect == "" {
			http.Error(w, "missing redirect_uri", http.StatusBadRequest)
			return
		}
		http.Redirect(w, r, redirect+"?code=fake-code&state="+url.QueryEscape(state), http.StatusFound)
	})
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			http.Error(w, "bad form", http.StatusBadRequest)
			return
		}
		fp.mu.Lock()
		fp.tokenForms = append(fp.tokenForms, r.PostForm)
		body, status := fp.tokenBody, fp.tokenStatus
		fp.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		fmt.Fprint(w, body)
	})
	fp.srv = httptest.NewServer(mux)
	t.Cleanup(fp.srv.Close)
	return fp
}

func (fp *fakeProvider) setAuth(fn func(w http.ResponseWriter, r *http.Request)) {
	fp.mu.Lock()
	defer fp.mu.Unlock()
	fp.authFn = fn
}

func (fp *fakeProvider) tokenFormCount() int {
	fp.mu.Lock()
	defer fp.mu.Unlock()
	return len(fp.tokenForms)
}

func (fp *fakeProvider) lastTokenForm() url.Values {
	fp.mu.Lock()
	defer fp.mu.Unlock()
	if len(fp.tokenForms) == 0 {
		return nil
	}
	return fp.tokenForms[len(fp.tokenForms)-1]
}

func loopbackRoot(t *testing.T, redirectURI string) string {
	t.Helper()
	u, err := url.Parse(redirectURI)
	if err != nil {
		t.Fatalf("parse redirect URI %q: %v", redirectURI, err)
	}
	return u.Scheme + "://" + u.Host
}

// --- Loopback listener -------------------------------------------------------

func TestLoopbackRedirectURI(t *testing.T) {
	l, err := NewLoopback(LoopbackOptions{})
	if err != nil {
		t.Fatalf("NewLoopback: %v", err)
	}
	defer l.Close()
	if l.Port() == 0 {
		t.Fatal("expected an OS-assigned ephemeral port")
	}
	want := "http://127.0.0.1:" + strconv.Itoa(l.Port()) + "/callback"
	if got := l.RedirectURI(); got != want {
		t.Errorf("RedirectURI = %q, want %q", got, want)
	}
}

func TestLoopbackFixedPort(t *testing.T) {
	probe, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := probe.Addr().(*net.TCPAddr).Port
	probe.Close()

	l, err := NewLoopback(LoopbackOptions{Port: port})
	if err != nil {
		t.Fatalf("NewLoopback(fixed port): %v", err)
	}
	defer l.Close()
	if l.Port() != port {
		t.Errorf("Port = %d, want %d", l.Port(), port)
	}
}

func TestLoopbackPortConflict(t *testing.T) {
	probe, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer probe.Close()
	port := probe.Addr().(*net.TCPAddr).Port

	_, err = NewLoopback(LoopbackOptions{Port: port})
	if !errors.Is(err, ErrPortBindFailed) {
		t.Fatalf("want ErrPortBindFailed, got %v", err)
	}
}

// --- Prepare -----------------------------------------------------------------

func TestPrepareLoopbackFlowRejectsNonInteractiveGrants(t *testing.T) {
	for _, grant := range []GrantType{GrantClientCredentials, GrantPassword, GrantDeviceCode, GrantRefreshToken} {
		cfg := OAuthConfig{GrantType: grant, AuthURL: "https://example.com/auth", ClientID: "c"}
		_, _, err := PrepareLoopbackFlow(cfg, FlowOptions{})
		if !errors.Is(err, ErrInvalidConfig) {
			t.Errorf("grant %q: want ErrInvalidConfig, got %v", grant, err)
		}
	}
}

func TestLoopbackFlowConfiguredRedirectPort(t *testing.T) {
	probe, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := probe.Addr().(*net.TCPAddr).Port
	probe.Close()
	redirect := fmt.Sprintf("http://127.0.0.1:%d/callback", port)

	fp := newFakeProvider(t)
	cfg := OAuthConfig{
		GrantType:   GrantAuthorizationCode,
		AuthURL:     fp.srv.URL + "/authorize",
		TokenURL:    fp.srv.URL + "/token",
		ClientID:    "test-client",
		RedirectURI: redirect,
	}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatalf("PrepareLoopbackFlow: %v", err)
	}
	defer f.Close()

	if redir.RedirectURI != redirect {
		t.Errorf("RedirectURI = %q, want configured %q", redir.RedirectURI, redirect)
	}
	if redir.Note != "" {
		t.Errorf("no fallback expected on a free fixed port, got note %q", redir.Note)
	}
	au, err := url.Parse(redir.AuthorizeURL)
	if err != nil {
		t.Fatal(err)
	}
	if got := au.Query().Get("redirect_uri"); got != redirect {
		t.Errorf("authorize redirect_uri = %q, want %q", got, redirect)
	}
	// The listener must really be bound to the configured port.
	resp, err := http.Get(redirect)
	if err != nil {
		t.Fatalf("listener not reachable on configured port: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("GET %s = %d, want 200", redirect, resp.StatusCode)
	}
}

func TestLoopbackFlowFixedPortFallback(t *testing.T) {
	// Occupy a fixed port so the configured redirect URI cannot bind.
	blocker, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer blocker.Close()
	blockedPort := blocker.Addr().(*net.TCPAddr).Port
	configured := fmt.Sprintf("http://127.0.0.1:%d/callback", blockedPort)

	fp := newFakeProvider(t)
	cfg := OAuthConfig{
		GrantType:   GrantAuthorizationCode,
		AuthURL:     fp.srv.URL + "/authorize",
		TokenURL:    fp.srv.URL + "/token",
		ClientID:    "test-client",
		RedirectURI: configured,
	}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatalf("PrepareLoopbackFlow with busy fixed port: %v", err)
	}
	defer f.Close()

	// The flow must not hard-fail: it fell back to an ephemeral port and
	// surfaced a note the UI can show the user.
	if redir.Note == "" {
		t.Fatal("expected a fallback note when the fixed port is in use")
	}
	if redir.RedirectURI == configured {
		t.Errorf("redirect URI should have moved off the busy port, still %q", configured)
	}
	if !strings.HasSuffix(redir.RedirectURI, "/callback") {
		t.Errorf("unexpected fallback redirect URI %q", redir.RedirectURI)
	}
	// The authorize URL must advertise the NEW URI — sending the busy
	// configured one would make the callback land on a dead port.
	au, err := url.Parse(redir.AuthorizeURL)
	if err != nil {
		t.Fatal(err)
	}
	if got := au.Query().Get("redirect_uri"); got != redir.RedirectURI {
		t.Errorf("authorize redirect_uri = %q, want the fallback URI %q", got, redir.RedirectURI)
	}
	// The fallback listener really serves the callback.
	resp, err := http.Get(redir.RedirectURI)
	if err != nil {
		t.Fatalf("fallback listener not reachable: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("GET %s = %d, want 200", redir.RedirectURI, resp.StatusCode)
	}

	// Complete the flow end to end: the fake provider redirects to whatever
	// redirect_uri the authorize URL carries, which is the fallback listener.
	var page string
	done := make(chan error, 1)
	go func() {
		resp, err := http.Get(redir.AuthorizeURL)
		if err != nil {
			done <- err
			return
		}
		defer resp.Body.Close()
		b, _ := io.ReadAll(resp.Body)
		page = string(b)
		done <- nil
	}()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	token, err := f.Wait(ctx)
	if err != nil {
		t.Fatalf("Wait: %v", err)
	}
	if err := <-done; err != nil {
		t.Fatalf("callback GET: %v", err)
	}
	if token == nil || token.AccessToken != "fake-access-token" {
		t.Fatalf("token = %+v", token)
	}
	if !strings.Contains(page, "Sign-in complete") {
		t.Errorf("callback page doesn't confirm success: %.120s", page)
	}
}

// --- Authorization code flow (end to end) ------------------------------------

func TestRunLoopbackFlowAuthorizationCode(t *testing.T) {
	fp := newFakeProvider(t)
	cfg := OAuthConfig{
		GrantType: GrantAuthorizationCode,
		AuthURL:   fp.srv.URL + "/authorize",
		TokenURL:  fp.srv.URL + "/token",
		ClientID:  "test-client",
		Scopes:    "read write",
	}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatalf("PrepareLoopbackFlow: %v", err)
	}
	defer f.Close()

	if redir.Mode != RedirectLoopback {
		t.Errorf("Mode = %q, want loopback", redir.Mode)
	}
	if redir.State == "" || redir.RedirectURI == "" {
		t.Fatal("RedirectResult missing state or redirect URI")
	}

	au, err := url.Parse(redir.AuthorizeURL)
	if err != nil {
		t.Fatal(err)
	}
	q := au.Query()
	for key, want := range map[string]string{
		"response_type":         "code",
		"client_id":             "test-client",
		"redirect_uri":          redir.RedirectURI,
		"state":                 redir.State,
		"scope":                 "read write",
		"code_challenge_method": "S256",
	} {
		if got := q.Get(key); got != want {
			t.Errorf("authorize %s = %q, want %q", key, got, want)
		}
	}
	challenge := q.Get("code_challenge")
	if challenge == "" {
		t.Fatal("authorize URL missing code_challenge (PKCE must be on by default)")
	}

	var page string
	done := make(chan error, 1)
	go func() {
		resp, err := http.Get(redir.AuthorizeURL)
		if err != nil {
			done <- err
			return
		}
		defer resp.Body.Close()
		b, _ := io.ReadAll(resp.Body)
		page = string(b)
		done <- nil
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	token, err := f.Wait(ctx)
	if err != nil {
		t.Fatalf("Wait: %v", err)
	}
	if err := <-done; err != nil {
		t.Fatalf("callback GET: %v", err)
	}

	if token.AccessToken != "fake-access-token" {
		t.Errorf("AccessToken = %q", token.AccessToken)
	}
	if token.TokenType != "Bearer" {
		t.Errorf("TokenType = %q", token.TokenType)
	}
	if token.ExpiresAtMs <= time.Now().UnixMilli() {
		t.Errorf("ExpiresAtMs = %d, must be in the future", token.ExpiresAtMs)
	}
	if !strings.Contains(page, "close this tab") {
		t.Errorf("callback page missing branded copy: %s", page)
	}

	form := fp.lastTokenForm()
	if form == nil {
		t.Fatal("token endpoint never called")
	}
	if form.Get("grant_type") != "authorization_code" {
		t.Errorf("grant_type = %q", form.Get("grant_type"))
	}
	if form.Get("code") != "fake-code" {
		t.Errorf("code = %q", form.Get("code"))
	}
	if form.Get("redirect_uri") != redir.RedirectURI {
		t.Errorf("redirect_uri = %q, want %q", form.Get("redirect_uri"), redir.RedirectURI)
	}
	if form.Get("client_id") != "test-client" {
		t.Errorf("client_id = %q", form.Get("client_id"))
	}
	verifier := form.Get("code_verifier")
	if !IsValidVerifier(verifier) {
		t.Errorf("code_verifier %q is not RFC 7636 conformant", verifier)
	}
	if form.Get("client_secret") != "" {
		t.Error("public client must never send client_secret")
	}
	// Closed-loop PKCE proof: the challenge in the authorize request must be
	// the S256 hash of the verifier sent to the token endpoint.
	if got := S256Challenge(verifier); got != challenge {
		t.Errorf("PKCE mismatch: authorize challenge %q, token exchange verifier hashes to %q", challenge, got)
	}
	if n := fp.tokenFormCount(); n != 1 {
		t.Errorf("expected exactly one token request, got %d", n)
	}
}

func TestRunLoopbackFlowStateMismatch(t *testing.T) {
	fp := newFakeProvider(t)
	fp.setAuth(func(w http.ResponseWriter, r *http.Request) {
		redirect := r.URL.Query().Get("redirect_uri")
		http.Redirect(w, r, redirect+"?code=fake-code&state=attacker-controlled", http.StatusFound)
	})
	cfg := OAuthConfig{
		GrantType: GrantAuthorizationCode,
		AuthURL:   fp.srv.URL + "/authorize",
		TokenURL:  fp.srv.URL + "/token",
		ClientID:  "test-client",
	}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	var page string
	done := make(chan error, 1)
	go func() {
		resp, err := http.Get(redir.AuthorizeURL)
		if err != nil {
			done <- err
			return
		}
		defer resp.Body.Close()
		b, _ := io.ReadAll(resp.Body)
		page = string(b)
		done <- nil
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_, err = f.Wait(ctx)
	if !errors.Is(err, ErrStateMismatch) {
		t.Fatalf("want ErrStateMismatch, got %v", err)
	}
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(page, "state mismatch") {
		t.Errorf("callback page should surface the state mismatch verbatim: %s", page)
	}
	if n := fp.tokenFormCount(); n != 0 {
		t.Errorf("token exchange must not run after a state mismatch, got %d requests", n)
	}
}

func TestRunLoopbackFlowProviderError(t *testing.T) {
	fp := newFakeProvider(t)
	fp.setAuth(func(w http.ResponseWriter, r *http.Request) {
		redirect := r.URL.Query().Get("redirect_uri")
		state := r.URL.Query().Get("state")
		http.Redirect(w, r, redirect+"?error=access_denied&error_description=User+denied+the+request&state="+url.QueryEscape(state), http.StatusFound)
	})
	cfg := OAuthConfig{
		GrantType: GrantAuthorizationCode,
		AuthURL:   fp.srv.URL + "/authorize",
		TokenURL:  fp.srv.URL + "/token",
		ClientID:  "test-client",
	}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	var page string
	done := make(chan error, 1)
	go func() {
		resp, err := http.Get(redir.AuthorizeURL)
		if err != nil {
			done <- err
			return
		}
		defer resp.Body.Close()
		b, _ := io.ReadAll(resp.Body)
		page = string(b)
		done <- nil
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_, err = f.Wait(ctx)
	if !errors.Is(err, ErrProviderDenied) {
		t.Fatalf("want ErrProviderDenied, got %v", err)
	}
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	var oe *OAuthError
	if !errors.As(err, &oe) {
		t.Fatalf("expected *OAuthError, got %T", err)
	}
	if oe.ProviderCode() != "access_denied" {
		t.Errorf("ProviderCode = %q", oe.ProviderCode())
	}
	if oe.ProviderDescription() != "User denied the request" {
		t.Errorf("ProviderDescription = %q", oe.ProviderDescription())
	}
	if !strings.Contains(page, "access_denied") || !strings.Contains(page, "User denied the request") {
		t.Errorf("callback page must show provider error verbatim: %s", page)
	}
}

func TestRunLoopbackFlowTimeoutAndTeardown(t *testing.T) {
	fp := newFakeProvider(t)
	cfg := OAuthConfig{
		GrantType: GrantAuthorizationCode,
		AuthURL:   fp.srv.URL + "/authorize",
		TokenURL:  fp.srv.URL + "/token",
		ClientID:  "test-client",
	}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	_, err = f.Wait(ctx)
	cancel()
	if !errors.Is(err, ErrTimeout) {
		t.Fatalf("want ErrTimeout, got %v", err)
	}

	// Clean teardown: after Close the listener must be gone and its port free.
	if err := f.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}
	if err := f.Close(); err != nil {
		t.Fatalf("second Close should be a no-op: %v", err)
	}
	port := portOf(t, redir.RedirectURI)
	l2, err := NewLoopback(LoopbackOptions{Port: port})
	if err != nil {
		t.Fatalf("port %d not freed after Close: %v", port, err)
	}
	l2.Close()
}

// --- Implicit flow (fragment re-POST) ----------------------------------------

func TestRunLoopbackFlowImplicitFragment(t *testing.T) {
	fp := newFakeProvider(t)
	cfg := OAuthConfig{
		GrantType: GrantImplicit,
		AuthURL:   fp.srv.URL + "/authorize",
		ClientID:  "test-client",
		Scopes:    "read",
	}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	root := loopbackRoot(t, redir.RedirectURI)

	// The authorize URL must use response_type=token and no PKCE.
	au, err := url.Parse(redir.AuthorizeURL)
	if err != nil {
		t.Fatal(err)
	}
	q := au.Query()
	if q.Get("response_type") != "token" {
		t.Errorf("response_type = %q, want token", q.Get("response_type"))
	}
	if q.Get("redirect_uri") != redir.RedirectURI {
		t.Errorf("redirect_uri = %q, want %q", q.Get("redirect_uri"), redir.RedirectURI)
	}
	if q.Get("state") != redir.State {
		t.Errorf("state = %q, want %q", q.Get("state"), redir.State)
	}

	// A query-less GET (the provider's fragment redirect, since fragments
	// never reach the server) must serve the re-POST page.
	resp, err := http.Get(root)
	if err != nil {
		t.Fatalf("GET loopback root: %v", err)
	}
	page, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	for _, want := range []string{"/fragment", "access_token", "Content-Security-Policy"} {
		if !strings.Contains(string(page), want) {
			t.Errorf("fragment page missing %q", want)
		}
	}

	// Simulate the page's JS: re-POST the fragment payload as JSON.
	payload, err := json.Marshal(fragmentBody{
		State:       redir.State,
		AccessToken: "fake-implicit-token",
		TokenType:   "Bearer",
		Scope:       "read",
		ExpiresIn:   "3600",
	})
	if err != nil {
		t.Fatal(err)
	}
	go func() {
		resp, err := http.Post(root+"/fragment", "application/json", bytes.NewReader(payload))
		if err != nil {
			t.Errorf("fragment POST: %v", err)
			return
		}
		defer resp.Body.Close()
		io.Copy(io.Discard, resp.Body)
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	token, err := f.Wait(ctx)
	if err != nil {
		t.Fatalf("Wait: %v", err)
	}
	if token.AccessToken != "fake-implicit-token" {
		t.Errorf("AccessToken = %q", token.AccessToken)
	}
	if token.TokenType != "Bearer" {
		t.Errorf("TokenType = %q", token.TokenType)
	}
	if token.Scope != "read" {
		t.Errorf("Scope = %q", token.Scope)
	}
	if token.ExpiresAtMs <= time.Now().UnixMilli() {
		t.Errorf("ExpiresAtMs = %d, must be in the future", token.ExpiresAtMs)
	}
}

func TestFragmentPostStateMismatch(t *testing.T) {
	fp := newFakeProvider(t)
	cfg := OAuthConfig{GrantType: GrantImplicit, AuthURL: fp.srv.URL + "/authorize", ClientID: "test-client"}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	root := loopbackRoot(t, redir.RedirectURI)

	payload, _ := json.Marshal(fragmentBody{State: "wrong-state", AccessToken: "x"})
	go func() {
		resp, err := http.Post(root+"/fragment", "application/json", bytes.NewReader(payload))
		if err != nil {
			t.Errorf("fragment POST: %v", err)
			return
		}
		defer resp.Body.Close()
		io.Copy(io.Discard, resp.Body)
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_, err = f.Wait(ctx)
	if !errors.Is(err, ErrStateMismatch) {
		t.Fatalf("want ErrStateMismatch, got %v", err)
	}
}

func TestFragmentPostProviderError(t *testing.T) {
	fp := newFakeProvider(t)
	cfg := OAuthConfig{GrantType: GrantImplicit, AuthURL: fp.srv.URL + "/authorize", ClientID: "test-client"}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	root := loopbackRoot(t, redir.RedirectURI)

	payload, _ := json.Marshal(fragmentBody{
		State:            redir.State,
		Error:            "access_denied",
		ErrorDescription: "User denied the request",
	})
	go func() {
		resp, err := http.Post(root+"/fragment", "application/json", bytes.NewReader(payload))
		if err != nil {
			t.Errorf("fragment POST: %v", err)
			return
		}
		defer resp.Body.Close()
		io.Copy(io.Discard, resp.Body)
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_, err = f.Wait(ctx)
	if !errors.Is(err, ErrProviderDenied) {
		t.Fatalf("want ErrProviderDenied, got %v", err)
	}
	var oe *OAuthError
	if !errors.As(err, &oe) {
		t.Fatalf("expected *OAuthError, got %T", err)
	}
	if oe.ProviderCode() != "access_denied" || oe.ProviderDescription() != "User denied the request" {
		t.Errorf("verbatim provider error lost: code=%q desc=%q", oe.ProviderCode(), oe.ProviderDescription())
	}
}

func TestFragmentPostBodyTooLarge(t *testing.T) {
	fp := newFakeProvider(t)
	cfg := OAuthConfig{GrantType: GrantImplicit, AuthURL: fp.srv.URL + "/authorize", ClientID: "test-client"}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	root := loopbackRoot(t, redir.RedirectURI)

	big := strings.Repeat("x", maxFragmentBody+1)
	go func() {
		resp, err := http.Post(root+"/fragment", "application/json", strings.NewReader(big))
		if err != nil {
			t.Errorf("fragment POST: %v", err)
			return
		}
		defer resp.Body.Close()
		io.Copy(io.Discard, resp.Body)
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_, err = f.Wait(ctx)
	if !errors.Is(err, ErrMissingCallback) {
		t.Fatalf("want ErrMissingCallback, got %v", err)
	}
}

// --- Host hardening -----------------------------------------------------------

func TestLoopbackRejectsForeignHost(t *testing.T) {
	fp := newFakeProvider(t)
	cfg := OAuthConfig{GrantType: GrantImplicit, AuthURL: fp.srv.URL + "/authorize", ClientID: "test-client"}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	root := loopbackRoot(t, redir.RedirectURI)

	req, err := http.NewRequest("GET", root, nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Host = "evil.example"
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("foreign Host got %d, want 403", resp.StatusCode)
	}

	// The rejected request must not have completed or poisoned the flow: a
	// legitimate callback still succeeds.
	payload, _ := json.Marshal(fragmentBody{State: redir.State, AccessToken: "still-works"})
	go func() {
		resp, err := http.Post(root+"/fragment", "application/json", bytes.NewReader(payload))
		if err != nil {
			t.Errorf("fragment POST: %v", err)
			return
		}
		defer resp.Body.Close()
		io.Copy(io.Discard, resp.Body)
	}()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	token, err := f.Wait(ctx)
	if err != nil {
		t.Fatalf("flow should still complete after a rejected Host: %v", err)
	}
	if token.AccessToken != "still-works" {
		t.Errorf("AccessToken = %q", token.AccessToken)
	}
}

// --- Browser launch -----------------------------------------------------------

func TestRunLoopbackFlowBrowserLaunch(t *testing.T) {
	fp := newFakeProvider(t)
	cfg := OAuthConfig{
		GrantType: GrantAuthorizationCode,
		AuthURL:   fp.srv.URL + "/authorize",
		TokenURL:  fp.srv.URL + "/token",
		ClientID:  "test-client",
	}

	launched := make(chan string, 1)
	old := openURLFn
	openURLFn = func(cmd *exec.Cmd) error {
		launched <- cmd.Args[len(cmd.Args)-1]
		return nil
	}
	defer func() { openURLFn = old }()

	type runResult struct {
		token *TokenResult
		redir *RedirectResult
		err   error
	}
	resCh := make(chan runResult, 1)
	go func() {
		token, redir, err := RunLoopbackFlow(context.Background(), cfg, FlowOptions{LaunchBrowser: true})
		resCh <- runResult{token, redir, err}
	}()

	authURL := <-launched
	if authURL == "" {
		t.Fatal("browser launcher never invoked")
	}
	if _, err := url.Parse(authURL); err != nil {
		t.Fatalf("launched URL %q is not a valid URL: %v", authURL, err)
	}

	resp, err := http.Get(authURL)
	if err != nil {
		t.Fatalf("callback GET: %v", err)
	}
	resp.Body.Close()

	res := <-resCh
	if res.err != nil {
		t.Fatalf("RunLoopbackFlow: %v", res.err)
	}
	if res.token == nil || res.token.AccessToken != "fake-access-token" {
		t.Errorf("token = %+v", res.token)
	}
	if res.redir == nil || res.redir.AuthorizeURL != authURL {
		t.Errorf("launched URL %q != prepared authorize URL %q", authURL, res.redir.AuthorizeURL)
	}
}

func portOf(t *testing.T, raw string) int {
	t.Helper()
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	p, err := strconv.Atoi(u.Port())
	if err != nil {
		t.Fatal(err)
	}
	return p
}

// --- Dual-stack (IPv6) -------------------------------------------------------

// TestLoopbackIPv6Callback verifies that the callback handler accepts
// requests whose Host header uses the IPv6 loopback [::1]. On modern
// Windows, localhost resolves to ::1 first, so a browser redirect to
// http://localhost:PORT/callback reaches the listener via IPv6.
func TestLoopbackIPv6Callback(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping IPv6 test in -short mode")
	}
	fp := newFakeProvider(t)
	cfg := OAuthConfig{
		GrantType: GrantAuthorizationCode,
		AuthURL:   fp.srv.URL + "/authorize",
		TokenURL:  fp.srv.URL + "/token",
		ClientID:  "test-client",
	}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	// Check the IPv6 listener bound.
	if f.loopback.ln6 == nil {
		t.Skip("IPv6 loopback not available on this host")
	}

	// Send a callback via the IPv6 loopback.
	v6URL := fmt.Sprintf("http://[::1]:%d/callback?code=test-code&state=%s",
		f.loopback.Port(), redir.State)
	resp, err := http.Get(v6URL)
	if err != nil {
		t.Fatalf("IPv6 callback request failed: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("IPv6 callback got %d, want 200", resp.StatusCode)
	}

	// The flow must have completed.
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	token, err := f.Wait(ctx)
	if err != nil {
		t.Fatalf("Wait: %v", err)
	}
	if token == nil || token.AccessToken != "fake-access-token" {
		t.Errorf("token = %+v", token)
	}
}

// TestDualStackListener verifies that NewLoopback attempts to bind both
// IPv4 and IPv6 on the same port.
func TestDualStackListener(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping dual-stack test in -short mode")
	}
	l, err := NewLoopback(LoopbackOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()

	// Both listeners should be bound (unless IPv6 is unavailable).
	if l.ln == nil {
		t.Fatal("primary IPv4 listener is nil")
	}
	// ln6 is best-effort — nil is acceptable on hosts without IPv6.
	if l.ln6 != nil {
		// Both must share the same port.
		if l.ln6.Addr().(*net.TCPAddr).Port != l.Port() {
			t.Fatalf("IPv6 port %d != IPv4 port %d",
				l.ln6.Addr().(*net.TCPAddr).Port, l.Port())
		}
	}
}

// --- POST form_post response mode --------------------------------------------

// TestLoopbackFormPostCallback verifies that the callback handler accepts
// POST requests with application/x-www-form-urlencoded body, matching the
// form_post response mode used by Azure AD and other providers.
func TestLoopbackFormPostCallback(t *testing.T) {
	fp := newFakeProvider(t)
	cfg := OAuthConfig{
		GrantType: GrantAuthorizationCode,
		AuthURL:   fp.srv.URL + "/authorize",
		TokenURL:  fp.srv.URL + "/token",
		ClientID:  "test-client",
	}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	root := loopbackRoot(t, redir.RedirectURI)

	// Simulate Azure AD form_post: POST the code/state as form data.
	form := url.Values{
		"state": {redir.State},
		"code":  {"test-auth-code"},
	}
	resp, err := http.PostForm(root+"/callback", form)
	if err != nil {
		t.Fatalf("form_post callback: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("form_post got %d, want 200", resp.StatusCode)
	}

	// Verify the fake provider received the token exchange.
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	token, err := f.Wait(ctx)
	if err != nil {
		t.Fatalf("Wait: %v", err)
	}
	if token == nil || token.AccessToken != "fake-access-token" {
		t.Errorf("token = %+v", token)
	}

	// Verify the provider saw the correct form values in the token exchange.
	fp.mu.Lock()
	forms := fp.tokenForms
	fp.mu.Unlock()
	if len(forms) == 0 {
		t.Fatal("token endpoint was never called")
	}
	if forms[0].Get("code") != "test-auth-code" {
		t.Errorf("token exchange code = %q, want test-auth-code", forms[0].Get("code"))
	}
}

// TestLoopbackFormPostError verifies that a form_post error response
// (e.g. Azure AD returning access_denied) is surfaced correctly.
func TestLoopbackFormPostError(t *testing.T) {
	fp := newFakeProvider(t)
	fp.authFn = func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r,
			fmt.Sprintf("/callback?error=access_denied&error_description=User+denied&state=%s", r.URL.Query().Get("state")),
			http.StatusFound)
	}
	cfg := OAuthConfig{
		GrantType: GrantAuthorizationCode,
		AuthURL:   fp.srv.URL + "/authorize",
		TokenURL:  fp.srv.URL + "/token",
		ClientID:  "test-client",
	}
	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	root := loopbackRoot(t, redir.RedirectURI)

	// Simulate Azure AD form_post with an error.
	form := url.Values{
		"state":             {redir.State},
		"error":             {"access_denied"},
		"error_description": {"User denied"},
	}
	resp, err := http.PostForm(root+"/callback", form)
	if err != nil {
		t.Fatalf("form_post error: %v", err)
	}
	resp.Body.Close()

	// The handler should return 200 (with the error page) and finish the
	// flow with a ProviderDeniedError.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = f.Wait(ctx)
	if err == nil {
		t.Fatal("expected error for access_denied")
	}
	var oe *OAuthError
	if !errors.As(err, &oe) {
		t.Fatalf("expected OAuthError, got %T: %v", err, err)
	}
	if oe.ProviderCode() != "access_denied" {
		t.Errorf("ProviderCode = %q, want access_denied", oe.ProviderCode())
	}
}

// --- Bare Host header (no port) -----------------------------------------------

// TestIsLoopbackHostBareIP verifies that isLoopbackHost accepts a Host
// header that is just an IP address without a port (some HTTP/2 clients
// omit the port for non-standard ports).
func TestIsLoopbackHostBareIP(t *testing.T) {
	tests := []struct {
		host string
		port int
		want bool
	}{
		{"127.0.0.1", 8080, true},
		{"localhost", 8080, true},
		{"::1", 8080, true},
		{"127.0.0.1:8080", 8080, true},
		{"localhost:8080", 8080, true},
		{"[::1]:8080", 8080, true},
		{"evil.example", 8080, false},
		{"192.168.1.1", 8080, false},
	}
	for _, tt := range tests {
		if got := isLoopbackHost(tt.host, tt.port); got != tt.want {
			t.Errorf("isLoopbackHost(%q, %d) = %v, want %v", tt.host, tt.port, got, tt.want)
		}
	}
}
