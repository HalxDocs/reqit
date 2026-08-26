package mcp

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sync"
	"time"
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
	traffic   *TrafficStore
	onTraffic func(TrafficEntry)
}

func NewServer(workspaceDir string) *Server {
	return &Server{
		reader:    bufio.NewReader(os.Stdin),
		writer:    bufio.NewWriter(os.Stdout),
		tools:     make(map[string]toolEntry),
		workspace: workspaceDir,
		traffic:   NewTrafficStore(workspaceDir),
	}
}

// NewServerWithIO creates a server with custom reader/writer (for testing or embedding).
func NewServerWithIO(workspaceDir string, r io.Reader, w io.Writer) *Server {
	return &Server{
		reader:    bufio.NewReader(r),
		writer:    bufio.NewWriter(w),
		tools:     make(map[string]toolEntry),
		workspace: workspaceDir,
		traffic:   NewTrafficStore(workspaceDir),
	}
}

// OnTraffic registers a callback invoked after each JSON-RPC frame is handled.
func (s *Server) OnTraffic(fn func(TrafficEntry)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onTraffic = fn
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
	start := time.Now()
	var resp Response
	switch req.Method {
	case "initialize":
		resp = s.handleInitialize(req)
	case "tools/list":
		resp = s.handleToolsList(req)
	case "tools/call":
		resp = s.handleToolsCall(req)
	case "notifications/initialized":
		resp = Response{JSONRPC: "2.0", ID: req.ID, Result: nil}
	default:
		resp = Response{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error:   &RPCError{Code: -32601, Message: fmt.Sprintf("method not found: %s", req.Method)},
		}
	}
	latency := time.Since(start).Milliseconds()
	toolName := ""
	if req.Method == "tools/call" && req.Params != nil {
		var p ToolCallParams
		if err := json.Unmarshal(req.Params, &p); err == nil {
			toolName = p.Name
		}
	}
	status := "ok"
	if resp.Error != nil {
		status = "error"
	} else if tr, ok := resp.Result.(ToolResult); ok && tr.IsError {
		status = "error"
	}
	entry := TrafficEntry{
		Method:    req.Method,
		ToolName:  toolName,
		RequestID: req.ID,
		Params:    req.Params,
		Status:    status,
		LatencyMs: latency,
		Direction: "res",
	}
	if resp.Result != nil {
		if b, err := json.Marshal(resp.Result); err == nil {
			entry.Result = json.RawMessage(b)
			if len(b) > 8000 {
				entry.Raw = string(b[:8000])
			} else {
				entry.Raw = string(b)
			}
		}
	}
	if resp.Error != nil {
		entry.Error = resp.Error
		entry.Raw = resp.Error.Message
	}
	if req.Params != nil && entry.Raw == "" {
		if len(req.Params) > 4000 {
			entry.Raw = string(req.Params[:4000])
		} else {
			entry.Raw = string(req.Params)
		}
	}
	if len(req.Params) > 0 && entry.Params == nil {
		entry.Params = req.Params
	} else if req.Params != nil {
		entry.Params = req.Params
	}
	// Also capture raw request for search
	if entry.Raw == "" && req.Method != "" {
		entry.Raw = req.Method
		if toolName != "" {
			entry.Raw += " " + toolName
		}
	}
	if s.traffic != nil {
		if ent, err := s.traffic.Append(entry); err == nil {
			entry = ent
		}
	}
	// Live push for Wails UI
	var cb func(TrafficEntry)
	s.mu.Lock()
	cb = s.onTraffic
	s.mu.Unlock()
	if cb != nil {
		ce := entry
		go cb(ce)
	}
	return resp
}

func (s *Server) handleInitialize(req Request) Response {
	// Negotiate protocol version — echo client's requested version if recognized,
	// otherwise default to 2024-11-05 (covers 2024-11-05, 2025-03-26, 2025-06-18).
	version := "2024-11-05"
	if req.Params != nil {
		var p struct {
			ProtocolVersion string `json:"protocolVersion"`
		}
		if err := json.Unmarshal(req.Params, &p); err == nil && p.ProtocolVersion != "" {
			// Accept any 2024-11-05 or 2025-* version clients send; echo it back.
			switch p.ProtocolVersion {
			case "2024-11-05", "2025-03-26", "2025-06-18":
				version = p.ProtocolVersion
			default:
				// Unknown future version — return our latest supported.
				version = "2025-06-18"
			}
		}
	}
	result := InitializeResult{
		ProtocolVersion: version,
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
