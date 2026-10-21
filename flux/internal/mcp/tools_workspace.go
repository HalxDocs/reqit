package mcp

import (
	"encoding/json"
	"flux/internal/workspaces"
	"fmt"
	"strings"
	"time"
)

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

// --- OpenCode bridge ---

func handleOpencodePing(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		return fmt.Sprintf("reqit MCP ✓\nworkspace: %s\ntools: %d\ntime: %s", wsDir, len(toolDefs), time.Now().Format(time.RFC3339)), nil
	}
}
