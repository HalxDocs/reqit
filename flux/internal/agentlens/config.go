package agentlens

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

const (
	configFile = "config.yaml"
	suiteFile  = "suite.yaml"
)

// ConfigDir returns the .reqit/agent-lens/ directory for a workspace.
func ConfigDir(workspaceDir string) string {
	return filepath.Join(workspaceDir, ".reqit", "agent-lens")
}

// LoadConfig loads the agent-lens config.yaml from disk.
func LoadConfig(workspaceDir string) (*LensConfig, error) {
	path := filepath.Join(ConfigDir(workspaceDir), configFile)
	data, err := os.ReadFile(path)
	if err != nil {
		return &LensConfig{
			Version: 1,
			Defaults: LensDefaults{
				Expose:    true,
				NameStyle: "snake_case",
			},
			Tools: []ToolConfig{},
		}, nil
	}

	// Parse as JSON (YAML is a superset of JSON, and we use json tags)
	var cfg LensConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		// Try simple key-value parse for YAML
		cfg = parseSimpleYAML(string(data))
	}

	if cfg.Version == 0 {
		cfg.Version = 1
	}
	if cfg.Tools == nil {
		cfg.Tools = []ToolConfig{}
	}

	return &cfg, nil
}

// LoadConfigOrDefault is a convenience wrapper that returns a default config if loading fails.
func LoadConfigOrDefault(workspaceDir string) *LensConfig {
	cfg, _ := LoadConfig(workspaceDir)
	return cfg
}

// SaveConfig persists the agent-lens config.yaml to disk.
func SaveConfig(workspaceDir string, cfg *LensConfig) error {
	dir := ConfigDir(workspaceDir)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filepath.Join(dir, configFile), data, 0600)
}

// LoadSuite loads the eval suite.yaml from disk.
func LoadSuite(workspaceDir string) (*EvalSuite, error) {
	path := filepath.Join(ConfigDir(workspaceDir), suiteFile)
	data, err := os.ReadFile(path)
	if err != nil {
		return &EvalSuite{
			Version: 1,
			Tasks:   []EvalTask{},
		}, nil
	}

	var suite EvalSuite
	if err := json.Unmarshal(data, &suite); err != nil {
		suite = EvalSuite{Version: 1, Tasks: []EvalTask{}}
	}

	if suite.Tasks == nil {
		suite.Tasks = []EvalTask{}
	}

	return &suite, nil
}

// SaveSuite persists the eval suite.yaml to disk.
func SaveSuite(workspaceDir string, suite *EvalSuite) error {
	dir := ConfigDir(workspaceDir)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}

	data, err := json.MarshalIndent(suite, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filepath.Join(dir, suiteFile), data, 0600)
}

// GetToolConfig returns the ToolConfig for a given request name, or the default.
func GetToolConfig(cfg *LensConfig, requestName string) ToolConfig {
	for _, tc := range cfg.Tools {
		if tc.Request == requestName {
			return tc
		}
	}
	return ToolConfig{
		Request: requestName,
		Expose:  cfg.Defaults.Expose,
	}
}

// UpdateToolConfig upserts a ToolConfig for a given request name.
func UpdateToolConfig(cfg *LensConfig, tc ToolConfig) {
	for i, existing := range cfg.Tools {
		if existing.Request == tc.Request {
			cfg.Tools[i] = tc
			return
		}
	}
	cfg.Tools = append(cfg.Tools, tc)
}

// parseSimpleYAML is a minimal YAML parser for the config format.
func parseSimpleYAML(data string) LensConfig {
	cfg := LensConfig{
		Version: 1,
		Defaults: LensDefaults{
			Expose:    true,
			NameStyle: "snake_case",
		},
		Tools: []ToolConfig{},
	}

	lines := strings.Split(data, "\n")
	inTools := false
	currentTool := ToolConfig{}

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}

		if strings.HasPrefix(trimmed, "tools:") {
			inTools = true
			continue
		}

		if inTools {
			if strings.HasPrefix(trimmed, "- request:") {
				if currentTool.Request != "" {
					cfg.Tools = append(cfg.Tools, currentTool)
				}
				currentTool = ToolConfig{
					Request: strings.Trim(strings.TrimPrefix(trimmed, "- request:"), " \"'"),
					Expose:  true,
				}
			} else if strings.HasPrefix(trimmed, "expose:") {
				val := strings.TrimSpace(strings.TrimPrefix(trimmed, "expose:"))
				currentTool.Expose = val == "true"
			} else if strings.HasPrefix(trimmed, "name:") {
				currentTool.Name = strings.Trim(strings.TrimPrefix(trimmed, "name:"), " \"'")
			} else if strings.HasPrefix(trimmed, "description:") || strings.HasPrefix(trimmed, "description: >") {
				val := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(trimmed, "description:"), ">"))
				currentTool.Description = strings.Trim(val, " \"'")
			}
		} else {
			if strings.HasPrefix(trimmed, "expose:") {
				val := strings.TrimSpace(strings.TrimPrefix(trimmed, "expose:"))
				cfg.Defaults.Expose = val == "true"
			} else if strings.HasPrefix(trimmed, "name_style:") {
				cfg.Defaults.NameStyle = strings.Trim(strings.TrimPrefix(trimmed, "name_style:"), " \"'")
			}
		}
	}

	if currentTool.Request != "" {
		cfg.Tools = append(cfg.Tools, currentTool)
	}

	return cfg
}
