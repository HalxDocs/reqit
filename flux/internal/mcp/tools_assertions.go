package mcp

import (
	"encoding/json"
	"flux/internal/ai"
	"fmt"
)

func handleDiagnoseResponse(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Method     string `json:"method"`
			URL        string `json:"url"`
			StatusCode string `json:"status_code"`
			Body       string `json:"body"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return "", err
		}

		settings := ai.NewSettings(wsDir)
		settings.Load()
		if !settings.IsConfigured() {
			return "", fmt.Errorf("AI not configured. Set your API key in Settings → AI")
		}
		cfg := settings.Get()

		bodyPreview := p.Body
		if len(bodyPreview) > 2000 {
			bodyPreview = bodyPreview[:2000] + "... (truncated)"
		}

		systemMsg := "You are an API debugging assistant. Analyze the request and response, then provide a clear diagnosis. Be concise and actionable. Format your response in markdown."
		userMsg := fmt.Sprintf("## Request\n**%s %s**\n\n## Response\n**Status: %s**\n\n**Body:**\n```\n%s\n```\n\nDiagnose the issue. Explain what went wrong, why, and how to fix it.", p.Method, p.URL, p.StatusCode, bodyPreview)

		messages := []ai.Message{
			{Role: "system", Content: systemMsg},
			{Role: "user", Content: userMsg},
		}

		return ai.Chat(cfg, messages)
	}
}

func handleGenerateAssertions(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Method     string `json:"method"`
			URL        string `json:"url"`
			StatusCode string `json:"status_code"`
			Body       string `json:"body"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return "", err
		}

		settings := ai.NewSettings(wsDir)
		settings.Load()
		if !settings.IsConfigured() {
			return "", fmt.Errorf("AI not configured. Set your API key in Settings → AI")
		}
		cfg := settings.Get()

		bodyPreview := p.Body
		if len(bodyPreview) > 3000 {
			bodyPreview = bodyPreview[:3000] + "... (truncated)"
		}

		systemMsg := `You are an API test assertion generator. Given a request and response, generate test assertions in reqit's JSON format. Return ONLY a JSON array of assertions, no explanation.

Assertion types:
- {"type":"statusCode","target":"200"}
- {"type":"maxTiming","target":"5000"}
- {"type":"bodyContains","target":"text"}
- {"type":"bodyMatch","target":"regex"}
- {"type":"jsonPath","target":"$.field","value":"expected"}
- {"type":"header","target":"Content-Type","value":"application/json"}

Generate sensible assertions.`
		userMsg := fmt.Sprintf("**%s %s** → **%s**\n\nResponse:\n```\n%s\n```\n\nGenerate assertions.", p.Method, p.URL, p.StatusCode, bodyPreview)

		messages := []ai.Message{
			{Role: "system", Content: systemMsg},
			{Role: "user", Content: userMsg},
		}

		return ai.Chat(cfg, messages)
	}
}

// --- Git-native ---
