package main

import (
	"errors"
	"fmt"
	"strings"

	aipkg "flux/internal/ai"
	agentlenspkg "flux/internal/agentlens"
	"flux/internal/models"
)

// --- AI ---

type AISettingsResult struct {
	Enabled  bool   `json:"enabled"`
	Provider string `json:"provider"`
	APIKey   string `json:"apiKey"`
	BaseURL  string `json:"baseUrl"`
	Model    string `json:"model"`
}

func (a *App) GetAISettings() AISettingsResult {
	if a.ai == nil {
		return AISettingsResult{}
	}
	cfg := a.ai.Get()
	return AISettingsResult{
		Enabled:  a.ai.IsConfigured(),
		Provider: string(cfg.Provider),
		APIKey:   cfg.APIKey,
		BaseURL:  cfg.BaseURL,
		Model:    cfg.Model,
	}
}

func (a *App) SaveAISettings(provider, apiKey, baseURL, model string) error {
	if a.ai == nil {
		dir, err := a.workspaces.ActiveDir()
		if err != nil {
			return err
		}
		a.ai = aipkg.NewSettings(dir)
	}
	cfg := aipkg.Config{
		Provider: aipkg.Provider(provider),
		APIKey:   apiKey,
		BaseURL:  baseURL,
		Model:    model,
	}
	return a.ai.Save(cfg)
}

func (a *App) DiagnoseWithAI(payload models.RequestPayload, response models.ResponseResult) (string, error) {
	if a.ai == nil || !a.ai.IsConfigured() {
		return "", errors.New("AI not configured — go to Settings to add your API key")
	}
	cfg := a.ai.Get()

	bodyPreview := response.Body
	if len(bodyPreview) > 2000 {
		bodyPreview = bodyPreview[:2000] + "... (truncated)"
	}

	systemMsg := `You are an API debugging assistant. Analyze the request and response, then provide a clear diagnosis. Be concise and actionable. Format your response in markdown.`

	userMsg := fmt.Sprintf(`## Request
**%s %s**

**Headers:**
%s

**Body:**
%s

## Response
**Status: %d %s**
**Time: %dms**

**Response Headers:**
%s

**Response Body:**
%s

%s

Diagnose the issue. Explain what went wrong, why, and how to fix it. If the request succeeded, confirm it looks correct and suggest any improvements.`,
		payload.Method, payload.URL,
		formatHeaders(payload.Headers),
		payload.Body,
		response.StatusCode, response.Status, response.TimingMs,
		formatResponseHeaders(response.Headers),
		bodyPreview,
		formatValidation(response.Validation),
	)

	messages := []aipkg.Message{
		{Role: "system", Content: systemMsg},
		{Role: "user", Content: userMsg},
	}

	return aipkg.Chat(cfg, messages)
}

func (a *App) GenerateAssertions(payload models.RequestPayload, response models.ResponseResult) (string, error) {
	if a.ai == nil || !a.ai.IsConfigured() {
		return "", errors.New("AI not configured — go to Settings to add your API key")
	}
	cfg := a.ai.Get()

	bodyPreview := response.Body
	if len(bodyPreview) > 3000 {
		bodyPreview = bodyPreview[:3000] + "... (truncated)"
	}

	systemMsg := `You are an API test assertion generator. Given a request and response, generate test assertions in reqit's JSON format. Return ONLY a JSON array of assertions, no explanation.

Assertion types:
- {"type":"statusCode","target":"200"} — exact status code match
- {"type":"maxTiming","target":"5000"} — max response time in ms
- {"type":"bodyContains","target":"text"} — response body contains text
- {"type":"bodyMatch","target":"regex"} — response body matches regex
- {"type":"jsonPath","target":"$.field","value":"expected"} — JSON path value check
- {"type":"header","target":"Content-Type","value":"application/json"} — header value check

Generate sensible assertions covering: status code, response time, required fields, and data types. Include edge-case assertions (error status codes, missing fields).`

	userMsg := fmt.Sprintf(`**%s %s** → **%d %s** (%dms)

Response body:
`+"```"+`
%s
`+"```"+`

Generate assertions for this endpoint.`, payload.Method, payload.URL, response.StatusCode, response.Status, response.TimingMs, bodyPreview)

	messages := []aipkg.Message{
		{Role: "system", Content: systemMsg},
		{Role: "user", Content: userMsg},
	}

	return aipkg.Chat(cfg, messages)
}

func formatHeaders(headers []models.Header) string {
	var sb strings.Builder
	for _, h := range headers {
		if !h.Enabled {
			continue
		}
		sb.WriteString(fmt.Sprintf("- **%s:** %s\n", h.Key, h.Value))
	}
	if sb.Len() == 0 {
		return "_none_"
	}
	return sb.String()
}

func formatResponseHeaders(headers map[string]string) string {
	var sb strings.Builder
	for k, v := range headers {
		sb.WriteString(fmt.Sprintf("- **%s:** %s\n", k, v))
	}
	if sb.Len() == 0 {
		return "_none_"
	}
	return sb.String()
}

func formatValidation(v *models.ValidationResult) string {
	if v == nil {
		return ""
	}
	if v.Valid {
		return "## Contract Validation\n**Status: ✓ Contract OK**"
	}
	var sb strings.Builder
	sb.WriteString("## Contract Validation\n**Status: ✗ Violations**\n\n")
	for _, e := range v.Errors {
		sb.WriteString(fmt.Sprintf("- **[%s]** %s: %s\n", e.Layer, e.Field, e.Message))
	}
	return sb.String()
}

// ── Agent Lens ──────────────────────────────────────────────────────────────

// AnalyzeCollectionAgentLens scores every request in a collection for agent-readiness.
func (a *App) AnalyzeCollectionAgentLens(collID string) (agentlenspkg.CollectionScore, error) {
	if a.collections == nil {
		return agentlenspkg.CollectionScore{}, errors.New("no active workspace")
	}
	colls, err := a.collections.GetAll()
	if err != nil {
		return agentlenspkg.CollectionScore{}, err
	}
	var target *models.Collection
	for i := range colls {
		if colls[i].ID == collID {
			target = &colls[i]
			break
		}
	}
	if target == nil {
		return agentlenspkg.CollectionScore{}, errors.New("collection not found")
	}
	dir, _ := a.workspaces.ActiveDir()
	return agentlenspkg.AnalyzeCollection(*target, dir), nil
}

// AnalyzeAllCollectionsAgentLens scores all collections together (cross-collection duplicate detection).
func (a *App) AnalyzeAllCollectionsAgentLens() (agentlenspkg.CollectionScore, error) {
	if a.collections == nil {
		return agentlenspkg.CollectionScore{}, errors.New("no active workspace")
	}
	colls, err := a.collections.GetAll()
	if err != nil {
		return agentlenspkg.CollectionScore{}, err
	}
	dir, _ := a.workspaces.ActiveDir()
	return agentlenspkg.AnalyzeCollections(colls, dir), nil
}

// PreviewToolAgentLens returns the tool definition and lint score for a single request.
func (a *App) PreviewToolAgentLens(collID, requestID string) (agentlenspkg.ToolDefinition, agentlenspkg.ToolScore, error) {
	if a.collections == nil {
		return agentlenspkg.ToolDefinition{}, agentlenspkg.ToolScore{}, errors.New("no active workspace")
	}
	colls, err := a.collections.GetAll()
	if err != nil {
		return agentlenspkg.ToolDefinition{}, agentlenspkg.ToolScore{}, err
	}
	var req models.SavedRequest
	folderName := ""
	found := false
	for _, coll := range colls {
		for _, r := range coll.Requests {
			if r.ID == requestID {
				req = r
				folderName = coll.Name
				found = true
				break
			}
		}
		if found {
			break
		}
	}
	if !found {
		return agentlenspkg.ToolDefinition{}, agentlenspkg.ToolScore{}, errors.New("request not found")
	}
	dir, _ := a.workspaces.ActiveDir()
	tool, score := agentlenspkg.PreviewTool(req, folderName, colls, dir)
	return tool, score, nil
}

// RunEvalAgentLens runs all eval tasks against the configured AI provider.
func (a *App) RunEvalAgentLens() (*agentlenspkg.EvalSuiteResult, error) {
	if a.collections == nil {
		return nil, errors.New("no active workspace")
	}
	colls, err := a.collections.GetAll()
	if err != nil {
		return nil, err
	}
	dir, _ := a.workspaces.ActiveDir()
	return agentlenspkg.RunEvalSuite(dir, colls, 0.8)
}

// ExportMCPServerAgentLens generates a standalone MCP server module.
func (a *App) ExportMCPServerAgentLens() (*agentlenspkg.ExportResult, error) {
	if a.collections == nil {
		return nil, errors.New("no active workspace")
	}
	colls, err := a.collections.GetAll()
	if err != nil {
		return nil, err
	}
	dir, _ := a.workspaces.ActiveDir()
	scoreResult := agentlenspkg.AnalyzeCollections(colls, dir)
	return agentlenspkg.ExportMCPServer(dir, colls, scoreResult.Score, 1.0)
}
