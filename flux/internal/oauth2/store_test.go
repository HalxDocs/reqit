package oauth2

import (
	"os"
	"testing"

	"github.com/zalando/go-keyring"
)

// TestMain swaps in go-keyring's in-memory mock so tests never touch the
// real OS keychain.
func TestMain(m *testing.M) {
	keyring.MockInit()
	os.Exit(m.Run())
}

func TestSaveLoadDeleteTokenRoundTrip(t *testing.T) {
	SetWorkspaceKey("ws-store-test")
	defer SetWorkspaceKey("")

	ref := NewTokenRef()
	rec := &TokenRecord{
		AccessToken:  "at-1",
		RefreshToken: "rt-1",
		TokenType:    "Bearer",
		Scope:        "repo user",
		ExpiresAtMs:  1700000000000,
	}
	if err := SaveToken("", ref, "github.com", rec); err != nil {
		t.Fatal(err)
	}

	got, err := LoadToken("", ref, "github.com")
	if err != nil {
		t.Fatal(err)
	}
	if got.AccessToken != "at-1" || got.RefreshToken != "rt-1" || got.TokenType != "Bearer" {
		t.Errorf("round-trip mismatch: %+v", got)
	}
	if got.ExpiresAtMs != 1700000000000 {
		t.Errorf("ExpiresAtMs = %d", got.ExpiresAtMs)
	}

	// Provider host is part of the key: same ref, different host → not found.
	if _, err := LoadToken("", ref, "gitlab.com"); err != ErrTokenNotFound {
		t.Errorf("expected ErrTokenNotFound for other host, got %v", err)
	}

	if err := DeleteToken("", ref, "github.com"); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadToken("", ref, "github.com"); err != ErrTokenNotFound {
		t.Errorf("expected ErrTokenNotFound after delete, got %v", err)
	}
}

// TestSaveTokenValidatesInput: an empty token or ref must never reach the
// keychain.
func TestSaveTokenValidatesInput(t *testing.T) {
	if err := SaveToken("", "", "github.com", &TokenRecord{AccessToken: "x"}); err == nil {
		t.Error("empty ref should be rejected")
	}
	if err := SaveToken("", "ref", "github.com", &TokenRecord{}); err == nil {
		t.Error("empty token should be rejected")
	}
	if err := SaveToken("", "ref", "github.com", nil); err == nil {
		t.Error("nil record should be rejected")
	}
}

func TestNewTokenRef(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 50; i++ {
		r := NewTokenRef()
		if len(r) != len("tok_")+24 {
			t.Errorf("unexpected ref length: %q", r)
		}
		if seen[r] {
			t.Errorf("duplicate ref: %q", r)
		}
		seen[r] = true
	}
}

func TestHostFromURL(t *testing.T) {
	cases := []struct{ in, want string }{
		{"https://github.com/login/oauth/access_token", "github.com"},
		{"http://127.0.0.1:7317/callback", "127.0.0.1"},
		{"https://login.microsoftonline.com/abc/token", "login.microsoftonline.com"},
		{"", "unknown"},
		{"not a url", "unknown"},
		{"://broken", "unknown"},
	}
	for _, c := range cases {
		if got := HostFromURL(c.in); got != c.want {
			t.Errorf("HostFromURL(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestWorkspaceKeyFromDir(t *testing.T) {
	a := WorkspaceKeyFromDir("/ws/alpha")
	b := WorkspaceKeyFromDir("/ws/alpha")
	c := WorkspaceKeyFromDir("/ws/beta")
	if a != b {
		t.Errorf("same dir should give same key: %q vs %q", a, b)
	}
	if a == c {
		t.Errorf("different dirs should give different keys: %q", a)
	}
	if WorkspaceKeyFromDir("") != "default" {
		t.Error("empty dir should map to the default key")
	}
}

func TestResolveStoredToken(t *testing.T) {
	SetWorkspaceKey("ws-resolve-test")
	defer SetWorkspaceKey("")

	ref := NewTokenRef()
	if err := SaveToken("", ref, "github.com", &TokenRecord{AccessToken: "at-x", TokenType: "bearer"}); err != nil {
		t.Fatal(err)
	}

	tok, tt, ok := ResolveStoredToken(ref, "https://github.com/login/oauth/access_token")
	if !ok || tok != "at-x" || tt != "bearer" {
		t.Errorf("ResolveStoredToken = (%q, %q, %v)", tok, tt, ok)
	}

	if _, _, ok := ResolveStoredToken("missing-ref", "https://github.com/x"); ok {
		t.Error("unknown ref should not resolve")
	}
	if _, _, ok := ResolveStoredToken("", "https://github.com/x"); ok {
		t.Error("empty ref should not resolve")
	}
}

// TestTokenRecordExpired: ms-based expiry with a skew buffer.
func TestTokenRecordExpired(t *testing.T) {
	now := int64(1_700_000_000_000)
	fresh := &TokenRecord{AccessToken: "t", ExpiresAtMs: now + 3600_000}
	if fresh.Expired(now, 60_000) {
		t.Error("fresh token should not be expired")
	}
	withinSkew := &TokenRecord{AccessToken: "t", ExpiresAtMs: now + 30_000}
	if !withinSkew.Expired(now, 60_000) {
		t.Error("token inside the skew buffer should count as expired")
	}
	expired := &TokenRecord{AccessToken: "t", ExpiresAtMs: now - 1}
	if !expired.Expired(now, 0) {
		t.Error("expired token should report expired")
	}
	noExpiry := &TokenRecord{AccessToken: "t"}
	if !noExpiry.Expired(now, 60_000) {
		t.Error("token without expiry should be treated as expired")
	}
}
