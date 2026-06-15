package postman

import (
	"encoding/json"
	"regexp"
)

// SecretWarning describes a potential secret found during import scanning.
type SecretWarning struct {
	RequestName string `json:"requestName"`
	HeaderKey   string `json:"headerKey"`
	Field       string `json:"field"`     // "header", "variable", "body"
	Hint        string `json:"hint"`
	ValuePrefix string `json:"valuePrefix"` // first 8 chars of matched value
}

// DefaultSecretPatterns match common API token formats.
var DefaultSecretPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)bearer\s+[a-z0-9\-._~+/]+=*\b`),
	regexp.MustCompile(`(?i)(api[_-]?key|apikey)\s*[:=]\s*['"]?[\w\-]{16,}`),
	regexp.MustCompile(`sk-[a-zA-Z0-9]{32,}`),               // OpenAI
	regexp.MustCompile(`ghp_[a-zA-Z0-9]{36}\b`),             // GitHub PAT
	regexp.MustCompile(`gho_[a-zA-Z0-9]{36}\b`),             // GitHub OAuth
	regexp.MustCompile(`xoxb-[0-9]+-[a-zA-Z0-9]+`),          // Slack Bot
	regexp.MustCompile(`xoxp-[0-9]+-[a-zA-Z0-9]+`),          // Slack User
	regexp.MustCompile(`(?i)token\s*[:=]\s*['"]?[a-z0-9\-._~+/]{20,}`),
	regexp.MustCompile(`(?i)secret\s*[:=]\s*['"]?[a-z0-9\-._~+/]{16,}`),
	regexp.MustCompile(`AKIA[0-9A-Z]{16}`),                  // AWS Access Key
	regexp.MustCompile(`eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+`), // JWT
}

// ScanForSecrets scans raw Postman collection JSON for potential secrets in variables, headers, and body.
func ScanForSecrets(rawJSON []byte) []SecretWarning {
	var col rawCollection
	if err := json.Unmarshal(rawJSON, &col); err != nil {
		return nil
	}

	var warnings []SecretWarning

	// Check collection-level variables
	for _, v := range col.Variable {
		for _, pat := range DefaultSecretPatterns {
			if pat.MatchString(v.Value) {
				prefix := v.Value
				if len(prefix) > 8 {
					prefix = prefix[:8]
				}
				warnings = append(warnings, SecretWarning{
					Field:       "variable",
					HeaderKey:   v.Key,
					Hint:        "Looks like a real secret — replace with {{variable}}",
					ValuePrefix: prefix + "...",
				})
				break
			}
		}
	}

	// Check requests for secrets in headers and body
	var walkItems func(items []rawItem)
	walkItems = func(items []rawItem) {
		for _, item := range items {
			if item.Request != nil {
				var req rawRequest
				if err := json.Unmarshal(item.Request, &req); err != nil {
					continue
				}
				// Check headers
				for _, h := range req.Header {
					for _, pat := range DefaultSecretPatterns {
						if pat.MatchString(h.Value) {
							prefix := h.Value
							if len(prefix) > 8 {
								prefix = prefix[:8]
							}
							warnings = append(warnings, SecretWarning{
								RequestName: item.Name,
								HeaderKey:   h.Key,
								Field:       "header",
								Hint:        "Looks like a real token — use {{env_var}} instead",
								ValuePrefix: prefix + "...",
							})
							break
						}
					}
				}
				// Check body
				if req.Body != nil && req.Body.Raw != "" {
					for _, pat := range DefaultSecretPatterns {
						if match := pat.FindString(req.Body.Raw); match != "" {
							prefix := match
							if len(prefix) > 8 {
								prefix = prefix[:8]
							}
							warnings = append(warnings, SecretWarning{
								RequestName: item.Name,
								Field:       "body",
								Hint:        "Request body contains what looks like a secret token",
								ValuePrefix: prefix + "...",
							})
							break
						}
					}
				}
			}
			if len(item.Item) > 0 {
				walkItems(item.Item)
			}
		}
	}
	walkItems(col.Item)

	return warnings
}
