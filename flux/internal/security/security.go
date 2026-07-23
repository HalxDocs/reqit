package security

import (
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
	// Block loopback and private IPs
	if ip := net.ParseIP(host); ip != nil {
		if isPrivateIP(ip) {
			return errors.New("requests to private/loopback IPs are blocked")
		}
	} else {
		// Block common internal hostnames
		lower := strings.ToLower(host)
		if lower == "localhost" || strings.HasSuffix(lower, ".local") || strings.HasSuffix(lower, ".internal") {
			return errors.New("requests to internal hostnames are blocked")
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

// SanitizeExecArg rejects dangerous characters in exec.Command arguments.
func SanitizeExecArg(arg string) error {
	if arg == "" {
		return errors.New("argument is required")
	}
	// Block newlines, carriage returns, null bytes, and argument injection flags
	for _, c := range arg {
		switch c {
		case '\n', '\r', '\x00':
			return errors.New("argument contains forbidden characters")
		}
	}
	// Block argument injection via --
	if strings.Contains(arg, "--") {
		return errors.New("argument contains forbidden flag injection")
	}
	return nil
}
