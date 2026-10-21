package mcp

import (
	"encoding/json"
	"flux/internal/collections"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

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
