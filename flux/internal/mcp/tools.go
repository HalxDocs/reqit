package mcp

import (
	"encoding/json"
	"fmt"
)

// Tool definitions

func RegisterAll(s *Server) {
	for _, tool := range toolDefs {
		name := tool.Name
		s.RegisterTool(tool, makeHandler(name, s.workspace))
	}
}

func makeHandler(name, wsDir string) ToolHandler {
	switch name {
	case "list_collections":
		return handleListCollections(wsDir)
	case "get_collection":
		return handleGetCollection(wsDir)
	case "create_request":
		return handleCreateRequest(wsDir)
	case "update_request":
		return handleUpdateRequest(wsDir)
	case "delete_request":
		return handleDeleteRequest(wsDir)
	case "run_collection":
		return handleRunCollection(wsDir)
	case "list_environments":
		return handleListEnvironments(wsDir)
	case "get_environment":
		return handleGetEnvironment(wsDir)
	case "set_variable":
		return handleSetVariable(wsDir)
	case "switch_environment":
		return handleSwitchEnvironment(wsDir)
	case "send_request":
		return handleSendRequest()
	case "diagnose_response":
		return handleDiagnoseResponse(wsDir)
	case "generate_assertions":
		return handleGenerateAssertions(wsDir)
	case "diff_collection":
		return handleDiffCollection(wsDir)
	case "get_collection_history":
		return handleGetCollectionHistory(wsDir)
	case "blame_request":
		return handleBlameRequest(wsDir)
	case "get_project_root":
		return handleGetProjectRoot(wsDir)
	case "list_workspaces":
		return handleListWorkspaces()
	case "opencode_ping":
		return handleOpencodePing(wsDir)
	case "oauth_discover":
		return handleOAuthDiscover()
	case "oauth_diagnose_loopback":
		return handleOAuthDiagnoseLoopback()
	case "event_inspector_list":
		return handleEventInspectorList(wsDir)
	case "event_inspector_get":
		return handleEventInspectorGet(wsDir)
	case "get_request":
		return handleGetRequest(wsDir)
	default:
		return func(args json.RawMessage) (string, error) {
			return "", fmt.Errorf("unknown tool: %s", name)
		}
	}
}

// --- Collections ---
