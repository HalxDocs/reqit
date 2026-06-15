package postman

import (
	"encoding/json"
	"fmt"
	"strings"
)

// DetectVersion auto-detects the Postman collection format version from raw JSON data.
// Returns "v2.1", "v2.0", or an error if the format is unknown.
func DetectVersion(data []byte) (string, error) {
	var probe struct {
		Info struct {
			Schema string `json:"schema"`
		} `json:"info"`
	}
	if err := json.Unmarshal(data, &probe); err != nil {
		return "", fmt.Errorf("not a Postman collection: %w", err)
	}
	if probe.Info.Schema == "" {
		// Try legacy v2.0 format
		var legacy struct {
			Variables []interface{} `json:"variables"`
		}
		if err := json.Unmarshal(data, &legacy); err == nil && len(legacy.Variables) > 0 {
			return "v2.0", nil
		}
		return "", fmt.Errorf("unknown Postman collection format (no schema field)")
	}
	switch {
	case strings.Contains(probe.Info.Schema, "v2.1"):
		return "v2.1", nil
	case strings.Contains(probe.Info.Schema, "v2.0"):
		return "v2.0", nil
	default:
		return "", fmt.Errorf("unsupported Postman schema version: %s", probe.Info.Schema)
	}
}

// DetectFileType detects whether the JSON data is a collection, environment, or workspace export.
func DetectFileType(data []byte) string {
	var probe struct {
		Info  struct{} `json:"info"`
		Item  []struct{} `json:"item"`
		Values []struct{} `json:"values"`
	}
	if err := json.Unmarshal(data, &probe); err != nil {
		return "unknown"
	}
	if len(probe.Item) > 0 && probe.Info != (struct{}{}) {
		return "collection"
	}
	if len(probe.Values) > 0 {
		return "environment"
	}
	// Check for workspace wrapper
	var ws struct {
		Collections []struct{} `json:"collections"`
	}
	if err := json.Unmarshal(data, &ws); err == nil && len(ws.Collections) > 0 {
		return "workspace"
	}
	return "unknown"
}
