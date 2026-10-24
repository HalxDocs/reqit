# Changelog

## [2.5.0] - 2026-10-22 — Secrets Stay Out of Git, Conditional Mock Rules, Vault References

### New
- Environment values no longer reach git — reqit's data moved into `.reqit/` and the ignore rules now cover the files that actually exist
- Environment files are encrypted at rest with AES-256-GCM, using the key held in your OS keychain
- Existing workspaces migrate their data into `.reqit/` automatically on first launch
- `{{VAULT_NAME}}` references are resolved at request time from 1Password, HashiCorp Vault or AWS — the secret is never written to disk
- Mock server rules — match on method, path, header or query and answer with your own status, body and delay
- Backup health in the Git panel: reqit now tells you whether your collections have actually left your machine
- CI runs the Go and frontend suites on every push, plus the OAuth 2.0 suite against a real Keycloak

### Fixed
- Ctrl+S did nothing — two commands claimed the shortcut and the wrong one won
- Ctrl+Z was swallowed in text fields, so undo never worked; the URL field now has its own history
- The macOS update could not be applied — the release is a zip and the updater only handled gzip
- The app reported 2.0.0 in About on every release; the bundle version now comes from the tag
- The What's New panel was empty for every release since v1.1.0, and showed the wrong version's notes
- Deleting a stored secret failed on any machine without a keyring daemon

### Under the hood
- One implementation of `{{variable}}` substitution — the CLI, runner and MCP had drifted apart
- cURL parsing follows POSIX quoting, so nested JSON in a body is no longer corrupted
- app.go and the MCP tools split into focused files; a dead OAuth 2.0 engine and an unreachable mock rules engine were removed

## [2.4.0] - 2026-10-13 — Backup health, crash + timing fixes, hermetic test suite

### Fixes
- `fix(eventinspector): stop SIGSEGV when listener stopped right after start` — the serve goroutine read `l.server` unlocked while `Stop()` set it to `nil`, panicking the whole app. Reproduced by `go test`: `net/http.(*Server).Serve` on a nil receiver. Now captures the server in a local. Verified with `-race`.
- `fix(requester): stop reporting 0ms for sub-millisecond requests` — `Duration.Milliseconds()` truncates, so a fast local request reported `0ms` for DNS, TCP, TLS, TTFB, download **and** total. The frontend already hedged with `timing.totalMs || 1`, so the zero was a known-but-unfixed case. Adds `msDuration`/`msBetween` helpers that round real elapsed time up to at least 1ms while leaving genuine zero as zero.
- `fix(request): keep long URLs scrolling with the caret in the URL bar` — the highlight overlay only re-synced via `onScroll`, which programmatic value updates never fire, leaving long URLs cut off. Re-glues the overlay in a layout effect and pins the viewport to the end when the caret is at the end.
- `fix(build): keep the go:embed placeholder so a fresh clone builds` — `main.go` embeds `all:frontend/dist`, but that directory was fully gitignored, so `go build ./...` failed on any clean checkout. Commits a `.gitkeep` and switches the rules to `dist/*`.
- `fix(build): recreate the embed placeholder after every frontend build` — vite's `emptyOutDir` wiped the `.gitkeep`, so building and then committing would silently re-break fresh clones.

### Features
- `feat(git): surface backup health and debounce auto-sync` — collections and environments already lived in git, but nothing told a user whether their data had actually left the machine:
  - Debounced auto-sync, so a burst of mutations becomes one commit+push instead of one per binding call.
  - Sync outcomes are recorded, including `no git credentials`, which previously no-op'd silently.
  - New `GetBackupStatus`, derived live from git — remote, credentials, uncommitted work, unpushed commits, last push time, and plain-English `problems`. `HasUnpushedCommits` errs toward "unpushed" so an unbacked-up workspace is never reported safe.
  - Emits status at startup; the Git panel shows a **Not backed up** banner with a fix action, or a quiet `Backed up Nm ago` when healthy.
  - `CommitAndPush` now fails loudly instead of returning `nil` after a commit-only save with no credentials.
  - Adds the first test file for `internal/git`.

### Developer Experience
- `test(oauth2): gate Keycloak container behind explicit opt-in` — `setupKeycloak` skipped only when docker was *absent*, so any machine with Docker installed pulled a ~500MB Keycloak image and waited up to 180s on every `go test ./...`. Having `docker` on `PATH` is not consent to boot a container; now requires `TEST_KEYCLOAK_DOCKER` (or `KEYCLOAK_URL`) and honours `-short`. Container names made unique so a crashed run cannot block the next. Package went from a 60s timeout to **0.84s**; the full suite now completes in ~8s.
- `fix(test): stop confirm-guarded actions deadlocking the suite` — `showConfirm()` only settles when a real modal renders, so any test touching a confirm-guarded action hung forever instead of failing. Defaults the confirm in test setup; individual tests can override for the cancel path. Also refreshed the last-tab close test, which still asserted the empty-state behaviour intentionally replaced on 2026-09-01.
- `docs: test instructions with the live-provider opt-in variables` — the gated Keycloak/Entra/GitHub tests were undiscoverable.

## [2.3.0] - 2026-09-19 — Re-tag of 2.2.1

- Identical tree to `v2.2.1` (same tree hash `6a4bf7c`) — a re-release, not new code. No functional changes from 2.2.1.

## [2.2.1] - 2026-09-19 — URL bar sizing and Linux download fixes

### Fixes
- `fix(request): invalid-URL banner no longer squeezes the URL field` — the banner rendered as a flex item inside the URL row, so the moment a URL turned invalid (e.g. typing `:`, where bare `https` resolves against the localhost base and counts as valid but `https:` does not) the long message stole all flex width and the input collapsed to a sliver. It now renders full-width below the row.
- `fix(web): Linux download never 404s` — the button looked up only one asset name; after the v2.2.0 rename (raw binary → tarball) any miss fell back to a dead URL and GitHub served a 404. Now tries candidates in order (`tar.gz`, then legacy raw) against the release assets before falling back to the direct link. Docs Linux section updated to the tarball flow.

## [2.2.0] - 2026-09-18 — URL bar rework, Linux packaging, hook-order crash fix

### Fixes
- `fix(request): remove inset variable button to restore full URL width` — follows `reserve padding for inset variable button` and `move variable-insert button out of URL input`.
- `fix(frontend): hook after early return in UrlPreview crashed on URL edit` — a hook was called after an early return, breaking hook order and crashing on every URL edit. `chore(frontend)` additionally logs component stacks in `ErrorBoundary` to make hook-order crashes diagnosable.
- `fix(collections): keep URL-named requests flat in tree` + clarify the invalid-URL hint.

### Features
- `feat(request): Postman-style auto-save for New Request + Content-Type auto-check`.

### Platform
- `fix(linux): tarball-ready updater, desktop entry, docs` — the updater extracts the executable from `.tar.gz` archives (gzip sniffed, regular files only, 200MiB cap) with 5 new tests, and a `flux/build/linux/reqit.desktop` launcher entry ships alongside. WebApp download button, README and DOCS point at `reqit-linux-amd64.tar.gz` with extract and system-wide/per-user install instructions.
- Release workflow packages Linux artifacts into a tarball and adjusts checksum calculations.

## [2.1.0] - 2026-09-02 — Diff ignore patterns

### Features
- `feat(response): add ignore patterns to diff` — exclude volatile values so response diffs show only meaningful changes. Adds `diffIgnore.ts` (exact + glob matching), `useDiffIgnoreStore` with global defaults, per-request overrides and header patterns (localStorage-persisted), and `DiffIgnoreModal` with Global / Per-Request / Headers tabs. Defaults ignore `timestamp`, `requestId`, `traceId`, `spanId`, `createdAt`, `updatedAt`, `*Id`; headers ignore `Date`, `X-Request-Id`, `X-Correlation-Id`, `ETag`, `X-Trace-Id`, `X-Span-Id`. `DiffSnapshots.tsx` applies patterns before canonicalisation and gains a settings button.

## [2.0.0] - 2026-09-02 — OAuth2 engine, Inspector suite, MCP universal & UX polish

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
