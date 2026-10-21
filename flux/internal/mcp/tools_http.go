package mcp

import (
	"context"
	"encoding/json"
	"flux/internal/models"
	"flux/internal/requester"
	"flux/internal/security"
	"fmt"
	"strings"
)

func handleSendRequest() ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Method  string `json:"method"`
			URL     string `json:"url"`
			Headers string `json:"headers"`
			Body    string `json:"body"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return "", err
		}

		// An MCP client can pass any URL, so this tool is a server-side
		// request forgery surface. Use the same validator the requester uses:
		// it checks the scheme and resolves the host, which closes the
		// DNS-rebinding bypass a host-only check leaves open.
		if err := security.ValidateURL(p.URL); err != nil {
			return "", fmt.Errorf("blocked: request to %s is not allowed (SSRF protection): %w", p.URL, err)
		}

		payload := models.RequestPayload{
			Method:   p.Method,
			URL:      p.URL,
			BodyType: "none",
			Body:     p.Body,
			// The requester applies this check too; enabling it here means the
			// request is refused before it is dispatched, not after.
			ValidateURL: true,
		}
		if p.Body != "" {
			payload.BodyType = "json"
		}
		if p.Headers != "" {
			var headers []models.Header
			if err := json.Unmarshal([]byte(p.Headers), &headers); err == nil {
				payload.Headers = headers
			}
		}

		res := requester.Execute(context.Background(), payload, nil)

		var sb strings.Builder
		fmt.Fprintf(&sb, "**%s %s** → %d %s (%dms, %dB)\n\n", p.Method, p.URL, res.StatusCode, res.Status, res.TimingMs, res.SizeBytes)
		if res.Error != "" {
			fmt.Fprintf(&sb, "Error: %s\n", res.Error)
		} else {
			fmt.Fprintf(&sb, "```json\n%s\n```", res.Body)
		}
		return sb.String(), nil
	}
}

// --- AI Tools ---
