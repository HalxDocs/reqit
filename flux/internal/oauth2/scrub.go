package oauth2

import (
	"encoding/json"
	"fmt"
	"strings"
)

// AuthValue JSON blobs (RequestPayload.AuthValue when AuthType == "oauth2")
// must never contain live secrets once they reach disk. This file owns the
// boundary: it extracts embedded tokens/client secrets into the OS keychain
// (migration), produces secret-free blobs for persistence, and re-attaches
// tokens transiently for the renderer.

// Secret keys that must never be written to a git-tracked file.
var secretBlobKeys = []string{"accessToken", "refreshToken", "clientSecret"}

// StripAuthValue removes any embedded secrets from an OAuth2 authValue JSON
// blob without touching the keychain. Returns the sanitized blob and whether
// anything was removed. Non-secret fields are preserved verbatim, so config
// (URLs, clientId, scopes, redirectUri, usePkce, tokenRef) round-trips.
func StripAuthValue(authValue string) (string, bool) {
	if authValue == "" {
		return authValue, false
	}
	m, ok := parseBlob(authValue)
	if !ok {
		return authValue, false
	}
	changed := false
	for _, k := range secretBlobKeys {
		if s, exists := m[k]; exists {
			if str, isStr := s.(string); isStr && str != "" {
				delete(m, k)
				changed = true
			}
		}
	}
	if !changed {
		return authValue, false
	}
	out, err := json.Marshal(m)
	if err != nil {
		return authValue, false
	}
	return string(out), true
}

// MigrateAuthValue moves any embedded OAuth secrets out of the blob into the
// OS keychain and returns a secret-free blob carrying the tokenRef. Returns
// changed=true when secrets were found.
//
// Keying: the provider host is derived from the blob's tokenUrl (or
// deviceUrl), and the ref is the blob's existing tokenRef or a freshly
// generated one. The tokenRef is stored back into the blob so payloads and
// keychain entries stay linked across saves.
//
// If the keychain write fails, the blob is returned UNCHANGED (with secrets
// still embedded) along with the error, so callers can decide whether to
// preserve data (load path) or strip anyway (save path). Never assume a
// keychain failure is silently fine.
func MigrateAuthValue(authValue, wsKey string) (clean string, changed bool, err error) {
	if authValue == "" {
		return authValue, false, nil
	}
	m, ok := parseBlob(authValue)
	if !ok {
		// Not JSON — the raw-token form (e.g. Postman imports store the access
		// token verbatim in AuthValue). Migrate it to the keychain and return a
		// minimal ref-only blob so the payload stays secret-free and requests
		// keep resolving their token via tokenRef.
		if strings.TrimSpace(authValue) == "" {
			return authValue, false, nil
		}
		ref := NewTokenRef()
		if err := SaveToken(wsKey, ref, "unknown", &TokenRecord{AccessToken: authValue}); err != nil {
			return authValue, false, err
		}
		clean, err := json.Marshal(map[string]any{"tokenRef": ref})
		if err != nil {
			return authValue, false, fmt.Errorf("oauth2: marshal sanitized auth value: %w", err)
		}
		return string(clean), true, nil
	}

	access := str(m, "accessToken")
	refresh := str(m, "refreshToken")
	clientSecret := str(m, "clientSecret")
	if access == "" && refresh == "" && clientSecret == "" {
		return authValue, false, nil
	}

	tokenURL := str(m, "tokenUrl")
	if tokenURL == "" {
		tokenURL = str(m, "deviceUrl")
	}
	host := HostFromURL(tokenURL)

	ref := str(m, "tokenRef")
	if ref == "" {
		ref = NewTokenRef()
		m["tokenRef"] = ref
	}

	if clientSecret != "" {
		if err := SaveClientSecret(wsKey, ref, host, clientSecret); err != nil {
			return authValue, false, err
		}
	}
	if access != "" || refresh != "" {
		rec := &TokenRecord{
			AccessToken:  access,
			RefreshToken: refresh,
			TokenType:    str(m, "tokenType"),
			Scope:        str(m, "scope"),
			ExpiresAtMs:  expiresAtMs(m),
			IDToken:      str(m, "idToken"),
		}
		if err := SaveToken(wsKey, ref, host, rec); err != nil {
			return authValue, false, err
		}
	}

	for _, k := range secretBlobKeys {
		delete(m, k)
	}
	out, err := json.Marshal(m)
	if err != nil {
		return authValue, false, fmt.Errorf("oauth2: marshal sanitized auth value: %w", err)
	}
	return string(out), true, nil
}

// SanitizeAuthValueForExport returns a secret-free AuthValue for exporting a
// collection to another tool (Postman, Insomnia, Hoppscotch, OpenAPI, docs).
// JSON blobs lose their embedded secrets (config + tokenRef survive so the
// exported auth remains usable); raw-token forms are cleared entirely — a live
// token must never leave reqit inside an exported file.
func SanitizeAuthValueForExport(authValue string) string {
	if authValue == "" {
		return ""
	}
	if clean, ok := StripAuthValue(authValue); ok {
		return clean
	}
	// Still valid JSON → it was already secret-free; keep the config.
	var probe any
	if json.Unmarshal([]byte(authValue), &probe) == nil {
		return authValue
	}
	// Raw token (e.g. Postman-imported oauth2) — never export it.
	return ""
}

// RehydrateAuthValue attaches the stored token from the keychain to a
// sanitized authValue blob, for transient use by the renderer. The result is
// never persisted. Returns the enriched blob and whether it changed.
func RehydrateAuthValue(authValue, wsKey string) (string, bool) {
	if authValue == "" {
		return authValue, false
	}
	m, ok := parseBlob(authValue)
	if !ok {
		return authValue, false
	}
	if str(m, "accessToken") != "" {
		return authValue, false // already carries a token
	}
	ref := str(m, "tokenRef")
	if ref == "" {
		return authValue, false
	}
	tokenURL := str(m, "tokenUrl")
	if tokenURL == "" {
		tokenURL = str(m, "deviceUrl")
	}
	rec, err := LoadToken(wsKey, ref, HostFromURL(tokenURL))
	if err != nil {
		return authValue, false
	}
	m["accessToken"] = rec.AccessToken
	if rec.TokenType != "" {
		m["tokenType"] = rec.TokenType
	}
	if rec.RefreshToken != "" {
		m["refreshToken"] = rec.RefreshToken
	}
	if rec.Scope != "" {
		m["scope"] = rec.Scope
	}
	if rec.ExpiresAtMs > 0 {
		// Milliseconds — the unit the renderer compares against Date.now().
		m["expiresAt"] = rec.ExpiresAtMs
	}
	if rec.IDToken != "" {
		m["idToken"] = rec.IDToken
	}
	out, err := json.Marshal(m)
	if err != nil {
		return authValue, false
	}
	return string(out), true
}

// --- helpers ---------------------------------------------------------------

func parseBlob(authValue string) (map[string]any, bool) {
	m := map[string]any{}
	if err := json.Unmarshal([]byte(authValue), &m); err != nil {
		return nil, false
	}
	return m, true
}

func str(m map[string]any, k string) string {
	if s, ok := m[k].(string); ok {
		return s
	}
	return ""
}

// expiresAtMs normalizes the blob's expiry to milliseconds. Legacy blobs
// stored Unix seconds (Go's time.Now().Unix()); newer ones may already be ms.
func expiresAtMs(m map[string]any) int64 {
	var v int64
	switch n := m["expiresAtMs"].(type) {
	case float64:
		v = int64(n)
	case int64:
		v = n
	}
	if v > 0 {
		return v
	}
	switch n := m["expiresAt"].(type) {
	case float64:
		v = int64(n)
	case int64:
		v = n
	}
	if v <= 0 {
		return 0
	}
	if v > 1e12 {
		return v // already milliseconds
	}
	return v * 1000 // seconds → milliseconds
}
