package mcp

import (
	"encoding/json"
	"flux/internal/environments"
	"flux/internal/models"
	"fmt"
	"strings"
)

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
