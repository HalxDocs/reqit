package mcp

import (
	"flux/internal/models"
	"flux/internal/vars"
)

// resolvePayloadMCP substitutes environment variables into a request before
// the MCP tools send it.
//
// It used to do the substitution inline with a string replacer that never
// matched, so only an exact "{{key}}" with no whitespace was replaced — the
// CLI and the runner both accept "{{ key }}". The shared implementation is
// used now so all three agree.
func resolvePayloadMCP(p models.RequestPayload, env map[string]string) models.RequestPayload {
	return vars.ResolvePayload(p, env, nil)
}
