package oauth2

import (
	"context"
	"encoding/base64"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

// tokenSrv returns a test server that records the form it received and
// responds with the given body/status.
func tokenSrv(t *testing.T, status int, body string) (*httptest.Server, func() url.Values) {
	t.Helper()
	var last url.Values
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		last = r.PostForm
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return srv, func() url.Values { return last }
}

func pkceCfg(auth, token string) OAuthConfig {
	return OAuthConfig{
		GrantType:   GrantAuthorizationCode,
		AuthURL:     auth,
		TokenURL:    token,
		ClientID:    "client-1",
		Scopes:      "repo user",
		RedirectURI: "http://127.0.0.1:7317/callback",
		PKCE:        PKCES256,
	}
}

// TestExchangeAuthorizationCodePKCE: the code exchange carries the correct
// params (incl. code_verifier) and NEVER the client_secret for a public
// client, even when a secret was supplied by the caller.
func TestExchangeAuthorizationCodePKCE(t *testing.T) {
	srv, last := tokenSrv(t, 200, `{"access_token":"tok","token_type":"Bearer","refresh_token":"rt","expires_in":3600,"scope":"repo"}`)
	cfg := pkceCfg(srv.URL+"/auth", srv.URL+"/token")
	cfg.PKCE = PKCES256

	tr, err := Exchange(context.Background(), cfg, ExchangeOptions{
		Code:         "abc",
		CodeVerifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
		ClientSecret: "super-secret", // must be ignored for a public client
	})
	if err != nil {
		t.Fatal(err)
	}
	f := last()
	if f.Get("grant_type") != "authorization_code" {
		t.Errorf("grant_type = %q", f.Get("grant_type"))
	}
	if f.Get("code") != "abc" {
		t.Errorf("code = %q", f.Get("code"))
	}
	if f.Get("redirect_uri") != cfg.RedirectURI {
		t.Errorf("redirect_uri = %q", f.Get("redirect_uri"))
	}
	if f.Get("client_id") != "client-1" {
		t.Errorf("client_id = %q", f.Get("client_id"))
	}
	if f.Get("code_verifier") != "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" {
		t.Errorf("code_verifier = %q", f.Get("code_verifier"))
	}
	if f.Get("client_secret") != "" {
		t.Errorf("PKCE public-client exchange must never send client_secret, got %q", f.Get("client_secret"))
	}
	if tr.AccessToken != "tok" || tr.RefreshToken != "rt" || tr.TokenType != "Bearer" {
		t.Errorf("token result = %+v", tr)
	}
	if tr.ExpiresAtMs < time.Now().UnixMilli()+3_500_000 {
		t.Errorf("ExpiresAtMs should be now+expires_in in ms, got %d", tr.ExpiresAtMs)
	}
}

// TestExchangeAuthorizationCodeConfidential: a confidential client sends
// client_secret in the body (default mode).
func TestExchangeAuthorizationCodeConfidential(t *testing.T) {
	srv, last := tokenSrv(t, 200, `{"access_token":"tok","token_type":"Bearer","expires_in":3600}`)
	cfg := pkceCfg(srv.URL+"/auth", srv.URL+"/token")
	cfg.Confidential = true
	cfg.PKCE = PKCENone // confidential clients can still use PKCE, but exercise non-PKCE here

	if _, err := Exchange(context.Background(), cfg, ExchangeOptions{Code: "abc", ClientSecret: "s3cret"}); err != nil {
		t.Fatal(err)
	}
	f := last()
	if f.Get("client_secret") != "s3cret" {
		t.Errorf("client_secret = %q, want s3cret", f.Get("client_secret"))
	}
	if f.Get("client_id") != "client-1" {
		t.Errorf("client_id = %q", f.Get("client_id"))
	}
}

// TestExchangeAuthorizationCodeConfidentialBasic: Basic auth mode puts the
// credentials in the Authorization header and keeps them out of the body.
func TestExchangeAuthorizationCodeConfidentialBasic(t *testing.T) {
	var authHeader string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		authHeader = r.Header.Get("Authorization")
		if r.PostForm.Get("client_secret") != "" || r.PostForm.Get("client_id") != "" {
			t.Errorf("Basic mode leaked credentials into the body: %v", r.PostForm)
		}
		_, _ = w.Write([]byte(`{"access_token":"tok","token_type":"Bearer"}`))
	}))
	t.Cleanup(srv.Close)

	cfg := pkceCfg(srv.URL+"/auth", srv.URL+"/token")
	cfg.Confidential = true
	cfg.ClientAuth = ClientAuthBasic
	cfg.PKCE = PKCENone

	if _, err := Exchange(context.Background(), cfg, ExchangeOptions{Code: "abc", ClientSecret: "s3cret"}); err != nil {
		t.Fatal(err)
	}
	want := "Basic " + base64.StdEncoding.EncodeToString([]byte("client-1:s3cret"))
	if authHeader != want {
		t.Errorf("Authorization = %q, want %q", authHeader, want)
	}
}

// TestExchangeAuthorizationCodeFormEncoded covers GitHub-style providers that
// reply application/x-www-form-urlencoded even when we request JSON.
func TestExchangeAuthorizationCodeFormEncoded(t *testing.T) {
	srv, _ := tokenSrv(t, 200, "access_token=gho_123&token_type=bearer&scope=repo")
	cfg := pkceCfg(srv.URL+"/auth", srv.URL+"/token")
	cfg.PKCE = PKCENone

	tr, err := Exchange(context.Background(), cfg, ExchangeOptions{Code: "c"})
	if err != nil {
		t.Fatal(err)
	}
	if tr.AccessToken != "gho_123" || tr.TokenType != "bearer" {
		t.Errorf("token result = %+v", tr)
	}
}

// TestExchangeBadVerificationCodeFallback: GitHub reports redirect_uri
// mismatches as bad_verification_code; the engine retries without
// redirect_uri and only then succeeds.
func TestExchangeBadVerificationCodeFallback(t *testing.T) {
	attempts := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		attempts++
		if attempts == 1 {
			if r.PostForm.Get("redirect_uri") == "" {
				t.Error("first request should include redirect_uri")
			}
			_, _ = w.Write([]byte(`{"error":"bad_verification_code","error_description":"The code passed is incorrect or expired."}`))
			return
		}
		if r.PostForm.Get("redirect_uri") != "" {
			t.Error("retry should omit redirect_uri")
		}
		_, _ = w.Write([]byte(`{"access_token":"tok","token_type":"Bearer","expires_in":3600}`))
	}))
	t.Cleanup(srv.Close)

	cfg := pkceCfg(srv.URL+"/auth", srv.URL+"/token")
	cfg.PKCE = PKCENone
	tr, err := Exchange(context.Background(), cfg, ExchangeOptions{Code: "c"})
	if err != nil {
		t.Fatal(err)
	}
	if tr.AccessToken != "tok" || attempts != 2 {
		t.Errorf("token=%q attempts=%d", tr.AccessToken, attempts)
	}
}

// TestExchangeProviderErrorVerbatim: provider errors surface verbatim through
// the typed error (errors.Is + code/description accessors).
func TestExchangeProviderErrorVerbatim(t *testing.T) {
	srv, _ := tokenSrv(t, 400, `{"error":"invalid_grant","error_description":"The authorization code is expired","error_uri":"https://idp/errors/9"}`)
	cfg := pkceCfg(srv.URL+"/auth", srv.URL+"/token")
	cfg.PKCE = PKCENone

	_, err := Exchange(context.Background(), cfg, ExchangeOptions{Code: "bad"})
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, ErrProviderDenied) {
		t.Errorf("errors.Is(ErrProviderDenied) = false for %v", err)
	}
	oe, ok := err.(*OAuthError)
	if !ok {
		t.Fatalf("expected *OAuthError, got %T", err)
	}
	if oe.ProviderCode() != "invalid_grant" {
		t.Errorf("ProviderCode = %q", oe.ProviderCode())
	}
	if oe.ProviderDescription() != "The authorization code is expired" {
		t.Errorf("ProviderDescription = %q", oe.ProviderDescription())
	}
}

// TestExchangeRefreshToken verifies the refresh grant params and the
// ErrRefreshFailed typed error.
func TestExchangeRefreshToken(t *testing.T) {
	srv, last := tokenSrv(t, 200, `{"access_token":"new-tok","refresh_token":"new-rt","token_type":"Bearer","expires_in":3600}`)
	cfg := pkceCfg("", srv.URL+"/token")
	cfg.GrantType = GrantRefreshToken
	cfg.Confidential = true

	tr, err := Exchange(context.Background(), cfg, ExchangeOptions{RefreshToken: "old-rt", ClientSecret: "s"})
	if err != nil {
		t.Fatal(err)
	}
	f := last()
	if f.Get("grant_type") != "refresh_token" || f.Get("refresh_token") != "old-rt" {
		t.Errorf("params = %v", f)
	}
	if tr.AccessToken != "new-tok" {
		t.Errorf("access = %q", tr.AccessToken)
	}

	// Provider error on refresh → ErrRefreshFailed.
	srv2, _ := tokenSrv(t, 400, `{"error":"invalid_grant","error_description":"Refresh token revoked"}`)
	cfg2 := pkceCfg("", srv2.URL+"/token")
	cfg2.GrantType = GrantRefreshToken
	_, err = Exchange(context.Background(), cfg2, ExchangeOptions{RefreshToken: "dead"})
	if !errors.Is(err, ErrRefreshFailed) {
		t.Errorf("expected ErrRefreshFailed, got %v", err)
	}
}

// TestExchangeClientCredentials covers body and Basic client-auth modes plus
// the scope parameter.
func TestExchangeClientCredentials(t *testing.T) {
	var authHeader string
	var bodyVals url.Values
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		bodyVals = r.PostForm
		authHeader = r.Header.Get("Authorization")
		_, _ = w.Write([]byte(`{"access_token":"cc-tok","token_type":"Bearer","expires_in":600}`))
	}))
	t.Cleanup(srv.Close)

	// Body mode.
	cfg := OAuthConfig{GrantType: GrantClientCredentials, TokenURL: srv.URL + "/token", ClientID: "svc", Confidential: true}
	tr, err := Exchange(context.Background(), cfg, ExchangeOptions{Scope: "read write", ClientSecret: "svc-secret"})
	if err != nil {
		t.Fatal(err)
	}
	if tr.AccessToken != "cc-tok" {
		t.Errorf("access = %q", tr.AccessToken)
	}
	if bodyVals.Get("grant_type") != "client_credentials" || bodyVals.Get("scope") != "read write" {
		t.Errorf("body = %v", bodyVals)
	}
	if bodyVals.Get("client_secret") != "svc-secret" || bodyVals.Get("client_id") != "svc" {
		t.Errorf("client auth body = %v", bodyVals)
	}

	// Basic mode.
	cfg.ClientAuth = ClientAuthBasic
	if _, err := Exchange(context.Background(), cfg, ExchangeOptions{ClientSecret: "svc-secret"}); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(authHeader, "Basic ") {
		t.Errorf("Basic mode should set Authorization, got %q", authHeader)
	}
	if bodyVals.Get("client_secret") != "" || bodyVals.Get("client_id") != "" {
		t.Errorf("Basic mode leaked credentials into body: %v", bodyVals)
	}
}

// TestExchangePassword verifies the password grant params.
func TestExchangePassword(t *testing.T) {
	srv, last := tokenSrv(t, 200, `{"access_token":"pw-tok","token_type":"Bearer"}`)
	cfg := OAuthConfig{GrantType: GrantPassword, TokenURL: srv.URL + "/token", ClientID: "c"}

	tr, err := Exchange(context.Background(), cfg, ExchangeOptions{Username: "alice", Password: "wonderland", Scope: "openid"})
	if err != nil {
		t.Fatal(err)
	}
	f := last()
	if f.Get("grant_type") != "password" || f.Get("username") != "alice" || f.Get("password") != "wonderland" || f.Get("scope") != "openid" {
		t.Errorf("params = %v", f)
	}
	if tr.AccessToken != "pw-tok" {
		t.Errorf("access = %q", tr.AccessToken)
	}

	if _, err := Exchange(context.Background(), cfg, ExchangeOptions{}); err == nil {
		t.Error("missing credentials should error")
	}
}

// TestExchangeRejectsNonTokenGrants: implicit/empty grants never hit the token
// endpoint; device delegates to DeviceStart/DevicePoll.
func TestExchangeRejectsNonTokenGrants(t *testing.T) {
	for _, gt := range []GrantType{GrantImplicit, ""} {
		cfg := OAuthConfig{GrantType: gt, TokenURL: "https://x/token"}
		if _, err := Exchange(context.Background(), cfg, ExchangeOptions{}); err == nil {
			t.Errorf("grant %q should be rejected", gt)
		}
	}
	cfg := OAuthConfig{GrantType: GrantDeviceCode, TokenURL: "https://x/token"}
	if _, err := Exchange(context.Background(), cfg, ExchangeOptions{}); err == nil {
		t.Error("device grant should direct to DeviceStart/DevicePoll")
	}
	if _, err := Exchange(context.Background(), OAuthConfig{}, ExchangeOptions{}); err == nil {
		t.Error("missing token URL should error")
	}
}

// TestDeviceStartAndPoll covers the RFC 8628 lifecycle against a fake server:
// start (no grant_type, device endpoint) → pending → success.
func TestDeviceStartAndPoll(t *testing.T) {
	var startPath, pollPath string
	polls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		if r.PostForm.Get("device_code") == "" {
			startPath = r.URL.Path
			if r.PostForm.Get("grant_type") != "" {
				t.Errorf("device start must not send grant_type, got %q", r.PostForm.Get("grant_type"))
			}
			if r.PostForm.Get("client_id") != "client-1" {
				t.Errorf("device start client_id = %q", r.PostForm.Get("client_id"))
			}
			if r.PostForm.Get("scope") != "repo" {
				t.Errorf("device start scope = %q", r.PostForm.Get("scope"))
			}
			_, _ = w.Write([]byte(`{"device_code":"dev-1","user_code":"ABCD-EFGH","verification_uri":"https://provider/device","expires_in":600,"interval":5}`))
			return
		}
		pollPath = r.URL.Path
		if r.PostForm.Get("grant_type") != "urn:ietf:params:oauth:grant-type:device_code" {
			t.Errorf("poll grant_type = %q", r.PostForm.Get("grant_type"))
		}
		polls++
		if polls == 1 {
			_, _ = w.Write([]byte(`{"error":"authorization_pending"}`))
			return
		}
		_, _ = w.Write([]byte(`{"access_token":"dev-tok","token_type":"Bearer","expires_in":3600}`))
	}))
	t.Cleanup(srv.Close)

	cfg := OAuthConfig{
		GrantType: GrantDeviceCode, ClientID: "client-1", Scopes: "repo",
		DeviceURL: srv.URL + "/device", TokenURL: srv.URL + "/token",
	}

	start, err := StartDevice(context.Background(), cfg, "")
	if err != nil {
		t.Fatal(err)
	}
	if start.DeviceCode != "dev-1" || start.UserCode != "ABCD-EFGH" || start.Interval != 5 {
		t.Errorf("device start = %+v", start)
	}
	if startPath != "/device" {
		t.Errorf("device start path = %q, want /device", startPath)
	}

	p1, err := PollDevice(context.Background(), cfg, "", start.DeviceCode)
	if err != nil {
		t.Fatal(err)
	}
	if p1.Status != DevicePollPending {
		t.Errorf("first poll = %q, want pending", p1.Status)
	}
	if pollPath != "/token" {
		t.Errorf("poll path = %q, want /token", pollPath)
	}

	p2, err := PollDevice(context.Background(), cfg, "", start.DeviceCode)
	if err != nil {
		t.Fatal(err)
	}
	if p2.Status != DevicePollSuccess || p2.Token == nil || p2.Token.AccessToken != "dev-tok" {
		t.Errorf("second poll = %+v", p2)
	}
}

// TestDevicePollErrorStatuses maps provider errors to the RFC 8628 lifecycle.
func TestDevicePollErrorStatuses(t *testing.T) {
	cases := []struct {
		body   string
		status DevicePollStatus
	}{
		{`{"error":"slow_down"}`, DevicePollSlowDown},
		{`{"error":"access_denied"}`, DevicePollDenied},
		{`{"error":"expired_token"}`, DevicePollExpired},
		{`{"error":"invalid_client"}`, DevicePollError},
	}
	for _, c := range cases {
		srv, _ := tokenSrv(t, 400, c.body)
		cfg := OAuthConfig{GrantType: GrantDeviceCode, TokenURL: srv.URL + "/token", ClientID: "c"}
		res, err := PollDevice(context.Background(), cfg, "", "dev")
		if err != nil {
			t.Fatal(err)
		}
		if res.Status != c.status {
			t.Errorf("body %s → status %q, want %q", c.body, res.Status, c.status)
		}
	}
}

// TestAuthCodeFlow covers authorize-URL construction, state round-trip, and
// the Exchanger implementation.
func TestAuthCodeFlow(t *testing.T) {
	cfg := pkceCfg("https://provider/authorize", "https://provider/token")
	flow, err := NewAuthCodeFlow(cfg)
	if err != nil {
		t.Fatal(err)
	}

	u, err := flow.AuthorizeURL()
	if err != nil {
		t.Fatal(err)
	}
	parsed, _ := url.Parse(u)
	q := parsed.Query()
	if q.Get("response_type") != "code" || q.Get("client_id") != "client-1" {
		t.Errorf("authorize params missing: %v", q)
	}
	if q.Get("redirect_uri") != cfg.RedirectURI {
		t.Errorf("redirect_uri = %q", q.Get("redirect_uri"))
	}
	if q.Get("scope") != "repo user" {
		t.Errorf("scope = %q", q.Get("scope"))
	}
	if q.Get("state") == "" || !flow.ValidateState(q.Get("state")) {
		t.Errorf("state round-trip failed: %q", q.Get("state"))
	}
	if flow.ValidateState("wrong") {
		t.Error("ValidateState should reject a mismatched state")
	}
	if q.Get("code_challenge_method") != "S256" || q.Get("code_challenge") == "" {
		t.Errorf("PKCE challenge missing: %v", q)
	}
	if q.Get("code_challenge") != S256Challenge(flow.Verifier()) {
		t.Error("code_challenge should be S256(verifier)")
	}

	// Exchanger impl drives the token endpoint via the engine.
	srv, last := tokenSrv(t, 200, `{"access_token":"fc-tok","token_type":"Bearer","expires_in":3600}`)
	cfg.TokenURL = srv.URL + "/token"
	flow2, _ := NewAuthCodeFlow(cfg)
	tr, err := flow2.ExchangeCode(context.Background(), "the-code")
	if err != nil {
		t.Fatal(err)
	}
	if tr.AccessToken != "fc-tok" {
		t.Errorf("access = %q", tr.AccessToken)
	}
	if last().Get("code_verifier") != flow2.Verifier() {
		t.Error("token exchange should send the flow's verifier")
	}
	if last().Get("client_secret") != "" {
		t.Error("flow exchange must not send client_secret for a public client")
	}
}

// TestAuthCodeFlowNoPKCE: PKCENone produces an authorize URL without challenge
// params and a code exchange without code_verifier.
func TestAuthCodeFlowNoPKCE(t *testing.T) {
	cfg := pkceCfg("https://provider/authorize", "")
	cfg.PKCE = PKCENone
	flow, err := NewAuthCodeFlow(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if flow.Verifier() != "" {
		t.Error("PKCENone must not generate a verifier")
	}
	u, err := flow.AuthorizeURL()
	if err != nil {
		t.Fatal(err)
	}
	q, _ := url.Parse(u)
	if q.Query().Get("code_challenge") != "" || q.Query().Get("code_challenge_method") != "" {
		t.Error("PKCENone authorize URL must not carry challenge params")
	}
}

// TestAuthCodeFlowConfidential: a confidential client's secret is threaded
// through WithClientSecret into the exchange, but a PKCE public client never
// sends it even when a secret is supplied (the Hoppscotch/Azure bug class).
func TestAuthCodeFlowConfidential(t *testing.T) {
	cfg := pkceCfg("https://provider/authorize", "")
	srv, last := tokenSrv(t, 200, `{"access_token":"conf-tok","token_type":"Bearer","expires_in":3600}`)
	cfg.TokenURL = srv.URL + "/token"

	// Confidential client with an issued secret: PKCE verifier AND secret.
	cfg.Confidential = true
	flow, err := NewAuthCodeFlow(cfg)
	if err != nil {
		t.Fatal(err)
	}
	flow.WithClientSecret("s3cret")
	if _, err := flow.ExchangeCode(context.Background(), "the-code"); err != nil {
		t.Fatal(err)
	}
	if got := last().Get("client_secret"); got != "s3cret" {
		t.Errorf("confidential exchange client_secret = %q, want s3cret", got)
	}
	if last().Get("code_verifier") != flow.Verifier() {
		t.Error("confidential PKCE exchange must still send the code_verifier")
	}

	// Public client: the supplied secret must be ignored entirely.
	cfg.Confidential = false
	public, err := NewAuthCodeFlow(cfg)
	if err != nil {
		t.Fatal(err)
	}
	public.WithClientSecret("s3cret")
	if _, err := public.ExchangeCode(context.Background(), "the-code"); err != nil {
		t.Fatal(err)
	}
	if got := last().Get("client_secret"); got != "" {
		t.Errorf("public-client exchange sent client_secret %q — must never happen", got)
	}
}

// TestAuthCodeFlowRequiresConfig: missing auth URL or client ID is a typed
// config error, and PKCE defaults to S256.
func TestAuthCodeFlowRequiresConfig(t *testing.T) {
	if _, err := NewAuthCodeFlow(OAuthConfig{}); err == nil {
		t.Error("empty config should error")
	}
	cfg := OAuthConfig{AuthURL: "https://provider/authorize", ClientID: "c", RedirectURI: "http://127.0.0.1:9/cb"}
	f, err := NewAuthCodeFlow(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if f.PKCEMethod() != PKCES256 {
		t.Errorf("PKCE should default to S256, got %q", f.PKCEMethod())
	}
}

// TestNewStateToken: state values are unique and URL-safe.
func TestNewStateToken(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 100; i++ {
		s := NewStateToken()
		if seen[s] {
			t.Fatalf("duplicate state: %q", s)
		}
		seen[s] = true
		if strings.ContainsAny(s, "=+/") {
			t.Errorf("state must be URL-safe, got %q", s)
		}
	}
}

// TestAuthCodeFlowImplementsExchanger is a compile-time assertion that the
// loopback handler's dependency is satisfied by the engine.
func TestAuthCodeFlowImplementsExchanger(t *testing.T) {
	var exch Exchanger = (*AuthCodeFlow)(nil)
	if exch == nil {
		t.Fatal("AuthCodeFlow must implement Exchanger")
	}
}
