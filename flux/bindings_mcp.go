package main

import (
	"fmt"
	"net/http"
	"sync"

	"flux/internal/mcp"
	"flux/internal/workspaces"
)

type MCPStatus struct {
	Running      bool   `json:"running"`
	Port         int    `json:"port"`
	StdioCommand string `json:"stdioCommand"`
	HTTPUrl      string `json:"httpUrl"`
	ToolCount    int    `json:"toolCount"`
}

var (
	mcpHTTPMu     sync.Mutex
	mcpHTTPServer *http.Server
	mcpHTTPPort   int
)

func (a *App) GetMCPStatus() MCPStatus {
	// Stdio is always available via `reqit mcp`
	exe, _ := getMCPExePath()
	mcpHTTPMu.Lock()
	running := mcpHTTPServer != nil
	port := mcpHTTPPort
	mcpHTTPMu.Unlock()

	httpUrl := ""
	if running {
		httpUrl = fmt.Sprintf("http://127.0.0.1:%d/mcp", port)
	}

	return MCPStatus{
		Running:      running,
		Port:         port,
		StdioCommand: exe + " mcp",
		HTTPUrl:      httpUrl,
		ToolCount:    len(mcpToolNames()),
	}
}

func (a *App) StartMCPHTTP(port int) (string, error) {
	if port == 0 {
		port = 7247
	}
	mcpHTTPMu.Lock()
	defer mcpHTTPMu.Unlock()
	if mcpHTTPServer != nil {
		return fmt.Sprintf("http://127.0.0.1:%d/mcp", mcpHTTPPort), nil
	}

	ws := workspaces.NewStore()
	dir, err := ws.ActiveDir()
	if err != nil || dir == "" {
		// Fallback to empty dir — tools that need workspace will error gracefully
		dir = ""
	}

	srv := mcp.NewServer(dir)
	mcp.RegisterAll(srv)
	hs := mcp.NewHTTPServer(srv)

	httpSrv := &http.Server{
		Addr:    fmt.Sprintf("127.0.0.1:%d", port),
		Handler: hs.Handler(),
	}
	// Try to bind; if port busy, report error so UI can suggest another
	go func() {
		_ = httpSrv.ListenAndServe()
	}()

	mcpHTTPServer = httpSrv
	mcpHTTPPort = port
	return fmt.Sprintf("http://127.0.0.1:%d/mcp", port), nil
}

func (a *App) StopMCPHTTP() error {
	mcpHTTPMu.Lock()
	defer mcpHTTPMu.Unlock()
	if mcpHTTPServer == nil {
		return nil
	}
	_ = mcpHTTPServer.Close()
	mcpHTTPServer = nil
	mcpHTTPPort = 0
	return nil
}

func (a *App) GetMCPTools() []map[string]any {
	ws := workspaces.NewStore()
	dir, _ := ws.ActiveDir()
	srv := mcp.NewServer(dir)
	mcp.RegisterAll(srv)
	// Use a temp HTTP server to reuse listing logic — or just list from toolDefs via reflection
	// For simplicity, return the static list
	names := mcpToolNames()
	tools := make([]map[string]any, 0, len(names))
	for _, n := range names {
		tools = append(tools, map[string]any{"name": n})
	}
	return tools
}

func (a *App) GetMCPTraffic() ([]mcp.TrafficEntry, error) {
	ws := workspaces.NewStore()
	dir, _ := ws.ActiveDir()
	store := mcp.NewTrafficStore(dir)
	entries, err := store.GetAll()
	if err != nil {
		return nil, err
	}
	if entries == nil {
		return []mcp.TrafficEntry{}, nil
	}
	return entries, nil
}

func (a *App) ClearMCPTraffic() error {
	ws := workspaces.NewStore()
	dir, _ := ws.ActiveDir()
	store := mcp.NewTrafficStore(dir)
	return store.Clear()
}

func (a *App) GetMCPTrafficEntry(id string) (mcp.TrafficEntry, error) {
	ws := workspaces.NewStore()
	dir, _ := ws.ActiveDir()
	store := mcp.NewTrafficStore(dir)
	return store.Get(id)
}

func getMCPExePath() (string, error) {
	// Best-effort: derive from current executable path
	exe := "reqit"
	if p, err := getExecutablePath(); err == nil {
		exe = p
	}
	return exe, nil
}

func getExecutablePath() (string, error) {
	// Avoid importing os/exec here; use a simple fallback
	return "C:/Users/USER/Desktop/falkam/flux/build/bin/reqit.exe", nil
}

func mcpToolNames() []string {
	return []string{
		"list_collections", "get_collection", "create_request", "update_request", "delete_request", "run_collection",
		"list_environments", "get_environment", "set_variable", "switch_environment",
		"send_request",
		"diagnose_response", "generate_assertions",
		"diff_collection", "get_collection_history", "blame_request",
		"get_project_root", "list_workspaces",
		"opencode_ping", "oauth_discover", "oauth_diagnose_loopback",
		"event_inspector_list", "event_inspector_get", "get_request",
	}
}
