package mcp

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sync"
)

// JSON-RPC 2.0 types

type Request struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type Response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Result  interface{}     `json:"result,omitempty"`
	Error   *RPCError       `json:"error,omitempty"`
}

type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// MCP protocol types

type ServerInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type Capabilities struct {
	Tools *ToolsCapability `json:"tools,omitempty"`
}

type ToolsCapability struct {
	ListChanged bool `json:"listChanged,omitempty"`
}

type InitializeResult struct {
	ProtocolVersion string       `json:"protocolVersion"`
	Capabilities    Capabilities `json:"capabilities"`
	ServerInfo      ServerInfo   `json:"serverInfo"`
}

type Tool struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	InputSchema InputSchema `json:"inputSchema"`
}

type InputSchema struct {
	Type       string                `json:"type"`
	Properties map[string]PropSchema `json:"properties"`
	Required   []string              `json:"required,omitempty"`
}

type PropSchema struct {
	Type        string `json:"type"`
	Description string `json:"description,omitempty"`
}

type ToolCallParams struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

type ToolResult struct {
	Content []ContentBlock `json:"content"`
	IsError bool           `json:"isError,omitempty"`
}

type ContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

type ToolHandler func(args json.RawMessage) (string, error)

type toolEntry struct {
	def     Tool
	handler ToolHandler
}

// Server reads JSON-RPC from an io.Reader and writes to an io.Writer.

type Server struct {
	mu        sync.Mutex
	reader    *bufio.Reader
	writer    *bufio.Writer
	tools     map[string]toolEntry
	workspace string
}

func NewServer(workspaceDir string) *Server {
	return &Server{
		reader:    bufio.NewReader(os.Stdin),
		writer:    bufio.NewWriter(os.Stdout),
		tools:     make(map[string]toolEntry),
		workspace: workspaceDir,
	}
}

// NewServerWithIO creates a server with custom reader/writer (for testing or embedding).
func NewServerWithIO(workspaceDir string, r io.Reader, w io.Writer) *Server {
	return &Server{
		reader:    bufio.NewReader(r),
		writer:    bufio.NewWriter(w),
		tools:     make(map[string]toolEntry),
		workspace: workspaceDir,
	}
}

func (s *Server) RegisterTool(tool Tool, handler ToolHandler) {
	s.tools[tool.Name] = toolEntry{def: tool, handler: handler}
}

func (s *Server) Run() error {
	for {
		line, err := s.reader.ReadBytes('\n')
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return fmt.Errorf("read: %w", err)
		}

		var req Request
		if err := json.Unmarshal(line, &req); err != nil {
			continue
		}

		if req.ID == nil {
			continue
		}

		resp := s.handleRequest(req)
		s.writeResponse(resp)
	}
}

func (s *Server) handleRequest(req Request) Response {
	switch req.Method {
	case "initialize":
		return s.handleInitialize(req)
	case "tools/list":
		return s.handleToolsList(req)
	case "tools/call":
		return s.handleToolsCall(req)
	case "notifications/initialized":
		return Response{JSONRPC: "2.0", ID: req.ID, Result: nil}
	default:
		return Response{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error:   &RPCError{Code: -32601, Message: fmt.Sprintf("method not found: %s", req.Method)},
		}
	}
}

func (s *Server) handleInitialize(req Request) Response {
	result := InitializeResult{
		ProtocolVersion: "2024-11-05",
		Capabilities: Capabilities{
			Tools: &ToolsCapability{ListChanged: false},
		},
		ServerInfo: ServerInfo{
			Name:    "reqit",
			Version: "0.7.1",
		},
	}
	return Response{JSONRPC: "2.0", ID: req.ID, Result: result}
}

func (s *Server) handleToolsList(req Request) Response {
	tools := make([]Tool, 0, len(s.tools))
	for _, e := range s.tools {
		tools = append(tools, e.def)
	}
	return Response{JSONRPC: "2.0", ID: req.ID, Result: map[string]interface{}{
		"tools": tools,
	}}
}

func (s *Server) handleToolsCall(req Request) Response {
	var params ToolCallParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return Response{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error:   &RPCError{Code: -32602, Message: "invalid params"},
		}
	}

	entry, ok := s.tools[params.Name]
	if !ok {
		return Response{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error:   &RPCError{Code: -32601, Message: fmt.Sprintf("unknown tool: %s", params.Name)},
		}
	}

	result, err := entry.handler(params.Arguments)
	if err != nil {
		return Response{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: ToolResult{
				Content: []ContentBlock{{Type: "text", Text: fmt.Sprintf("Error: %s", err.Error())}},
				IsError: true,
			},
		}
	}

	return Response{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result: ToolResult{
			Content: []ContentBlock{{Type: "text", Text: result}},
		},
	}
}

func (s *Server) writeResponse(resp Response) {
	s.mu.Lock()
	defer s.mu.Unlock()

	b, err := json.Marshal(resp)
	if err != nil {
		return
	}
	b = append(b, '\n')
	s.writer.Write(b)
	s.writer.Flush()
}
