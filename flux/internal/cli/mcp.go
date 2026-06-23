package cli

import (
	"fmt"
	"os"

	"flux/internal/mcp"
)

func mcpRun(wsDir string) int {
	s := mcp.NewServer(wsDir)
	mcp.RegisterAll(s)

	fmt.Fprintln(os.Stderr, "reqit MCP server started (stdio). Waiting for messages...")

	if err := s.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "MCP server error: %v\n", err)
		return 1
	}
	return 0
}
