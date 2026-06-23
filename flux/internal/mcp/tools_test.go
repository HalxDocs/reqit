package mcp

import (
	"encoding/json"
	"testing"
)

func TestRegisterAll(t *testing.T) {
	s := NewServerWithIO("/tmp/test-ws", nil, nil)
	RegisterAll(s)

	if len(s.tools) == 0 {
		t.Fatal("expected tools to be registered")
	}

	// Verify expected tool names exist
	expectedTools := []string{
		"list_collections",
		"get_collection",
		"create_request",
		"update_request",
		"delete_request",
		"run_collection",
		"list_environments",
		"get_environment",
		"set_variable",
		"switch_environment",
		"send_request",
		"diagnose_response",
		"generate_assertions",
		"diff_collection",
		"get_collection_history",
		"blame_request",
		"get_project_root",
		"list_workspaces",
	}

	for _, name := range expectedTools {
		if _, ok := s.tools[name]; !ok {
			t.Errorf("expected tool %q to be registered", name)
		}
	}
}

func TestAllToolsHaveDefinitions(t *testing.T) {
	s := NewServerWithIO("/tmp/test-ws", nil, nil)
	RegisterAll(s)

	for name, entry := range s.tools {
		if entry.def.Name == "" {
			t.Errorf("tool %q has empty name", name)
		}
		if entry.def.Description == "" {
			t.Errorf("tool %q has empty description", name)
		}
		if entry.def.InputSchema.Type == "" {
			t.Errorf("tool %q has empty input schema type", name)
		}
		if entry.handler == nil {
			t.Errorf("tool %q has nil handler", name)
		}
	}
}

func TestToolsListViaServer(t *testing.T) {
	s := NewServerWithIO("/tmp/test-ws", nil, nil)
	RegisterAll(s)

	req := Request{
		JSONRPC: "2.0",
		ID:      json.RawMessage(`1`),
		Method:  "tools/list",
	}
	resp := s.handleRequest(req)

	if resp.Error != nil {
		t.Fatalf("unexpected error: %s", resp.Error.Message)
	}

	result := resp.Result.(map[string]interface{})
	tools := result["tools"].([]Tool)
	if len(tools) != len(s.tools) {
		t.Errorf("expected %d tools in list, got %d", len(s.tools), len(tools))
	}
}
