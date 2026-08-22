package oauth2

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"
)

// Entra endpoint is versioned per tenant; the tenant may be "organizations" or
// "common" for the public metadata endpoint, or a real tenant GUID for the
// credentialed flows.

// TestEntraDiscoveryMetadata runs OIDC discovery against a real Entra tenant
// and asserts the metadata the engine's flows consume. With
// TEST_ENTRA_TENANT=organizations this runs without any app registration — a
// genuinely credential-free live assertion.
//
// Real-provider finding (verified against login.microsoftonline.com): Entra's
// v2 metadata does NOT publish code_challenge_methods_supported or
// grant_types_supported, even though Entra supports S256 PKCE. The engine
// must therefore never treat an absent PKCE list as "PKCE unsupported" —
// NewAuthCodeFlow defaults to S256 independently of discovery. The assertion
// below locks that contract in.
func TestEntraDiscoveryMetadata(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping Entra smoke in -short mode")
	}
	tenant := os.Getenv("TEST_ENTRA_TENANT")
	if tenant == "" {
		t.Skip(`TEST_ENTRA_TENANT not set — set to "organizations" for the public metadata endpoint`)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	issuer := "https://login.microsoftonline.com/" + tenant + "/v2.0"
	meta, err := Discover(ctx, issuer)
	if err != nil {
		t.Fatalf("discovery against %s: %v", issuer, err)
	}
	if meta.Issuer == "" {
		t.Error("issuer missing from discovery metadata")
	}
	if meta.AuthorizationEndpoint == "" || meta.TokenEndpoint == "" {
		t.Errorf("missing endpoints: authorize=%q token=%q", meta.AuthorizationEndpoint, meta.TokenEndpoint)
	}
	if !strings.HasPrefix(meta.TokenEndpoint, "https://login.microsoftonline.com/") {
		t.Errorf("unexpected token endpoint %q", meta.TokenEndpoint)
	}
	// The acceptance contract: a missing PKCE-methods list must not be read
	// as "no PKCE" — Entra proves this by omitting the field while supporting
	// S256. The engine's PKCE default is S256 regardless of this list.
	t.Logf("Entra PKCE methods list is %v (absent is fine — engine defaults to S256)", meta.CodeChallengeMethods)
	if len(meta.CodeChallengeMethods) > 0 && !containsString(meta.CodeChallengeMethods, "S256") {
		t.Errorf("if Entra ever advertises PKCE methods, S256 must be among them, got %v", meta.CodeChallengeMethods)
	}
	t.Logf("discovery ok: authorize=%s token=%s", meta.AuthorizationEndpoint, meta.TokenEndpoint)
}

// TestEntraClientCredentialsSmoke is the live "Client Credentials works
// independently" acceptance criterion: a real client_credentials exchange
// against Entra's token endpoint in both client-auth modes (body and HTTP
// Basic), proving the token is a working JWT with a future expiry.
func TestEntraClientCredentialsSmoke(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping Entra smoke in -short mode")
	}
	tenant := os.Getenv("TEST_ENTRA_TENANT")
	clientID := os.Getenv("TEST_ENTRA_CLIENT_ID")
	secret := os.Getenv("TEST_ENTRA_CLIENT_SECRET")
	if tenant == "" || clientID == "" || secret == "" {
		t.Skip("TEST_ENTRA_TENANT / TEST_ENTRA_CLIENT_ID / TEST_ENTRA_CLIENT_SECRET not set (app with a client secret)")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cfg := OAuthConfig{
		GrantType:    GrantClientCredentials,
		TokenURL:     fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", tenant),
		ClientID:     clientID,
		Scopes:       "https://graph.microsoft.com/.default",
		Confidential: true,
	}

	tr, err := Exchange(ctx, cfg, ExchangeOptions{ClientSecret: secret})
	if err != nil {
		t.Fatalf("client_credentials (body auth): %v", err)
	}
	assertEntraAccessToken(t, tr, "body")

	cfg.ClientAuth = ClientAuthBasic
	tr2, err := Exchange(ctx, cfg, ExchangeOptions{ClientSecret: secret})
	if err != nil {
		t.Fatalf("client_credentials (HTTP Basic auth): %v", err)
	}
	assertEntraAccessToken(t, tr2, "basic")
}

func assertEntraAccessToken(t *testing.T, tr *TokenResult, mode string) {
	t.Helper()
	if tr.AccessToken == "" {
		t.Fatalf("[%s] no access token", mode)
	}
	if parts := strings.Split(tr.AccessToken, "."); len(parts) != 3 {
		t.Errorf("[%s] access token is not a JWT (%d segments)", mode, len(parts))
	}
	if tr.TokenType == "" || !strings.EqualFold(tr.TokenType, "Bearer") {
		t.Errorf("[%s] token type = %q", mode, tr.TokenType)
	}
	if tr.ExpiresAtMs <= time.Now().UnixMilli() {
		t.Errorf("[%s] expiry not in the future", mode)
	}
	if tr.Scope == "" {
		t.Errorf("[%s] scope missing", mode)
	}
}

// TestEntraPKCEWithoutClientSecret is the live form of the Hoppscotch/Azure
// acceptance criterion: a PKCE public-client exchange must pass client
// authentication with NO client_secret on the wire. The interactive login
// cannot be automated against Entra, so the smoke exchanges a deliberately
// fake code: Entra validates request shape before the code, so a well-formed
// PKCE request passes client auth and fails on the code (invalid_grant);
// a confidential-client request without its secret fails as invalid_client
// instead. Requires an app registered as a public client
// (allowPublicClientFlows) — no client secret involved.
func TestEntraPKCEWithoutClientSecret(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping Entra smoke in -short mode")
	}
	tenant := os.Getenv("TEST_ENTRA_TENANT")
	clientID := os.Getenv("TEST_ENTRA_PUBLIC_CLIENT_ID")
	if tenant == "" || clientID == "" {
		t.Skip("TEST_ENTRA_TENANT and TEST_ENTRA_PUBLIC_CLIENT_ID not set (public-client app registration, no secret)")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cfg := OAuthConfig{
		GrantType:   GrantAuthorizationCode,
		TokenURL:    fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", tenant),
		ClientID:    clientID,
		RedirectURI: "http://localhost/callback",
		PKCE:        PKCES256,
	}
	verifier, err := NewCodeVerifier()
	if err != nil {
		t.Fatal(err)
	}

	// Public client, PKCE verifier present, NO client_secret anywhere. The
	// engine's applyClientAuth never adds a secret for a non-confidential
	// client — if it did, Entra would answer invalid_client and this test
	// would catch the exact Hoppscotch-class bug.
	_, err = Exchange(ctx, cfg, ExchangeOptions{
		Code:         "definitely-not-a-real-code",
		CodeVerifier: verifier,
		RedirectURI:  cfg.RedirectURI,
	})
	if err == nil {
		t.Fatal("fake code must be rejected by the real token endpoint")
	}
	var oe *OAuthError
	if !errors.As(err, &oe) || oe.ProviderCode() == "" {
		t.Fatalf("want a verbatim provider error, got %v", err)
	}
	t.Logf("verbatim provider response: %v", err)
	if oe.ProviderCode() == "invalid_client" {
		t.Fatalf("client auth failed — the PKCE exchange must not require a client_secret (app must be registered as a public client): %v", err)
	}
	if !errors.Is(err, ErrProviderDenied) {
		t.Fatalf("want ErrProviderDenied, got %v", err)
	}
	// Entra rejects a bogus code with invalid_grant once the request shape
	// (PKCE verifier present, no secret needed) is accepted.
	if oe.ProviderCode() != "invalid_grant" {
		t.Errorf("expected invalid_grant for a fake code (client auth passed), got %q", oe.ProviderCode())
	}
	if !strings.Contains(oe.Error(), "AADSTS") {
		t.Errorf("expected a verbatim AADSTS error description, got %v", err)
	}
}

func containsString(haystack []string, needle string) bool {
	for _, s := range haystack {
		if s == needle {
			return true
		}
	}
	return false
}
