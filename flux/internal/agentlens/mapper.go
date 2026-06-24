package agentlens

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"flux/internal/models"
)

var (
	paramPattern  = regexp.MustCompile(`\{(\w+)\}`)
	acronymPattern = regexp.MustCompile(`([A-Z]+)([A-Z][a-z])`)
_wordBreak      = regexp.MustCompile(`[-_\s]+`)
)

// MapRequestToTool converts a SavedRequest into a ToolDefinition.
func MapRequestToTool(req models.SavedRequest, folderName string) ToolDefinition {
	tool := ToolDefinition{
		RequestID:   req.ID,
		RequestName: req.Name,
		Folder:      folderName,
		Method:      strings.ToUpper(req.Payload.Method),
		Path:        req.Payload.URL,
	}

	tool.Name = generateToolName(req.Name, folderName)
	tool.Description = generateDescription(req)
	tool.Parameters = extractParameters(req)
	tool.InputSchema = buildInputSchema(tool.Parameters)
	tool.Destructive = isDestructive(req)

	return tool
}

// generateToolName converts a request name to snake_case tool name.
func generateToolName(name, folder string) string {
	s := strings.TrimSpace(name)
	s = strings.ToLower(s)

	// Replace common separators with spaces
	s = strings.NewReplacer("-", " ", "_", " ", ".", " ", "/", " ", ".", " ").Replace(s)

	// Collapse multiple spaces
	for strings.Contains(s, "  ") {
		s = strings.ReplaceAll(s, "  ", " ")
	}

	// Split into words and join with underscores
	words := strings.Fields(s)
	if len(words) == 0 {
		return "unnamed_tool"
	}

	// Filter out noise words
	filtered := make([]string, 0, len(words))
	for _, w := range words {
		switch w {
		case "the", "a", "an", "get", "set", "create", "update", "delete", "remove", "add", "list", "fetch":
			// Keep action verbs, skip articles
			if w == "the" || w == "a" || w == "an" {
				continue
			}
		}
		filtered = append(filtered, w)
	}

	if len(filtered) == 0 {
		filtered = words
	}

	name = strings.Join(filtered, "_")

	// Truncate if too long (common MCP client limit is 64 chars)
	if len(name) > 64 {
		name = name[:64]
	}

	return name
}

// generateDescription creates a tool description from request metadata.
func generateDescription(req models.SavedRequest) string {
	var b strings.Builder

	method := strings.ToUpper(req.Payload.Method)
	path := req.Payload.URL

	// Build description from method + path
	b.WriteString(fmt.Sprintf("%s %s", method, path))

	// Add body type context
	if req.Payload.BodyType != "" && req.Payload.BodyType != "none" {
		b.WriteString(fmt.Sprintf(" (body: %s)", req.Payload.BodyType))
	}

	// Add auth context
	if req.Payload.AuthType != "" && req.Payload.AuthType != "none" {
		b.WriteString(fmt.Sprintf(" [auth: %s]", req.Payload.AuthType))
	}

	return b.String()
}

// extractParameters pulls parameters from URL path, query params, headers, and body.
func extractParameters(req models.SavedRequest) []ToolParam {
	var params []ToolParam
	seen := map[string]bool{}

	// Extract path parameters from {param} placeholders
	matches := paramPattern.FindAllStringSubmatch(req.Payload.URL, -1)
	for _, m := range matches {
		name := m[1]
		if seen[name] {
			continue
		}
		seen[name] = true
		params = append(params, ToolParam{
			Name:     name,
			In:       "path",
			Type:     "string",
			Required: true,
		})
	}

	// Extract query parameters
	for _, h := range req.Payload.Params {
		if !h.Enabled || h.Key == "" {
			continue
		}
		if seen[h.Key] {
			continue
		}
		seen[h.Key] = true
		params = append(params, ToolParam{
			Name:     h.Key,
			In:       "query",
			Type:     "string",
			Required: false,
		})
	}

	// Extract header parameters (skip standard headers)
	standardHeaders := map[string]bool{
		"content-type": true, "authorization": true, "accept": true,
		"user-agent": true, "host": true, "connection": true,
	}
	for _, h := range req.Payload.Headers {
		if !h.Enabled || h.Key == "" {
			continue
		}
		if standardHeaders[strings.ToLower(h.Key)] {
			continue
		}
		if seen[h.Key] {
			continue
		}
		seen[h.Key] = true
		params = append(params, ToolParam{
			Name:     h.Key,
			In:       "header",
			Type:     "string",
			Required: false,
		})
	}

	// Extract body parameters
	if req.Payload.BodyType == "json" && req.Payload.Body != "" {
		bodyParams := extractJSONBodyParams(req.Payload.Body)
		for _, p := range bodyParams {
			if !seen[p.Name] {
				seen[p.Name] = true
				params = append(params, p)
			}
		}
	}

	return params
}

// extractJSONBodyParams parses a JSON body and extracts top-level fields.
func extractJSONBodyParams(body string) []ToolParam {
	var m map[string]any
	if err := json.Unmarshal([]byte(body), &m); err != nil {
		return nil
	}

	var params []ToolParam
	for key, val := range m {
		tp := ToolParam{
			Name:     key,
			In:       "body",
			Type:     inferJSONType(val),
			Required: false, // can't determine from raw JSON
		}
		params = append(params, tp)
	}
	return params
}

// inferJSONType returns the JSON schema type for a Go value.
func inferJSONType(v any) string {
	switch v.(type) {
	case bool:
		return "boolean"
	case float64:
		val := v.(float64)
		if val == float64(int64(val)) {
			return "integer"
		}
		return "number"
	case string:
		return "string"
	case []any:
		return "array"
	case map[string]any:
		return "object"
	case nil:
		return "string"
	default:
		return "string"
	}
}

// buildInputSchema constructs a JSON Schema object from parameters.
func buildInputSchema(params []ToolParam) map[string]any {
	if len(params) == 0 {
		return map[string]any{
			"type":       "object",
			"properties": map[string]any{},
		}
	}

	properties := map[string]any{}
	required := []string{}

	for _, p := range params {
		prop := map[string]any{
			"type": p.Type,
		}
		if p.Description != "" {
			prop["description"] = p.Description
		}
		if len(p.Enum) > 0 {
			prop["enum"] = p.Enum
		}
		properties[p.Name] = prop

		if p.Required {
			required = append(required, p.Name)
		}
	}

	schema := map[string]any{
		"type":       "object",
		"properties": properties,
	}
	if len(required) > 0 {
		schema["required"] = required
	}

	return schema
}

// isDestructive checks if a request is likely destructive.
func isDestructive(req models.SavedRequest) bool {
	method := strings.ToUpper(req.Payload.Method)
	if method == "DELETE" {
		return true
	}

	name := strings.ToLower(req.Name)
	path := strings.ToLower(req.Payload.URL)

	destructiveWords := []string{"delete", "remove", "destroy", "cancel", "revoke", "terminate", "purge", "drop", "truncate"}
	for _, w := range destructiveWords {
		if strings.Contains(name, w) || strings.Contains(path, w) {
			return true
		}
	}

	return false
}

// toSnakeCase converts an arbitrary string to snake_case.
func toSnakeCase(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}

	// Insert word breaks before capitals
	s = acronymPattern.ReplaceAllString(s, "${1} ${2}")

	// Replace non-alphanumeric with spaces
	result := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') {
			result = append(result, c)
		} else {
			result = append(result, ' ')
		}
	}

	words := _wordBreak.Split(strings.ToLower(string(result)), -1)
	filtered := make([]string, 0, len(words))
	for _, w := range words {
		if w != "" {
			filtered = append(filtered, w)
		}
	}

	return strings.Join(filtered, "_")
}

// sanitizeName removes non-identifier characters.
func sanitizeName(s string) string {
	result := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '-' {
			result = append(result, c)
		} else if c == ' ' || c == '.' || c == '/' {
			result = append(result, '_')
		}
	}
	s = string(result)

	// Collapse multiple underscores
	for strings.Contains(s, "__") {
		s = strings.ReplaceAll(s, "__", "_")
	}

	s = strings.Trim(s, "_-")

	// Ensure starts with letter
	if len(s) > 0 && s[0] >= '0' && s[0] <= '9' {
		s = "t_" + s
	}

	return s
}
