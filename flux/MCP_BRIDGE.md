# reqit ↔ OpenCode MCP Bridge

Reqit now exposes **all** its API-client capabilities to OpenCode (and any MCP-compatible agent) in two transports.

## Transports

### 1. Stdio (default, for local OpenCode)

OpenCode spawns `reqit mcp` and talks JSON-RPC over stdin/stdout.

```bash
./build/bin/reqit mcp
```

Probe:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | ./build/bin/reqit mcp
```

### 2. HTTP (for remote OpenCode / `curl`)

```bash
./build/bin/reqit mcp --http --port 7247
# → http://127.0.0.1:7247/mcp  (POST JSON-RPC)
#   http://127.0.0.1:7247/health (GET)
#   http://127.0.0.1:7247/tools  (GET REST list)
#   http://127.0.0.1:7247/       (GET info)
```

All endpoints are CORS-enabled for browser agents.

Examples:

```bash
# list tools (REST)
curl http://127.0.0.1:7247/tools | jq

# JSON-RPC tools/list
curl -s -X POST http://127.0.0.1:7247/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | jq

# health
curl http://127.0.0.1:7247/health

# call a tool
curl -s -X POST http://127.0.0.1:7247/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"opencode_ping","arguments":{}}}' | jq
```

## OpenCode config

Copy one of the provided configs into your OpenCode config directory:

**Option A — stdio (local binary, recommended):**

`opencode.json` at workspace root or `C:\Users\USER\Desktop\falkam\opencode.json`:

```json
{
  "mcp": {
    "reqit": {
      "type": "local",
      "command": ["C:/Users/USER/Desktop/falkam/flux/build/bin/reqit.exe", "mcp"],
      "enabled": true
    }
  }
}
```

Relative variant (`flux/opencode.json`):

```json
{
  "mcp": {
    "reqit": {
      "type": "local",
      "command": ["./build/bin/reqit.exe", "mcp"],
      "enabled": true
    }
  }
}
```

**Option B — HTTP (remote, no spawn):**

First run `reqit mcp --http`, then:

```json
{
  "mcp": {
    "reqit-http": {
      "type": "remote",
      "url": "http://127.0.0.1:7247/mcp",
      "enabled": true
    }
  }
}
```

Restart OpenCode after editing the config. Verify with `opencode_ping`:

```
→ tools/call opencode_ping {} 
← "reqit MCP ✓ workspace: ... tools: 24"
```

## Tools (24 total)

### Collections (6)
`list_collections`, `get_collection`, `create_request`, `update_request`, `delete_request`, `run_collection`

### Environments (4)
`list_environments`, `get_environment`, `set_variable`, `switch_environment`

### Execution (1)
`send_request` (SSRF-blocked, no localhost/internal)

### AI (2)
`diagnose_response`, `generate_assertions`

### Git-native (3)
`diff_collection`, `get_collection_history`, `blame_request`

### Workspace (2)
`get_project_root`, `list_workspaces`

### OpenCode bridge (6) — new
`opencode_ping` — health check, returns workspace + tool count + timestamp  
`oauth_discover` — `{issuer}` → `.well-known/openid-configuration` (any provider)  
`oauth_diagnose_loopback` — tests 127.0.0.1 bind (the exact OAuth callback path)  
`event_inspector_list` — `{limit?}` → last N captured webhooks (verify status, type, time)  
`event_inspector_get` — `{id}` → full event (headers, body, replays)  
`get_request` — `{collection, request}` → full payload

All tools work over both stdio and HTTP (`POST /mcp`). The bridge is the single entry point OpenCode needs to create endpoints, drive OAuth, inspect webhooks, and run collections without touching the GUI.
