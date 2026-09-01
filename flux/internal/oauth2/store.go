package oauth2

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"sync"

	keyring "flux/internal/keyring"
)

// keyringService namespaces this app's entries in the OS keychain
// (Keychain / Credential Manager / libsecret), mirroring how the rest of the
// app uses go-keyring (internal/crypto, internal/git, ...).
const keyringService = "reqit-oauth2"

// TokenRecord is the persisted OAuth token pair. ExpiresAtMs is the Unix
// epoch in milliseconds — the same unit the renderer uses (Date.now()), so
// expiry checks never mix seconds and milliseconds.
type TokenRecord struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken,omitempty"`
	TokenType    string `json:"tokenType"`
	Scope        string `json:"scope,omitempty"`
	ExpiresAtMs  int64  `json:"expiresAtMs"`
	IDToken      string `json:"idToken,omitempty"`
}

// Expired reports whether the record is expired or within skewMs of expiry.
func (t *TokenRecord) Expired(nowMs, skewMs int64) bool {
	return t == nil || t.ExpiresAtMs == 0 || nowMs+skewMs >= t.ExpiresAtMs
}

// ErrTokenNotFound is returned when no keychain entry exists for a ref.
var ErrTokenNotFound = errors.New("oauth2: no stored token for this reference")

var (
	wsMu        sync.RWMutex
	activeWSKey string
)

// SetWorkspaceKey sets the workspace identity used to derive keyring keys.
// Called on workspace mount and switch (app.mountWorkspace).
func SetWorkspaceKey(key string) {
	wsMu.Lock()
	defer wsMu.Unlock()
	activeWSKey = key
}

// CurrentWorkspaceKey returns the active workspace identity ("" if unset).
func CurrentWorkspaceKey() string {
	wsMu.RLock()
	defer wsMu.RUnlock()
	return activeWSKey
}

// WorkspaceKeyFromDir derives a stable, non-secret workspace identifier from
// the workspace directory path. Stable across restarts; used as the workspace
// component of keyring keys (same convention as internal/git's PAT keys).
func WorkspaceKeyFromDir(dir string) string {
	if dir == "" {
		return "default"
	}
	sum := sha256.Sum256([]byte(dir))
	return hex.EncodeToString(sum[:8]) // 16 hex chars
}

// NewTokenRef returns a fresh, cryptographically random token reference. The
// ref is NOT secret — it only names a keychain entry — so it may be stored in
// the (git-tracked) collection JSON.
func NewTokenRef() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return "tok_" + hex.EncodeToString(b)
}

// HostFromURL returns the hostname component of a provider URL, or "unknown"
// when it cannot be determined. Used to scope keyring keys per provider.
func HostFromURL(raw string) string {
	if raw == "" {
		return "unknown"
	}
	u, err := url.Parse(raw)
	if err != nil || u.Hostname() == "" {
		return "unknown"
	}
	return u.Hostname()
}

// key builds the keyring entry name: reqit:{workspace}:{ref}:{providerHost}.
func key(wsKey, ref, host string) string {
	if wsKey == "" {
		wsKey = CurrentWorkspaceKey()
	}
	if wsKey == "" {
		wsKey = "default"
	}
	return "reqit:" + wsKey + ":" + ref + ":" + host
}

// SaveToken stores (or updates) a token record in the OS keychain.
// wsKey may be empty to use the active workspace key.
func SaveToken(wsKey, ref, host string, rec *TokenRecord) error {
	if ref == "" {
		return fmt.Errorf("oauth2: cannot store token without a reference")
	}
	if rec == nil || (rec.AccessToken == "" && rec.RefreshToken == "") {
		return fmt.Errorf("oauth2: cannot store an empty token")
	}
	data, err := json.Marshal(rec)
	if err != nil {
		return fmt.Errorf("oauth2: marshal token record: %w", err)
	}
	if err := keyring.Set(keyringService, key(wsKey, ref, host), string(data)); err != nil {
		return fmt.Errorf("oauth2: keychain write failed: %w", err)
	}
	return nil
}

// LoadToken reads a token record from the OS keychain.
func LoadToken(wsKey, ref, host string) (*TokenRecord, error) {
	if ref == "" {
		return nil, ErrTokenNotFound
	}
	raw, err := keyring.Get(keyringService, key(wsKey, ref, host))
	if err != nil {
		if errors.Is(err, keyring.ErrNotFound) {
			return nil, ErrTokenNotFound
		}
		return nil, fmt.Errorf("oauth2: keychain read failed: %w", err)
	}
	var rec TokenRecord
	if err := json.Unmarshal([]byte(raw), &rec); err != nil {
		return nil, fmt.Errorf("oauth2: parse token record: %w", err)
	}
	if rec.AccessToken == "" && rec.RefreshToken == "" {
		return nil, ErrTokenNotFound
	}
	return &rec, nil
}

// SaveClientSecret stores a confidential client's secret in the OS keychain,
// keyed by the same (workspace, ref, host) as its tokens. Never persists in
// git-tracked files.
func SaveClientSecret(wsKey, ref, host, secret string) error {
	if ref == "" {
		return fmt.Errorf("oauth2: cannot store client secret without a reference")
	}
	if secret == "" {
		return fmt.Errorf("oauth2: cannot store an empty client secret")
	}
	if err := keyring.Set(keyringService, key(wsKey, ref, host)+":secret", secret); err != nil {
		return fmt.Errorf("oauth2: keychain write failed: %w", err)
	}
	return nil
}

// LoadClientSecret reads a confidential client's secret from the OS keychain.
func LoadClientSecret(wsKey, ref, host string) (string, error) {
	if ref == "" {
		return "", ErrTokenNotFound
	}
	raw, err := keyring.Get(keyringService, key(wsKey, ref, host)+":secret")
	if err != nil {
		if errors.Is(err, keyring.ErrNotFound) {
			return "", ErrTokenNotFound
		}
		return "", fmt.Errorf("oauth2: keychain read failed: %w", err)
	}
	if raw == "" {
		return "", ErrTokenNotFound
	}
	return raw, nil
}

// DeleteToken removes a token record and any client secret from the OS
// keychain for the given ref.
func DeleteToken(wsKey, ref, host string) error {
	if ref == "" {
		return nil
	}
	for _, k := range []string{key(wsKey, ref, host), key(wsKey, ref, host) + ":secret"} {
		if err := keyring.Delete(keyringService, k); err != nil && !errors.Is(err, keyring.ErrNotFound) {
			return fmt.Errorf("oauth2: keychain delete failed: %w", err)
		}
	}
	return nil
}

// ResolveStoredToken returns the stored access token for ref, resolving the
// provider host from the token URL, scoped to the active workspace. Used by
// the request pipeline (requester, scheduler, runner) so tokens are attached
// from the keychain rather than from git-tracked payloads.
func ResolveStoredToken(tokenRef, tokenURL string) (accessToken, tokenType string, ok bool) {
	if tokenRef == "" {
		return "", "", false
	}
	rec, err := LoadToken(CurrentWorkspaceKey(), tokenRef, HostFromURL(tokenURL))
	if err != nil {
		return "", "", false
	}
	return rec.AccessToken, rec.TokenType, true
}
