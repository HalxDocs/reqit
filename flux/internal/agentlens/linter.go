package agentlens

import (
	"math"
	"strings"
	"unicode/utf8"
)

// LintTool runs all agent-readiness rules against a single tool and returns results.
func LintTool(tool ToolDefinition, allTools []ToolDefinition, config LensConfig) []LintResult {
	var results []LintResult
	results = append(results, lintR1DescriptionQuality(tool)...)
	results = append(results, lintR2ParameterCoverage(tool)...)
	results = append(results, lintR3NamingLimits(tool, allTools, config)...)
	results = append(results, lintR4NearDuplicates(tool, allTools)...)
	results = append(results, lintR5DestructiveTagging(tool)...)
	return results
}

// lintR1DescriptionQuality checks description length and disambiguation clauses.
func lintR1DescriptionQuality(tool ToolDefinition) []LintResult {
	var results []LintResult
	desc := tool.Description

	if desc == "" {
		results = append(results, LintResult{
			RuleID:        "R1",
			RuleName:      "Description Quality",
			Severity:      SeverityError,
			Message:       "Tool has no description. AI agents rely entirely on descriptions to choose tools.",
			FixSuggestion: "Add a description explaining what this tool does, when to use it, and when NOT to use it.",
		})
		return results
	}

	length := utf8.RuneCountInString(desc)
	if length < 20 {
		results = append(results, LintResult{
			RuleID:        "R1",
			RuleName:      "Description Quality",
			Severity:      SeverityWarning,
			Message:       "Description is very short (" + itoa(length) + " chars). Agents need enough context to disambiguate.",
			FixSuggestion: "Expand to at least 20 characters. Include: what it returns, when to use it.",
		})
	}

	// Check for disambiguation clause
	lower := strings.ToLower(desc)
	hasUseWhen := strings.Contains(lower, "use this when") || strings.Contains(lower, "use when") || strings.Contains(lower, "use for")
	hasDoNot := strings.Contains(lower, "do not") || strings.Contains(lower, "don't use") || strings.Contains(lower, "avoid")

	if !hasUseWhen && !hasDoNot && length > 0 {
		results = append(results, LintResult{
			RuleID:        "R1",
			RuleName:      "Description Quality",
			Severity:      SeverityInfo,
			Message:       "No disambiguation clause found ('use this when...' or 'do not use for...').",
			FixSuggestion: "Add a clause like 'Use this when you need X. Do not use for Y — see Z instead.'",
		})
	}

	return results
}

// lintR2ParameterCoverage checks that every parameter has a description and enums are listed.
func lintR2ParameterCoverage(tool ToolDefinition) []LintResult {
	var results []LintResult

	for _, p := range tool.Parameters {
		if p.Description == "" {
			severity := SeverityWarning
			if p.In == "body" {
				severity = SeverityInfo // body params often inferred
			}
			results = append(results, LintResult{
				RuleID:        "R2",
				RuleName:      "Parameter Coverage",
				Severity:      severity,
				Message:       "Parameter '" + p.Name + "' (" + p.In + ") has no description.",
				FixSuggestion: "Add a description for '" + p.Name + "' explaining what it expects.",
			})
		}
	}

	// Check required params count
	requiredCount := 0
	for _, p := range tool.Parameters {
		if p.Required {
			requiredCount++
		}
	}
	if len(tool.Parameters) > 0 && requiredCount == 0 {
		results = append(results, LintResult{
			RuleID:        "R2",
			RuleName:      "Parameter Coverage",
			Severity:      SeverityInfo,
			Message:       "No parameters are marked required. Agents may send empty calls.",
			FixSuggestion: "Mark path parameters and essential query params as required.",
		})
	}

	return results
}

// lintR3NamingLimits checks name length and warns about tool count.
func lintR3NamingLimits(tool ToolDefinition, allTools []ToolDefinition, config LensConfig) []LintResult {
	var results []LintResult

	nameLen := len(tool.Name)
	if nameLen > 64 {
		results = append(results, LintResult{
			RuleID:        "R3",
			RuleName:      "Naming Limits",
			Severity:      SeverityError,
			Message:       "Tool name '" + tool.Name + "' exceeds 64 characters (" + itoa(nameLen) + "). Some MCP clients enforce name-length limits.",
			FixSuggestion: "Shorten the tool name. Use abbreviations or remove filler words.",
		})
	} else if nameLen > 48 {
		results = append(results, LintResult{
			RuleID:        "R3",
			RuleName:      "Naming Limits",
			Severity:      SeverityInfo,
			Message:       "Tool name is " + itoa(nameLen) + " chars. Consider keeping under 48 for safety.",
			FixSuggestion: "Shorten the name if possible.",
		})
	}

	// Check if name is snake_case
	if tool.Name != "" {
		if tool.Name[0] >= 'A' && tool.Name[0] <= 'Z' {
			results = append(results, LintResult{
				RuleID:        "R3",
				RuleName:      "Naming Limits",
				Severity:      SeverityInfo,
				Message:       "Tool name should start with lowercase (snake_case convention).",
				FixSuggestion: "Rename to '" + strings.ToLower(tool.Name[:1]) + tool.Name[1:] + "'.",
			})
		}
	}

	// Tool count warning
	exposedCount := len(allTools)
	if exposedCount > 20 {
		results = append(results, LintResult{
			RuleID:        "R3",
			RuleName:      "Naming Limits",
			Severity:      SeverityWarning,
			Message:       "Collection exposes " + itoa(exposedCount) + " tools. Many MCP clients enforce per-session tool-count caps (often 10-30).",
			FixSuggestion: "Consider hiding less important tools with 'expose: false' or merging similar endpoints.",
		})
	}

	return results
}

// lintR4NearDuplicates detects tools with similar names or descriptions.
func lintR4NearDuplicates(tool ToolDefinition, allTools []ToolDefinition) []LintResult {
	var results []LintResult

	nameTokens := tokenize(tool.Name + " " + tool.Description)
	if len(nameTokens) == 0 {
		return results
	}

	for _, other := range allTools {
		if other.RequestID == tool.RequestID {
			continue
		}
		otherTokens := tokenize(other.Name + " " + other.Description)
		similarity := tokenOverlap(nameTokens, otherTokens)

		if similarity > 0.75 {
			results = append(results, LintResult{
				RuleID:        "R4",
				RuleName:      "Near-Duplicate Detector",
				Severity:      SeverityWarning,
				Message:       "Tool '" + tool.Name + "' is " + formatPercent(similarity) + " similar to '" + other.Name + "'. Agents may pick the wrong one.",
				FixSuggestion: "Differentiate by adding 'Use this when...' clauses, or merge if they serve the same purpose.",
			})
		}
	}

	return results
}

// lintR5DestructiveTagging ensures destructive tools are annotated.
func lintR5DestructiveTagging(tool ToolDefinition) []LintResult {
	var results []LintResult

	if !tool.Destructive {
		return results
	}

	// Check if description mentions destructive nature
	lower := strings.ToLower(tool.Description)
	safetyPhrases := []string{"destructive", "irreversible", "permanent", "cannot be undone", "cannot be reversed", "no undo", "careful", "warning"}
	hasWarning := false
	for _, phrase := range safetyPhrases {
		if strings.Contains(lower, phrase) {
			hasWarning = true
			break
		}
	}

	if !hasWarning {
		results = append(results, LintResult{
			RuleID:        "R5",
			RuleName:      "Destructive Action Tagging",
			Severity:      SeverityError,
			Message:       "Destructive tool '" + tool.Name + "' (DELETE or destructive name) has no warning in description.",
			FixSuggestion: "Add 'DESTRUCTIVE: This action cannot be undone.' to the description.",
		})
	}

	return results
}

// tokenize splits a string into lowercase word tokens.
func tokenize(s string) []string {
	s = strings.ToLower(s)
	s = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == ' ' {
			return r
		}
		return ' '
	}, s)
	return strings.Fields(s)
}

// tokenOverlap computes Jaccard similarity between two token sets.
func tokenOverlap(a, b []string) float64 {
	setA := map[string]bool{}
	for _, t := range a {
		setA[t] = true
	}
	setB := map[string]bool{}
	for _, t := range b {
		setB[t] = true
	}

	intersection := 0
	for t := range setA {
		if setB[t] {
			intersection++
		}
	}

	union := len(setA) + len(setB) - intersection
	if union == 0 {
		return 0
	}

	return float64(intersection) / float64(union)
}

// ScoreFromResults computes a 0-100 score from lint results.
func ScoreFromResults(results []LintResult) int {
	if len(results) == 0 {
		return 100
	}

	penalty := 0.0
	for _, r := range results {
		switch r.Severity {
		case SeverityError:
			penalty += 15
		case SeverityWarning:
			penalty += 5
		case SeverityInfo:
			penalty += 1
		}
	}

	score := 100 - int(math.Min(penalty, 100))
	if score < 0 {
		score = 0
	}
	return score
}

// itoa is a simple int-to-string without importing strconv.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	if n < 0 {
		return "-" + itoa(-n)
	}
	digits := make([]byte, 0, 10)
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	return string(digits)
}

// formatPercent formats a float as a percentage string.
func formatPercent(f float64) string {
	pct := int(f * 100)
	return itoa(pct) + "%"
}
