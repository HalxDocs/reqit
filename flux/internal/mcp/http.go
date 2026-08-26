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
//   POST /mcp       → JSON-RPC (initialize, tools/list, tools/call) — Streamable HTTP
//   GET  /mcp       → SSE stream (for remote ChatGPT/Cursor HTTP clients)
//   GET  /.well-known/mcp → 307 redirect to /mcp (discovery probe)
//   GET  /health    → 200 ok (for probes)
//   GET  /tools     → JSON array of tool defs (REST convenience)
func (h *HTTPServer) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/mcp", h.handleMCP)
	mux.HandleFunc("/.well-known/mcp", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/mcp", http.StatusTemporaryRedirect)
	})
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
	// SSE for remote clients that GET /mcp with Accept: text/event-stream
	if r.Method == http.MethodGet {
		accept := r.Header.Get("Accept")
		if accept == "text/event-stream" || r.URL.Query().Get("transport") == "sse" {
			h.handleMCPSSE(w, r)
			return
		}
		// Generic GET probe — return info
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"name":    "reqit MCP",
			"version": "0.7.1",
			"transports": []string{"stdio", "http"},
			"endpoints": map[string]string{
				"mcp":   "POST /mcp (JSON-RPC) or GET /mcp with Accept: text/event-stream (SSE)",
				"tools": "GET /tools",
			},
		})
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	// Echo client's requested protocol version for negotiation (universal)
	if v := r.Header.Get("MCP-Protocol-Version"); v != "" {
		w.Header().Set("MCP-Protocol-Version", v)
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

func (h *HTTPServer) handleMCPSSE(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}
	fmt.Fprintf(w, "event: endpoint\ndata: /mcp\n\n")
	flusher.Flush()
	tools := make([]Tool, 0, len(h.mcp.tools))
	for _, e := range h.mcp.tools {
		tools = append(tools, e.def)
	}
	payload, _ := json.Marshal(map[string]any{"tools": tools})
	fmt.Fprintf(w, "event: message\ndata: %s\n\n", payload)
	flusher.Flush()
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
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version")
		w.Header().Set("Access-Control-Expose-Headers", "Mcp-Session-Id, MCP-Protocol-Version")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
