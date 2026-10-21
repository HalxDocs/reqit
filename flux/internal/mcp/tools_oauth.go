package mcp

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"
)

func handleOAuthDiscover() ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Issuer string `json:"issuer"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return "", err
		}
		if p.Issuer == "" {
			return "", fmt.Errorf("issuer is required, e.g. https://accounts.google.com")
		}
		// Use internal oauth2 discovery directly
		// Lazy import to avoid cycle — we import here via a helper that shells out to the engine
		// Instead, do a raw well-known fetch so this tool works even without the full engine wired.
		meta, err := discoverGeneric(p.Issuer)
		if err != nil {
			return "", err
		}
		b, _ := json.MarshalIndent(meta, "", "  ")
		return string(b), nil
	}
}

func discoverGeneric(issuer string) (map[string]any, error) {
	// Try both OIDC and RFC 8414 well-known paths.
	issuer = strings.TrimRight(issuer, "/")
	paths := []string{
		issuer + "/.well-known/openid-configuration",
		issuer + "/.well-known/oauth-authorization-server",
	}
	var lastErr error
	for _, u := range paths {
		resp, err := httpGetJSON(u)
		if err != nil {
			lastErr = err
			continue
		}
		if resp["authorization_endpoint"] != nil && resp["token_endpoint"] != nil {
			resp["issuer"] = issuer
			return resp, nil
		}
		lastErr = fmt.Errorf("discovery at %s missing endpoints", u)
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("discovery failed for %s", issuer)
	}
	return nil, lastErr
}

func httpGetJSON(u string) (map[string]any, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("%s returned %d", u, resp.StatusCode)
	}
	var m map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&m); err != nil {
		return nil, err
	}
	return m, nil
}

func handleOAuthDiagnoseLoopback() ToolHandler {
	return func(args json.RawMessage) (string, error) {
		// We can't run the full Go diagnose (needs browser) in a headless MCP call,
		// so we do the part OpenCode can verify: can we bind a loopback listener?
		ln, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			return "", fmt.Errorf("loopback bind failed: %w — another process may hold the loopback port. Try a fixed port like 127.0.0.1:7317", err)
		}
		port := ln.Addr().(*net.TCPAddr).Port
		ln.Close()
		return fmt.Sprintf("loopback OK — 127.0.0.1:%d is free. The OS browser should be able to reach http://127.0.0.1:%d/callback . If the browser shows 'This site can't be reached', check firewall/proxy or try --http mode.", port, port), nil
	}
}
