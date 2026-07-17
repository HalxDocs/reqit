package agentlens

import (
	"flux/internal/models"
)

// AnalyzeCollection maps all requests to tools, runs lint rules, and returns scores.
func AnalyzeCollection(coll models.Collection, workspaceDir string) CollectionScore {
	return AnalyzeCollections([]models.Collection{coll}, workspaceDir)
}

// AnalyzeCollections analyzes multiple collections together (for cross-collection duplicate detection).
func AnalyzeCollections(colls []models.Collection, workspaceDir string) CollectionScore {
	cfg := LoadConfigOrDefault(workspaceDir)

	// Phase 1: Map all requests to tools
	var allTools []ToolDefinition
	for _, coll := range colls {
		for _, req := range coll.Requests {
			tool := MapRequestToTool(req, coll.Name)

			// Apply config overrides
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

	// Phase 2: Run linter on each tool
	var toolScores []ToolScore
	totalScore := 0
	totalErrors := 0
	totalWarnings := 0
	totalInfos := 0

	for _, tool := range allTools {
		results := LintTool(tool, allTools, *cfg)
		score := ScoreFromResults(results)

		ts := ToolScore{
			ToolName:     tool.Name,
			RequestID:    tool.RequestID,
			Score:        score,
			Results:      results,
			ErrorCount:   countBySeverity(results, SeverityError),
			WarningCount: countBySeverity(results, SeverityWarning),
			InfoCount:    countBySeverity(results, SeverityInfo),
		}
		toolScores = append(toolScores, ts)
		totalScore += score
		totalErrors += ts.ErrorCount
		totalWarnings += ts.WarningCount
		totalInfos += ts.InfoCount
	}

	// Phase 3: Compute collection-level score (average of tool scores)
	collScore := 0
	if len(toolScores) > 0 {
		collScore = totalScore / len(toolScores)
	}

	return CollectionScore{
		Score:        collScore,
		ToolCount:    countTotalRequests(colls),
		ExposedCount: len(allTools),
		Tools:        toolScores,
		Errors:       totalErrors,
		Warnings:     totalWarnings,
		Infos:        totalInfos,
	}
}

// AnalyzeRequest scores a single request as a tool.
func AnalyzeRequest(req models.SavedRequest, folderName string, allColls []models.Collection, workspaceDir string) ToolScore {
	cfg := LoadConfigOrDefault(workspaceDir)

	// Map the target request
	tool := MapRequestToTool(req, folderName)
	tc := GetToolConfig(cfg, req.Name)
	if tc.Name != "" {
		tool.Name = tc.Name
	}
	if tc.Description != "" {
		tool.Description = tc.Description
	}

	// Map all other requests for duplicate detection
	var allTools []ToolDefinition
	for _, coll := range allColls {
		for _, r := range coll.Requests {
			t := MapRequestToTool(r, coll.Name)
			etc := GetToolConfig(cfg, r.Name)
			if etc.Name != "" {
				t.Name = etc.Name
			}
			if etc.Description != "" {
				t.Description = etc.Description
			}
			allTools = append(allTools, t)
		}
	}

	results := LintTool(tool, allTools, *cfg)
	score := ScoreFromResults(results)

	return ToolScore{
		ToolName:     tool.Name,
		RequestID:    tool.RequestID,
		Score:        score,
		Results:      results,
		ErrorCount:   countBySeverity(results, SeverityError),
		WarningCount: countBySeverity(results, SeverityWarning),
		InfoCount:    countBySeverity(results, SeverityInfo),
	}
}

// PreviewTool returns the tool definition and score without persisting anything.
func PreviewTool(req models.SavedRequest, folderName string, allColls []models.Collection, workspaceDir string) (ToolDefinition, ToolScore) {
	tool := MapRequestToTool(req, folderName)
	score := AnalyzeRequest(req, folderName, allColls, workspaceDir)
	return tool, score
}

// countBySeverity counts lint results of a given severity.
func countBySeverity(results []LintResult, severity LintSeverity) int {
	count := 0
	for _, r := range results {
		if r.Severity == severity {
			count++
		}
	}
	return count
}

// countTotalRequests counts all requests across collections.
func countTotalRequests(colls []models.Collection) int {
	total := 0
	for _, c := range colls {
		total += len(c.Requests)
	}
	return total
}
