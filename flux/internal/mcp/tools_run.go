package mcp

import (
	"context"
	"encoding/json"
	"flux/internal/collections"
	"flux/internal/crypto"
	"flux/internal/environments"
	"flux/internal/models"
	"flux/internal/requester"
	"fmt"
	"strings"
	"time"
)

func handleRunCollection(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Name        string `json:"name"`
			Environment string `json:"environment"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return "", err
		}

		store := collections.NewStore(wsDir)
		all, err := store.GetAll()
		if err != nil {
			return "", err
		}

		var coll *models.Collection
		for i := range all {
			if all[i].Name == p.Name {
				coll = &all[i]
				break
			}
		}
		if coll == nil {
			return "", fmt.Errorf("collection not found: %s", p.Name)
		}

		if len(coll.Requests) == 0 {
			return fmt.Sprintf("Collection %q has no requests.", p.Name), nil
		}

		// Load environments
		es := environments.NewStore(wsDir, crypto.App())
		envSnap, err := es.Get()
		if err != nil {
			return "", fmt.Errorf("load environments: %w", err)
		}
		var env *models.Environment
		if p.Environment != "" {
			for i := range envSnap.Environments {
				if envSnap.Environments[i].Name == p.Environment {
					env = &envSnap.Environments[i]
					break
				}
			}
		} else if envSnap.Active != "" {
			for i := range envSnap.Environments {
				if envSnap.Environments[i].ID == envSnap.Active {
					env = &envSnap.Environments[i]
					break
				}
			}
		}

		envMap := make(map[string]string)
		if env != nil {
			for _, v := range env.Vars {
				if v.Enabled && v.Key != "" {
					envMap[v.Key] = v.Value
				}
			}
		}

		var sb strings.Builder
		var passed, failed int
		fmt.Fprintf(&sb, "Running collection: %s (%d requests)\n\n", p.Name, len(coll.Requests))

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		for _, req := range coll.Requests {
			if ctx.Err() != nil {
				fmt.Fprintf(&sb, "\n⚠ Collection run cancelled (timeout)\n")
				break
			}
			payload := resolvePayloadMCP(req.Payload, envMap)
			res := requester.Execute(ctx, payload, nil)

			if res.Error != "" {
				failed++
				fmt.Fprintf(&sb, "✕ %s [%s %s] ERROR: %s\n", req.Name, payload.Method, payload.URL, res.Error)
			} else {
				passed++
				fmt.Fprintf(&sb, "✓ %s [%s %s] %d %dms\n", req.Name, payload.Method, payload.URL, res.StatusCode, res.TimingMs)
			}
		}

		fmt.Fprintf(&sb, "\n%d passed, %d failed, %d total", passed, failed, len(coll.Requests))
		return sb.String(), nil
	}
}

// --- Environments ---
