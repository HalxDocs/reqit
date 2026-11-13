package trust

import (
	"crypto/sha256"
	"encoding/hex"
	"net/url"
	"regexp"
	"strings"

	"flux/internal/models"
)

// Redaction rules. The receipt must be safe to commit to a repository, so the
// defaults are deliberately strict: a value is stored only when it cannot be a
// credential, and everything else is reduced to a marker or a hash.

// sensitiveName matches the names of query parameters and headers whose value
// is a credential.
var sensitiveName = regexp.MustCompile(`(?i)(token|secret|password|passwd|pwd|key|auth|signature|sig|credential|session|cookie|bearer|jwt)`)

// safeHeaderValue lists response and request headers whose values are useful
// to see and are not credentials. Everything else keeps only its name.
var safeHeaderValue = map[string]bool{
	"content-type":      true,
	"content-length":    true,
	"content-encoding":  true,
	"accept":            true,
	"accept-encoding":   true,
	"accept-language":   true,
	"user-agent":        true,
	"host":              true,
	"connection":        true,
	"cache-control":     true,
	"date":              true,
	"server":            true,
	"transfer-encoding": true,
	"x-request-id":      true,
	"x-correlation-id":  true,
	"x-trace-id":        true,
	"retry-after":       true,
}

const redactedValue = "«redacted»"

// previewLimit caps an optional body preview. Zero means previews are off.
const previewLimit = 8 * 1024

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return "sha256:" + hex.EncodeToString(sum[:])
}

// safeQueryValue lists query parameter names whose values are useful to see
// and are not credentials. Every other value is masked, so an innocuously
// named parameter such as ?id=sk_live_… cannot leak.
var safeQueryValue = map[string]bool{
	"page":        true,
	"per_page":    true,
	"perpage":     true,
	"limit":       true,
	"offset":      true,
	"size":        true,
	"sort":        true,
	"order":       true,
	"format":      true,
	"fields":      true,
	"include":     true,
	"expand":      true,
	"version":     true,
	"api_version": true,
	"lang":        true,
	"locale":      true,
	"timezone":    true,
	"pretty":      true,
	"dry_run":     true,
}

// secretPrefix matches the value shapes used by common credential types. It
// catches a secret even when the parameter name gives no hint.
var secretPrefix = regexp.MustCompile(`(?i)^(sk_live_|sk_test_|rk_live_|rk_test_|pk_live_|gh[pousr]_|github_pat_|xox[baprs]-|AKIA|ASIA|AIza|ya29\.|whsec_|SG\.|shpat_|glpat-|npm_|hf_|sk-ant-|eyJ)`)

// looksLikeSecret reports whether a bare value looks like a token. It is a
// heuristic, not a guarantee, which is why query values are masked by default
// and this only has to catch the remaining path segments.
func looksLikeSecret(value string) bool {
	if value == "" {
		return false
	}
	if secretPrefix.MatchString(value) {
		return true
	}
	if len(value) < 24 {
		return false
	}
	var upper, lower, digit, other bool
	for _, r := range value {
		switch {
		case r >= 'A' && r <= 'Z':
			upper = true
		case r >= 'a' && r <= 'z':
			lower = true
		case r >= '0' && r <= '9':
			digit = true
		case r == '-' || r == '_':
			// Common token separators.
		default:
			other = true
		}
	}
	return upper && lower && digit && !other
}

// redactPath masks path segments that look like credentials. Path segments are
// otherwise kept because they identify the endpoint.
func redactPath(path string) string {
	if path == "" || path == "/" {
		return path
	}
	segments := strings.Split(path, "/")
	for i, segment := range segments {
		if segment == "" || placeholderPattern.MatchString(segment) {
			continue
		}
		if looksLikeSecret(segment) {
			segments[i] = redactedValue
		}
	}
	return strings.Join(segments, "/")
}

// redactURL keeps the scheme, host, path and parameter names; masks path
// segments that look like credentials; and masks every query value except an
// allowlist of non-sensitive ones. Userinfo and the fragment are dropped.
func redactURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	if u.User != nil {
		u.User = nil
	}
	u.Path = redactPath(u.Path)
	if u.RawQuery != "" {
		// Work on the raw pairs rather than Query()/Encode(), which would
		// re-encode every value. A safe query value is stored exactly as it
		// was written, placeholders included.
		pairs := strings.Split(u.RawQuery, "&")
		for i, pair := range pairs {
			key, value, hasValue := strings.Cut(pair, "=")
			if !hasValue {
				continue
			}
			decodedKey, err := url.QueryUnescape(key)
			if err != nil {
				decodedKey = key
			}
			decodedValue, err := url.QueryUnescape(value)
			if err != nil {
				decodedValue = value
			}
			// A placeholder is not a secret; keeping it makes the templated
			// request readable. Only a resolved value is masked.
			if placeholderPattern.MatchString(decodedValue) {
				continue
			}
			if safeQueryValue[strings.ToLower(decodedKey)] && !looksLikeSecret(decodedValue) {
				continue
			}
			pairs[i] = key + "=" + url.QueryEscape(redactedValue)
		}
		u.RawQuery = strings.Join(pairs, "&")
	}
	u.Fragment = ""
	out := u.String()
	// url.String escapes braces, which would turn a templated path into
	// %7B%7BVAR%7D%7D. The placeholders are not secrets and keeping them
	// readable is the point of recording the request as written.
	out = strings.ReplaceAll(out, "%7B%7B", "{{")
	out = strings.ReplaceAll(out, "%7D%7D", "}}")
	return out
}

// redactHeaders records every header name and only the values that cannot be
// credentials. A custom header's value is masked because its meaning is
// unknown.
func redactHeaders(headers []models.Header) []HeaderRecord {
	out := make([]HeaderRecord, 0, len(headers))
	for _, h := range headers {
		if h.Key == "" {
			continue
		}
		rec := HeaderRecord{Name: h.Key}
		if h.Enabled && safeHeaderValue[strings.ToLower(h.Key)] {
			rec.Value = h.Value
		} else if h.Enabled {
			rec.Value = redactedValue
			rec.Redacted = true
		}
		out = append(out, rec)
	}
	return out
}

// redactResponseHeaders applies the same allowlist to a response, where the
// risk is a reflected credential in a header such as Set-Cookie.
func redactResponseHeaders(headers map[string]string) map[string]string {
	if len(headers) == 0 {
		return nil
	}
	out := make(map[string]string, len(headers))
	for name, value := range headers {
		lower := strings.ToLower(name)
		switch {
		case safeHeaderValue[lower]:
			out[name] = value
		case sensitiveName.MatchString(lower):
			out[name] = redactedValue
		default:
			// Unknown header: keep the name so the receipt is still useful
			// for debugging, but not the value.
			out[name] = redactedValue
		}
	}
	return out
}

// preview returns at most limit bytes of s, with a marker when truncated.
func preview(s string, limit int) string {
	if limit <= 0 || s == "" {
		return ""
	}
	if len(s) <= limit {
		return s
	}
	return s[:limit] + "…"
}
