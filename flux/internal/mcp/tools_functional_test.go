package mcp

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"flux/internal/collections"
	"flux/internal/environments"
	"flux/internal/models"
)

// These tests exercise the real tool handlers against a real workspace, so a
// tool cannot silently stop working while the protocol layer still passes.

func newWorkspace(t *testing.T) string {
	t.Helper()
	ws := t.TempDir()
	// The data directory is created on demand by the stores.
	if err := os.MkdirAll(filepath.Join(ws, ".reqit"), 0o755); err != nil {
		t.Fatal(err)
	}
	return ws
}

func seedCollection(t *testing.T, ws, name string) models.Collection {
	t.Helper()
	store := collections.NewStore(ws)
	coll, err := store.CreateCollection(name)
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}
	return coll
}

func call(t *testing.T, handler ToolHandler, args any) string {
	t.Helper()
	raw, err := json.Marshal(args)
	if err != nil {
		t.Fatal(err)
	}
	out, err := handler(raw)
	if err != nil {
		t.Fatalf("tool returned an error: %v", err)
	}
	return out
}

func TestListCollectionsReturnsRealCollections(t *testing.T) {
	ws := newWorkspace(t)
	seedCollection(t, ws, "Auth API")

	out := call(t, handleListCollections(ws), map[string]any{})

	if !strings.Contains(out, "Auth API") {
		t.Errorf("expected the collection in the output, got %q", out)
	}
}

func TestListCollectionsOnAnEmptyWorkspace(t *testing.T) {
	ws := newWorkspace(t)
	out := call(t, handleListCollections(ws), map[string]any{})
	if !strings.Contains(out, "No collections") {
		t.Errorf("expected the empty-state message, got %q", out)
	}
}

func TestGetCollectionFindsACollection(t *testing.T) {
	ws := newWorkspace(t)
	seedCollection(t, ws, "Payments")

	out := call(t, handleGetCollection(ws), map[string]any{"name": "Payments"})
	if !strings.Contains(out, "Payments") {
		t.Errorf("expected the collection, got %q", out)
	}
}

func TestGetCollectionReportsAMissingName(t *testing.T) {
	ws := newWorkspace(t)
	raw, _ := json.Marshal(map[string]any{"name": "Nope"})
	if _, err := handleGetCollection(ws)(raw); err == nil {
		t.Error("expected an error for a collection that does not exist")
	}
}

func TestCreateRequestAddsToTheCollection(t *testing.T) {
	ws := newWorkspace(t)
	coll := seedCollection(t, ws, "Users")

	out := call(t, handleCreateRequest(ws), map[string]any{
		"collection": coll.Name,
		"name":       "GET /users",
		"method":     "GET",
		"url":        "https://api.example.com/users",
	})
	if out == "" {
		t.Fatal("expected a response")
	}

	all, err := collections.NewStore(ws).GetAll()
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, c := range all {
		for _, r := range c.Requests {
			if r.Name == "GET /users" {
				found = true
			}
		}
	}
	if !found {
		t.Error("the request was not added to the collection")
	}
}

func TestEnvironmentToolsReadAndWrite(t *testing.T) {
	ws := newWorkspace(t)

	// Environments are created in the app, not over MCP, so seed one first.
	es := environments.NewStore(ws, nil)
	created, err := es.Create("staging")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	listOut := call(t, handleListEnvironments(ws), map[string]any{})
	if !strings.Contains(listOut, "staging") {
		t.Errorf("expected the environment in the list, got %q", listOut)
	}

	getOut := call(t, handleGetEnvironment(ws), map[string]any{"name": "staging"})
	if !strings.Contains(getOut, "staging") {
		t.Errorf("expected the environment, got %q", getOut)
	}

	// The environment is stored in the workspace data directory.
	envs, err := environments.NewStore(ws, nil).Get()
	if err != nil {
		t.Fatal(err)
	}
	if len(envs.Environments) != 1 || envs.Environments[0].ID != created.ID {
		t.Errorf("environment was not stored: %+v", envs.Environments)
	}
}

func TestSetVariableStoresTheValue(t *testing.T) {
	ws := newWorkspace(t)
	es := environments.NewStore(ws, nil)
	if _, err := es.Create("dev"); err != nil {
		t.Fatalf("Create: %v", err)
	}

	out := call(t, handleSetVariable(ws), map[string]any{
		"environment": "dev",
		"key":         "api_key",
		"value":       "sk-test-123",
	})
	if !strings.Contains(out, "api_key") {
		t.Errorf("expected the variable in the response, got %q", out)
	}

	envs, err := environments.NewStore(ws, nil).Get()
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, e := range envs.Environments {
		for _, v := range e.Vars {
			if v.Key == "api_key" && v.Value == "sk-test-123" {
				found = true
			}
		}
	}
	if !found {
		t.Errorf("the variable was not stored: %+v", envs.Environments)
	}
}

// The tools read the workspace through the stores, which keep their files in
// the .reqit directory. A tool that built its own path would drift from that.
func TestToolsReadTheDataDirectory(t *testing.T) {
	ws := newWorkspace(t)
	seedCollection(t, ws, "InDataDir")

	if _, err := os.Stat(filepath.Join(ws, ".reqit", "collections", "index.json")); err != nil {
		t.Fatalf("the collection was not written to the data directory: %v", err)
	}
}
