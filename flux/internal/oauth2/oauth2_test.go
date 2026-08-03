package oauth2

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func newTestConfig(auth, token string) OAuth2Config {
	return OAuth2Config{
		AuthURL:      auth,
		TokenURL:     token,
		ClientID:     "client-1",
		ClientSecret: "secret-1",
		Scopes:       "repo user",
		RedirectURI:  "http://127.0.0.1:7317/callback",
	}
}

// TestExchangeJSON verifies the token request sends Accept: application/json
// and parses a JSON token response.
func TestExchangeJSON(t *testing.T) {
	var gotAccept string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAccept = r.Header.Get("Accept")
		if err := r.ParseForm(); err != nil {
			t.Fatalf("parse form: %v", err)
		}
		if r.Form.Get("grant_type") != "authorization_code" {
			t.Errorf("grant_type = %q", r.Form.Get("grant_type"))
		}
		if r.Form.Get("code") != "abc123" {
			t.Errorf("code = %q", r.Form.Get("code"))
		}
		if r.Form.Get("client_secret") != "secret-1" {
			t.Errorf("client_secret = %q", r.Form.Get("client_secret"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"tok","token_type":"Bearer","expires_in":3600,"scope":"repo"}`))
	}))
	defer srv.Close()

	s := New(newTestConfig(srv.URL+"/auth", srv.URL+"/token"))
	tr, err := s.Exchange(context.Background(), "abc123")
	if err != nil {
		t.Fatal(err)
	}
	if gotAccept != "application/json" {
		t.Errorf("Accept header = %q, want application/json", gotAccept)
	}
	if tr.AccessToken != "tok" {
		t.Errorf("AccessToken = %q", tr.AccessToken)
	}
	if tr.TokenType != "Bearer" {
		t.Errorf("TokenType = %q", tr.TokenType)
	}
	if tr.ExpiresAt == 0 {
		t.Error("ExpiresAt should be set from expires_in")
	}
	if tr.Error != "" {
		t.Errorf("unexpected error: %s", tr.Error)
	}
}

// TestExchangeFormEncoded verifies the GitHub default response
// (application/x-www-form-urlencoded) is parsed even though we request JSON.
func TestExchangeFormEncoded(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/x-www-form-urlencoded")
		_, _ = w.Write([]byte("access_token=gho_123&token_type=bearer&scope=repo"))
	}))
	defer srv.Close()

	s := New(newTestConfig(srv.URL+"/auth", srv.URL+"/token"))
	tr, err := s.Exchange(context.Background(), "code")
	if err != nil {
		t.Fatal(err)
	}
	if tr.AccessToken != "gho_123" {
		t.Errorf("AccessToken = %q, want gho_123", tr.AccessToken)
	}
	if tr.TokenType != "bearer" {
		t.Errorf("TokenType = %q", tr.TokenType)
	}
}

// TestExchangeRetriesWithoutRedirectURI verifies that a bad_verification_code
// error (which providers use to signal a redirect_uri mismatch) triggers a
// retry without the redirect_uri parameter, per GitHub's documented fallback.
func TestExchangeRetriesWithoutRedirectURI(t *testing.T) {
	fullOnce := true
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Fatalf("parse form: %v", err)
		}
		if fullOnce {
			fullOnce = false
			if r.Form.Get("redirect_uri") == "" {
				t.Errorf("first request should send redirect_uri")
			}
			_, _ = w.Write([]byte(`{"error":"bad_verification_code","error_description":"The code passed is incorrect or expired."}`))
			return
		}
		if r.Form.Get("redirect_uri") != "" {
			t.Errorf("retry should omit redirect_uri")
		}
		_, _ = w.Write([]byte(`{"access_token":"tok","token_type":"Bearer","expires_in":3600}`))
	}))
	defer srv.Close()

	s := New(newTestConfig(srv.URL+"/auth", srv.URL+"/token"))
	tr, err := s.Exchange(context.Background(), "code")
	if err != nil {
		t.Fatal(err)
	}
	if tr.AccessToken != "tok" {
		t.Errorf("AccessToken = %q, want tok", tr.AccessToken)
	}
}

// TestExchangeError verifies provider error responses are surfaced with their
// description.
func TestExchangeError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"error":"invalid_grant","error_description":"The code is expired or has already been used"}`))
	}))
	defer srv.Close()

	s := New(newTestConfig(srv.URL+"/auth", srv.URL+"/token"))
	tr, err := s.Exchange(context.Background(), "bad")
	if err != nil {
		t.Fatal(err)
	}
	if tr.Error != "invalid_grant" {
		t.Errorf("Error = %q", tr.Error)
	}
	if !strings.Contains(tr.ErrorDescription, "expired") {
		t.Errorf("ErrorDescription = %q", tr.ErrorDescription)
	}
}

// TestAuthorizeURL validates that the authorize URL contains the expected
// params and that state round-trips through ValidateState.
func TestAuthorizeURL(t *testing.T) {
	s := New(newTestConfig("https://github.com/login/oauth/authorize", "https://github.com/login/oauth/access_token"))
	u, state, err := s.AuthorizeURL()
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(u)
	if err != nil {
		t.Fatal(err)
	}
	q := parsed.Query()
	if q.Get("response_type") != "code" {
		t.Errorf("response_type = %q", q.Get("response_type"))
	}
	if q.Get("client_id") != "client-1" {
		t.Errorf("client_id = %q", q.Get("client_id"))
	}
	if q.Get("redirect_uri") != s.config.RedirectURI {
		t.Errorf("redirect_uri = %q", q.Get("redirect_uri"))
	}
	if q.Get("scope") != "repo user" {
		t.Errorf("scope = %q", q.Get("scope"))
	}
	if q.Get("state") == "" {
		t.Error("state should not be empty")
	}
	if !s.ValidateState(state) {
		t.Error("ValidateState should accept the issued state")
	}
	if s.ValidateState("wrong") {
		t.Error("ValidateState should reject a mismatched state")
	}
}

// TestAuthorizeURLPKCE verifies code_challenge + S256 are added when PKCE is on.
func TestAuthorizeURLPKCE(t *testing.T) {
	cfg := newTestConfig("https://provider/authorize", "https://provider/token")
	cfg.UsePKCE = true
	s := New(cfg)
	u, _, err := s.AuthorizeURL()
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(u, "code_challenge=") || !strings.Contains(u, "code_challenge_method=S256") {
		t.Errorf("PKCE params missing: %s", u)
	}
}

// TestDeviceFlow covers the full RFC 8628 lifecycle: start, pending, success.
// It verifies the start request hits the device authorization endpoint (not the
// token endpoint) and carries no grant_type.
func TestDeviceFlow(t *testing.T) {
	state := struct {
		deviceCode string
		polls      int
	}{}

	var startPath, tokenPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Fatalf("parse form: %v", err)
		}
		if r.Form.Get("device_code") == "" {
			// Start request (RFC 8628: must NOT include grant_type).
			startPath = r.URL.Path
			if r.Form.Get("grant_type") != "" {
				t.Errorf("device start grant_type = %q, want empty", r.Form.Get("grant_type"))
			}
			if r.Form.Get("client_id") != "client-1" {
				t.Errorf("client_id = %q", r.Form.Get("client_id"))
			}
			if r.Form.Get("client_secret") != "secret-1" {
				t.Errorf("client_secret = %q", r.Form.Get("client_secret"))
			}
			_, _ = w.Write([]byte(`{"device_code":"dev-1","user_code":"ABCD-EFGH","verification_uri":"https://github.com/login/device","expires_in":600,"interval":5}`))
			return
		}
		// Poll request.
		tokenPath = r.URL.Path
		if r.Form.Get("device_code") != "dev-1" {
			t.Errorf("device_code = %q", r.Form.Get("device_code"))
		}
		if r.Form.Get("grant_type") != "urn:ietf:params:oauth:grant-type:device_code" {
			t.Errorf("poll grant_type = %q", r.Form.Get("grant_type"))
		}
		state.polls++
		if state.polls < 2 {
			_, _ = w.Write([]byte(`{"error":"authorization_pending"}`))
			return
		}
		_, _ = w.Write([]byte(`{"access_token":"devtok","token_type":"Bearer","expires_in":3600,"scope":"repo"}`))
	}))
	defer srv.Close()

	cfg := newTestConfig(srv.URL+"/auth", srv.URL+"/token")
	cfg.DeviceURL = srv.URL + "/device"
	s := New(cfg)
	ds, err := s.DeviceStart(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if ds.DeviceCode != "dev-1" || ds.UserCode != "ABCD-EFGH" {
		t.Errorf("device start = %+v", ds)
	}
	if startPath != "/device" {
		t.Errorf("device start path = %q, want /device", startPath)
	}

	p1, err := s.DevicePoll(context.Background(), ds.DeviceCode)
	if err != nil {
		t.Fatal(err)
	}
	if p1.Status != "pending" {
		t.Errorf("first poll status = %q, want pending", p1.Status)
	}
	if tokenPath != "/token" {
		t.Errorf("poll path = %q, want /token", tokenPath)
	}

	p2, err := s.DevicePoll(context.Background(), ds.DeviceCode)
	if err != nil {
		t.Fatal(err)
	}
	if p2.Status != "success" {
		t.Errorf("second poll status = %q, want success", p2.Status)
	}
	if p2.Token == nil || p2.Token.AccessToken != "devtok" {
		t.Errorf("poll token = %+v", p2.Token)
	}
}

// TestDeviceStartError surfaces the provider error.
func TestDeviceStartError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"error":"invalid_client","error_description":"Unknown client"}`))
	}))
	defer srv.Close()

	s := New(newTestConfig(srv.URL+"/auth", srv.URL+"/token"))
	ds, err := s.DeviceStart(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if ds.Error != "invalid_client" {
		t.Errorf("Error = %q", ds.Error)
	}
}

func TestJSONMarshalConfig(t *testing.T) {
	cfg := newTestConfig("", "")
	cfg.TokenURL = "https://github.com/login/oauth/access_token"
	b, err := json.Marshal(cfg)
	if err != nil {
		t.Fatal(err)
	}
	var back OAuth2Config
	if err := json.Unmarshal(b, &back); err != nil {
		t.Fatal(err)
	}
	if back.TokenURL != cfg.TokenURL {
		t.Errorf("round-trip mismatch: %+v", back)
	}
}
