# reqit ↔ Any AI — MCP Bridge (OpenCode, Claude, Cursor, VS Code)

Reqit exposes **all** its API-client capabilities to *any* MCP-compatible agent
(OpenCode, Claude Code/Desktop, Cursor, VS Code, ChatGPT, generic) in two
transports. 24 tools in one server (no split — you don't use Windsurf).

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

### 2. HTTP (for remote agents / `curl` / ChatGPT)

```bash
./build/bin/reqit mcp --http --port 7247
# → http://127.0.0.1:7247/mcp      (POST JSON-RPC — Streamable HTTP)
#   http://127.0.0.1:7247/mcp      (GET  Accept: text/event-stream → SSE)
#   http://127.0.0.1:7247/.well-known/mcp → 307 to /mcp (discovery)
#   http://127.0.0.1:7247/health   (GET)
#   http://127.0.0.1:7247/tools    (GET REST list)
#   http://127.0.0.1:7247/         (GET info)
```

CORS allows `Authorization`, `Mcp-Session-Id`, `MCP-Protocol-Version`; server echoes the client's `MCP-Protocol-Version` (`2024-11-05` / `2025-03-26` / `2025-06-18`) for universal negotiation.

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

## Configs — one file per AI (copy & restart the agent)

All files are already generated in this repo. Copy the one your AI reads:

| AI | File to use / copy to | Type |
|---|---|---|
| **OpenCode** | `opencode.json` or `flux/opencode.json` | `local` (`reqit mcp`) |
| **Generic** | `mcp.json` (repo root) or `flux/mcp.json` | `mcpServers.reqit` |
| **VS Code** | `.vscode/mcp.json` and `flux/.vscode/mcp.json` | `servers.reqit` |
| **Cursor** | `.cursor/mcp.json` and `flux/.cursor/mcp.json` | `mcpServers.reqit` |
| **Claude Desktop** | `claude_desktop_config.json.example` → `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/.config/Claude/claude_desktop_config.json` (Linux) | `mcpServers` |
| **Claude Code** | `claude mcp add reqit -- ./flux/build/bin/reqit mcp` (Linux) or `C:/.../reqit.exe mcp` (Windows) | CLI |

**Stdio (local binary, recommended for OpenCode/Claude/Cursor/VS Code):**

`opencode.json` / `mcp.json` / `.vscode/mcp.json` all contain (Windows `reqit.exe`, Linux `reqit`):
```json
{ "mcpServers": { "reqit": { "command": "./flux/build/bin/reqit", "args": ["mcp"], "cwd": "." } } }
```
On Fedora Linux: build with `go build -o flux/build/bin/reqit .` (no `.exe`), ensure `chmod +x`.

**HTTP (remote, no spawn — for ChatGPT, remote OpenCode, `curl`):**

First run `reqit mcp --http --port 7247`, then:

```json
{ "mcp": { "reqit-http": { "type": "remote", "url": "http://127.0.0.1:7247/mcp", "enabled": true } } }
```

Verify any agent with:

```
→ tools/call opencode_ping {}
← "reqit MCP ✓ workspace: ... tools: 24"
```

## Fedora / Linux notes

- **Deps:** `sudo dnf install webkit2gtk4.1 libsecret gnome-keyring` (for `go-keyring` SecretService) or rely on the new file fallback at `~/.config/flux/keyring-fallback.json` (0600) if SecretService is unavailable.
- **Browser:** OAuth `xdg-open` now falls back to `gio open` / `sensible-browser` for Wayland.
- **Binary:** `flux/build/bin/reqit` (no `.exe`), `chmod +x` after `go build`.
- **MCP config:** use `./flux/build/bin/reqit` (not `.exe`) in JSON; `cwd` is `"."` at repo root.

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
