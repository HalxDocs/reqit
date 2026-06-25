package agentlens

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	aipkg "flux/internal/ai"
	"flux/internal/models"
)

// EvalRunResult is the result of a single eval run (one task, one execution).
type EvalRunResult struct {
	TaskIndex    int            `json:"taskIndex"`
	Prompt       string         `json:"prompt"`
	ExpectTool   string         `json:"expectTool"`
	ExpectArgs   map[string]any `json:"expectArgs,omitempty"`
	ActualTool   string         `json:"actualTool"`
	ActualArgs   map[string]any `json:"actualArgs,omitempty"`
	ToolMatch    bool           `json:"toolMatch"`
	ArgsMatch    bool           `json:"argsMatch"`
	Passed       bool           `json:"passed"`
	LatencyMs    int64          `json:"latencyMs"`
	Error        string         `json:"error,omitempty"`
	Timestamp    string         `json:"timestamp"`
}

// EvalTaskResult is the aggregated result for one task (across runs_per_task).
type EvalTaskResult struct {
	TaskIndex int              `json:"taskIndex"`
	Prompt    string           `json:"prompt"`
	Runs      []EvalRunResult  `json:"runs"`
	PassRate  float64          `json:"passRate"` // 0.0 - 1.0
	Passed    bool             `json:"passed"`   // true if passRate >= threshold
}

// EvalSuiteResult is the full result of running an eval suite.
type EvalSuiteResult struct {
	SuiteName   string           `json:"suiteName"`
	Provider    string           `json:"provider"`
	Model       string           `json:"model"`
	Tasks       []EvalTaskResult `json:"tasks"`
	TotalRuns   int              `json:"totalRuns"`
	TotalPassed int              `json:"totalPassed"`
	PassRate    float64          `json:"passRate"`
	Score       int              `json:"score"` // 0-100
	StartedAt   string           `json:"startedAt"`
	FinishedAt  string           `json:"finishedAt"`
}

// RunEvalSuite executes all tasks in the suite against the configured AI provider.
func RunEvalSuite(workspaceDir string, colls []models.Collection, passRateThreshold float64) (*EvalSuiteResult, error) {
	suite, err := LoadSuite(workspaceDir)
	if err != nil {
		return nil, fmt.Errorf("load suite: %w", err)
	}

	if len(suite.Tasks) == 0 {
		return nil, fmt.Errorf("no eval tasks defined in suite.yaml")
	}

	// Load AI settings
	aiSettings := aipkg.NewSettings(workspaceDir)
	aiSettings.Load()
	if !aiSettings.IsConfigured() {
		return nil, fmt.Errorf("AI not configured — go to Settings > AI to add your API key")
	}
	aiCfg := aiSettings.Get()

	// Map all requests to tools
	cfg, _ := LoadConfig(workspaceDir)
	var allTools []ToolDefinition
	for _, coll := range colls {
		for _, req := range coll.Requests {
			tool := MapRequestToTool(req, coll.Name)
			tc := GetToolConfig(cfg, req.Name)
			if !tc.Expose {
				continue
			}
			if tc.Name != "" {
				tool.Name = tc.Name
			}
			if tc.Description != "" {
				tool.Description = tc.Description
			}
			allTools = append(allTools, tool)
		}
	}

	if len(allTools) == 0 {
		return nil, fmt.Errorf("no exposed tools — enable tools in config.yaml first")
	}

	// Convert to AI tool definitions
	aiTools := make([]aipkg.ToolDef, len(allTools))
	for i, t := range allTools {
		aiTools[i] = aipkg.ToolDef{
			Name:        t.Name,
			Description: t.Description,
			Parameters:  t.InputSchema,
		}
	}

	startedAt := time.Now().UTC().Format(time.RFC3339)
	result := &EvalSuiteResult{
		Provider:  string(aiCfg.Provider),
		Model:     aiCfg.Model,
		StartedAt: startedAt,
	}

	runsPerTask := 3

	for i, task := range suite.Tasks {
		taskResult := EvalTaskResult{
			TaskIndex: i,
			Prompt:    task.Prompt,
		}

		passCount := 0
		for r := 0; r < runsPerTask; r++ {
			runResult := runSingleEval(aiCfg, aiTools, task, i)
			taskResult.Runs = append(taskResult.Runs, runResult)
			if runResult.Passed {
				passCount++
			}
			result.TotalRuns++
			if runResult.Passed {
				result.TotalPassed++
			}
		}

		taskResult.PassRate = float64(passCount) / float64(runsPerTask)
		taskResult.Passed = taskResult.PassRate >= passRateThreshold
		result.Tasks = append(result.Tasks, taskResult)
	}

	result.FinishedAt = time.Now().UTC().Format(time.RFC3339)
	if result.TotalRuns > 0 {
		result.PassRate = float64(result.TotalPassed) / float64(result.TotalRuns)
	}
	result.Score = int(result.PassRate * 100)

	// Persist run result
	persistRunResult(workspaceDir, result)

	return result, nil
}

// runSingleEval executes one task against the AI provider.
func runSingleEval(aiCfg aipkg.Config, tools []aipkg.ToolDef, task EvalTask, taskIndex int) EvalRunResult {
	run := EvalRunResult{
		TaskIndex:  taskIndex,
		Prompt:     task.Prompt,
		ExpectTool: task.ExpectTool,
		ExpectArgs: task.ExpectArgs,
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
	}

	// Build system prompt
	systemPrompt := "You are an API assistant. You have access to the following tools. " +
		"When the user asks you to do something, call the appropriate tool. " +
		"Only call one tool per request. Do not explain — just call the tool."

	messages := []aipkg.Message{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: task.Prompt},
	}

	start := time.Now()
	result, err := aipkg.ChatWithTools(aiCfg, messages, tools)
	run.LatencyMs = time.Since(start).Milliseconds()

	if err != nil {
		run.Error = err.Error()
		return run
	}

	if len(result.ToolCalls) == 0 {
		run.ActualTool = ""
		run.ToolMatch = false
		run.Passed = false
		return run
	}

	// Use the first tool call
	call := result.ToolCalls[0]
	run.ActualTool = call.Name
	run.ActualArgs = call.Arguments

	// Check tool match
	run.ToolMatch = call.Name == task.ExpectTool

	// Check args match (if expected args provided)
	if len(task.ExpectArgs) > 0 {
		run.ArgsMatch = argsMatch(task.ExpectArgs, call.Arguments)
	} else {
		run.ArgsMatch = true // no args expected
	}

	run.Passed = run.ToolMatch && run.ArgsMatch
	return run
}

// argsMatch does a shallow comparison of expected vs actual arguments.
func argsMatch(expected, actual map[string]any) bool {
	for k, ev := range expected {
		av, ok := actual[k]
		if !ok {
			return false
		}
		// Compare as strings for simplicity
		ej, _ := json.Marshal(ev)
		aj, _ := json.Marshal(av)
		if string(ej) != string(aj) {
			// Try string comparison
			if fmt.Sprintf("%v", ev) != fmt.Sprintf("%v", av) {
				return false
			}
		}
	}
	return true
}

// persistRunResult saves the eval result to .reqit/agent-lens/runs/
func persistRunResult(workspaceDir string, result *EvalSuiteResult) {
	dir := filepath.Join(ConfigDir(workspaceDir), "runs")
	os.MkdirAll(dir, 0700)

	filename := time.Now().UTC().Format("2006-01-02T150405Z") + ".json"
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return
	}
	os.WriteFile(filepath.Join(dir, filename), data, 0600)
}

// GetEvalRuns returns all saved eval run results.
func GetEvalRuns(workspaceDir string) []EvalSuiteResult {
	dir := filepath.Join(ConfigDir(workspaceDir), "runs")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}

	var runs []EvalSuiteResult
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}
		var run EvalSuiteResult
		if json.Unmarshal(data, &run) == nil {
			runs = append(runs, run)
		}
	}
	return runs
}
