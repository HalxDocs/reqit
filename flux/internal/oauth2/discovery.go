package oauth2

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// DiscoveryMetadata is the subset of RFC 8414 / OIDC Discovery metadata the
// engine consumes. Unknown fields in the response are ignored.
type DiscoveryMetadata struct {
	Issuer                      string   `json:"issuer"`
	AuthorizationEndpoint       string   `json:"authorization_endpoint"`
	TokenEndpoint               string   `json:"token_endpoint"`
	DeviceAuthorizationEndpoint string   `json:"device_authorization_endpoint"`
	JWKSURI                     string   `json:"jwks_uri"`
	CodeChallengeMethods        []string `json:"code_challenge_methods_supported"`
	ScopesSupported             []string `json:"scopes_supported"`
	GrantTypesSupported         []string `json:"grant_types_supported"`
}

// discoveryCacheTTL bounds how long metadata is reused so a changed server
// configuration is picked up within a few minutes without re-fetching on
// every flow.
const discoveryCacheTTL = 5 * time.Minute

var (
	discoverMu    sync.Mutex
	discoverCache = map[string]discoverEntry{}
)

type discoverEntry struct {
	meta    DiscoveryMetadata
	expires time.Time
}

// Discover fetches authorization server metadata for issuer (RFC 8414 / OIDC
// Discovery): the OIDC well-known path is tried first, with the RFC 8414
// oauth-authorization-server path as a fallback for servers that only publish
// that variant. Successful results are cached per issuer for 5 minutes.
func Discover(ctx context.Context, issuer string) (*DiscoveryMetadata, error) {
	issuer = strings.TrimRight(issuer, "/")
	if issuer == "" {
		return nil, InvalidConfigError("discover", "issuer is required")
	}

	discoverMu.Lock()
	if e, ok := discoverCache[issuer]; ok && time.Now().Before(e.expires) {
		discoverMu.Unlock()
		meta := e.meta
		return &meta, nil
	}
	discoverMu.Unlock()

	var lastErr error
	for _, path := range []string{
		".well-known/openid-configuration",       // OIDC Discovery
		".well-known/oauth-authorization-server", // RFC 8414
	} {
		meta, err := discoverFetch(ctx, issuer, path)
		if err != nil {
			lastErr = err
			continue
		}
		if meta.AuthorizationEndpoint == "" || meta.TokenEndpoint == "" {
			lastErr = fmt.Errorf("oauth2: discovery metadata for %s missing authorization_endpoint or token_endpoint", issuer)
			continue
		}
		discoverMu.Lock()
		discoverCache[issuer] = discoverEntry{meta: *meta, expires: time.Now().Add(discoveryCacheTTL)}
		discoverMu.Unlock()
		return meta, nil
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("oauth2: discovery failed for %s", issuer)
	}
	return nil, lastErr
}

// discoverFetch GETs one well-known metadata document and decodes it.
func discoverFetch(ctx context.Context, issuer, path string) (*DiscoveryMetadata, error) {
	u := issuer + "/" + path
	req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
	if err != nil {
		return nil, fmt.Errorf("oauth2: build discovery request for %s: %w", u, err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "reqit-oauth2-discovery")

	resp, err := tokenClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("oauth2: discovery request to %s failed: %w", u, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("oauth2: discovery %s returned %s", u, http.StatusText(resp.StatusCode))
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("oauth2: read discovery response from %s: %w", u, err)
	}
	var meta DiscoveryMetadata
	if err := json.Unmarshal(body, &meta); err != nil {
		return nil, fmt.Errorf("oauth2: parse discovery response from %s: %w", u, err)
	}
	if meta.Issuer == "" {
		meta.Issuer = issuer
	}
	return &meta, nil
}
