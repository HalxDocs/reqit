package agentlens

import (
	"testing"

	"flux/internal/models"
)

func makeRequest(name, method, url string, headers []models.Header, params []models.Header, bodyType, body string) models.SavedRequest {
	return models.SavedRequest{
		ID:   "req-" + name,
		Name: name,
		Payload: models.RequestPayload{
			Method:   method,
			URL:      url,
			Headers:  headers,
			Params:   params,
			BodyType: bodyType,
			Body:     body,
		},
	}
}

func TestMapRequestToTool_BasicGET(t *testing.T) {
	req := makeRequest("Get User", "GET", "/api/users/{id}", nil, nil, "none", "")
	tool := MapRequestToTool(req, "Users")

	if tool.Method != "GET" {
		t.Errorf("expected GET, got %s", tool.Method)
	}
	if tool.Name == "" {
		t.Error("tool name should not be empty")
	}
	if len(tool.Parameters) != 1 {
		t.Errorf("expected 1 path param, got %d", len(tool.Parameters))
	}
	if tool.Parameters[0].Name != "id" {
		t.Errorf("expected param 'id', got '%s'", tool.Parameters[0].Name)
	}
	if tool.Parameters[0].In != "path" {
		t.Errorf("expected param in 'path', got '%s'", tool.Parameters[0].In)
	}
	if !tool.Parameters[0].Required {
		t.Error("path param should be required")
	}
}

func TestMapRequestToTool_POSTWithJSONBody(t *testing.T) {
	body := `{"name": "Alice", "email": "alice@example.com", "age": 30}`
	req := makeRequest("Create User", "POST", "/api/users", nil, nil, "json", body)
	tool := MapRequestToTool(req, "Users")

	if tool.Method != "POST" {
		t.Errorf("expected POST, got %s", tool.Method)
	}
	if len(tool.Parameters) != 3 {
		t.Errorf("expected 3 body params, got %d", len(tool.Parameters))
	}

	paramNames := map[string]bool{}
	for _, p := range tool.Parameters {
		paramNames[p.Name] = true
		if p.In != "body" {
			t.Errorf("expected param '%s' in body, got '%s'", p.Name, p.In)
		}
	}
	for _, expected := range []string{"name", "email", "age"} {
		if !paramNames[expected] {
			t.Errorf("missing expected param: %s", expected)
		}
	}
}

func TestMapRequestToTool_DELETE(t *testing.T) {
	req := makeRequest("Delete User", "DELETE", "/api/users/{id}", nil, nil, "none", "")
	tool := MapRequestToTool(req, "Users")

	if !tool.Destructive {
		t.Error("DELETE method should be destructive")
	}
}

func TestMapRequestToTool_QueryParams(t *testing.T) {
	params := []models.Header{
		{Key: "status", Value: "active", Enabled: true},
		{Key: "limit", Value: "10", Enabled: true},
	}
	req := makeRequest("List Users", "GET", "/api/users", nil, params, "none", "")
	tool := MapRequestToTool(req, "Users")

	queryParams := 0
	for _, p := range tool.Parameters {
		if p.In == "query" {
			queryParams++
		}
	}
	if queryParams != 2 {
		t.Errorf("expected 2 query params, got %d", queryParams)
	}
}

func TestMapRequestToTool_CustomHeaders(t *testing.T) {
	headers := []models.Header{
		{Key: "X-Request-ID", Value: "abc", Enabled: true},
		{Key: "Authorization", Value: "Bearer token", Enabled: true},
		{Key: "Content-Type", Value: "application/json", Enabled: true},
	}
	req := makeRequest("Get User", "GET", "/api/users/1", headers, nil, "none", "")
	tool := MapRequestToTool(req, "Users")

	customHeaders := 0
	for _, p := range tool.Parameters {
		if p.In == "header" {
			customHeaders++
		}
	}
	if customHeaders != 1 {
		t.Errorf("expected 1 custom header param (X-Request-ID), got %d", customHeaders)
	}
}

func TestLintR1_EmptyDescription(t *testing.T) {
	tool := ToolDefinition{
		Name:        "get_user",
		Description: "",
	}
	results := lintR1DescriptionQuality(tool)
	if len(results) == 0 {
		t.Error("expected error for empty description")
	}
	if results[0].Severity != SeverityError {
		t.Errorf("expected error severity, got %s", results[0].Severity)
	}
}

func TestLintR1_ShortDescription(t *testing.T) {
	tool := ToolDefinition{
		Name:        "get_user",
		Description: "Gets user",
	}
	results := lintR1DescriptionQuality(tool)
	found := false
	for _, r := range results {
		if r.RuleID == "R1" && r.Severity == SeverityWarning {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected warning for short description")
	}
}

func TestLintR1_GoodDescription(t *testing.T) {
	tool := ToolDefinition{
		Name:        "get_user",
		Description: "Fetch a user by ID. Use this when you need a single user's details. Do not use for listing — see list_users.",
	}
	results := lintR1DescriptionQuality(tool)
	for _, r := range results {
		if r.Severity == SeverityError || r.Severity == SeverityWarning {
			t.Errorf("unexpected severity for good description: %s - %s", r.Severity, r.Message)
		}
	}
}

func TestLintR2_ParamNoDescription(t *testing.T) {
	tool := ToolDefinition{
		Name:        "get_user",
		Description: "Get a user by ID. Use this for single user lookups.",
		Parameters: []ToolParam{
			{Name: "id", In: "path", Type: "string", Required: true, Description: ""},
		},
	}
	results := lintR2ParameterCoverage(tool)
	found := false
	for _, r := range results {
		if r.RuleID == "R2" && r.Severity == SeverityWarning {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected warning for param without description")
	}
}

func TestLintR3_LongName(t *testing.T) {
	tool := ToolDefinition{
		Name:        "this_is_a_very_long_tool_name_that_definitely_exceeds_the_sixty_four_character_limit",
		Description: "A tool with a very long name that should trigger a warning.",
	}
	results := lintR3NamingLimits(tool, nil, LensConfig{})
	found := false
	for _, r := range results {
		if r.RuleID == "R3" && r.Severity == SeverityError {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected error for name > 64 chars")
	}
}

func TestLintR4_NearDuplicates(t *testing.T) {
	tools := []ToolDefinition{
		{Name: "get_user", Description: "Fetch a user by ID from the database", RequestID: "req-1"},
		{Name: "get_user_by_id", Description: "Fetch a user by ID from the database", RequestID: "req-2"},
	}
	results := lintR4NearDuplicates(tools[0], tools)
	found := false
	for _, r := range results {
		if r.RuleID == "R4" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected duplicate detection for similar tools")
	}
}

func TestLintR5_DestructiveNoWarning(t *testing.T) {
	tool := ToolDefinition{
		Name:        "delete_user",
		Description: "Delete a user account",
		Destructive: true,
	}
	results := lintR5DestructiveTagging(tool)
	found := false
	for _, r := range results {
		if r.RuleID == "R5" && r.Severity == SeverityError {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected error for destructive tool without warning")
	}
}

func TestLintR5_DestructiveWithWarning(t *testing.T) {
	tool := ToolDefinition{
		Name:        "delete_user",
		Description: "Delete a user. DESTRUCTIVE: This action cannot be undone.",
		Destructive: true,
	}
	results := lintR5DestructiveTagging(tool)
	if len(results) > 0 {
		t.Error("expected no issues for destructive tool with warning")
	}
}

func TestScoreFromResults_Perfect(t *testing.T) {
	score := ScoreFromResults(nil)
	if score != 100 {
		t.Errorf("expected 100 for no results, got %d", score)
	}
}

func TestScoreFromResults_Mixed(t *testing.T) {
	results := []LintResult{
		{Severity: SeverityError},
		{Severity: SeverityWarning},
		{Severity: SeverityInfo},
	}
	score := ScoreFromResults(results)
	if score >= 100 || score <= 0 {
		t.Errorf("expected middle score, got %d", score)
	}
}

func TestTokenOverlap(t *testing.T) {
	a := tokenize("get user by ID from database")
	b := tokenize("get user by ID from cache")
	sim := tokenOverlap(a, b)
	if sim < 0.5 || sim > 1.0 {
		t.Errorf("expected 0.5-1.0 similarity, got %f", sim)
	}
}

func TestAnalyzeCollection(t *testing.T) {
	coll := models.Collection{
		ID:   "coll-1",
		Name: "Users",
		Requests: []models.SavedRequest{
			makeRequest("Get User", "GET", "/api/users/{id}", nil, nil, "none", ""),
			makeRequest("List Users", "GET", "/api/users", nil, nil, "none", ""),
			makeRequest("Create User", "POST", "/api/users", nil, nil, "json", `{"name":"test"}`),
		},
	}

	score := AnalyzeCollection(coll, t.TempDir())
	if score.ExposedCount != 3 {
		t.Errorf("expected 3 exposed tools, got %d", score.ExposedCount)
	}
	if score.Score < 0 || score.Score > 100 {
		t.Errorf("score out of range: %d", score.Score)
	}
	if len(score.Tools) != 3 {
		t.Errorf("expected 3 tool scores, got %d", len(score.Tools))
	}
}
