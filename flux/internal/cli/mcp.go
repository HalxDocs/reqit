package cli

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"flux/internal/mcp"
)

func mcpRun(wsDir string, args []string) int {
	// Parse optional flags: --http [--port PORT]  (default stdio)
	httpMode := false
	port := "7247"
	for i := 0; i < len(args); i++ {
		if args[i] == "--http" {
			httpMode = true
		}
		if (args[i] == "--port" || args[i] == "-p") && i+1 < len(args) {
			port = args[i+1]
		}
		if strings.HasPrefix(args[i], "--port=") {
			port = strings.TrimPrefix(args[i], "--port=")
		}
	}

	s := mcp.NewServer(wsDir)
	mcp.RegisterAll(s)

	if httpMode {
		hs := mcp.NewHTTPServer(s)
		addr := ":" + port
		fmt.Fprintf(os.Stderr, "reqit MCP HTTP server listening on http://127.0.0.1%s/mcp\n", addr)
		fmt.Fprintf(os.Stderr, "  health: http://127.0.0.1%s/health   tools: http://127.0.0.1%s/tools\n", addr, addr)
		fmt.Fprintln(os.Stderr, "OpenCode → add to opencode.json: {\"mcp\": {\"reqit\": {\"type\": \"http\", \"url\": \"http://127.0.0.1:"+port+"/mcp\"}}}")
		if err := http.ListenAndServe(addr, hs.Handler()); err != nil {
			fmt.Fprintf(os.Stderr, "MCP HTTP server error: %v\n", err)
			return 1
		}
		return 0
	}

	fmt.Fprintln(os.Stderr, "reqit MCP server started (stdio). Waiting for messages...")
	fmt.Fprintln(os.Stderr, "  tip: run with --http to expose HTTP endpoints for OpenCode remote")

	if err := s.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "MCP server error: %v\n", err)
		return 1
	}
	return 0
}
