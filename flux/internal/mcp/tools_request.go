package mcp

import (
	"encoding/json"
	"flux/internal/collections"
	"fmt"
)

func handleGetRequest(wsDir string) ToolHandler {
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
		for _, c := range all {
			if c.Name == p.Collection {
				for _, r := range c.Requests {
					if r.Name == p.Request {
						b, _ := json.MarshalIndent(r, "", "  ")
						return string(b), nil
					}
				}
				return "", fmt.Errorf("request %q not found in collection %q", p.Request, p.Collection)
			}
		}
		return "", fmt.Errorf("collection not found: %s", p.Collection)
	}
}

// --- Helpers ---
