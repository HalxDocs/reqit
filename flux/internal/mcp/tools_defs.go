package mcp

var toolDefs = []Tool{
	// Collections
	{
		Name:        "list_collections",
		Description: "List all collections in the active workspace",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{}},
	},
	{
		Name:        "get_collection",
		Description: "Get a collection and all its requests by name",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"name": {Type: "string", Description: "Collection name"},
		}, Required: []string{"name"}},
	},
	{
		Name:        "create_request",
		Description: "Create a new request in a collection",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"collection": {Type: "string", Description: "Collection name"},
			"name":       {Type: "string", Description: "Request name"},
			"method":     {Type: "string", Description: "HTTP method (GET, POST, etc.)"},
			"url":        {Type: "string", Description: "Request URL"},
		}, Required: []string{"collection", "name", "method", "url"}},
	},
	{
		Name:        "update_request",
		Description: "Update an existing request's payload",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"collection": {Type: "string", Description: "Collection name"},
			"request":    {Type: "string", Description: "Request name"},
			"method":     {Type: "string", Description: "HTTP method"},
			"url":        {Type: "string", Description: "Request URL"},
			"headers":    {Type: "string", Description: "JSON array of {key, value, enabled}"},
			"body":       {Type: "string", Description: "Request body"},
		}, Required: []string{"collection", "request"}},
	},
	{
		Name:        "delete_request",
		Description: "Delete a request from a collection",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"collection": {Type: "string", Description: "Collection name"},
			"request":    {Type: "string", Description: "Request name"},
		}, Required: []string{"collection", "request"}},
	},
	{
		Name:        "run_collection",
		Description: "Run all requests in a collection sequentially and return results",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"name":        {Type: "string", Description: "Collection name"},
			"environment": {Type: "string", Description: "Environment name (optional)"},
		}, Required: []string{"name"}},
	},

	// Environments
	{
		Name:        "list_environments",
		Description: "List all environments in the active workspace",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{}},
	},
	{
		Name:        "get_environment",
		Description: "Get an environment and its variables by name",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"name": {Type: "string", Description: "Environment name"},
		}, Required: []string{"name"}},
	},
	{
		Name:        "set_variable",
		Description: "Set a variable in an environment",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"environment": {Type: "string", Description: "Environment name"},
			"key":         {Type: "string", Description: "Variable key"},
			"value":       {Type: "string", Description: "Variable value"},
		}, Required: []string{"environment", "key", "value"}},
	},
	{
		Name:        "switch_environment",
		Description: "Set the active environment",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"name": {Type: "string", Description: "Environment name"},
		}, Required: []string{"name"}},
	},

	// Execution
	{
		Name:        "send_request",
		Description: "Send an HTTP request and return the response",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"method":  {Type: "string", Description: "HTTP method (GET, POST, PUT, PATCH, DELETE)"},
			"url":     {Type: "string", Description: "Request URL"},
			"headers": {Type: "string", Description: "JSON array of {key, value, enabled} (optional)"},
			"body":    {Type: "string", Description: "Request body (optional)"},
		}, Required: []string{"method", "url"}},
	},

	// AI Tools
	{
		Name:        "diagnose_response",
		Description: "Diagnose a failed or unexpected API response using AI. Requires AI to be configured in settings.",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"method":      {Type: "string", Description: "HTTP method used"},
			"url":         {Type: "string", Description: "Request URL"},
			"status_code": {Type: "string", Description: "Response status code"},
			"body":        {Type: "string", Description: "Response body"},
		}, Required: []string{"method", "url", "status_code"}},
	},
	{
		Name:        "generate_assertions",
		Description: "Generate test assertions for a request/response pair using AI. Returns JSON array of assertions.",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"method":      {Type: "string", Description: "HTTP method used"},
			"url":         {Type: "string", Description: "Request URL"},
			"status_code": {Type: "string", Description: "Response status code"},
			"body":        {Type: "string", Description: "Response body"},
		}, Required: []string{"method", "url", "status_code"}},
	},

	// Git-native
	{
		Name:        "diff_collection",
		Description: "Show git diff for collection files in the workspace",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"from": {Type: "string", Description: "From ref (commit, branch, tag)"},
			"to":   {Type: "string", Description: "To ref (default: working tree)"},
		}},
	},
	{
		Name:        "get_collection_history",
		Description: "Show git log for collection changes",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"limit": {Type: "string", Description: "Max commits to return (default: 10)"},
		}},
	},
	{
		Name:        "blame_request",
		Description: "Find which commit last changed a specific request",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"collection": {Type: "string", Description: "Collection name"},
			"request":    {Type: "string", Description: "Request name"},
		}, Required: []string{"collection", "request"}},
	},

	// Workspace
	{
		Name:        "get_project_root",
		Description: "Get the workspace root directory path",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{}},
	},
	{
		Name:        "list_workspaces",
		Description: "List all reqit workspaces",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{}},
	},

	// OpenCode bridge — let an AI agent drive reqit end-to-end
	{
		Name:        "opencode_ping",
		Description: "Health check for the OpenCode ↔ reqit MCP bridge. Returns workspace and tool count.",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{}},
	},
	{
		Name:        "oauth_discover",
		Description: "Discover OAuth 2.0 endpoints from an issuer URL via OIDC discovery (.well-known/openid-configuration). Works with any provider (Google, Entra, Auth0, Okta, Keycloak, custom).",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"issuer": {Type: "string", Description: "Issuer base URL, e.g. https://accounts.google.com or https://login.microsoftonline.com/{tenant}/v2.0"},
		}, Required: []string{"issuer"}},
	},
	{
		Name:        "oauth_diagnose_loopback",
		Description: "Test that the OS browser can reach the loopback listener (the exact path an OAuth callback takes). Returns findings for OpenCode to surface if 'This site can't be reached'.",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{}},
	},
	{
		Name:        "event_inspector_list",
		Description: "List captured webhook events from the Event Inspector (last 50). Shows verification status, type, and timestamp.",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"limit": {Type: "string", Description: "Max events to return (default 20, max 50)"},
		}},
	},
	{
		Name:        "event_inspector_get",
		Description: "Get a single captured webhook event by ID, including headers, body, and replay history.",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"id": {Type: "string", Description: "Event ID from event_inspector_list"},
		}, Required: []string{"id"}},
	},
	{
		Name:        "get_request",
		Description: "Get a single request by collection and request name, with full payload (headers, body, auth).",
		InputSchema: InputSchema{Type: "object", Properties: map[string]PropSchema{
			"collection": {Type: "string", Description: "Collection name"},
			"request":    {Type: "string", Description: "Request name"},
		}, Required: []string{"collection", "request"}},
	},
}

// RegisterAll registers all tools on the server.
