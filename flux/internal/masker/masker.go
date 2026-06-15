package masker

import (
	"encoding/json"
	"regexp"
	"sync"
)

// Rule describes a masking rule.
type Rule struct {
	Name        string `json:"name"`
	Pattern     string `json:"pattern"`
	Replacement string `json:"replacement"`
	Enabled     bool   `json:"enabled"`
	compiled    *regexp.Regexp
}

// Engine masks sensitive data using configurable regex rules.
type Engine struct {
	mu    sync.RWMutex
	rules []*Rule
}

// New creates a masker engine with default rules.
func New() *Engine {
	e := &Engine{}
	e.initDefaults()
	return e
}

func (e *Engine) initDefaults() {
	e.rules = []*Rule{
		{
			Name:        "Bearer Token",
			Pattern:     `(?i)Bearer\s+[A-Za-z0-9\-._~+/]+=*`,
			Replacement: "Bearer ★★★★★",
			Enabled:     true,
		},
		{
			Name:        "Basic Auth",
			Pattern:     `(?i)Basic\s+[A-Za-z0-9+/=]+`,
			Replacement: "Basic ★★★★★",
			Enabled:     true,
		},
		{
			Name:        "API Key",
			Pattern:     `(?i)(api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*['"]?[A-Za-z0-9_\-./]{8,}`,
			Replacement: "${1}: ★★★★★",
			Enabled:     true,
		},
		{
			Name:        "Authorization Header",
			Pattern:     `(?i)(x-)?authorization\s*[:=]\s*.+`,
			Replacement: "${1}authorization: ★★★★★",
			Enabled:     true,
		},
		{
			Name:        "Password / Secret",
			Pattern:     `(?i)(password|secret|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{4,}`,
			Replacement: "${1}: ★★★★★",
			Enabled:     true,
		},
		{
			Name:        "Session Cookie",
			Pattern:     `(?i)(session|token|auth|sid)\s*[:=]\s*[A-Za-z0-9%\-]{8,}`,
			Replacement: "${1}: ★★★★★",
			Enabled:     true,
		},
		{
			Name:        "JWT Token",
			Pattern:     `[A-Za-z0-9\-_]+?\.[A-Za-z0-9\-_]+?\.[A-Za-z0-9\-_]+`,
			Replacement: "★★★★★.★★★★★.★★★★★",
			Enabled:     true,
		},
		{
			Name:        "Private Key PEM",
			Pattern:     `-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]+?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----`,
			Replacement: "-----BEGIN PRIVATE KEY----- ★★★★★ -----END PRIVATE KEY-----",
			Enabled:     true,
		},
	}
	for _, r := range e.rules {
		r.compiled = regexp.MustCompile(r.Pattern)
	}
}

// AddRule adds a custom masking rule.
func (e *Engine) AddRule(name, pattern, replacement string) error {
	compiled, err := regexp.Compile(pattern)
	if err != nil {
		return err
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	e.rules = append(e.rules, &Rule{
		Name:        name,
		Pattern:     pattern,
		Replacement: replacement,
		Enabled:     true,
		compiled:    compiled,
	})
	return nil
}

// RemoveRule removes a rule by name.
func (e *Engine) RemoveRule(name string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	for i, r := range e.rules {
		if r.Name == name {
			e.rules = append(e.rules[:i], e.rules[i+1:]...)
			return
		}
	}
}

// SetEnabled enables or disables a rule by name.
func (e *Engine) SetEnabled(name string, on bool) {
	e.mu.Lock()
	defer e.mu.Unlock()
	for _, r := range e.rules {
		if r.Name == name {
			r.Enabled = on
			return
		}
	}
}

// List returns all rules.
func (e *Engine) List() []Rule {
	e.mu.RLock()
	defer e.mu.RUnlock()
	result := make([]Rule, len(e.rules))
	for i, r := range e.rules {
		result[i] = *r
		result[i].compiled = nil
	}
	return result
}

// Mask applies all enabled rules to the input text.
func (e *Engine) Mask(text string) string {
	e.mu.RLock()
	defer e.mu.RUnlock()
	result := text
	for _, r := range e.rules {
		if !r.Enabled {
			continue
		}
		result = r.compiled.ReplaceAllString(result, r.Replacement)
	}
	return result
}

// MaskMap applies masking to all string values in a map.
func (e *Engine) MaskMap(m map[string]string) map[string]string {
	result := make(map[string]string, len(m))
	for k, v := range m {
		result[k] = e.Mask(v)
	}
	return result
}

// MaskHeaders applies masking to header values.
func (e *Engine) MaskHeaders(headers []struct{ Key, Value string }) []struct{ Key, Value string } {
	result := make([]struct{ Key, Value string }, len(headers))
	for i, h := range headers {
		result[i] = struct{ Key, Value string }{Key: h.Key, Value: e.Mask(h.Value)}
	}
	return result
}

// MarshalRules serialises a slice of rules to JSON.
func MarshalRules(rules []Rule) (string, error) {
	type ruleJSON struct {
		Name        string `json:"name"`
		Pattern     string `json:"pattern"`
		Replacement string `json:"replacement"`
		Enabled     bool   `json:"enabled"`
	}
	out := make([]ruleJSON, len(rules))
	for i, r := range rules {
		out[i] = ruleJSON{Name: r.Name, Pattern: r.Pattern, Replacement: r.Replacement, Enabled: r.Enabled}
	}
	data, err := json.Marshal(out)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
