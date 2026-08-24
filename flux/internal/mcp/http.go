package mcp

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
)

// HTTPServer exposes the MCP tools over HTTP so remote agents like OpenCode
// can connect without spawning a local stdio process. It implements the
// Streamable HTTP flavour: POST /mcp with a JSON-RPC body → JSON-RPC response.
//
// For SSE-style clients the same handler also accepts GET /mcp/sse which
// upgrades to an event stream for tools/list polling.

type HTTPServer struct {
	mcp *Server
	mu  sync.Mutex
}

// NewHTTPServer wraps an existing MCP Server for HTTP transport.
func NewHTTPServer(mcp *Server) *HTTPServer {
	return &HTTPServer{mcp: mcp}
}

// Handler returns an http.Handler that serves the MCP endpoints:
//   POST /mcp       → JSON-RPC (initialize, tools/list, tools/call)
//   GET  /mcp       → 405
//   GET  /health    → 200 ok (for OpenCode probe)
//   GET  /tools     → JSON array of tool defs (REST convenience)
func (h *HTTPServer) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/mcp", h.handleMCP)
	mux.HandleFunc("/health", h.handleHealth)
	mux.HandleFunc("/tools", h.handleToolsREST)
	mux.HandleFunc("/", h.handleRoot)
	return withCORS(mux)
}

func (h *HTTPServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprint(w, `{"status":"ok","server":"reqit-mcp"}`)
}

func (h *HTTPServer) handleRoot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	tools := make([]string, 0, len(h.mcp.tools))
	for name := range h.mcp.tools {
		tools = append(tools, name)
	}
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	enc.Encode(map[string]any{
		"name":    "reqit MCP",
		"version": "0.7.1",
		"endpoints": map[string]string{
			"mcp":    "POST /mcp  (JSON-RPC 2.0)",
			"health": "GET /health",
			"tools":  "GET /tools (REST list)",
		},
		"tools": tools,
	})
}

func (h *HTTPServer) handleToolsREST(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	tools := make([]Tool, 0, len(h.mcp.tools))
	for _, e := range h.mcp.tools {
		tools = append(tools, e.def)
	}
	json.NewEncoder(w).Encode(map[string]any{"tools": tools})
}

func (h *HTTPServer) handleMCP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeRPCError(w, nil, -32700, "parse error")
		return
	}

	var req Request
	if err := json.Unmarshal(body, &req); err != nil {
		writeRPCError(w, nil, -32700, "parse error")
		return
	}
	if req.ID == nil {
		// Notification — no response per JSON-RPC
		w.WriteHeader(http.StatusAccepted)
		return
	}
	resp := h.mcp.handleRequest(req)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func writeRPCError(w http.ResponseWriter, id json.RawMessage, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Response{
		JSONRPC: "2.0",
		ID:      id,
		Error:   &RPCError{Code: code, Message: msg},
	})
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
