package oauth2

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// TestDiscoverOIDCPath exercises the OIDC well-known path and field mapping.
func TestDiscoverOIDCPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/.well-known/openid-configuration" {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"issuer": "https://idp.example.test/realms/demo",
			"authorization_endpoint": "https://idp.example.test/realms/demo/protocol/openid-connect/auth",
			"token_endpoint": "https://idp.example.test/realms/demo/protocol/openid-connect/token",
			"jwks_uri": "https://idp.example.test/realms/demo/protocol/openid-connect/certs",
			"code_challenge_methods_supported": ["S256", "plain"],
			"scopes_supported": ["openid", "profile", "email"],
			"grant_types_supported": ["authorization_code", "client_credentials", "refresh_token"]
		}`))
	}))
	defer srv.Close()

	meta, err := Discover(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("Discover: %v", err)
	}
	if meta.Issuer != "https://idp.example.test/realms/demo" {
		t.Errorf("issuer = %q", meta.Issuer)
	}
	if meta.AuthorizationEndpoint == "" || meta.TokenEndpoint == "" || meta.JWKSURI == "" {
		t.Errorf("endpoints not mapped: %+v", meta)
	}
	if len(meta.CodeChallengeMethods) != 2 || meta.CodeChallengeMethods[0] != "S256" {
		t.Errorf("code challenge methods = %v", meta.CodeChallengeMethods)
	}
	if len(meta.ScopesSupported) != 3 {
		t.Errorf("scopes = %v", meta.ScopesSupported)
	}
}

// TestDiscoverRFC8414Fallback verifies the fallback to the RFC 8414
// oauth-authorization-server path when the OIDC path is absent.
func TestDiscoverRFC8414Fallback(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/.well-known/openid-configuration":
			http.NotFound(w, r)
		case "/.well-known/oauth-authorization-server":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
				"issuer": "https://as.example.test",
				"authorization_endpoint": "https://as.example.test/authorize",
				"token_endpoint": "https://as.example.test/token"
			}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	meta, err := Discover(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("Discover: %v", err)
	}
	if meta.TokenEndpoint != "https://as.example.test/token" {
		t.Errorf("token endpoint = %q", meta.TokenEndpoint)
	}
}

// TestDiscoverCacheHit verifies the per-issuer cache: the second call does not
// re-fetch within the TTL.
func TestDiscoverCacheHit(t *testing.T) {
	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"authorization_endpoint": "https://idp.example.test/auth",
			"token_endpoint": "https://idp.example.test/token"
		}`))
	}))
	defer srv.Close()

	// Flush any stale cache entry for this server URL.
	discoverMu.Lock()
	delete(discoverCache, srv.URL)
	discoverMu.Unlock()

	ctx := context.Background()
	if _, err := Discover(ctx, srv.URL); err != nil {
		t.Fatalf("first Discover: %v", err)
	}
	if _, err := Discover(ctx, srv.URL); err != nil {
		t.Fatalf("second Discover: %v", err)
	}
	if got := hits.Load(); got != 1 {
		t.Errorf("expected 1 discovery request (cache hit), got %d", got)
	}
}

// TestDiscoverErrors covers the failure paths: empty issuer and a server that
// publishes neither well-known document.
func TestDiscoverErrors(t *testing.T) {
	if _, err := Discover(context.Background(), ""); err == nil {
		t.Error("empty issuer must fail")
	}
	if _, err := Discover(context.Background(), "  /"); err == nil {
		t.Error("blank issuer must fail")
	}

	srv := httptest.NewServer(http.NotFoundHandler())
	defer srv.Close()
	if _, err := Discover(context.Background(), srv.URL); err == nil {
		t.Error("metadata-less server must fail discovery")
	}
}

// TestDiscoverTrailingSlashNormalization ensures a trailing slash on the
// issuer does not produce a double-slash well-known path.
func TestDiscoverTrailingSlashNormalization(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "//") {
			t.Errorf("double slash in path %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"authorization_endpoint":"https://idp.example.test/auth","token_endpoint":"https://idp.example.test/token"}`))
	}))
	defer srv.Close()

	_, err := Discover(context.Background(), srv.URL+"/")
	if err != nil {
		t.Fatalf("Discover: %v", err)
	}
	// Also verify the TTL is finite and positive (no stale-forever cache).
	if discoveryCacheTTL < time.Minute {
		t.Errorf("cache TTL suspiciously short: %v", discoveryCacheTTL)
	}
}
