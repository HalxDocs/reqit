# Changelog

## [1.2.0] - 2026-09-02 — OAuth2 engine, Inspector suite, MCP universal & UX polish

### Highlights
- Full OAuth 2.0 rebuild (RFC 8252 loopback `127.0.0.1:0` + dual `::1`, PKCE S256 always-on, `client_secret` only for `Confidential`, fragment `HTML+JS` + `form_post` + SSO path, `state` verified, Go-only exchange, keychain `reqit:{ws}:{ref}:{host}`, `no_expiry` vs `expired` split). Fixes GitHub `bad_verification_code` retry, Entra `client_secret=undefined`, Fedora `~/.config/flux/keyring-fallback.json` + `xdg-open → gio open` fallback.
- Event Inspector v1 — Svix `whsec_` verify, cap 1000, `events.json`, `whsec_` OS keychain, `Replays`, `EventInspectorPanel` (badge `verified`/`unverified`/`duplicate`), `requester.Execute` replay.
- Realtime — `sock`/`sockhistory` (Ws/SSE, `bufio 1MB`, `Last-Event-ID`), `grpc` 4 streaming types + `proto` parsing, `testserver` (`:8080` + `:50051` with `httptest` ephemeral in tests), `TestLiveWebSocketViaSock` / `TestLiveSSEViaSock` (live `127.0.0.1`).
- **MCP universal** (24 tools, stdio `reqit mcp` + HTTP `POST /mcp` + `GET /mcp` SSE + `/.well-known/mcp` 307, `MCP-Protocol-Version` 2024-11-05/2025-03-26/2025-06-18 negotiation, CORS, configs for OpenCode/Claude/Cursor/VS Code/Generic, `MCPPanel` Overview | Traffic Inspector, demo collection 20 endpoints).
- 7 low-bloat inspector features (extend existing surfaces, no new product):
  1. **MCP Traffic Inspector** (`internal/mcp/traffic.go`, `MCPPanel` Traffic tab reusing `EventInspector` two-pane + `BodyView`).
  2. **Tool-Poisoning Scanner** (`internal/agentlens/linter.go` R6 — imperative `ignore previous instructions`, zero-width/bidi `U+200B`, `AKIA/sk-`).
  3. **Response Diffing** (`DiffSnapshots.tsx` canonical `sortKeys` JSON, header diff, `history:changed` picker).
  4. **Flaky Detection** (`internal/runhistory` `runhistory.json` cap 500, `FlakyStats` last 20, `RunnerModal` **FLAKY** amber badge).
  5. **Adversarial Assertions** (`internal/assertions/payloads.go` 6 smuggled-instruction payloads, `AssertPromptInjection`, `AssertionEditor`).
  6. **Custom Visualizers** (`VisualizerView.tsx`, `visualizerRegistry.ts`, `ResponsePane` `Visualize` tab, `visualizer.set(template,data)` + Table/Geo/Chart examples).
  7. **Tool Drift Snapshots** (`internal/agentlens/tool_snapshot.go` `tools-<collID>.json` + `.prev.json`, `DiffToolSnapshots`, `AgentLensPanel` **Drift** tab).
- 6 UX polish — grouped `Tools` (Realtime/Automation/Protocol/Platform, persisted `flux:toolsCollapsed`, 17 `view:*` `Cmd+K`), `UrlPreview` always-show + `{{}}` pill, `KeyValueEditor` `=` before `:`, `AuthTab` JWT decode, `BodyTab` `GET+body` warn + file→text keep-path, `ResponsePane` `InlineAlert`, `BodyView` 500KB banner + truncate, `useTabsStore` accurate dirty + `keep at least one tab` + confirm, `HistoryList` pagination, `CollectionsTree` **New Folder** (`FolderPlus`), `CommandPalette` federated search + debounced `SocketPanel`/`MCP Traffic`, `PanelHeader` + `lint-tokens.mjs`.
- **Fedora / Linux** — cross-platform `os.Executable()` (`bindings_mcp.go`, `MCPPanel`), `opencode.json`/`mcp.json` relative `./flux/build/bin/reqit` with `_comment` for `reqit.exe`, `Oauth2/browser.go` `gio open` fallback, `README` `webkit2gtk4.1 + libsecret`.

### OAuth2
- `feat(oauth2): add canonical types, errors, and PKCE (RFC 7636)` — `types.go:OAuthConfig/TokenResult`, `errors.go:11` sentinels, `pkce.go:Verifier` 64 chars `S256Challenge`.
- `feat(oauth2): keychain store, scrub, browser launcher, OIDC discovery, diagnostics` — `store.go` `reqit-oauth2`, `scrub.go` `Strip/Migrate/Rehydrate`, `browser.go` `open`/`rundll32`/`xdg-open`, `discovery.go` 5m cache both well-known paths, `diagnose.go` `DiagnoseLoopback`.
- `feat(oauth2): loopback listener, token exchange, manual fallback` — `loopback.go:756` dual-stack + `Note` on busy `7317`, `exchange.go:525` 6 grants + `ClientAuthBasic/Body` + `GitHub` retry, `manual.go:104` paste-back.
- `fix(oauth2): legacy State — ms expiry and FlowTimeoutSec` — `oauth2.go:26` `ExpiresAt` ms + `FlowTimeoutSec` for MFA.
- `feat(oauth2): Wails boundary — loopback + manual + device + diagnostics` — `bindings_oauth2.go` 9 bindings + `CheckForUpdates` + `InstallUpdate` (selfupdate → NSIS fallback).
- `fix(collections): scrub OAuth secrets — never write tokens to git` — `collections.go` `scrubbedForDisk` via `oauth2.MigrateAuthValue`.
- `feat(requester): silent auto-refresh before outgoing OAuth requests` — 60s skew.
- `feat(oauth): frontend OAuth2Flow + Discovery + auto-refresh UI` — grant picker (6 types, `client_credentials` + `password`/`implicit` behind amber RFC 9700 banners), presets `github/google/entra/auth0/okta/keycloak`, `OAuth2DiscoveryField`, `expiry.ts` `No expiry` neutral vs `Expired` red, live tick, `MigrateAuthValue`.
- `fix(oauth): distinguish no-expiry from expired in token panel` — `getExpiryState`/`formatExpiry` + `FLAKY` badge fix.

### Event Inspector & Realtime
- `feat: Event Inspector — capture, verify, dedupe, and replay Svix webhooks` — `internal/eventinspector` (4 files) + `EventInspectorPanel` + `smoke_test.go` live TCP + keyring.
- `feat: realtime protocols — gRPC streaming, WS/SSE sessions, and test server` — `internal/grpc` (4 files), `internal/sock`/`sockhistory`, `testserver` (`:8080` `ws` + `sse` + `:50051` gRPC), `TestLiveWebSocketViaSock` etc.

### MCP
- `feat(mcp): OpenCode bridge — HTTP transport + 6 new tools + CLI flags + config` — `http.go` `POST /mcp`, `tools.go` +6 `opencode_ping`/`oauth_*`/`event_inspector_*`, `cli/mcp.go` `--http --port 7247`, `opencode.json`/`mcp.json`.
- `feat(mcp): demo collection — 20 endpoints via OpenCode bridge` — `demo-collections/opencode-mcp-demo.json`.
- `feat(mcp): add MCP Bridge panel to UI so MCP is discoverable` — `MCPPanel.tsx` Overview + `useUIStore:view="mcp"` + `Sidebar` `Plug`.
- `feat(mcp): universal AI support — SSE, version negotiation, configs for all agents` — `http.go` SSE + `server.go` version echo `2025-06-18`, `.vscode/mcp.json` + `.cursor/mcp.json` + `claude_desktop_config.json.example` + `flux/MCP_BRIDGE.md` universal table.
- `feat(mcp): traffic inspector — Wireshark for your MCP server` — `traffic.go` + `MCPPanel` Traffic Inspector tab.

### Inspector Suite (7)
- `feat(agentlens): tool-poisoning scanner (R6)` — as above.
- `feat(response): diff across env/time + header/status + canonical JSON` — as above.
- `feat(runner): flaky request detection — history + quarantine` — as above.
- `feat(assertions): adversarial / prompt-injection payloads + assertion type` — as above.
- `feat(response): custom visualizers — render mode for HTML/templates` — as above.
- `feat(agentlens): tool description drift snapshots (git-native)` — as above.

### UX Polish (6)
- `feat(ux): navigation & discoverability` — as above.
- `feat(ux): request builder polish` — as above.
- `feat(ux): response safety` — as above.
- `feat(ux): collections/history polish` — as above.
- `feat(ux): search everywhere` — as above.
- `feat(ux): design system — PanelHeader + token lint + modal parity` — as above.
- `fix(agentlens): Analyze button now always clickable with feedback` — `loadCollections` functional `setSelectedColl`, `analyze` toast when no selection, button `disabled` only while `analyzing`.

### Platform & Docs
- `fix(linux): Fedora support — cross-platform MCP paths, keyring fallback, browser fallback` — `internal/keyring/keyring.go` `~/.config/flux/keyring-fallback.json` (0600) + 5 store files, `browser.go` `gio open` fallback, `bindings_mcp.go:os.Executable()`, `MCPPanel` `navigator.platform`, `mcp.json` relative, `MCP_BRIDGE.md` Fedora section.
- `docs: add Code of Conduct (Contributor Covenant 2.1)` + `docs: add Security Policy` + `docs(readme): update for OAuth2, MCP universal, 7 inspector features, Fedora`.
- `chore: bump version to 1.2.0 (wails + frontend)` — `wails.json:1.1.0→1.2.0`, `frontend/package.json:0.0.0→1.2.0` aligned with `updater.CurrentVersion`.

## v0.7.0 (2026-06-15) — Collaboration & Team Platform

### Collaboration Sync (Decoupled, Self-Hosted)
- WebSocket-based live sync for real-time collection sharing
- CRDT merge strategies for conflict-free concurrent edits
- Pluggable transport — built-in reference server or bring your own
- No accounts, no cloud subscriptions, data never leaves your network

### Inline Commentary
- Threaded discussions anchored to requests, configurations, and collections
- Local-only annotations stay private; shared annotations sync to team
- @-mentions and reply threading for async review cycles
- Resolved comments collapse automatically

### Role-Based Shared Workspaces (RBAC)
- **Viewer** — read collections, browse history, inspect requests
- **Editor** — create, edit, delete, run tests
- **Administrator** — manage roles, invite members, delete workspace, configure sync
- Enforced both locally and server-side with OAuth2-compatible scope model

### Visual Git Merge Utility
- Side-by-side diff for JSON, headers, and form-data bodies
- Accept-left / Accept-right / Edit-manually per conflicted segment
- Three-way merge previews
- Resolve and commit without leaving the app

### Internal Audit Logs
- Append-only, tamper-evident audit trail with incremental hashing
- Tracks create, read, update, delete, export, import, run, share, config changes
- Timeline viewer — filter by resource, user, date range
- Export as JSON or CSV for compliance

### Team Onboarding Mechanics
- Git ref–based invites: push an invite branch, teammate pulls and accepts
- Permission-wrapped invite URLs with workspace ID + default role
- Identity derived from local Git config (name + email), no sign-up required

### HTTP & Request Engine
- Full HTTP method support (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- Request cancellation mid-flight
- 30s timeout with configurable context
- Connection pooling (100 max idle, 10 per host)
- URL bar with `{{VAR}}` live resolution
- Tabbed request configuration: Params, Headers, Body (JSON, form-data, urlencoded, raw), Auth, Scripts
- Auth types: Bearer, Basic, Digest, NTLM, API Key, OAuth2 (full flow + PKCE + refresh), JWT decoder
- Pre-request / post-response JavaScript (goja engine) with variable extraction
- Response viewer: syntax-highlighted JSON/XML/HTML, status bar, headers, cookies, timeline breakdown (DNS/TCP/TLS/TTFB/download)
- Contract testing badge with violation details
- Cookie jar with auto-capture and persistent storage
- Binary response download

### Protocol Support
- **WebSocket** — connect, send/receive text, 500-message buffer, connection state tracking
- **Server-Sent Events (SSE)** — connect, parse data lines, JSON auto-detection
- **GraphQL** — queries, mutations, subscriptions (WebSocket), introspection, operation name support
- **gRPC** — gRPC-web-text unary and streaming via HTTP POST
- **SOAP** — envelope builder with header/body, SOAP 1.1 and 1.2, WSDL parsing
- **MQTT** — connect with auth, publish with QoS, subscribe to topics, message history

### Collections
- Full CRUD: create, rename, delete collections and saved requests
- Virtual scrolling for 1000+ items with ResizeObserver + binary search
- Drag-and-drop reorder with visual cyan drop-line indicators
- Move requests between collections
- Batch select / move / delete with checkboxes (Select All / Deselect All)
- Collection menu: rename, duplicate, delete, export, link spec
- Search bar with live filter and auto-hide empty collections
- Spec linking for contract validation

### API Design & Documentation
- OpenAPI spec designer with endpoint CRUD
- OpenAPI import (yaml/yml/json) → auto-creates collections
- Export collection as OpenAPI 3.0.3 JSON or self-contained Swagger UI HTML
- In-app API reference viewer from linked specs
- Markdown API docs export with configurable toggles (headers, body, examples, timestamp, base URL)
- SwaggerHub push/pull
- Stoplight push/pull

### Testing & Automation
- Collection runner with sequential and concurrent (5 worker) modes
- Retry support with 500ms backoff
- Conditional execution via JavaScript
- Test suite builder with nested test groups
- Test suite ↔ Runner integration (Run button executes suite)
- Assertion engine (status, JSON body, headers, timing)
- Load testing with configurable virtual users and latency percentiles
- JSON and HTML report generation and export
- GitHub Actions / GitLab CI / Jenkins pipeline generation
- Playwright test generation (JS/TS)
- Jest test generation (JS/TS)
- CLI runner script generation

### Git Integration
- Full git status, branch management, commit, push, pull
- Stash and pop
- Merge branches
- Diff between refs with file-level diff content
- Conflict detection and resolution (ours/theirs)
- Active contributor tracking
- ReqitInit — creates `.reqit/` directory structure with `.gitignore`
- Auto-pull on workspace mount
- Git & PR Preview panel with diff review
- Uncommitted change indicator in sidebar

### Import & Export
- **Import**: Postman v2.1 (full with pm.* transpile), Postman Environment, Insomnia, Hoppscotch, OpenAPI, cURL (paste)
- **Export**: Postman, Insomnia, Hoppscotch, OpenAPI JSON, OpenAPI HTML, cURL, Markdown, code snippets (fetch, Python, cURL)

### Mock Server
- One-click local HTTP server on configurable port
- Route matching: exact path + path params (`/users/:id`)
- Saved response replay
- Delay simulation per route
- Status code and body overrides
- CORS headers enabled by default
- Recording mode for capturing live responses
- Stateful response tracking
- Rules engine

### Security & Enterprise
- **OAuth2** — full authorize/exchange/refresh flow with PKCE
- **JWT Decoder** — inline decode with header/claims display
- **Enterprise SSO** — SAML 2.0 and OpenID Connect provider management
- **Crypto/E2EE** — AES-256-GCM encryption with Argon2id key derivation
- **Secret Vault** — 1Password, HashiCorp Vault, AWS Secrets Manager integration
- **Data Masker** — regex-based masking for Bearer, Basic, API Key (custom rules supported)
- **Air-Gap Mode** — disable telemetry, interceptor, plugin downloads, update checks, SSO, vault access
- **RBAC** — Viewer/Editor/Administrator roles with granular permissions

### Developer Experience
- Workspace management with create, switch, rename, delete, relocate, open from folder
- File watcher with auto-reload on external changes
- Environment variables with `{{VAR}}` interpolation and env switcher
- Dark/light theme with system preference auto-detect
- Keyboard shortcuts: Cmd+Enter (send), Cmd+S (save), Cmd+K (palette), Cmd+Z (undo), and more
- Command palette (Cmd+K) with searchable actions
- Tab management with Zustand store
- Undo/redo for request edits
- Auto-updater with GitHub release version checking and one-click install
- Plugin system with manifest discovery and directory-based install
- System tray with notifications and background execution
- Toast notification system
- Resizable panel splitter
- Modal system

### Interceptor (Browser Traffic Capture)
- HTTP proxy on random localhost port
- Captures requests with full details (method, URL, headers, body)
- One-click send captured request to workspace
- Chrome extension (MV3) for browser integration
- Persistent capture storage (last 1000)
- Export extension to directory

### Performance & Monitoring
- Virtual scrolling for 1000+ collection items
- Response timing breakdown (DNS, TCP, TLS, TTFB, download)
- Timeline visualization bar chart
- Load testing with percentile analysis

### Other
- In-app blog (Postman import tutorial, Git-native storage, Local-first philosophy)
- Growth panel with feature tiers, recipes, community config, badges, voting
- Telemetry (opt-in, zero by default)
- User profile with request count tracking
- Marketing web app with feature showcase and live API playground

### Bug Fixes
- Wrapped JS assertion panics in Goja with `defer recover()` to prevent app crashes
- Removed debug `log.Println` from file watcher (GUI mode compatibility)
- Changed updater version fallback to `v0.0.0-dev` so un-ldflagged builds are distinguishable
- Wired `ReqitInit` into workspace mount to ensure `.reqit/` directory structure is always created
