package mcp

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestHandleInitialize(t *testing.T) {
	s := NewServerWithIO("/tmp/test-ws", nil, nil)

	req := Request{
		JSONRPC: "2.0",
		ID:      json.RawMessage(`1`),
		Method:  "initialize",
	}
	resp := s.handleRequest(req)

	if resp.JSONRPC != "2.0" {
		t.Errorf("expected jsonrpc 2.0, got %s", resp.JSONRPC)
	}
	if resp.Error != nil {
		t.Fatalf("unexpected error: %s", resp.Error.Message)
	}

	var result InitializeResult
	b, _ := json.Marshal(resp.Result)
	if err := json.Unmarshal(b, &result); err != nil {
		t.Fatalf("unmarshal result: %v", err)
	}
	if result.ProtocolVersion != "2024-11-05" {
		t.Errorf("expected protocol 2024-11-05, got %s", result.ProtocolVersion)
	}
	if result.ServerInfo.Name != "reqit" {
		t.Errorf("expected server name reqit, got %s", result.ServerInfo.Name)
	}
}

func TestHandleToolsListEmpty(t *testing.T) {
	s := NewServerWithIO("/tmp/test-ws", nil, nil)

	req := Request{
		JSONRPC: "2.0",
		ID:      json.RawMessage(`1`),
		Method:  "tools/list",
	}
	resp := s.handleRequest(req)

	if resp.Error != nil {
		t.Fatalf("unexpected error: %s", resp.Error.Message)
	}

	result, ok := resp.Result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map result, got %T", resp.Result)
	}
	tools, ok := result["tools"].([]Tool)
	if !ok {
		t.Fatalf("expected tools array, got %T", result["tools"])
	}
	if len(tools) != 0 {
		t.Errorf("expected 0 tools, got %d", len(tools))
	}
}

func TestHandleToolsListWithRegistered(t *testing.T) {
	s := NewServerWithIO("/tmp/test-ws", nil, nil)

	s.RegisterTool(Tool{
		Name:        "test_tool",
		Description: "A test tool",
		InputSchema: InputSchema{
			Type: "object",
			Properties: map[string]PropSchema{
				"input": {Type: "string", Description: "test input"},
			},
		},
	}, func(args json.RawMessage) (string, error) {
		return "ok", nil
	})

	req := Request{
		JSONRPC: "2.0",
		ID:      json.RawMessage(`1`),
		Method:  "tools/list",
	}
	resp := s.handleRequest(req)

	result := resp.Result.(map[string]interface{})
	tools := result["tools"].([]Tool)
	if len(tools) != 1 {
		t.Fatalf("expected 1 tool, got %d", len(tools))
	}
	if tools[0].Name != "test_tool" {
		t.Errorf("expected test_tool, got %s", tools[0].Name)
	}
}

func TestHandleToolsCall(t *testing.T) {
	s := NewServerWithIO("/tmp/test-ws", nil, nil)

	s.RegisterTool(Tool{
		Name:        "echo",
		Description: "Echoes input",
		InputSchema: InputSchema{
			Type:       "object",
			Properties: map[string]PropSchema{"msg": {Type: "string"}},
		},
	}, func(args json.RawMessage) (string, error) {
		var p struct{ Msg string `json:"msg"` }
		json.Unmarshal(args, &p)
		return "echo:" + p.Msg, nil
	})

	params, _ := json.Marshal(ToolCallParams{
		Name:      "echo",
		Arguments: json.RawMessage(`{"msg":"hello"}`),
	})
	req := Request{
		JSONRPC: "2.0",
		ID:      json.RawMessage(`1`),
		Method:  "tools/call",
		Params:  params,
	}
	resp := s.handleRequest(req)

	if resp.Error != nil {
		t.Fatalf("unexpected error: %s", resp.Error.Message)
	}

	result := resp.Result.(ToolResult)
	if result.IsError {
		t.Fatal("expected no error result")
	}
	if len(result.Content) != 1 || result.Content[0].Text != "echo:hello" {
		t.Errorf("expected 'echo:hello', got %v", result.Content)
	}
}

func TestHandleToolsCallUnknown(t *testing.T) {
	s := NewServerWithIO("/tmp/test-ws", nil, nil)

	params, _ := json.Marshal(ToolCallParams{
		Name:      "nonexistent",
		Arguments: json.RawMessage(`{}`),
	})
	req := Request{
		JSONRPC: "2.0",
		ID:      json.RawMessage(`1`),
		Method:  "tools/call",
		Params:  params,
	}
	resp := s.handleRequest(req)

	if resp.Error == nil {
		t.Fatal("expected error for unknown tool")
	}
	if resp.Error.Code != -32601 {
		t.Errorf("expected code -32601, got %d", resp.Error.Code)
	}
}

func TestHandleMethodNotFound(t *testing.T) {
	s := NewServerWithIO("/tmp/test-ws", nil, nil)

	req := Request{
		JSONRPC: "2.0",
		ID:      json.RawMessage(`1`),
		Method:  "unknown/method",
	}
	resp := s.handleRequest(req)

	if resp.Error == nil {
		t.Fatal("expected error for unknown method")
	}
	if resp.Error.Code != -32601 {
		t.Errorf("expected code -32601, got %d", resp.Error.Code)
	}
}

func TestToolHandlerError(t *testing.T) {
	s := NewServerWithIO("/tmp/test-ws", nil, nil)

	s.RegisterTool(Tool{
		Name:        "fail",
		Description: "Always fails",
		InputSchema: InputSchema{Type: "object"},
	}, func(args json.RawMessage) (string, error) {
		var x struct{}; return "", json.Unmarshal([]byte("invalid"), &x) // force error
	})

	params, _ := json.Marshal(ToolCallParams{
		Name:      "fail",
		Arguments: json.RawMessage(`{}`),
	})
	req := Request{
		JSONRPC: "2.0",
		ID:      json.RawMessage(`1`),
		Method:  "tools/call",
		Params:  params,
	}
	resp := s.handleRequest(req)

	result := resp.Result.(ToolResult)
	if !result.IsError {
		t.Fatal("expected error result")
	}
}

func TestNotificationNoResponse(t *testing.T) {
	s := NewServerWithIO("/tmp/test-ws", nil, nil)

	req := Request{
		JSONRPC: "2.0",
		Method:  "notifications/initialized",
	}
	if req.ID != nil {
		t.Fatal("expected nil ID for notification")
	}

	resp := s.handleRequest(req)
	if resp.Error != nil {
		t.Errorf("unexpected error: %s", resp.Error.Message)
	}
}

func TestMultipleTools(t *testing.T) {
	s := NewServerWithIO("/tmp/test-ws", nil, nil)

	toolDefs := []struct {
		name string
		fn   ToolHandler
	}{
		{"list_collections", func(args json.RawMessage) (string, error) { return "col1\ncol2", nil }},
		{"list_environments", func(args json.RawMessage) (string, error) { return "env1", nil }},
		{"get_project_root", func(args json.RawMessage) (string, error) { return "/tmp/test", nil }},
	}

	for _, td := range toolDefs {
		s.RegisterTool(Tool{
			Name:        td.name,
			Description: "test",
			InputSchema: InputSchema{Type: "object"},
		}, td.fn)
	}

	req := Request{
		JSONRPC: "2.0",
		ID:      json.RawMessage(`1`),
		Method:  "tools/list",
	}
	resp := s.handleRequest(req)
	result := resp.Result.(map[string]interface{})
	toolList := result["tools"].([]Tool)
	if len(toolList) != 3 {
		t.Errorf("expected 3 tools, got %d", len(toolList))
	}
}

func TestWriteResponse(t *testing.T) {
	var buf bytes.Buffer
	s := NewServerWithIO("/tmp/test-ws", nil, &buf)

	resp := Response{
		JSONRPC: "2.0",
		ID:      json.RawMessage(`1`),
		Result:  "test",
	}
	s.writeResponse(resp)

	output := buf.String()
	if len(output) == 0 {
		t.Fatal("expected output, got empty")
	}
	if output[len(output)-1] != '\n' {
		t.Error("expected newline terminator")
	}

	var parsed Response
	if err := json.Unmarshal([]byte(output[:len(output)-1]), &parsed); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if parsed.JSONRPC != "2.0" {
		t.Errorf("expected jsonrpc 2.0, got %s", parsed.JSONRPC)
	}
}

func TestRunEOF(t *testing.T) {
	var buf bytes.Buffer
	s := NewServerWithIO("/tmp/test-ws", &buf, nil)

	err := s.Run()
	if err != nil {
		t.Errorf("expected nil on EOF, got %v", err)
	}
}

func TestRunHandlesRequest(t *testing.T) {
	s := NewServerWithIO("/tmp/test-ws", nil, nil)

	s.RegisterTool(Tool{
		Name:        "ping",
		Description: "pong",
		InputSchema: InputSchema{Type: "object"},
	}, func(args json.RawMessage) (string, error) {
		return "pong", nil
	})

	// Test handleRequest directly with valid params
	params, _ := json.Marshal(ToolCallParams{
		Name:      "ping",
		Arguments: json.RawMessage(`{}`),
	})
	req := Request{
		JSONRPC: "2.0",
		ID:      json.RawMessage(`1`),
		Method:  "tools/call",
		Params:  params,
	}
	resp := s.handleRequest(req)
	if resp.Error != nil {
		t.Fatalf("unexpected error: %s", resp.Error.Message)
	}
	result := resp.Result.(ToolResult)
	if len(result.Content) != 1 || result.Content[0].Text != "pong" {
		t.Errorf("expected 'pong', got %v", result.Content)
	}
}
