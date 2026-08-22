package oauth2

// Keycloak integration matrix — the Phase 3 gate against a REAL Keycloak
// instance, driven through the engine with headless browser login automation:
//   - authorization_code + PKCE (S256), incl. PKCE-enforcement negative
//   - refresh_token with short-lived (60s) access tokens + silent refresh
//   - client_credentials against a confidential client (body + Basic auth)
//   - device authorization grant (RFC 8628) end to end
//   - state-mismatch rejection by the engine's own loopback listener
//
// Gating: skips when Docker is unavailable and KEYCLOAK_URL is unset (CI
// without Docker), and under `go test -short`. When Docker is available the
// test spawns a Keycloak container itself; set KEYCLOAK_URL (+ optional
// KEYCLOAK_ADMIN / KEYCLOAK_ADMIN_PASSWORD) to target an existing instance:
//
//	KEYCLOAK_URL=http://127.0.0.1:8080 go test ./internal/oauth2/ -run Keycloak -v
//
// KEYCLOAK_IMAGE overrides the container image (default
// quay.io/keycloak/keycloak:26.1).

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"
)

const (
	kcAdminUser     = "admin"
	kcAdminPassword = "admin"
	kcSmokeUser     = "alice"
	kcSmokePassword = "alice-pass-123"
)

func TestKeycloakAuthCodePKCESmoke(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping Keycloak smoke in -short mode")
	}
	e := newKcEnv(t, nil)
	redirectURI := e.loopbackRedirect(t)
	e.publicPKCEClient(t, "reqit-smoke", redirectURI)
	e.createUser(t)
	cfg := e.authCodeConfig("reqit-smoke", redirectURI)

	flow, err := NewAuthCodeFlow(cfg)
	if err != nil {
		t.Fatal(err)
	}
	authorizeURL, err := flow.AuthorizeURL()
	if err != nil {
		t.Fatal(err)
	}

	// Headless browser: authorize → login form → credentials → redirect back.
	code, state := e.kc.headlessLogin(t, authorizeURL, kcSmokeUser, kcSmokePassword)
	if state != flow.State() {
		t.Fatalf("state mismatch: got %q want %q — callback rejected by the engine", state, flow.State())
	}
	if code == "" {
		t.Fatal("provider returned no authorization code")
	}

	// The engine exchange — this is the gate: Keycloak (public client, PKCE
	// enforced since v19) will reject a missing/invalid code_verifier.
	tr, err := flow.ExchangeCode(context.Background(), code)
	if err != nil {
		t.Fatalf("code exchange failed: %v", err)
	}
	if tr.AccessToken == "" {
		t.Fatal("no access token in exchange result")
	}
	if tr.TokenType == "" {
		t.Error("token type missing")
	}
	if tr.ExpiresAtMs <= 0 {
		t.Error("ExpiresAtMs not set")
	}

	// Prove the token works: call the userinfo endpoint.
	e.kc.assertUserinfo(t, e.issuer, tr.AccessToken)

	// Negative gate — PKCE enforcement: Keycloak created this public client
	// with PKCE required (pkce.code.challenge.method=S256), so exchanging a
	// fresh code WITHOUT a code_verifier must be rejected. Authorization codes
	// are single-use, so a second login round is needed.
	code2, _ := e.kc.headlessLogin(t, authorizeURL, kcSmokeUser, kcSmokePassword)
	if code2 == "" {
		t.Fatal("second login round produced no code")
	}
	if _, err := Exchange(context.Background(), cfg, ExchangeOptions{
		Code:        code2,
		RedirectURI: redirectURI,
	}); err == nil {
		t.Error("PKCE not enforced: token exchange without code_verifier succeeded")
	} else {
		t.Logf("PKCE enforcement confirmed: no-verifier exchange rejected (%v)", err)
	}
}

// TestKeycloakManualPasteBackSmoke: the RedirectManual fallback against a
// real provider — no loopback listener at all. The authorize URL is opened
// (headless login here), the provider's redirect URL is pasted back into
// ManualFlow.Complete, which validates state and exchanges the code with the
// flow's PKCE verifier. Proves the paste-back path end-to-end: state,
// PKCE, exchange, and a working token.
func TestKeycloakManualPasteBackSmoke(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping Keycloak smoke in -short mode")
	}
	e := newKcEnv(t, nil)
	redirectURI := e.loopbackRedirect(t)
	e.publicPKCEClient(t, "reqit-manual", redirectURI)
	e.createUser(t)
	cfg := e.authCodeConfig("reqit-manual", redirectURI)

	mf, err := NewManualFlow(cfg)
	if err != nil {
		t.Fatal(err)
	}
	authURL, err := mf.AuthorizeURL()
	if err != nil {
		t.Fatal(err)
	}

	// "User" completes login in a browser; the provider redirects to the
	// registered redirect URI with code + state. That URL is what the user
	// copies from the address bar and pastes back into reqit.
	code, state := e.kc.headlessLogin(t, authURL, kcSmokeUser, kcSmokePassword)
	if code == "" || state == "" {
		t.Fatal("login round produced no code/state")
	}
	pasted := fmt.Sprintf("%s?code=%s&state=%s", redirectURI, code, state)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	token, err := mf.Complete(ctx, pasted)
	if err != nil {
		t.Fatalf("paste-back complete: %v", err)
	}
	if token.AccessToken == "" {
		t.Fatal("no access token")
	}
	e.kc.assertUserinfo(t, e.issuer, token.AccessToken)

	// Negative: a forged state pasted back must be rejected before exchange.
	if _, err := mf.Complete(ctx, fmt.Sprintf("%s?code=%s&state=forged", redirectURI, code)); !errors.Is(err, ErrStateMismatch) {
		t.Errorf("forged state must yield ErrStateMismatch, got %v", err)
	}
}

// TestKeycloakRefreshTokenSmoke: the refresh_token grant against a realm with
// 60-second access tokens (the shortest Keycloak allows). The initial token
// must carry a ~60s expiry, and a silent exchange of the refresh token must
// yield a fresh, working token pair without any user interaction.
func TestKeycloakRefreshTokenSmoke(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping Keycloak smoke in -short mode")
	}
	e := newKcEnv(t, map[string]any{"accessTokenLifespan": 60})
	redirectURI := e.loopbackRedirect(t)
	e.publicPKCEClient(t, "reqit-refresh", redirectURI)
	e.createUser(t)
	cfg := e.authCodeConfig("reqit-refresh", redirectURI)

	flow, err := NewAuthCodeFlow(cfg)
	if err != nil {
		t.Fatal(err)
	}
	authURL, _ := flow.AuthorizeURL()
	code, _ := e.kc.headlessLogin(t, authURL, kcSmokeUser, kcSmokePassword)
	if code == "" {
		t.Fatal("no authorization code")
	}
	tr, err := flow.ExchangeCode(context.Background(), code)
	if err != nil {
		t.Fatalf("code exchange failed: %v", err)
	}
	if tr.RefreshToken == "" {
		t.Fatal("Keycloak must issue a refresh token")
	}
	// Short-lived proof: the access token expires in roughly the realm's 60s
	// lifespan (allowing for the seconds the login round took).
	if d := time.Until(time.UnixMilli(tr.ExpiresAtMs)); d > 90*time.Second || d < 30*time.Second {
		t.Errorf("expected a ~60s access token, expires in %v", d)
	}
	e.kc.assertUserinfo(t, e.issuer, tr.AccessToken)

	// Silent refresh: straight refresh_token exchange, no browser, no prompt.
	// Exchange dispatches on cfg.GrantType, so the config must say so.
	refreshCfg := cfg
	refreshCfg.GrantType = GrantRefreshToken
	rt, err := Exchange(context.Background(), refreshCfg, ExchangeOptions{
		RefreshToken: tr.RefreshToken,
	})
	if err != nil {
		t.Fatalf("refresh grant failed: %v", err)
	}
	if rt.AccessToken == "" || rt.AccessToken == tr.AccessToken {
		t.Error("refresh must issue a fresh access token")
	}
	if rt.RefreshToken == "" {
		t.Error("refresh response must include a refresh token")
	}
	if d := time.Until(time.UnixMilli(rt.ExpiresAtMs)); d > 90*time.Second || d < 30*time.Second {
		t.Errorf("refreshed token should be short-lived too, expires in %v", d)
	}
	e.kc.assertUserinfo(t, e.issuer, rt.AccessToken)

	// Negative: a garbage refresh token fails with the typed refresh error.
	if _, err := Exchange(context.Background(), refreshCfg, ExchangeOptions{RefreshToken: "garbage-refresh-token"}); err == nil {
		t.Error("garbage refresh token must be rejected")
	} else if !errors.Is(err, ErrRefreshFailed) {
		t.Errorf("want ErrRefreshFailed, got %v", err)
	}
}

// TestKeycloakClientCredentialsSmoke: the client_credentials grant against a
// confidential client, in both body and HTTP-Basic client-auth modes, plus
// rejection of a wrong secret with the provider's verbatim invalid_client.
func TestKeycloakClientCredentialsSmoke(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping Keycloak smoke in -short mode")
	}
	e := newKcEnv(t, nil)
	secret := e.confidentialClient(t, "reqit-svc")
	cfg := OAuthConfig{
		GrantType:    GrantClientCredentials,
		TokenURL:     e.issuer + "/protocol/openid-connect/token",
		ClientID:     "reqit-svc",
		Confidential: true,
	}

	tr, err := Exchange(context.Background(), cfg, ExchangeOptions{ClientSecret: secret})
	if err != nil {
		t.Fatalf("client_credentials: %v", err)
	}
	if tr.AccessToken == "" {
		t.Fatal("no access token")
	}
	if tr.TokenType == "" {
		t.Error("token type missing")
	}
	if tr.ExpiresAtMs <= time.Now().UnixMilli() {
		t.Error("token expiry not in the future")
	}

	// HTTP Basic client auth (RFC 6749 §2.3.1) must work too.
	cfg.ClientAuth = ClientAuthBasic
	if _, err := Exchange(context.Background(), cfg, ExchangeOptions{ClientSecret: secret}); err != nil {
		t.Errorf("client_credentials with HTTP Basic auth failed: %v", err)
	}

	// Negative: the wrong secret is rejected with the provider's error code
	// surfaced verbatim. RFC 6749 §5.2 specifies invalid_client, but some
	// versions (Keycloak 26) answer unauthorized_client instead — the engine
	// must pass through whatever the provider actually sent.
	if _, err := Exchange(context.Background(), cfg, ExchangeOptions{ClientSecret: "wrong-secret"}); err == nil {
		t.Error("wrong client secret must be rejected")
	} else {
		var oe *OAuthError
		if !errors.As(err, &oe) || oe.ProviderCode() == "" || !strings.Contains(oe.Error(), "Invalid client") {
			t.Errorf("want the provider's error surfaced verbatim, got %v", err)
		}
	}
}

// TestKeycloakDeviceFlowSmoke: the RFC 8628 device authorization grant — start
// the flow, drive the browser-side verification URI (login + user code entry),
// then poll through the pending lifecycle to a working token.
func TestKeycloakDeviceFlowSmoke(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping Keycloak smoke in -short mode")
	}
	e := newKcEnv(t, nil)
	e.deviceClient(t, "reqit-device")
	e.createUser(t)
	cfg := OAuthConfig{
		GrantType: GrantDeviceCode,
		Issuer:    e.issuer,
		TokenURL:  e.issuer + "/protocol/openid-connect/token",
		DeviceURL: e.issuer + "/protocol/openid-connect/auth/device",
		ClientID:  "reqit-device",
		Scopes:    "openid",
		PKCE:      PKCES256,
	}

	start, err := StartDevice(context.Background(), cfg, "")
	if err != nil {
		t.Fatalf("device start: %v", err)
	}
	if start.DeviceCode == "" || start.UserCode == "" || start.VerificationURI == "" {
		t.Fatalf("device start missing fields: %+v", start)
	}

	// Simulate the user authorizing on another device (no redirect_uri).
	e.authorizeDevice(t, start.VerificationURIComplete, start.UserCode)

	// Poll through the RFC 8628 lifecycle until the token lands.
	interval := time.Duration(start.Interval) * time.Second
	if interval < 2*time.Second {
		interval = 2 * time.Second
	}
	deadline := time.Now().Add(45 * time.Second)
	for {
		poll, err := PollDevice(context.Background(), cfg, "", start.DeviceCode)
		if err != nil {
			t.Fatalf("device poll: %v", err)
		}
		switch poll.Status {
		case DevicePollSuccess:
			if poll.Token == nil || poll.Token.AccessToken == "" {
				t.Fatal("device success without a token")
			}
			e.kc.assertUserinfo(t, e.issuer, poll.Token.AccessToken)
			return
		case DevicePollPending, DevicePollSlowDown:
			if time.Now().After(deadline) {
				t.Fatal("device flow did not complete before the deadline")
			}
			time.Sleep(interval)
		default:
			t.Fatalf("device poll failed: status=%s error=%v", poll.Status, poll.Error)
		}
	}
}

// TestKeycloakStateMismatchRejected: the engine's own loopback listener must
// reject a genuine provider code delivered with a forged state — before any
// token exchange is attempted.
func TestKeycloakStateMismatchRejected(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping Keycloak smoke in -short mode")
	}
	e := newKcEnv(t, nil)
	redirectURI := e.loopbackRedirect(t)
	e.publicPKCEClient(t, "reqit-smoke", redirectURI)
	e.createUser(t)
	cfg := e.authCodeConfig("reqit-smoke", redirectURI)

	f, redir, err := PrepareLoopbackFlow(cfg, FlowOptions{})
	if err != nil {
		t.Fatalf("prepare: %v", err)
	}
	defer f.Close()

	// Real login round to obtain a genuine, single-use code. headlessLogin
	// extracts the code from the redirect Location without touching the
	// engine's listener.
	code, _ := e.kc.headlessLogin(t, redir.AuthorizeURL, kcSmokeUser, kcSmokePassword)
	if code == "" {
		t.Fatal("no authorization code")
	}

	// Deliver that code to the listener with a forged state.
	u, err := url.Parse(redir.RedirectURI)
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	q.Set("code", code)
	q.Set("state", "forged-state")
	u.RawQuery = q.Encode()
	resp, err := http.Get(u.String())
	if err != nil {
		t.Fatalf("deliver forged callback: %v", err)
	}
	page, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if !strings.Contains(string(page), "state mismatch") {
		t.Errorf("engine callback page should surface the mismatch verbatim: %.400s", page)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if _, err := f.Wait(ctx); !errors.Is(err, ErrStateMismatch) {
		t.Fatalf("want ErrStateMismatch from the engine, got %v", err)
	}
}

// --- Test environment -------------------------------------------------------

// kcEnv is a self-contained Keycloak test environment: one unique realm plus
// helpers for clients, users, and loopback redirect URIs. Each test gets its
// own realm so flows are fully isolated and clean up with it.
type kcEnv struct {
	kc     *keycloak
	realm  string
	issuer string
}

// newKcEnv creates a unique realm. realmSettings is merged into the realm
// representation (e.g. accessTokenLifespan for the refresh test).
func newKcEnv(t *testing.T, realmSettings map[string]any) *kcEnv {
	t.Helper()
	kc := setupKeycloak(t)
	realm := "reqit-" + fmt.Sprintf("%d", time.Now().UnixNano())
	body := map[string]any{"realm": realm, "enabled": true}
	for k, v := range realmSettings {
		body[k] = v
	}
	resp := kc.adminRequest(t, "POST", "/admin/realms", body)
	_ = resp.Body.Close()
	t.Cleanup(func() { kc.deleteRealm(t, realm) })
	return &kcEnv{kc: kc, realm: realm, issuer: kc.baseURL + "/realms/" + realm}
}

// loopbackRedirect picks a port with a probe listener and returns the
// redirect URI the flow will use — the client must be registered with the
// exact URI (RFC 8252 §7.3). The probe is closed immediately so the engine's
// own callback listener can bind the same port (the smoke tests drive the
// headless login and never connect to the callback, so the tiny close-to-
// rebind race is harmless).
func (e *kcEnv) loopbackRedirect(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("bind loopback: %v", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	_ = ln.Close()
	return fmt.Sprintf("http://127.0.0.1:%d/callback", port)
}

// createClient registers a client (repr merged over the defaults) and returns
// its UUID from the Location header.
func (e *kcEnv) createClient(t *testing.T, clientID string, repr map[string]any) string {
	t.Helper()
	body := map[string]any{"clientId": clientID, "enabled": true}
	for k, v := range repr {
		body[k] = v
	}
	resp := e.kc.adminRequest(t, "POST", "/admin/realms/"+e.realm+"/clients", body)
	loc := resp.Header.Get("Location")
	_ = resp.Body.Close()
	if loc == "" {
		t.Fatalf("client creation returned no Location header for %q", clientID)
	}
	parts := strings.Split(strings.TrimRight(loc, "/"), "/")
	return parts[len(parts)-1]
}

// publicPKCEClient registers a public client with PKCE required (S256).
func (e *kcEnv) publicPKCEClient(t *testing.T, clientID, redirectURI string) {
	t.Helper()
	e.createClient(t, clientID, map[string]any{
		"publicClient":              true,
		"standardFlowEnabled":       true,
		"directAccessGrantsEnabled": false,
		"redirectUris":              []string{redirectURI},
		"attributes":                map[string]string{"pkce.code.challenge.method": "S256"},
	})
}

// confidentialClient registers a confidential client with service accounts
// enabled and returns its secret, read back from the admin API so the test
// always uses the server's actual value.
func (e *kcEnv) confidentialClient(t *testing.T, clientID string) string {
	t.Helper()
	uuid := e.createClient(t, clientID, map[string]any{
		"publicClient":              false,
		"serviceAccountsEnabled":    true,
		"standardFlowEnabled":       false,
		"directAccessGrantsEnabled": false,
	})
	resp := e.kc.adminRequest(t, "GET", "/admin/realms/"+e.realm+"/clients/"+uuid+"/client-secret", nil)
	defer resp.Body.Close()
	var sec struct {
		Value string `json:"value"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&sec); err != nil || sec.Value == "" {
		t.Fatalf("read client secret: value=%q err=%v", sec.Value, err)
	}
	return sec.Value
}

// deviceClient registers a public client with the device authorization grant
// enabled (RFC 8628).
func (e *kcEnv) deviceClient(t *testing.T, clientID string) {
	t.Helper()
	e.createClient(t, clientID, map[string]any{
		"publicClient":              true,
		"standardFlowEnabled":       false,
		"directAccessGrantsEnabled": false,
		"attributes":                map[string]string{"oauth2.device.authorization.grant.enabled": "true"},
	})
}

// createUser registers alice with a complete profile (which prevents Keycloak
// 26's VERIFY_PROFILE required action from interposing after login).
func (e *kcEnv) createUser(t *testing.T) {
	t.Helper()
	user := map[string]any{
		"username":      kcSmokeUser,
		"enabled":       true,
		"firstName":     "Alice",
		"lastName":      "Smoke",
		"email":         "alice@example.test",
		"emailVerified": true,
		"credentials": []map[string]any{{
			"type":      "password",
			"value":     kcSmokePassword,
			"temporary": false,
		}},
	}
	resp := e.kc.adminRequest(t, "POST", "/admin/realms/"+e.realm+"/users", user)
	_ = resp.Body.Close()
}

// authCodeConfig returns the standard authorization-code config for this
// realm's public PKCE client.
func (e *kcEnv) authCodeConfig(clientID, redirectURI string) OAuthConfig {
	return OAuthConfig{
		GrantType:   GrantAuthorizationCode,
		Issuer:      e.issuer,
		AuthURL:     e.issuer + "/protocol/openid-connect/auth",
		TokenURL:    e.issuer + "/protocol/openid-connect/token",
		ClientID:    clientID,
		Scopes:      "openid",
		RedirectURI: redirectURI,
		PKCE:        PKCES256,
	}
}

// --- Keycloak instance management -------------------------------------------

type keycloak struct {
	baseURL   string
	adminUser string
	adminPass string

	mu       sync.Mutex
	token    string
	tokenExp time.Time
}

// adminToken returns a fresh admin access token for the master realm. Since
// Keycloak 26 the admin REST API rejects HTTP Basic auth (401) — it requires
// a Bearer token from the admin-cli password grant, which also works on all
// older versions. Tokens default to a 60s lifetime, so the token is cached
// with an expiry and lazily refreshed.
func (k *keycloak) adminToken(t *testing.T) string {
	t.Helper()
	k.mu.Lock()
	defer k.mu.Unlock()
	if k.token != "" && time.Now().Before(k.tokenExp.Add(-10*time.Second)) {
		return k.token
	}

	form := url.Values{}
	form.Set("client_id", "admin-cli")
	form.Set("username", k.adminUser)
	form.Set("password", k.adminPass)
	form.Set("grant_type", "password")
	resp, err := http.PostForm(k.baseURL+"/realms/master/protocol/openid-connect/token", form)
	if err != nil {
		t.Fatalf("admin token request: %v", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("admin token request → %d: %s", resp.StatusCode, body)
	}
	var raw struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &raw); err != nil || raw.AccessToken == "" {
		t.Fatalf("admin token response unparseable: %s", body)
	}
	k.token = raw.AccessToken
	k.tokenExp = time.Now().Add(time.Duration(raw.ExpiresIn) * time.Second)
	return k.token
}

// invalidateToken drops the cached admin token so the next request fetches a
// fresh one (used when a request comes back 401, e.g. token expiry).
func (k *keycloak) invalidateToken() {
	k.mu.Lock()
	defer k.mu.Unlock()
	k.token = ""
}

// adminRequest calls the admin REST API authenticated with a Bearer token.
// A single 401 triggers one token refresh + retry before failing.
func (k *keycloak) adminRequest(t *testing.T, method, path string, body any) *http.Response {
	t.Helper()
	do := func() (*http.Response, error) {
		var rd io.Reader
		if body != nil {
			data, err := json.Marshal(body)
			if err != nil {
				t.Fatal(err)
			}
			rd = strings.NewReader(string(data))
		}
		req, err := http.NewRequest(method, k.baseURL+path, rd)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer "+k.adminToken(t))
		req.Header.Set("Content-Type", "application/json")
		return http.DefaultClient.Do(req)
	}
	resp, err := do()
	if err != nil {
		t.Fatalf("admin %s %s: %v", method, path, err)
	}
	if resp.StatusCode == http.StatusUnauthorized {
		resp.Body.Close()
		k.invalidateToken()
		resp, err = do()
		if err != nil {
			t.Fatalf("admin %s %s (retry): %v", method, path, err)
		}
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
		t.Fatalf("admin %s %s → %d: %s", method, path, resp.StatusCode, b)
	}
	return resp
}

func (k *keycloak) deleteRealm(t *testing.T, realm string) {
	t.Helper()
	req, err := http.NewRequest("DELETE", k.baseURL+"/admin/realms/"+realm, nil)
	if err != nil {
		return
	}
	req.Header.Set("Authorization", "Bearer "+k.adminToken(t))
	if resp, err := http.DefaultClient.Do(req); err == nil {
		_ = resp.Body.Close()
	}
}

// setupKeycloak returns a reachable Keycloak base URL. It prefers
// KEYCLOAK_URL, else spawns a container when Docker exists, else skips.
func setupKeycloak(t *testing.T) *keycloak {
	t.Helper()
	if u := os.Getenv("KEYCLOAK_URL"); u != "" {
		base := strings.TrimRight(u, "/")
		kc := &keycloak{
			baseURL:   base,
			adminUser: envOr("KEYCLOAK_ADMIN", kcAdminUser),
			adminPass: envOr("KEYCLOAK_ADMIN_PASSWORD", kcAdminPassword),
		}
		kc.waitReady(t, 30*time.Second)
		t.Logf("keycloak: using external instance at %s", base)
		return kc
	}
	if _, err := exec.LookPath("docker"); err != nil {
		t.Skipf("KEYCLOAK_URL unset and docker unavailable: %v", err)
	}

	// Pick a free host port for the container's 8080.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Skipf("cannot pick a port: %v", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	_ = ln.Close()

	name := fmt.Sprintf("reqit-kc-smoke-%d", os.Getpid())
	image := envOr("KEYCLOAK_IMAGE", "quay.io/keycloak/keycloak:26.1")
	cmd := exec.Command("docker", "run", "-d", "--name", name,
		"-p", fmt.Sprintf("127.0.0.1:%d:8080", port),
		"-e", "KEYCLOAK_ADMIN="+kcAdminUser,
		"-e", "KEYCLOAK_ADMIN_PASSWORD="+kcAdminPassword,
		image, "start-dev")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("docker run failed: %v\n%s", err, out)
	}
	t.Cleanup(func() {
		_ = exec.Command("docker", "rm", "-f", name).Run()
	})

	base := fmt.Sprintf("http://127.0.0.1:%d", port)
	kc := &keycloak{baseURL: base, adminUser: kcAdminUser, adminPass: kcAdminPassword}
	t.Logf("keycloak: spawned container %s (%s), waiting for readiness", name, base)
	kc.waitReady(t, 180*time.Second)
	return kc
}

func (k *keycloak) waitReady(t *testing.T, timeout time.Duration) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	u := k.baseURL + "/realms/master/.well-known/openid-configuration"
	for time.Now().Before(deadline) {
		resp, err := http.Get(u) //nolint:gosec
		if err == nil {
			_ = resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return
			}
		}
		time.Sleep(2 * time.Second)
	}
	t.Fatalf("keycloak not ready at %s within %s", k.baseURL, timeout)
}

func (k *keycloak) assertUserinfo(t *testing.T, issuer, accessToken string) {
	t.Helper()
	req, err := http.NewRequest("GET", issuer+"/protocol/openid-connect/userinfo", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("userinfo: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("userinfo with the exchanged token → %d (token is not valid)", resp.StatusCode)
	}
	var claims map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&claims); err != nil {
		t.Fatal(err)
	}
	if claims["sub"] == "" || claims["preferred_username"] != kcSmokeUser {
		t.Errorf("unexpected userinfo claims: %v", claims)
	}
}

// --- Headless login automation ----------------------------------------------

// headlessLogin drives the browser side: authorize → any login/profile forms
// → redirect back, returning the code and state from the final callback.
// Keycloak 26 serves the login form directly at the authorize URL (no
// redirect hop) and may interpose required-action steps (e.g. VERIFY_PROFILE
// for a user with an incomplete profile), so the automation is a
// redirect-following form loop rather than a fixed two-hop sequence.
func (k *keycloak) headlessLogin(t *testing.T, authorizeURL, username, password string) (code, state string) {
	t.Helper()
	jar, _ := cookiejar.New(nil)
	client := &http.Client{
		Jar: jar,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse // manual redirect handling
		},
	}

	cur := authorizeURL
	for hop := 0; hop < 20; hop++ {
		// The previous hop may have handed us the final callback (the code
		// arrives in a redirect Location, not over the wire) — detect it
		// before GETting, since the callback listener never accepts.
		if code, state, ok := parseCallbackLocation(cur); ok {
			return code, state
		}
		resp, err := client.Get(cur)
		if err != nil {
			t.Fatalf("GET %s: %v", cur, err)
		}
		switch resp.StatusCode {
		case http.StatusFound, http.StatusSeeOther:
			loc := resp.Header.Get("Location")
			_ = resp.Body.Close()
			if loc == "" {
				t.Fatalf("redirect without Location from %s", cur)
			}
			if code, state, ok := parseCallbackLocation(loc); ok {
				return code, state
			}
			cur = k.resolve(baseURLOf(authorizeURL), loc)
		case http.StatusOK:
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
			_ = resp.Body.Close()
			cur = k.submitForm(t, client, cur, string(body), username, password)
		default:
			_ = resp.Body.Close()
			t.Fatalf("unexpected status %d from %s", resp.StatusCode, cur)
		}
	}
	t.Fatal("too many hops during provider login")
	return "", ""
}

// submitForm parses the form on page, fills the fields it recognizes
// (credentials for the login form; profile defaults for an update-profile
// step), POSTs it, and returns the next URL to visit.
func (k *keycloak) submitForm(t *testing.T, client *http.Client, pageURL, page, username, password string) string {
	t.Helper()
	action, inputs := parseKeycloakLoginForm(t, page)
	if action == "" {
		t.Fatalf("unexpected 200 page (no form): %.300s", page)
	}
	// The login form carries a password input — fill the credentials.
	if _, isLogin := inputs["password"]; isLogin {
		inputs["username"] = username
		inputs["password"] = password
	}
	// Keycloak 26 renders the VERIFY_PROFILE fields via JS, so the static
	// page only exposes the form action; POST the profile fields directly so
	// the required action completes without a browser.
	if strings.Contains(page, "kc-update-profile-form") {
		inputs["firstName"] = "Alice"
		inputs["lastName"] = "Smoke"
		inputs["email"] = "alice@example.test"
	}

	vals := url.Values{}
	for name, value := range inputs {
		vals.Set(name, value)
	}
	actionURL := k.resolve(baseURLOf(pageURL), action)
	resp, err := client.PostForm(actionURL, vals)
	if err != nil {
		t.Fatalf("POST form at %s: %v", actionURL, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusFound && resp.StatusCode != http.StatusSeeOther {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
		t.Fatalf("form POST to %s → %d: %.800s", actionURL, resp.StatusCode, b)
	}
	loc := resp.Header.Get("Location")
	if loc == "" {
		t.Fatalf("form POST redirect without Location from %s", actionURL)
	}
	return k.resolve(baseURLOf(pageURL), loc)
}

// authorizeDevice drives the browser side of the device flow (RFC 8628): it
// follows the verification URI through the login form, then submits the user
// code on the device confirmation page. After it returns, the poll loop picks
// up the token — there is no redirect back to a callback URI.
func (e *kcEnv) authorizeDevice(t *testing.T, verificationURI, userCode string) {
	t.Helper()
	jar, _ := cookiejar.New(nil)
	client := &http.Client{
		Jar: jar,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse // manual redirect handling
		},
	}

	cur := verificationURI
	for hop := 0; hop < 14; hop++ {
		resp, err := client.Get(cur)
		if err != nil {
			t.Fatalf("GET %s: %v", cur, err)
		}
		switch resp.StatusCode {
		case http.StatusFound, http.StatusSeeOther:
			loc := resp.Header.Get("Location")
			_ = resp.Body.Close()
			if loc == "" {
				t.Fatalf("redirect without Location from %s", cur)
			}
			cur = e.kc.resolve(baseURLOf(verificationURI), loc)
		case http.StatusOK:
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
			_ = resp.Body.Close()
			page := string(body)
			// Keycloak (17 → 26) ends the flow on a form-less "Device Login
			// Successful — you may close this browser window" page: the device
			// is authorized, and the poll loop takes over from here.
			if isDeviceSuccessPage(page) {
				return
			}
			action, inputs := parseKeycloakLoginForm(t, page)
			if action == "" {
				t.Fatalf("unexpected 200 page during device auth (no form): %.300s", page)
			}
			if _, isLogin := inputs["password"]; isLogin {
				inputs["username"] = kcSmokeUser
				inputs["password"] = kcSmokePassword
			}
			if _, isDevice := inputs["user_code"]; isDevice {
				inputs["user_code"] = userCode
			}
			// Keycloak's consent page (OAUTH_GRANT) submits via accept/cancel
			// buttons rendered outside the parsed <input> set — approve it.
			if _, isConsent := inputs["code"]; isConsent && strings.Contains(page, `name="accept"`) {
				inputs["accept"] = "Yes"
			}
			vals := url.Values{}
			for n, v := range inputs {
				vals.Set(n, v)
			}
			actionURL := e.kc.resolve(baseURLOf(cur), action)
			post, err := client.PostForm(actionURL, vals)
			if err != nil {
				t.Fatalf("POST form at %s: %v", actionURL, err)
			}
			loc := post.Header.Get("Location")
			status := post.StatusCode
			if status == http.StatusFound || status == http.StatusSeeOther {
				_ = post.Body.Close()
				if loc == "" {
					t.Fatalf("form POST redirect without Location from %s", actionURL)
				}
				cur = e.kc.resolve(baseURLOf(verificationURI), loc)
				continue
			}
			postBody, _ := io.ReadAll(io.LimitReader(post.Body, 2<<20))
			_ = post.Body.Close()
			// Older Keycloak answers the device POST with the success page
			// directly (200), no redirect hop.
			if isDeviceSuccessPage(string(postBody)) {
				return
			}
			t.Fatalf("form POST → %d: %.500s", status, postBody)
		default:
			_ = resp.Body.Close()
			t.Fatalf("unexpected status %d from %s", resp.StatusCode, cur)
		}
	}
	t.Fatal("too many hops during device authorization")
}

// isDeviceSuccessPage reports whether a Keycloak page is the terminal
// "Device Login Successful" page (no form, no further steps).
func isDeviceSuccessPage(page string) bool {
	return strings.Contains(page, "Device Login Successful") ||
		strings.Contains(page, "You may close this browser window")
}

// parseCallbackLocation reports whether loc is the final provider callback
// carrying an authorization code, returning the code and state.
func parseCallbackLocation(loc string) (code, state string, ok bool) {
	u, err := url.Parse(loc)
	if err != nil {
		return "", "", false
	}
	q := u.Query()
	if q.Get("code") == "" {
		return "", "", false
	}
	return q.Get("code"), q.Get("state"), true
}

// parseKeycloakLoginForm extracts the form action and all named inputs from
// the Keycloak login page. Keycloak renders one <input .../> per line; the
// stable contract we rely on is name/value attributes (17 → 26).
func parseKeycloakLoginForm(t *testing.T, page string) (string, map[string]string) {
	t.Helper()
	inputs := map[string]string{}
	action := ""
	if m := regexp.MustCompile(`(?i)<form[^>]*\saction="([^"]*)"`).FindStringSubmatch(page); len(m) == 2 {
		action = htmlUnescape(m[1])
	}
	re := regexp.MustCompile(`(?i)<input[^>]*>`)
	for _, tag := range re.FindAllString(page, -1) {
		name, value := "", ""
		for _, attr := range regexp.MustCompile(`(?i)(name|value)="([^"]*)"`).FindAllStringSubmatch(tag, -1) {
			if len(attr) == 3 {
				switch strings.ToLower(attr[1]) {
				case "name":
					name = htmlUnescape(attr[2])
				case "value":
					value = htmlUnescape(attr[2])
				}
			}
		}
		if name != "" {
			inputs[name] = value
		}
	}
	if action == "" && len(inputs) == 0 {
		t.Fatalf("could not parse login form: %.500s", page)
	}
	return action, inputs
}

func htmlUnescape(s string) string {
	r := strings.NewReplacer("&amp;", "&", "&quot;", "\"", "&#39;", "'", "&lt;", "<", "&gt;", ">")
	return r.Replace(s)
}

// resolve joins a possibly-relative reference against a base URL.
func (k *keycloak) resolve(base, ref string) string {
	if strings.HasPrefix(ref, "http://") || strings.HasPrefix(ref, "https://") {
		return ref
	}
	return strings.TrimRight(base, "/") + "/" + strings.TrimLeft(ref, "/")
}

func baseURLOf(u string) string {
	parsed, err := url.Parse(u)
	if err != nil {
		return u
	}
	return parsed.Scheme + "://" + parsed.Host
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// TestParseKeycloakLoginForm verifies the login-form parser against the real
// Keycloak 17–26 page shape, so the smoke test's riskiest step is covered even
// when no Keycloak instance is available.
func TestParseKeycloakLoginForm(t *testing.T) {
	page := `<!DOCTYPE html>
<html>
<body>
<div class="login-pf-page">
  <div id="kc-header">Keycloak</div>
  <div id="kc-content">
    <div id="kc-form">
      <div id="kc-form-wrapper">
        <form id="kc-form-login" onsubmit="login.disabled = true; return true;" action="/realms/reqit-smoke/login-actions/authenticate?client_id=reqit-smoke&amp;tab_id=abc123&amp;session_code=xyz&amp;execution=exec1&amp;isajax=false" method="post">
          <input type="text" id="username" name="username" class="form-control" autofocus="" autocomplete="off"/>
          <input type="password" id="password" name="password" class="form-control" autocomplete="off"/>
          <input type="hidden" id="credentialId" name="credentialId" value=""/>
          <div class="form-group">
            <div class="checkbox">
              <label>
                <input type="checkbox" tabindex="4" id="rememberMe" name="rememberMe" value="on" checked/>
                <span>Remember me</span>
              </label>
            </div>
          </div>
          <button name="login" id="kc-login" type="submit" value="Sign In"/>Sign In</button>
        </form>
      </div>
    </div>
  </div>
</div>
</body>
</html>`

	action, inputs := parseKeycloakLoginForm(t, page)
	if action == "" {
		t.Fatal("expected a form action")
	}
	if !strings.Contains(action, "login-actions/authenticate") {
		t.Errorf("action = %q", action)
	}
	if !strings.Contains(action, "&tab_id=abc123") {
		t.Errorf("HTML entities should be unescaped in action: %q", action)
	}
	if inputs["username"] != "" || inputs["password"] != "" {
		t.Errorf("username/password should be captured as empty-valued fields: %v", inputs)
	}
	if _, ok := inputs["credentialId"]; !ok {
		t.Error("hidden credentialId input should be captured")
	}
	if inputs["rememberMe"] != "on" {
		t.Errorf("checkbox value should be captured, got %q", inputs["rememberMe"])
	}
}
