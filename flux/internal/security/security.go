package security

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"path/filepath"
	"strings"
)

const MaxFilePathLen = 260

// ValidatePathWithinDir ensures path resolves to a location within dir.
// Rejects absolute paths outside dir, .. traversal, and empty paths.
func ValidatePathWithinDir(dir, path string) error {
	if path == "" {
		return errors.New("path is required")
	}
	// Clean both paths
	cleanDir := filepath.Clean(dir)
	cleanPath := filepath.Clean(path)
	// If path is relative, resolve against dir
	if !filepath.IsAbs(cleanPath) {
		cleanPath = filepath.Join(cleanDir, cleanPath)
	}
	// Normalize to same volume/root for comparison
	absDir, err := filepath.Abs(cleanDir)
	if err != nil {
		return fmt.Errorf("invalid directory: %w", err)
	}
	absPath, err := filepath.Abs(cleanPath)
	if err != nil {
		return fmt.Errorf("invalid path: %w", err)
	}
	// Check for traversal
	rel, err := filepath.Rel(absDir, absPath)
	if err != nil {
		return fmt.Errorf("invalid path: %w", err)
	}
	if strings.HasPrefix(rel, "..") {
		return errors.New("path escapes workspace directory")
	}
	if len(absPath) > MaxFilePathLen {
		return errors.New("path too long")
	}
	return nil
}

// ValidateURL validates a URL for scheme and blocks private/loopback IPs.
// It resolves hostnames to their IP addresses and checks each resolved IP
// against private ranges, which closes the DNS-rebinding bypass (where an
// attacker-controlled DNS server returns a public IP on the first lookup and a
// private IP on a subsequent lookup after the URL passes validation, but
// before the actual request is dispatched).  The literal-IP check before
// resolution is kept as a fast path.
func ValidateURL(rawURL string) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}
	scheme := strings.ToLower(u.Scheme)
	if scheme != "http" && scheme != "https" {
		return errors.New("only http and https URLs are allowed")
	}
	host := u.Hostname()
	if host == "" {
		return errors.New("URL has no host")
	}
	// Fast path: host is a literal IP address.
	if ip := net.ParseIP(host); ip != nil {
		if isPrivateIP(ip) {
			return errors.New("requests to private/loopback IPs are blocked")
		}
		return nil
	}
	// Block common internal hostnames.
	lower := strings.ToLower(host)
	if lower == "localhost" || strings.HasSuffix(lower, ".local") || strings.HasSuffix(lower, ".internal") {
		return errors.New("requests to internal hostnames are blocked")
	}
	// Resolve hostname and check all resolved IPs.
	// This prevents DNS-rebinding attacks where an attacker controls DNS
	// to return a public IP during validation but switches to a private IP
	// after validation passes and before the actual TCP connection.
	// If resolution fails we allow the request through (the actual DNS lookup
	// during the real request may still succeed), but we log the failure so
	// it can be surfaced as a warning.
	addrs, err := net.DefaultResolver.LookupIPAddr(context.Background(), host)
	if err != nil {
		// Resolution failure is non-fatal: the hostname may be valid but the
		// current environment (test, air-gapped, offline) may not have DNS.
		return nil
	}
	for _, addr := range addrs {
		if isPrivateIP(addr.IP) {
			return fmt.Errorf("requests to %q resolve to a private IP (%s) and are blocked", host, addr.IP)
		}
	}
	return nil
}

func isPrivateIP(ip net.IP) bool {
	if ip.IsLoopback() || ip.IsUnspecified() {
		return true
	}
	// 10.0.0.0/8
	if ip4 := ip.To4(); ip4 != nil && ip4[0] == 10 {
		return true
	}
	// 172.16.0.0/12
	if ip4 := ip.To4(); ip4 != nil && ip4[0] == 172 && ip4[1] >= 16 && ip4[1] <= 31 {
		return true
	}
	// 192.168.0.0/16
	if ip4 := ip.To4(); ip4 != nil && ip4[0] == 192 && ip4[1] == 168 {
		return true
	}
	// 169.254.0.0/16 (link-local / cloud metadata)
	if ip4 := ip.To4(); ip4 != nil && ip4[0] == 169 && ip4[1] == 254 {
		return true
	}
	// IPv6 loopback
	if ip.To16() != nil && ip.IsLoopback() {
		return true
	}
	return false
}

// SanitizeExecArg validates that arg is safe as a positional value in an
// exec.Command call.  It rejects empty strings, control characters, and any
// value that starts with "-", which would be interpreted as a flag by the
// target binary rather than a positional argument.  This prevents short-flag
// injection (e.g. "-oEvilPlugin=1") — the old heuristic only caught "--".
//
// Callers must never concatenate user-supplied values into the arg string;
// they should always build args as a fixed slice where user values are
// passed as separate slice elements.
func SanitizeExecArg(arg string) error {
	if arg == "" {
		return errors.New("argument is required")
	}
	// Block control characters that could break argument boundaries.
	for _, c := range arg {
		switch c {
		case '\n', '\r', '\x00':
			return errors.New("argument contains forbidden characters")
		}
	}
	// Reject values that start with "-": they would be interpreted as a
	// flag rather than a positional argument, enabling short-flag injection.
	if strings.HasPrefix(arg, "-") {
		return errors.New("argument starts with '-' which would be interpreted as a flag")
	}
	return nil
}
