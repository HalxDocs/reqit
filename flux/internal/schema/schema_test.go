package schema

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestCaptureSnapshot(t *testing.T) {
	// Create a minimal OpenAPI spec with no requestBody (avoids loader network resolution)
	spec := map[string]interface{}{
		"openapi": "3.0.3",
		"info":    map[string]interface{}{"title": "Test API", "version": "1.0.0"},
		"paths": map[string]interface{}{
			"/users": map[string]interface{}{
				"get": map[string]interface{}{
					"operationId": "listUsers",
					"parameters": []interface{}{
						map[string]interface{}{
							"name": "limit",
							"in":   "query",
							"schema": map[string]interface{}{
								"type": "integer",
							},
						},
					},
					"responses": map[string]interface{}{
						"200": map[string]interface{}{
							"description": "OK",
						},
					},
				},
			},
		},
	}

	tmpDir := t.TempDir()
	specPath := filepath.Join(tmpDir, "test-spec.json")

	data, _ := json.Marshal(spec)
	if err := os.WriteFile(specPath, data, 0644); err != nil {
		t.Fatal(err)
	}

	snap, err := CaptureSnapshot(specPath)
	if err != nil {
		t.Fatalf("CaptureSnapshot failed: %v", err)
	}

	if snap.Version != "3.0.3" {
		t.Errorf("expected version 3.0.3, got %s", snap.Version)
	}
	if len(snap.Endpoints) != 1 {
		t.Fatalf("expected 1 endpoint, got %d", len(snap.Endpoints))
	}

	ep := snap.Endpoints[0]
	if ep.Method != "GET" || ep.Path != "/users" {
		t.Errorf("expected GET /users, got %s %s", ep.Method, ep.Path)
	}
	if ep.OperationID != "listUsers" {
		t.Errorf("expected listUsers, got %s", ep.OperationID)
	}
	if len(ep.Parameters) != 1 {
		t.Fatalf("expected 1 parameter, got %d", len(ep.Parameters))
	}
	if ep.Parameters[0].Name != "limit" || ep.Parameters[0].In != "query" {
		t.Errorf("expected query param 'limit', got %s in %s", ep.Parameters[0].Name, ep.Parameters[0].In)
	}
}

func TestDetectDrift_NoChanges(t *testing.T) {
	old := &Snapshot{
		Version: "3.0.3",
		Endpoints: []Endpoint{
			{Method: "GET", Path: "/users", OperationID: "listUsers"},
		},
	}
	new := &Snapshot{
		Version: "3.0.3",
		Endpoints: []Endpoint{
			{Method: "GET", Path: "/users", OperationID: "listUsers"},
		},
	}

	drift := DetectDrift(old, new)
	if drift.HasChanges() {
		t.Errorf("expected no changes, got: %s", drift.Summary)
	}
}

func TestDetectDrift_AddedEndpoint(t *testing.T) {
	old := &Snapshot{
		Version: "3.0.3",
		Endpoints: []Endpoint{
			{Method: "GET", Path: "/users"},
		},
	}
	new := &Snapshot{
		Version: "3.0.3",
		Endpoints: []Endpoint{
			{Method: "GET", Path: "/users"},
			{Method: "POST", Path: "/users"},
		},
	}

	drift := DetectDrift(old, new)
	if len(drift.Added) != 1 {
		t.Fatalf("expected 1 added, got %d", len(drift.Added))
	}
	if drift.Added[0].Method != "POST" || drift.Added[0].Path != "/users" {
		t.Errorf("expected POST /users added, got %s %s", drift.Added[0].Method, drift.Added[0].Path)
	}
}

func TestDetectDrift_RemovedEndpoint(t *testing.T) {
	old := &Snapshot{
		Version: "3.0.3",
		Endpoints: []Endpoint{
			{Method: "GET", Path: "/users"},
			{Method: "DELETE", Path: "/users/{id}"},
		},
	}
	new := &Snapshot{
		Version: "3.0.3",
		Endpoints: []Endpoint{
			{Method: "GET", Path: "/users"},
		},
	}

	drift := DetectDrift(old, new)
	if len(drift.Removed) != 1 {
		t.Fatalf("expected 1 removed, got %d", len(drift.Removed))
	}
	if drift.Removed[0].Method != "DELETE" {
		t.Errorf("expected DELETE removed, got %s", drift.Removed[0].Method)
	}
}

func TestDetectDrift_ModifiedEndpoint(t *testing.T) {
	old := &Snapshot{
		Version: "3.0.3",
		Endpoints: []Endpoint{
			{
				Method: "POST",
				Path:   "/users",
				RequestBody: &SchemaRef{Type: "object"},
			},
		},
	}
	new := &Snapshot{
		Version: "3.0.3",
		Endpoints: []Endpoint{
			{
				Method: "POST",
				Path:   "/users",
				RequestBody: &SchemaRef{
					Type: "object",
					Properties: map[string]*SchemaRef{
						"name": {Type: "string"},
					},
				},
			},
		},
	}

	drift := DetectDrift(old, new)
	if len(drift.Changed) != 1 {
		t.Fatalf("expected 1 changed, got %d", len(drift.Changed))
	}
	if len(drift.Changed[0].Changes) != 1 {
		t.Fatalf("expected 1 field change, got %d", len(drift.Changed[0].Changes))
	}
	if drift.Changed[0].Changes[0].Field != "requestBody" {
		t.Errorf("expected requestBody change, got %s", drift.Changed[0].Changes[0].Field)
	}
}

func TestSaveAndLoadSnapshot(t *testing.T) {
	wsDir := t.TempDir()
	snap := &Snapshot{
		Version: "3.0.3",
		Endpoints: []Endpoint{
			{Method: "GET", Path: "/users"},
		},
	}

	if err := SaveSnapshot(wsDir, "my-api.json", snap); err != nil {
		t.Fatalf("SaveSnapshot failed: %v", err)
	}

	loaded, err := LoadSnapshot(wsDir, "my-api.json")
	if err != nil {
		t.Fatalf("LoadSnapshot failed: %v", err)
	}

	if loaded.Version != "3.0.3" {
		t.Errorf("expected version 3.0.3, got %s", loaded.Version)
	}
	if len(loaded.Endpoints) != 1 {
		t.Fatalf("expected 1 endpoint, got %d", len(loaded.Endpoints))
	}
}

func TestHasChanges(t *testing.T) {
	drift := &Drift{}
	if drift.HasChanges() {
		t.Error("empty drift should not have changes")
	}

	drift.Added = append(drift.Added, EndpointDrift{Method: "GET", Path: "/test"})
	if !drift.HasChanges() {
		t.Error("drift with added endpoints should have changes")
	}
}

func TestBreakingChanges(t *testing.T) {
	drift := &Drift{
		Removed: []EndpointDrift{
			{Method: "DELETE", Path: "/old"},
		},
		Changed: []EndpointDrift{
			{
				Method: "POST",
				Path:   "/users",
				Changes: []FieldChange{
					{Field: "requestBody", Kind: "changed"},
				},
			},
			{
				Method: "GET",
				Path:   "/items",
				Changes: []FieldChange{
					{Field: "response 200", Kind: "changed"},
				},
			},
		},
	}

	breaking := drift.BreakingChanges()
	if len(breaking) != 2 {
		t.Fatalf("expected 2 breaking changes, got %d", len(breaking))
	}
}

func TestEndpointKey(t *testing.T) {
	key := endpointKey("GET", "/users")
	if key != "GET /users" {
		t.Errorf("expected 'GET /users', got '%s'", key)
	}
}

func TestFormatSchema(t *testing.T) {
	if s := formatSchema(nil); s != "" {
		t.Errorf("expected empty string for nil schema, got %s", s)
	}
	if s := formatSchema(&SchemaRef{Ref: "#/components/schemas/User"}); s == "" {
		t.Error("expected non-empty string for ref schema")
	}
	if s := formatSchema(&SchemaRef{Type: "string"}); s == "" {
		t.Error("expected non-empty string for typed schema")
	}
}
