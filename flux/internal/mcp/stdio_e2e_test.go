package mcp

import (
	"bufio"
	"encoding/json"
	"os"
	"strings"
	"testing"

	"flux/internal/collections"
)

// The MCP server is driven the way a client drives it: JSON-RPC messages on
// stdin, responses on stdout. These tests go through the same path as
// `reqit mcp`, so a tool that cannot be reached from a client fails here.

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// runServer feeds the given messages to the server and returns its output
// lines.
func runServer(t *testing.T, wsDir string, messages ...string) []rpcResponse {
	t.Helper()

	in := strings.NewReader(strings.Join(messages, "\n") + "\n")
	out := &strings.Builder{}

	s := NewServerWithIO(wsDir, in, out)
	RegisterAll(s)
	if err := s.Run(); err != nil {
		t.Fatalf("server run: %v", err)
	}

	var responses []rpcResponse
	scanner := bufio.NewScanner(strings.NewReader(out.String()))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var resp rpcResponse
		if err := json.Unmarshal([]byte(line), &resp); err != nil {
			t.Fatalf("response is not valid JSON: %q", line)
		}
		responses = append(responses, resp)
	}
	return responses
}

func TestStdioServerInitializesAndListsTools(t *testing.T) {
	ws := newWorkspace(t)
	seedCollection(t, ws, "Auth API")

	responses := runServer(t, ws,
		`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}`,
		`{"jsonrpc":"2.0","id":2,"method":"tools/list"}`,
	)

	if len(responses) != 2 {
		t.Fatalf("expected 2 responses, got %d", len(responses))
	}

	init := responses[0]
	if init.Error != nil {
		t.Fatalf("initialize failed: %s", init.Error.Message)
	}
	var initResult struct {
		ProtocolVersion string `json:"protocolVersion"`
		Capabilities    struct {
			Tools struct {
				ListChanged bool `json:"listChanged"`
			} `json:"tools"`
		} `json:"capabilities"`
		ServerInfo struct {
			Name    string `json:"name"`
			Version string `json:"version"`
		} `json:"serverInfo"`
	}
	if err := json.Unmarshal(init.Result, &initResult); err != nil {
		t.Fatalf("initialize result: %v", err)
	}
	if initResult.ProtocolVersion == "" {
		t.Error("the server did not report a protocol version")
	}
	if initResult.ServerInfo.Name == "" {
		t.Error("the server did not report its name")
	}

	list := responses[1]
	if list.Error != nil {
		t.Fatalf("tools/list failed: %s", list.Error.Message)
	}
	var listResult struct {
		Tools []struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			InputSchema struct {
				Type string `json:"type"`
			} `json:"inputSchema"`
		} `json:"tools"`
	}
	if err := json.Unmarshal(list.Result, &listResult); err != nil {
		t.Fatalf("tools/list result: %v", err)
	}
	if len(listResult.Tools) == 0 {
		t.Fatal("expected the server to advertise tools")
	}

	// Every advertised tool must have a schema an MCP client can use.
	for _, tool := range listResult.Tools {
		if tool.Name == "" {
			t.Error("a tool was advertised without a name")
		}
		if tool.InputSchema.Type == "" {
			t.Errorf("tool %q has no input schema type", tool.Name)
		}
	}
}

func TestStdioServerCallsARealTool(t *testing.T) {
	ws := newWorkspace(t)
	seedCollection(t, ws, "Payments")

	responses := runServer(t, ws,
		`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}`,
		`{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_collections","arguments":{}}}`,
	)

	if len(responses) != 2 {
		t.Fatalf("expected 2 responses, got %d", len(responses))
	}

	call := responses[1]
	if call.Error != nil {
		t.Fatalf("tools/call failed: %s", call.Error.Message)
	}
	var callResult struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		IsError bool `json:"isError"`
	}
	if err := json.Unmarshal(call.Result, &callResult); err != nil {
		t.Fatalf("tools/call result: %v", err)
	}
	if callResult.IsError {
		t.Fatal("the tool reported an error")
	}
	if len(callResult.Content) == 0 {
		t.Fatal("the tool returned no content")
	}
	if !strings.Contains(callResult.Content[0].Text, "Payments") {
		t.Errorf("expected the collection in the tool output, got %q", callResult.Content[0].Text)
	}
}

func TestStdioServerReportsAnUnknownTool(t *testing.T) {
	ws := newWorkspace(t)

	responses := runServer(t, ws,
		`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"no_such_tool","arguments":{}}}`,
	)

	if len(responses) != 1 {
		t.Fatalf("expected 1 response, got %d", len(responses))
	}
	if responses[0].Error == nil {
		t.Error("expected an error for an unknown tool")
	}
}

// A tool must not be able to reach a collection the client cannot see.
func TestStdioToolCannotEscapeTheWorkspace(t *testing.T) {
	ws := newWorkspace(t)
	seedCollection(t, ws, "Visible")

	// A collection outside the workspace must not appear.
	outside := newWorkspace(t)
	seedCollection(t, outside, "Hidden")

	responses := runServer(t, ws,
		`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_collections","arguments":{}}}`,
	)
	if len(responses) != 1 {
		t.Fatalf("expected 1 response, got %d", len(responses))
	}
	var callResult struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(responses[0].Result, &callResult); err != nil {
		t.Fatal(err)
	}
	text := callResult.Content[0].Text
	if !strings.Contains(text, "Visible") {
		t.Errorf("expected the workspace collection, got %q", text)
	}
	if strings.Contains(text, "Hidden") {
		t.Errorf("a collection from another workspace leaked: %q", text)
	}
}

var _ = os.Stdout
var _ = collections.NewStore
