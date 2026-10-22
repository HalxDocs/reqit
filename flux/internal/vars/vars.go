// Package vars resolves {{variable}} placeholders in request payloads.
//
// The CLI, the collection runner and the MCP tools all need to substitute
// environment variables into a request before it is sent. They each had their
// own copy, and the copies had drifted: the MCP one used a no-op string
// replacer and so only matched an exact "{{key}}" with no whitespace, while
// the others allowed "{{ key }}". This package is the single implementation.
package vars

import (
	"regexp"
	"strings"

	"flux/internal/models"
)

var pattern = regexp.MustCompile(`\{\{\s*([\w.-]+)\s*\}\}`)

// Fallback resolves a placeholder that is not present in the environment.
// It lets the runner keep its faker support without this package knowing
// about it. A nil Fallback leaves the placeholder untouched.
type Fallback func(name string) (string, bool)

// Resolve replaces every {{name}} placeholder in s with the matching value
// from env. A placeholder with no matching value is left as it was, unless a
// Fallback handles it.
func Resolve(s string, env map[string]string, fallback Fallback) string {
	if !strings.Contains(s, "{{") {
		return s
	}
	return pattern.ReplaceAllStringFunc(s, func(match string) string {
		name := strings.TrimSpace(match[2 : len(match)-2])
		if v, ok := env[name]; ok {
			return v
		}
		if fallback != nil {
			if v, ok := fallback(name); ok {
				return v
			}
		}
		return match
	})
}

// HasVars reports whether any of the request's fields contains a
// placeholder. It is a cheap check that lets callers skip the substitution
// entirely for a request with nothing to resolve.
func HasVars(url, body, authValue string, headers, params, form []models.Header) bool {
	if strings.Contains(url, "{{") || strings.Contains(body, "{{") || strings.Contains(authValue, "{{") {
		return true
	}
	for _, h := range headers {
		if h.Enabled && strings.Contains(h.Value, "{{") {
			return true
		}
	}
	for _, p := range params {
		if p.Enabled && strings.Contains(p.Value, "{{") {
			return true
		}
	}
	for _, f := range form {
		if f.Enabled && strings.Contains(f.Value, "{{") {
			return true
		}
	}
	return false
}

// ResolvePayload substitutes the environment into every field of a request
// that carries a value. Disabled headers and params are left alone.
func ResolvePayload(p models.RequestPayload, env map[string]string, fallback Fallback) models.RequestPayload {
	p.URL = Resolve(p.URL, env, fallback)
	for i := range p.Headers {
		if p.Headers[i].Enabled {
			p.Headers[i].Value = Resolve(p.Headers[i].Value, env, fallback)
		}
	}
	for i := range p.Params {
		if p.Params[i].Enabled {
			p.Params[i].Value = Resolve(p.Params[i].Value, env, fallback)
		}
	}
	p.Body = Resolve(p.Body, env, fallback)
	p.AuthValue = Resolve(p.AuthValue, env, fallback)
	for i := range p.BodyForm {
		if p.BodyForm[i].Enabled {
			p.BodyForm[i].Value = Resolve(p.BodyForm[i].Value, env, fallback)
		}
	}
	return p
}
