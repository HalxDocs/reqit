package mcp

import (
	"encoding/json"
	"flux/internal/collections"
	"flux/internal/models"
	"fmt"
	"strings"
)

func handleListCollections(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		store := collections.NewStore(wsDir)
		all, err := store.GetAll()
		if err != nil {
			return "", err
		}
		var sb strings.Builder
		for _, c := range all {
			fmt.Fprintf(&sb, "- **%s** (%d requests)\n", c.Name, len(c.Requests))
		}
		if sb.Len() == 0 {
			return "No collections found.", nil
		}
		return sb.String(), nil
	}
}

func handleGetCollection(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Name string `json:"name"`
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
			if c.Name == p.Name {
				b, err := json.MarshalIndent(c, "", "  ")
				if err != nil {
					return "", fmt.Errorf("marshal collection: %w", err)
				}
				return string(b), nil
			}
		}
		return "", fmt.Errorf("collection not found: %s", p.Name)
	}
}

func handleCreateRequest(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Collection string `json:"collection"`
			Name       string `json:"name"`
			Method     string `json:"method"`
			URL        string `json:"url"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return "", err
		}
		store := collections.NewStore(wsDir)
		all, err := store.GetAll()
		if err != nil {
			return "", err
		}
		for i, c := range all {
			if c.Name == p.Collection {
				payload := models.RequestPayload{
					Method: p.Method,
					URL:    p.URL,
					Headers: []models.Header{
						{Key: "Content-Type", Value: "application/json", Enabled: false},
					},
					BodyType: "none",
				}
				_, err := store.AddRequest(c.ID, p.Name, payload)
				if err != nil {
					return "", err
				}
				_ = i
				return fmt.Sprintf("Created request %q in collection %q", p.Name, p.Collection), nil
			}
		}
		return "", fmt.Errorf("collection not found: %s", p.Collection)
	}
}

func handleUpdateRequest(wsDir string) ToolHandler {
	return func(args json.RawMessage) (string, error) {
		var p struct {
			Collection string `json:"collection"`
			Request    string `json:"request"`
			Method     string `json:"method"`
			URL        string `json:"url"`
			Body       string `json:"body"`
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
						payload := r.Payload
						if p.Method != "" {
							payload.Method = p.Method
						}
						if p.URL != "" {
							payload.URL = p.URL
						}
						if p.Body != "" {
							payload.Body = p.Body
						}
						if err := store.UpdateRequest(r.ID, p.Request, payload); err != nil {
							return "", err
						}
						return fmt.Sprintf("Updated request %q", p.Request), nil
					}
				}
				return "", fmt.Errorf("request not found: %s", p.Request)
			}
		}
		return "", fmt.Errorf("collection not found: %s", p.Collection)
	}
}

func handleDeleteRequest(wsDir string) ToolHandler {
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
						if err := store.DeleteRequest(r.ID); err != nil {
							return "", err
						}
						return fmt.Sprintf("Deleted request %q from %q", p.Request, p.Collection), nil
					}
				}
				return "", fmt.Errorf("request not found: %s", p.Request)
			}
		}
		return "", fmt.Errorf("collection not found: %s", p.Collection)
	}
}
