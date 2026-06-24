package agentlens

// ToolDefinition represents a request mapped to an MCP tool.
type ToolDefinition struct {
	RequestID   string            `json:"requestId"`
	RequestName string            `json:"requestName"`
	Folder      string            `json:"folder"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Method      string            `json:"method"`
	Path        string            `json:"path"`
	InputSchema map[string]any    `json:"inputSchema"`
	Parameters  []ToolParam       `json:"parameters"`
	Deprecated  bool              `json:"deprecated"`
	Destructive bool              `json:"destructive"`
}

// ToolParam describes a single parameter in the tool's input schema.
type ToolParam struct {
	Name        string   `json:"name"`
	In          string   `json:"in"` // "query", "header", "path", "body"
	Type        string   `json:"type"`
	Required    bool     `json:"required"`
	Description string   `json:"description"`
	Enum        []string `json:"enum,omitempty"`
}

// LintSeverity for rule results.
type LintSeverity string

const (
	SeverityError   LintSeverity = "error"
	SeverityWarning LintSeverity = "warning"
	SeverityInfo    LintSeverity = "info"
)

// LintResult is the output of a single lint rule for a single tool.
type LintResult struct {
	RuleID        string        `json:"ruleId"`
	RuleName      string        `json:"ruleName"`
	Severity      LintSeverity  `json:"severity"`
	Message       string        `json:"message"`
	FixSuggestion string        `json:"fixSuggestion"`
}

// ToolScore aggregates lint results into a 0-100 score for one tool.
type ToolScore struct {
	ToolName     string       `json:"toolName"`
	RequestID    string       `json:"requestId"`
	Score        int          `json:"score"` // 0-100
	Results      []LintResult `json:"results"`
	ErrorCount   int          `json:"errorCount"`
	WarningCount int          `json:"warningCount"`
	InfoCount    int          `json:"infoCount"`
}

// CollectionScore is the aggregate for the whole collection.
type CollectionScore struct {
	Score        int         `json:"score"`
	ToolCount    int         `json:"toolCount"`
	ExposedCount int         `json:"exposedCount"`
	Tools        []ToolScore `json:"tools"`
	Errors       int         `json:"errors"`
	Warnings     int         `json:"warnings"`
	Infos        int         `json:"infos"`
}

// ToolConfig is per-tool config from config.yaml.
type ToolConfig struct {
	Request     string `yaml:"request" json:"request"`
	Expose      bool   `yaml:"expose" json:"expose"`
	Name        string `yaml:"name,omitempty" json:"name,omitempty"`
	Description string `yaml:"description,omitempty" json:"description,omitempty"`
}

// LensConfig is the config.yaml structure.
type LensConfig struct {
	Version  int          `yaml:"version" json:"version"`
	Defaults LensDefaults `yaml:"defaults" json:"defaults"`
	Tools    []ToolConfig `yaml:"tools" json:"tools"`
}

// LensDefaults holds default exposure settings.
type LensDefaults struct {
	Expose    bool   `yaml:"expose" json:"expose"`
	NameStyle string `yaml:"name_style" json:"nameStyle"`
}

// EvalTask is a single eval task from suite.yaml.
type EvalTask struct {
	Prompt                   string         `json:"prompt" yaml:"prompt"`
	ExpectTool               string         `json:"expectTool" yaml:"expect_tool"`
	ExpectArgs               map[string]any `json:"expectArgs,omitempty" yaml:"expect_args,omitempty"`
	ExpectDestructiveConfirmed bool         `json:"expectDestructiveConfirmed,omitempty" yaml:"expect_destructive_confirmed,omitempty"`
}

// EvalSuite is the suite.yaml structure.
type EvalSuite struct {
	Version    int        `yaml:"version" json:"version"`
	Provider   string     `yaml:"provider" json:"provider"`
	Model      string     `yaml:"model" json:"model"`
	Tasks      []EvalTask `yaml:"tasks" json:"tasks"`
}
