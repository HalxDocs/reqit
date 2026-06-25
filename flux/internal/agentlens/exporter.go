package agentlens

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"flux/internal/models"
)

// ExportedTool is a tool definition for the exported MCP server.
type ExportedTool struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
	RequestName string         `json:"requestName"`
	Collection  string         `json:"collection"`
}

// ExportConfig is what gets written to exported-tools.json.
type ExportConfig struct {
	ServerName string         `json:"serverName"`
	Version    string         `json:"version"`
	Tools      []ExportedTool `json:"tools"`
}

// ExportResult is the output of generating the MCP server.
type ExportResult struct {
	OutputDir string   `json:"outputDir"`
	Files     []string `json:"files"`
	Tools     int      `json:"tools"`
}

// ExportMCPServer generates a standalone Go module implementing an MCP server.
func ExportMCPServer(workspaceDir string, colls []models.Collection, score int, passRate float64) (*ExportResult, error) {
	cfg, _ := LoadConfig(workspaceDir)
	result := &ExportResult{}

	// Collect exposed tools
	var exported []ExportedTool
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
			exported = append(exported, ExportedTool{
				Name:        tool.Name,
				Description: tool.Description,
				InputSchema: tool.InputSchema,
				RequestName: req.Name,
				Collection:  coll.Name,
			})
		}
	}

	if len(exported) == 0 {
		return nil, fmt.Errorf("no exposed tools to export — enable tools in config.yaml first")
	}

	// Create output directory
	outDir := filepath.Join(workspaceDir, ".reqit", "agent-lens", "mcp-server")
	os.MkdirAll(outDir, 0700)
	result.OutputDir = outDir
	result.Tools = len(exported)

	// 1. Write exported-tools.json
	expData, _ := json.MarshalIndent(ExportConfig{
		ServerName: "reqit-agent-lens-server",
		Version:    "1.0.0",
		Tools:      exported,
	}, "", "  ")
	os.WriteFile(filepath.Join(outDir, "exported-tools.json"), expData, 0600)
	result.Files = append(result.Files, "exported-tools.json")

	// 2. Write go.mod
	gomod := `module github.com/reqit/agent-lens-server

go 1.21
`
	os.WriteFile(filepath.Join(outDir, "go.mod"), []byte(gomod), 0600)
	result.Files = append(result.Files, "go.mod")

	// 3. Write go.sum (empty placeholder — user runs go mod tidy)
	os.WriteFile(filepath.Join(outDir, "go.sum"), nil, 0600)
	result.Files = append(result.Files, "go.sum")

	// 4. Write main.go
	mainGo := generateMainGo(exported)
	os.WriteFile(filepath.Join(outDir, "main.go"), []byte(mainGo), 0600)
	result.Files = append(result.Files, "main.go")

	// 5. Write README
	readme := generateReadme(exported, score, passRate)
	os.WriteFile(filepath.Join(outDir, "README.md"), []byte(readme), 0600)
	result.Files = append(result.Files, "README.md")

	return result, nil
}

// generateMainGo produces the main.go for the exported MCP server.
func generateMainGo(tools []ExportedTool) string {
	var sb strings.Builder
	sb.WriteString("package main\n\n")
	sb.WriteString("import (\n")
	sb.WriteString("\t\"encoding/json\"\n")
	sb.WriteString("\t\"fmt\"\n")
	sb.WriteString("\t\"io\"\n")
	sb.WriteString("\t\"os\"\n")
	sb.WriteString(")\n\n")

	// Tool registry as JSON string
	toolJSON, _ := json.MarshalIndent(tools, "", "  ")

	sb.WriteString("var toolsJSON = []byte(`\n")
	sb.WriteString(string(toolJSON))
	sb.WriteString("\n`)\n\n")

	sb.WriteString("type mcpRequest struct {\n")
	sb.WriteString("\tJSONRPC string         `json:\"jsonrpc\"`\n")
	sb.WriteString("\tID      any            `json:\"id\"`\n")
	sb.WriteString("\tMethod  string         `json:\"method\"`\n")
	sb.WriteString("\tParams  map[string]any `json:\"params\"`\n")
	sb.WriteString("}\n\n")

	sb.WriteString("type mcpResponse struct {\n")
	sb.WriteString("\tJSONRPC string `json:\"jsonrpc\"`\n")
	sb.WriteString("\tID      any    `json:\"id\"`\n")
	sb.WriteString("\tResult  any    `json:\"result,omitempty\"`\n")
	sb.WriteString("\tError   any    `json:\"error,omitempty\"`\n")
	sb.WriteString("}\n\n")

	sb.WriteString("func main() {\n")
	sb.WriteString("\tdat, _ := io.ReadAll(os.Stdin)\n")
	sb.WriteString("\tvar req mcpRequest\n")
	sb.WriteString("\tif err := json.Unmarshal(dat, &req); err != nil {\n")
	sb.WriteString("\t\twriteError(nil, -32700, \"Parse error\")\n")
	sb.WriteString("\t\treturn\n")
	sb.WriteString("\t}\n\n")
	sb.WriteString("\tswitch req.Method {\n")
	sb.WriteString("\tcase \"initialize\":\n")
	sb.WriteString("\t\twriteResult(req.ID, map[string]any{\n")
	sb.WriteString("\t\t\t\"protocolVersion\": \"2024-11-05\",\n")
	sb.WriteString("\t\t\t\"capabilities\":    map[string]any{\"tools\": map[string]any{}},\n")
	sb.WriteString("\t\t\t\"serverInfo\":      map[string]any{\"name\": \"reqit-agent-lens-server\", \"version\": \"1.0.0\"},\n")
	sb.WriteString("\t\t})\n")
	sb.WriteString("\tcase \"notifications/initialized\":\n")
	sb.WriteString("\tcase \"tools/list\":\n")
	sb.WriteString("\t\twriteResult(req.ID, map[string]any{\"tools\": tools})\n")
	sb.WriteString("\tcase \"tools/call\":\n")
	sb.WriteString("\t\thandleToolCall(req)\n")
	sb.WriteString("\tdefault:\n")
	sb.WriteString("\t\twriteError(req.ID, -32601, \"Method not found\")\n")
	sb.WriteString("\t}\n")
	sb.WriteString("}\n\n")

	sb.WriteString("func handleToolCall(req mcpRequest) {\n")
	sb.WriteString("\tparams, _ := req.Params[\"arguments\"].(map[string]any)\n")
	sb.WriteString("\t_ = params\n")
	sb.WriteString("\twriteResult(req.ID, map[string]any{\n")
	sb.WriteString("\t\t\"content\": []map[string]any{{\"type\": \"text\", \"text\": \"Tool executed by reqit agent lens server\"}},\n")
	sb.WriteString("\t})\n")
	sb.WriteString("}\n\n")

	sb.WriteString("func writeResult(id any, result any) {\n")
	sb.WriteString("\tout, _ := json.Marshal(mcpResponse{JSONRPC: \"2.0\", ID: id, Result: result})\n")
	sb.WriteString("\tfmt.Print(string(out))\n")
	sb.WriteString("}\n\n")

	sb.WriteString("func writeError(id any, code int, msg string) {\n")
	sb.WriteString("\tout, _ := json.Marshal(mcpResponse{JSONRPC: \"2.0\", ID: id, Error: map[string]any{\"code\": code, \"message\": msg}})\n")
	sb.WriteString("\tfmt.Print(string(out))\n")
	sb.WriteString("}\n")

	return sb.String()
}

// generateReadme produces the README.md for the exported server.
func generateReadme(tools []ExportedTool, score int, passRate float64) string {
	var sb strings.Builder
	sb.WriteString("# ReqIt Agent Lens MCP Server\n\n")
	sb.WriteString(fmt.Sprintf("This is a standalone MCP server generated by reqit Agent Lens.\n\n"))
	sb.WriteString(fmt.Sprintf("- **Score**: %d/100\n", score))
	sb.WriteString(fmt.Sprintf("- **Pass rate**: %.0f%%\n", passRate*100))
	sb.WriteString(fmt.Sprintf("- **Tools**: %d\n\n", len(tools)))

	sb.WriteString("## Tools\n\n")
	for _, t := range tools {
		sb.WriteString(fmt.Sprintf("- **%s** — %s (from %s)\n", t.Name, t.Description, t.Collection))
	}

	sb.WriteString("\n## Usage\n\n")
	sb.WriteString("```bash\n")
	sb.WriteString("go mod tidy\n")
	sb.WriteString("go build -o mcp-server .\n")
	sb.WriteString("echo '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{}}' | ./mcp-server\n")
	sb.WriteString("```\n")

	return sb.String()
}

// tools is a helper that converts the exported tools into a JSON string for embedding.
func toolsAsJSON(tools []ExportedTool) string {
	data, _ := json.MarshalIndent(tools, "", "  ")
	return string(data)
}
