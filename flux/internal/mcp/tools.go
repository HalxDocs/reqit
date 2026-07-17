package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"flux/internal/ai"
	"flux/internal/collections"
	"flux/internal/environments"
	"flux/internal/models"
	"flux/internal/requester"
	"flux/internal/workspaces"
)

// Tool definitions

var toolDefs = []Tool{
	// Collections
	{
		Name:        "list_collections",
		Description: "List all collections in the active workspace",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{}},
	},
	{
		Name:        "get_collection",
		Description: "Get a collection and all its requests by name",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"name": {Type: "string", Description: "Collection name"},
		}, Required: []string{"name"}},
	},
	{
		Name:        "create_request",
		Description: "Create a new request in a collection",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"collection": {Type: "string", Description: "Collection name"},
			"name":       {Type: "string", Description: "Request name"},
			"method":     {Type: "string", Description: "HTTP method (GET, POST, etc.)"},
			"url":        {Type: "string", Description: "Request URL"},
		}, Required: []string{"collection", "name", "method", "url"}},
	},
	{
		Name:        "update_request",
		Description: "Update an existing request's payload",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"collection": {Type: "string", Description: "Collection name"},
			"request":    {Type: "string", Description: "Request name"},
			"method":     {Type: "string", Description: "HTTP method"},
			"url":        {Type: "string", Description: "Request URL"},
			"headers":    {Type: "string", Description: "JSON array of {key, value, enabled}"},
			"body":       {Type: "string", Description: "Request body"},
		}, Required: []string{"collection", "request"}},
	},
	{
		Name:        "delete_request",
		Description: "Delete a request from a collection",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"collection": {Type: "string", Description: "Collection name"},
			"request":    {Type: "string", Description: "Request name"},
		}, Required: []string{"collection", "request"}},
	},
	{
		Name:        "run_collection",
		Description: "Run all requests in a collection sequentially and return results",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"name":        {Type: "string", Description: "Collection name"},
			"environment": {Type: "string", Description: "Environment name (optional)"},
		}, Required: []string{"name"}},
	},

	// Environments
	{
		Name:        "list_environments",
		Description: "List all environments in the active workspace",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{}},
	},
	{
		Name:        "get_environment",
		Description: "Get an environment and its variables by name",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"name": {Type: "string", Description: "Environment name"},
		}, Required: []string{"name"}},
	},
	{
		Name:        "set_variable",
		Description: "Set a variable in an environment",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"environment": {Type: "string", Description: "Environment name"},
			"key":         {Type: "string", Description: "Variable key"},
			"value":       {Type: "string", Description: "Variable value"},
		}, Required: []string{"environment", "key", "value"}},
	},
	{
		Name:        "switch_environment",
		Description: "Set the active environment",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"name": {Type: "string", Description: "Environment name"},
		}, Required: []string{"name"}},
	},

	// Execution
	{
		Name:        "send_request",
		Description: "Send an HTTP request and return the response",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"method":  {Type: "string", Description: "HTTP method (GET, POST, PUT, PATCH, DELETE)"},
			"url":     {Type: "string", Description: "Request URL"},
			"headers": {Type: "string", Description: "JSON array of {key, value, enabled} (optional)"},
			"body":    {Type: "string", Description: "Request body (optional)"},
		}, Required: []string{"method", "url"}},
	},

	// AI Tools
	{
		Name:        "diagnose_response",
		Description: "Diagnose a failed or unexpected API response using AI. Requires AI to be configured in settings.",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"method":     {Type: "string", Description: "HTTP method used"},
			"url":        {Type: "string", Description: "Request URL"},
			"status_code": {Type: "string", Description: "Response status code"},
			"body":       {Type: "string", Description: "Response body"},
		}, Required: []string{"method", "url", "status_code"}},
	},
	{
		Name:        "generate_assertions",
		Description: "Generate test assertions for a request/response pair using AI. Returns JSON array of assertions.",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"method":     {Type: "string", Description: "HTTP method used"},
			"url":        {Type: "string", Description: "Request URL"},
			"status_code": {Type: "string", Description: "Response status code"},
			"body":       {Type: "string", Description: "Response body"},
		}, Required: []string{"method", "url", "status_code"}},
	},

	// Git-native
	{
		Name:        "diff_collection",
		Description: "Show git diff for collection files in the workspace",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"from": {Type: "string", Description: "From ref (commit, branch, tag)"},
			"to":   {Type: "string", Description: "To ref (default: working tree)"},
		}},
	},
	{
		Name:        "get_collection_history",
		Description: "Show git log for collection changes",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"limit": {Type: "string", Description: "Max commits to return (default: 10)"},
		}},
	},
	{
		Name:        "blame_request",
		Description: "Find which commit last changed a specific request",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"collection": {Type: "string", Description: "Collection name"},
			"request":    {Type: "string", Description: "Request name"},
		}, Required: []string{"collection", "request"}},
	},

	// Workspace
	{
		Name:        "get_project_root",
		Description: "Get the workspace root directory path",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{}},
	},
	{
		Name:        "list_workspaces",
		Description: "List all reqit workspaces",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{}},
	},
}

// RegisterAll registers all tools on the server.
func RegisterAll(s *Server) {
	for _, tool := range toolDefs {
		name := tool.Name
		s.RegisterTool(tool, makeHandler(name, s.workspace))
	}
}

func makeHandler(name, wsDir string) ToolHandler {
	switch name {
	case "list_collections":
		return handleListCollections(wsDir)
	case "get_collection":
		return handleGetCollection(wsDir)
	case "create_request":
		return handleCreateRequest(wsDir)
	case "update_request":
		return handleUpdateRequest(wsDir)
	case "delete_request":
		return handleDeleteRequest(wsDir)
	case "run_collection":
		return handleRunCollection(wsDir)
	case "list_environments":
		return handleListEnvironments(wsDir)
	case "get_environment":
		return handleGetEnvironment(wsDir)
	case "set_variable":
		return handleSetVariable(wsDir)
	case "switch_environment":
		return handleSwitchEnvironment(wsDir)
	case "send_request":
		return handleSendRequest()
	case "diagnose_response":
		return handleDiagnoseResponse(wsDir)
	case "generate_assertions":
		return handleGenerateAssertions(wsDir)
	case "diff_collection":
		return handleDiffCollection(wsDir)
	case "get_collection_history":
		return handleGetCollectionHistory(wsDir)
	case "blame_request":
		return handleBlameRequest(wsDir)
	case "get_project_root":
		return handleGetProjectRoot(wsDir)
	case "list_workspaces":
		return handleListWorkspaces()
	default:
		return func(args json.RawMessage) (string, error) {
			return "", fmt.Errorf("unknown tool: %s", name)
		}
	}
}

// --- Collections ---

func handleListCollections(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		store := collections.NewStore(wsDir)
		all, err := store.GetAll()
		if err != nil {
			return "", err
		}
		var sb strings.Builder
		for _, c := range all {
			fmt.Fprintf(&sb, "- **%s** (%d requests)\n", c.Name, len(c.Requests))
		}
		if sb.Len() == 0 {
			return "No collections found.", nil
		}
		return sb.String(), nil
	}
}

func handleGetCollection(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return "", err
		}
		store := collections.NewStore(wsDir)
		all, err := store.GetAll()
		if err != nil {
			return "", err
		}
		for _, c := range all {
			if c.Name == p.Name {
				b, err := json.MarshalIndent(c, "", "  ")
				if err != nil {
					return "", fmt.Errorf("marshal collection: %w", err)
				}
				return string(b), nil
			}
		}
		return "", fmt.Errorf("collection not found: %s", p.Name)
	}
}

func handleCreateRequest(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Collection string `json:"collection"`
			Name       string `json:"name"`
			Method     string `json:"method"`
			URL        string `json:"url"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return "", err
		}
		store := collections.NewStore(wsDir)
		all, err := store.GetAll()
		if err != nil {
			return "", err
		}
		for i, c := range all {
			if c.Name == p.Collection {
				payload := models.RequestPayload{
					Method: p.Method,
					URL:    p.URL,
					Headers: []models.Header{
						{Key: "Content-Type", Value: "application/json", Enabled: false},
					},
					BodyType: "none",
				}
				_, err := store.AddRequest(c.ID, p.Name, payload)
				if err != nil {
					return "", err
				}
				_ = i
				return fmt.Sprintf("Created request %q in collection %q", p.Name, p.Collection), nil
			}
		}
		return "", fmt.Errorf("collection not found: %s", p.Collection)
	}
}

func handleUpdateRequest(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Collection string `json:"collection"`
			Request    string `json:"request"`
			Method     string `json:"method"`
			URL        string `json:"url"`
			Body       string `json:"body"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return "", err
		}
		store := collections.NewStore(wsDir)
		all, err := store.GetAll()
		if err != nil {
			return "", err
		}
		for _, c := range all {
			if c.Name == p.Collection {
				for _, r := range c.Requests {
					if r.Name == p.Request {
						payload := r.Payload
						if p.Method != "" {
							payload.Method = p.Method
						}
						if p.URL != "" {
							payload.URL = p.URL
						}
						if p.Body != "" {
							payload.Body = p.Body
						}
						if err := store.UpdateRequest(r.ID, p.Request, payload); err != nil {
							return "", err
						}
						return fmt.Sprintf("Updated request %q", p.Request), nil
					}
				}
				return "", fmt.Errorf("request not found: %s", p.Request)
			}
		}
		return "", fmt.Errorf("collection not found: %s", p.Collection)
	}
}

func handleDeleteRequest(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Collection string `json:"collection"`
			Request    string `json:"request"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return "", err
		}
		store := collections.NewStore(wsDir)
		all, err := store.GetAll()
		if err != nil {
			return "", err
		}
		for _, c := range all {
			if c.Name == p.Collection {
				for _, r := range c.Requests {
					if r.Name == p.Request {
						if err := store.DeleteRequest(r.ID); err != nil {
							return "", err
						}
						return fmt.Sprintf("Deleted request %q from %q", p.Request, p.Collection), nil
					}
				}
				return "", fmt.Errorf("request not found: %s", p.Request)
			}
		}
		return "", fmt.Errorf("collection not found: %s", p.Collection)
	}
}

func handleRunCollection(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Name        string `json:"name"`
			Environment string `json:"environment"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return "", err
		}

		store := collections.NewStore(wsDir)
		all, err := store.GetAll()
		if err != nil {
			return "", err
		}

		var coll *models.Collection
		for i := range all {
			if all[i].Name == p.Name {
				coll = &all[i]
				break
			}
		}
		if coll == nil {
			return "", fmt.Errorf("collection not found: %s", p.Name)
		}

		if len(coll.Requests) == 0 {
			return fmt.Sprintf("Collection %q has no requests.", p.Name), nil
		}

		// Load environments
		es := environments.NewStore(wsDir)
		envSnap, err := es.Get()
		if err != nil {
			return "", fmt.Errorf("load environments: %w", err)
		}
		var env *models.Environment
		if p.Environment != "" {
			for i := range envSnap.Environments {
				if envSnap.Environments[i].Name == p.Environment {
					env = &envSnap.Environments[i]
					break
				}
			}
		} else if envSnap.Active != "" {
			for i := range envSnap.Environments {
				if envSnap.Environments[i].ID == envSnap.Active {
					env = &envSnap.Environments[i]
					break
				}
			}
		}

		envMap := make(map[string]string)
		if env != nil {
			for _, v := range env.Vars {
				if v.Enabled && v.Key != "" {
					envMap[v.Key] = v.Value
				}
			}
		}

		var sb strings.Builder
		var passed, failed int
		fmt.Fprintf(&sb, "Running collection: %s (%d requests)\n\n", p.Name, len(coll.Requests))

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		for _, req := range coll.Requests {
			if ctx.Err() != nil {
				fmt.Fprintf(&sb, "\n⚠ Collection run cancelled (timeout)\n")
				break
			}
			payload := resolvePayloadMCP(req.Payload, envMap)
			res := requester.Execute(ctx, payload, nil)

			if res.Error != "" {
				failed++
				fmt.Fprintf(&sb, "✕ %s [%s %s] ERROR: %s\n", req.Name, payload.Method, payload.URL, res.Error)
			} else {
				passed++
				fmt.Fprintf(&sb, "✓ %s [%s %s] %d %dms\n", req.Name, payload.Method, payload.URL, res.StatusCode, res.TimingMs)
			}
		}

		fmt.Fprintf(&sb, "\n%d passed, %d failed, %d total", passed, failed, len(coll.Requests))
		return sb.String(), nil
	}
}

// --- Environments ---

func handleListEnvironments(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		es := environments.NewStore(wsDir)
		snap, err := es.Get()
		if err != nil {
			return "", err
		}
		var sb strings.Builder
		for _, e := range snap.Environments {
			mark := ""
			if e.ID == snap.Active {
				mark = " (active)"
			}
			fmt.Fprintf(&sb, "- **%s%s** (%d vars)\n", e.Name, mark, len(e.Vars))
		}
		if sb.Len() == 0 {
			return "No environments found.", nil
		}
		return sb.String(), nil
	}
}

func handleGetEnvironment(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return "", err
		}
		es := environments.NewStore(wsDir)
		snap, err := es.Get()
		if err != nil {
			return "", err
		}
		for _, e := range snap.Environments {
			if e.Name == p.Name {
				b, err := json.MarshalIndent(e, "", "  ")
				if err != nil {
					return "", fmt.Errorf("marshal environment: %w", err)
				}
				return string(b), nil
			}
		}
		return "", fmt.Errorf("environment not found: %s", p.Name)
	}
}

func handleSetVariable(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Environment string `json:"environment"`
			Key         string `json:"key"`
			Value       string `json:"value"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return "", err
		}
		es := environments.NewStore(wsDir)
		snap, err := es.Get()
		if err != nil {
			return "", err
		}
		for i, e := range snap.Environments {
			if e.Name == p.Environment {
				found := false
				for j, v := range e.Vars {
					if v.Key == p.Key {
						snap.Environments[i].Vars[j].Value = p.Value
						snap.Environments[i].Vars[j].Enabled = true
						found = true
						break
					}
				}
				if !found {
					snap.Environments[i].Vars = append(snap.Environments[i].Vars, models.EnvVar{
						Key: p.Key, Value: p.Value, Enabled: true,
					})
				}
				if err := es.Update(e.ID, e.Name, snap.Environments[i].Vars); err != nil {
					return "", err
				}
				return fmt.Sprintf("Set %s=%s in environment %q", p.Key, p.Value, p.Environment), nil
			}
		}
		return "", fmt.Errorf("environment not found: %s", p.Environment)
	}
}

func handleSwitchEnvironment(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return "", err
		}
		es := environments.NewStore(wsDir)
		snap, err := es.Get()
		if err != nil {
			return "", err
		}
		for _, e := range snap.Environments {
			if e.Name == p.Name {
				if err := es.SetActive(e.ID); err != nil {
					return "", err
				}
				return fmt.Sprintf("Switched to environment %q", p.Name), nil
			}
		}
		return "", fmt.Errorf("environment not found: %s", p.Name)
	}
}

// --- Execution ---

// isSSRFRisk checks if a URL targets internal/loopback addresses.
func isSSRFRisk(rawURL string) bool {
	u, err := url.Parse(rawURL)
	if err != nil {
		return true // block on parse error
	}
	hostname := u.Hostname()
	if hostname == "" {
		return false
	}
	// Block loopback.
	if hostname == "localhost" || hostname == "127.0.0.1" || hostname == "::1" || hostname == "0.0.0.0" {
		return true
	}
	// Block private IP ranges.
	if ip := net.ParseIP(hostname); ip != nil {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
			return true
		}
	}
	// Block metadata endpoints.
	if strings.HasSuffix(hostname, ".internal") || strings.HasSuffix(hostname, ".local") {
		return true
	}
	return false
}

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

		if isSSRFRisk(p.URL) {
			return "", fmt.Errorf("blocked: request to %s is not allowed (SSRF protection: no localhost/internal URLs)", p.URL)
		}

		payload := models.RequestPayload{
			Method:   p.Method,
			URL:      p.URL,
			BodyType: "none",
			Body:     p.Body,
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

func handleDiffCollection(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			From string `json:"from"`
			To   string `json:"to"`
		}
		json.Unmarshal(args, &p)

		reqitDir := filepath.Join(wsDir, ".reqit")
		if _, err := os.Stat(reqitDir); os.IsNotExist(err) {
			return "No .reqit/ directory found. Initialize git first.", nil
		}

		cmdArgs := []string{"diff"}
		if p.From != "" {
			cmdArgs = append(cmdArgs, p.From)
			if p.To != "" {
				cmdArgs = append(cmdArgs, p.To)
			}
		}
		cmdArgs = append(cmdArgs, "--", reqitDir)

		cmd := exec.Command("git", cmdArgs...)
		cmd.Dir = wsDir
		out, err := cmd.CombinedOutput()
		if err != nil {
			return string(out), fmt.Errorf("git diff failed: %w", err)
		}
		if len(out) == 0 {
			return "No changes in .reqit/ files.", nil
		}
		return string(out), nil
	}
}

func handleGetCollectionHistory(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Limit string `json:"limit"`
		}
		json.Unmarshal(args, &p)

		limit := "10"
		if p.Limit != "" {
			limit = p.Limit
		}

		reqitDir := filepath.Join(wsDir, ".reqit")
		if _, err := os.Stat(reqitDir); os.IsNotExist(err) {
			return "No .reqit/ directory found.", nil
		}

		cmd := exec.Command("git", "log", "--oneline", "-"+limit, "--", reqitDir)
		cmd.Dir = wsDir
		out, err := cmd.CombinedOutput()
		if err != nil {
			return string(out), fmt.Errorf("git log failed: %w", err)
		}
		if len(out) == 0 {
			return "No commit history for .reqit/ files.", nil
		}
		return "```\n" + string(out) + "```", nil
	}
}

func handleBlameRequest(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Collection string `json:"collection"`
			Request    string `json:"request"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return "", err
		}

		store := collections.NewStore(wsDir)
		all, err := store.GetAll()
		if err != nil {
			return "", err
		}

		var collName string
		for _, c := range all {
			if c.Name == p.Collection {
				collName = c.Name
				found := false
				for _, r := range c.Requests {
					if r.Name == p.Request {
						found = true
						break
					}
				}
				if !found {
					return "", fmt.Errorf("request not found: %s in %s", p.Request, p.Collection)
				}
				break
			}
		}
		if collName == "" {
			return "", fmt.Errorf("collection not found: %s", p.Collection)
		}

		reqitDir := filepath.Join(wsDir, ".reqit", "collections")
		filePath := filepath.Join(reqitDir, collName)

		cmd := exec.Command("git", "log", "--oneline", "-5", "--follow", "--", filePath)
		cmd.Dir = wsDir
		out, err := cmd.CombinedOutput()
		if err != nil {
			return string(out), fmt.Errorf("git log failed: %w", err)
		}
		if len(out) == 0 {
			return "No commit history for this collection.", nil
		}
		return "```\n" + string(out) + "```", nil
	}
}

// --- Workspace ---

func handleGetProjectRoot(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		return wsDir, nil
	}
}

func handleListWorkspaces() ToolHandler {
	return func(args json.RawMessage) (string, error) {
		ws := workspaces.NewStore()
		all, err := ws.GetAll()
		if err != nil {
			return "", err
		}
		var sb strings.Builder
		for _, w := range all {
			fmt.Fprintf(&sb, "- **%s** (%s) — %s\n", w.Name, w.ID, w.DataDir)
		}
		if sb.Len() == 0 {
			return "No workspaces found.", nil
		}
		return sb.String(), nil
	}
}

// --- Helpers ---

var varPattern = strings.NewReplacer("{{", "{{", "}}", "}}")

func resolvePayloadMCP(p models.RequestPayload, env map[string]string) models.RequestPayload {
	resolve := func(s string) string {
		for k, v := range env {
			s = strings.ReplaceAll(s, "{{"+k+"}}", v)
		}
		return s
	}

	p.URL = resolve(p.URL)
	for i := range p.Headers {
		if p.Headers[i].Enabled {
			p.Headers[i].Value = resolve(p.Headers[i].Value)
		}
	}
	for i := range p.Params {
		if p.Params[i].Enabled {
			p.Params[i].Value = resolve(p.Params[i].Value)
		}
	}
	p.Body = resolve(p.Body)
	p.AuthValue = resolve(p.AuthValue)
	return p
}
