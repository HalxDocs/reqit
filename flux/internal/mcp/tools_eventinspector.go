package mcp

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func handleEventInspectorList(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Limit string `json:"limit"`
		}
		json.Unmarshal(args, &p)
		limit := 20
		if p.Limit != "" {
			fmt.Sscanf(p.Limit, "%d", &limit)
		}
		if limit > 50 {
			limit = 50
		}
		// Event Inspector stores events under wsDir — use a direct file read
		// to avoid importing the store (keeps this handler leaf).
		eventsFile := filepath.Join(wsDir, ".reqit", "events.json")
		// Also try the legacy path
		if _, err := os.Stat(eventsFile); os.IsNotExist(err) {
			eventsFile = filepath.Join(wsDir, "events.json")
		}
		data, err := os.ReadFile(eventsFile)
		if err != nil {
			if os.IsNotExist(err) {
				return "No events captured yet. Start the Event Inspector listener and send a webhook.", nil
			}
			return "", err
		}
		var wrapper struct {
			Events []map[string]any `json:"events"`
		}
		if err := json.Unmarshal(data, &wrapper); err != nil {
			return "", err
		}
		if len(wrapper.Events) == 0 {
			return "No events captured yet.", nil
		}
		if len(wrapper.Events) > limit {
			wrapper.Events = wrapper.Events[:limit]
		}
		var sb strings.Builder
		for i, e := range wrapper.Events {
			id, _ := e["id"].(string)
			verify, _ := e["verifyStatus"].(string)
			typ, _ := e["eventType"].(string)
			at, _ := e["receivedAt"].(string)
			fmt.Fprintf(&sb, "%d. %s [%s] %s — %s\n", i+1, id, verify, typ, at)
		}
		return sb.String(), nil
	}
}

func handleEventInspectorGet(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return "", err
		}
		if p.ID == "" {
			return "", fmt.Errorf("id is required")
		}
		eventsFile := filepath.Join(wsDir, ".reqit", "events.json")
		if _, err := os.Stat(eventsFile); os.IsNotExist(err) {
			eventsFile = filepath.Join(wsDir, "events.json")
		}
		data, err := os.ReadFile(eventsFile)
		if err != nil {
			return "", err
		}
		var wrapper struct {
			Events []map[string]any `json:"events"`
		}
		if err := json.Unmarshal(data, &wrapper); err != nil {
			return "", err
		}
		for _, e := range wrapper.Events {
			if e["id"] == p.ID {
				b, _ := json.MarshalIndent(e, "", "  ")
				return string(b), nil
			}
		}
		return "", fmt.Errorf("event not found: %s", p.ID)
	}
}
