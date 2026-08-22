package oauth2

import (
	"context"
	"errors"
	"fmt"

	"net/url"
	"strings"
	"testing"
)

// TestManualFlowSuccess: pasting the provider's redirect URL completes the
// exchange, sending the PKCE verifier and the flow's own state.
func TestManualFlowSuccess(t *testing.T) {
	srv, last := tokenSrv(t, 200, `{"access_token":"tok","token_type":"Bearer","refresh_token":"rt","expires_in":3600}`)
	cfg := pkceCfg(srv.URL+"/auth", srv.URL+"/token")

	mf, err := NewManualFlow(cfg)
	if err != nil {
		t.Fatal(err)
	}
	authURL, err := mf.AuthorizeURL()
	if err != nil {
		t.Fatal(err)
	}
	au, _ := url.Parse(authURL)
	if au.Query().Get("code_challenge") == "" || au.Query().Get("code_challenge_method") != "S256" {
		t.Errorf("authorize URL must carry the PKCE challenge: %s", authURL)
	}

	// Simulate the provider redirecting back with the flow's state.
	pasted := fmt.Sprintf("%s?code=github-code&state=%s", cfg.RedirectURI, mf.State())
	token, err := mf.Complete(context.Background(), pasted)
	if err != nil {
		t.Fatalf("Complete: %v", err)
	}
	if token.AccessToken != "tok" || token.RefreshToken != "rt" {
		t.Errorf("token = %+v", token)
	}
	f := last()
	if f.Get("grant_type") != "authorization_code" || f.Get("code") != "github-code" {
		t.Errorf("exchange params = %v", f)
	}
	if f.Get("code_verifier") != mf.flow.verifier {
		t.Errorf("code_verifier must be the flow's verifier, got %q", f.Get("code_verifier"))
	}
	if f.Get("client_secret") != "" {
		t.Errorf("public-client exchange must never send client_secret, got %q", f.Get("client_secret"))
	}
}

// TestManualFlowStateMismatch: a forged/mismatched state is rejected before
// any exchange is attempted.
func TestManualFlowStateMismatch(t *testing.T) {
	srv, _ := tokenSrv(t, 200, `{"access_token":"tok"}`)
	mf, err := NewManualFlow(pkceCfg(srv.URL+"/auth", srv.URL+"/token"))
	if err != nil {
		t.Fatal(err)
	}
	pasted := fmt.Sprintf("%s?code=abc&state=forged-state", mf.Config().RedirectURI)
	_, err = mf.Complete(context.Background(), pasted)
	if !errors.Is(err, ErrStateMismatch) {
		t.Fatalf("want ErrStateMismatch, got %v", err)
	}
}

// TestManualFlowProviderErrorVerbatim: a provider rejection (error in the
// pasted URL) is surfaced verbatim, not as a generic failure.
func TestManualFlowProviderErrorVerbatim(t *testing.T) {
	mf, err := NewManualFlow(pkceCfg("https://auth.example.test", "https://token.example.test"))
	if err != nil {
		t.Fatal(err)
	}
	pasted := fmt.Sprintf("%s?error=access_denied&error_description=The+user+declined+authorization", mf.Config().RedirectURI)
	_, err = mf.Complete(context.Background(), pasted)
	if !errors.Is(err, ErrProviderDenied) {
		t.Fatalf("want ErrProviderDenied, got %v", err)
	}
	var oe *OAuthError
	if !errors.As(err, &oe) || oe.ProviderCode() != "access_denied" {
		t.Errorf("want verbatim access_denied, got %v", err)
	}
	if !strings.Contains(err.Error(), "The user declined authorization") {
		t.Errorf("error_description must be surfaced verbatim: %v", err)
	}
}

// TestManualFlowMissingPieces: empty paste, non-URL paste, and a redirect
// without a code all fail with clear typed errors; a code delivered in the
// URL fragment is recovered.
func TestManualFlowMissingPieces(t *testing.T) {
	srv, last := tokenSrv(t, 200, `{"access_token":"frag-tok"}`)
	mf, err := NewManualFlow(pkceCfg(srv.URL+"/auth", srv.URL+"/token"))
	if err != nil {
		t.Fatal(err)
	}

	if _, err := mf.Complete(context.Background(), ""); err == nil {
		t.Error("empty paste must fail")
	}
	if _, err := mf.Complete(context.Background(), "not a url"); err == nil {
		t.Error("non-URL paste must fail")
	}
	if _, err := mf.Complete(context.Background(), mf.Config().RedirectURI+"?state="+mf.State()); err == nil {
		t.Error("redirect without a code must fail")
	}

	// Fragment-delivered code (pasted URL includes the hash) is recovered.
	fragPasted := fmt.Sprintf("%s?state=%s#code=fragment-code", mf.Config().RedirectURI, mf.State())
	token, err := mf.Complete(context.Background(), fragPasted)
	if err != nil {
		t.Fatalf("fragment code: %v", err)
	}
	if token.AccessToken != "frag-tok" {
		t.Errorf("token = %+v", token)
	}
	if f := last(); f.Get("code") != "fragment-code" {
		t.Errorf("fragment code not exchanged: %v", f)
	}
}

// TestManualFlowMissingState: a code with no state at all is rejected as a
// missing callback (never silently accepted).
func TestManualFlowMissingState(t *testing.T) {
	mf, err := NewManualFlow(pkceCfg("https://auth.example.test", "https://token.example.test"))
	if err != nil {
		t.Fatal(err)
	}
	pasted := mf.Config().RedirectURI + "?code=abc"
	_, err = mf.Complete(context.Background(), pasted)
	if !errors.Is(err, ErrMissingCallback) {
		t.Fatalf("want ErrMissingCallback, got %v", err)
	}
}
