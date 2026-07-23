# reqit — Go + Wails Desktop API Client

Modern, local-first desktop API client built with [Wails v2](https://wails.io) (Go backend + React/TypeScript frontend). Supports HTTP, WebSocket, Socket.IO, gRPC, GraphQL, MQTT, SOAP — with collections, environments, mock servers, scripting, Git sync, and a built-in runner.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Directory Tree with File Purposes](#directory-tree-with-file-purposes)
  - [Root Files](#root-files)
  - [internal/ — Go Backend Packages](#internal--go-backend-packages)
  - [frontend/ — React/TypeScript UI](#frontend--reacttypescript-ui)
  - [Root Config Files](#root-config-files)
- [Build & Dev](#build--dev)
- [Auto-Update System](#auto-update-system)
- [CI / Release](#ci--release)
- [Data Storage](#data-storage)
- [Adding a Backend Method](#adding-a-backend-method)
- [License](#license)

---

## Quick Start

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
cd flux
wails dev
```

Production build:

```bash
wails build
```

Output: `build/bin/reqit` (or `reqit.exe` on Windows).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Wails Runtime                         │
├──────────────────────┬──────────────────────────────────┤
│  Go Backend (main)   │  React/TypeScript Frontend       │
│  ─────────────────── │  ──────────────────────────────  │
│  app.go + bindings   │  App.tsx + features/*            │
│  internal/ packages  │  shared/ components & hooks       │
│                      │                                  │
│  Wails Bind → JSON   │  wailsjs/go/ (auto-generated)    │
│  EventsEmit ← Events │  EventsOn (runtime events)      │
└──────────────────────┴──────────────────────────────────┘
```

**Go backend** (`package main`): `app.go` is the central `App` struct. Binding files (`bindings_*.go`) expose methods to the frontend via Wails' Bind. Core logic lives in `internal/` packages.

**Frontend** (`frontend/src/`): React + TypeScript + Zustand + Tailwind CSS. Feature modules are organized by domain in `features/`. Shared components/hooks in `shared/`.

**Storage**: Each workspace is a subdirectory in the OS app data dir (`%APPDATA%/reqit/` on Windows). Data is stored as JSON files — collections, environments, history, cookies. Git-native synchronization is layered on top.

---

## Directory Tree with File Purposes

### Root Files

| File | Purpose |
|---|---|
| `main.go` | CLI dispatcher — runs `wails desktop`, `cli run`, `mcp`, or `list` subcommands |
| `app.go` | Central `App` struct — startup/shutdown lifecycle, workspace mount, scheduler, OAuth2, interceptor, telemetry, plugins, auto-update |
| `fileio.go` | 8 MB–capped file reader for safe import operations |
| `fileio_test.go` | Tests for `fileio.go` (small, not found, too large, exactly max) |
| `wails.json` | Wails build config — app name "reqit", NSIS installer, version, author, webview settings |
| `go.mod` | Go module `flux`, Go 1.25 |
| `go.sum` | Go dependency checksums |
| `.gitignore` | Git ignore rules |
| `CHANGELOG.md` | Release changelog |
| `build.ps1` | Windows/Mac/Linux build script with version injection via ldflags |

#### Binding Files (Wails → Frontend)

| File | Purpose |
|---|---|
| `bindings_ai.go` | AI chat, assertion generation, Agent Lens analysis/export/eval |
| `bindings_collections.go` | Collections CRUD, history, environments, cookies, locks |
| `bindings_git.go` | Git status, commit, push, pull, branches, merge, stash, diff, conflicts |
| `bindings_import_export.go` | Import/export OpenAPI, Postman, Insomnia, Hoppscotch, HAR, cURL, Markdown, HTML |
| `bindings_mock.go` | Mock server lifecycle, recording, route overrides, captured responses |
| `bindings_protocols.go` | HTTP request execution, WebSocket, Socket.IO, gRPC, GraphQL, MQTT, SOAP |
| `bindings_runner.go` | Collection runner, load tests, test suites, report generation, external test generation |
| `bindings_security.go` | Encryption keys, vault, SSO, data masking, audit log, RBAC, air-gap config |

---

### internal/ — Go Backend Packages

#### agentlens/ — Agent-Readiness Analysis
Analyzes collections for AI agent readiness and exports MCP server modules.

| File | Purpose |
|---|---|
| `config.go` | Load/save Agent Lens YAML config and eval suite definitions |
| `evalrunner.go` | Executes eval tasks against AI provider, scores LLM responses |
| `exporter.go` | Exports MCP server module from collection tool definitions |
| `linter.go` | Agent-readiness lint rules: descriptions, params, naming, duplicates |
| `mapper.go` | Maps saved requests to MCP tool definitions with JSON Schema input schemas |
| `models.go` | Data types: ToolDefinition, Parameter, ToolScore, LintResult |
| `score.go` | Analyzes collections, computes aggregate agent-readiness scores |

#### ai/ — AI Provider Abstraction
BYOK AI integration supporting OpenAI, Anthropic, Gemini, Ollama.

| File | Purpose |
|---|---|
| `provider.go` | Chat client for four AI providers with streaming support |
| `settings.go` | AI settings persistence (config + OS keyring for API keys) |

#### assertions/ — Response Assertion Engine
Evaluates assertions against HTTP responses for the collection runner.

| File | Purpose |
|---|---|
| `assertions.go` | Status code, timing, body contains, JSONPath, header regex, and JavaScript assertion evaluation |

#### audit/ — Security Audit Trail
Immutable append-only audit log for compliance.

| File | Purpose |
|---|---|
| `audit.go` | Logs create/read/update/delete actions to JSON Lines file with search/query support |

#### cli/ — Headless CLI Mode
Run collections from the terminal without the Wails desktop UI.

| File | Purpose |
|---|---|
| `cli.go` | CLI dispatcher: `run`, `list`, `help` commands |
| `mcp.go` | MCP server CLI entrypoint |

#### collections/ — Collection Persistence
CRUD for saved API collections and requests.

| File | Purpose |
|---|---|
| `collections.go` | Create, read, update, delete, reorder collections and saved requests |

#### contract/ — OpenAPI Contract Validation
Validates HTTP responses against an OpenAPI spec.

| File | Purpose |
|---|---|
| `contract.go` | Loads specs from disk, validates status/body/headers against documented endpoints |

#### cookies/ — Persistent Cookie Jar
Workspace-scoped HTTP cookie persistence.

| File | Purpose |
|---|---|
| `jar.go` | Implements `http.CookieJar`, saves/loads cookies to JSON |

#### crypto/ — Encryption
AES-256-GCM encryption with Argon2 key derivation.

| File | Purpose |
|---|---|
| `crypto.go` | Key generation (random/passphrase-derived), encrypt/decrypt, OS keyring storage |

#### curl/ — cURL Parser & Generator
Parse cURL commands and generate cURL strings from request payloads.

| File | Purpose |
|---|---|
| `curl.go` | High-fidelity cURL parser, supports all flags and auth types |

#### environments/ — Environment Variables
Named environments for variable substitution in requests.

| File | Purpose |
|---|---|
| `environments.go` | CRUD for environments, active selection, variable resolution |

#### export/ — Documentation Export
Generate Markdown and HTML API documentation from collections.

| File | Purpose |
|---|---|
| `export/html/generator.go` | Standalone HTML API documentation generator |
| `export/html/options.go` | HTML export options (headers, body, examples, dark mode) |
| `export/markdown/generator.go` | Markdown API documentation generator |
| `export/markdown/options.go` | Markdown export options (headers, body, examples, timestamp) |

#### external/ — External Test & CI Generation
Generates Playwright/Jest tests, CLI runners, and CI pipeline configs.

| File | Purpose |
|---|---|
| `external.go` | Generates Playwright tests, Jest tests, CLI runner scripts, GitHub Actions, GitLab CI, Jenkins configs |

#### git/ — Native Git Integration
Full Git workspace using go-git.

| File | Purpose |
|---|---|
| `git.go` | Commit, push, pull, branch management, merge, stash, diff, conflict resolution |
| `init.go` | Git-native workspace initialization — `.reqit/` directory, `.gitignore` |

#### graphqlpkg/ — GraphQL Client
Query execution and schema introspection.

| File | Purpose |
|---|---|
| `graphql.go` | HTTP + WebSocket GraphQL query execution, schema introspection |

#### growth/ — Community Features
Open-core tiers, badges, recipes, feature voting, Discord integration.

| File | Purpose |
|---|---|
| `growth.go` | Community/engagement features management |

#### grpc/ — gRPC Client
Invoke gRPC unary and streaming endpoints via gRPC-Web proxy.

| File | Purpose |
|---|---|
| `grpc.go` | gRPC-Web unary + server-streaming invocation with JSON payloads |

#### history/ — Request History
Append-only history store.

| File | Purpose |
|---|---|
| `history.go` | Append, query, clear (capped at 500 entries) |

#### hoppscotch/ — Hoppscotch Import/Export
| File | Purpose |
|---|---|
| `hoppscotch.go` | Convert between Hoppscotch and reqit collection formats |

#### insomnia/ — Insomnia Import/Export
| File | Purpose |
|---|---|
| `insomnia.go` | Convert between Insomnia and reqit collection formats |

#### interceptor/ — Browser Traffic Capture
Local HTTP MITM proxy to intercept browser traffic.

| File | Purpose |
|---|---|
| `interceptor.go` | HTTP proxy server, request capture, Chrome extension assets serving |
| `assets.go` | Embedded Chrome extension files (background.js, popup.html, icons) |
| `background.js` | Chrome extension service worker for tab-based request capture |
| `manifest.json` | Chrome extension manifest |
| `popup.html` | Chrome extension popup UI |
| `popup.js` | Chrome extension popup logic |

#### jwt/ — JWT Decoder
| File | Purpose |
|---|---|
| `jwt.go` | Parses JWT header and claims without signature verification |

#### loadtest/ — Load Testing Engine
| File | Purpose |
|---|---|
| `loadtest.go` | Concurrent VU-based load testing with configurable duration and ramp-up, collects latency stats |

#### locks/ — Collection Locking
| File | Purpose |
|---|---|
| `locks.go` | Prevents concurrent edits on collections |

#### masker/ — Data Masking
| File | Purpose |
|---|---|
| `masker.go` | Regex-based masking engine for sensitive data in responses |

#### mcp/ — Model Context Protocol Server
JSON-RPC 2.0 MCP server over stdio for AI agent integration.

| File | Purpose |
|---|---|
| `server.go` | JSON-RPC 2.0 MCP server with tool registration and request handling |
| `tools.go` | MCP tool definitions: run collection, list collections, get environments, run curl |

#### models/ — Shared Data Types
| File | Purpose |
|---|---|
| `models.go` | RequestPayload, Collection, Environment, ResponseResult, RunnerConfig, LoadTestConfig, and all shared structs |

#### mock/ — Mock HTTP Server
| File | Purpose |
|---|---|
| `mock.go` | In-memory mock HTTP server with route registry and response matching |
| `mock_recording.go` | Captures real traffic into mock response records |
| `mock_rules.go` | Condition-based mock routing (header, query, method, path matching) |
| `mock_stateful.go` | Per-route/session counters for stateful mock behavior |

#### mqtt/ — MQTT Client
| File | Purpose |
|---|---|
| `mqtt.go` | MQTT publish/subscribe over HTTP bridge |

#### oauth2/ — OAuth2 Flow
| File | Purpose |
|---|---|
| `oauth2.go` | OAuth2 authorization code flow with PKCE, token exchange, refresh |

#### openapi/ — OpenAPI Import/Export & Design
| File | Purpose |
|---|---|
| `design.go` | Programmatic OpenAPI spec construction and editing |
| `export.go` | Export collections to OpenAPI 3.0 specs |
| `import.go` | Import OpenAPI 3.0 specs into collections |

#### plugin/ — Plugin System
| File | Purpose |
|---|---|
| `manager.go` | Plugin system coordinator — install, remove, lifecycle |
| `manifest.go` | Plugin manifest structure (hooks for auth, visualizer, codegen) |
| `registry.go` | Plugin registry — scan directory, load manifests |

#### postman/ — Postman Import/Export
| File | Purpose |
|---|---|
| `postman.go` | Postman v2.0/v2.1 collection import/export |
| `detector.go` | Auto-detect Postman format version |
| `mapper.go` | Maps Postman body modes, auth types to reqit format |
| `security.go` | Scans Postman imports for secrets |

#### profile/ — User Profile & Dev Profile
| File | Purpose |
|---|---|
| `profile.go` | Local user profile persistence (name, email, request count) |
| `airgap.go` | Air-gapped deployment configuration |
| `devprofile.go` | Developer profile for public web sharing with stats |
| `upstash.go` | Upstash Redis publish/subscribe for profile sync |

#### rbac/ — Role-Based Access Control
| File | Purpose |
|---|---|
| `rbac.go` | Grant/revoke roles (admin, editor, viewer), permission checks |

#### registry/ — API Registry Push/Pull
| File | Purpose |
|---|---|
| `swaggerhub.go` | SwaggerHub registry push/pull client |
| `stoplight.go` | Stoplight registry push/pull client |

#### reporter/ — Test Reports
| File | Purpose |
|---|---|
| `reporter.go` | JSON and HTML report generation for collection runs |

#### requester/ — HTTP Request Engine
| File | Purpose |
|---|---|
| `requester.go` | HTTP/HTTPS request execution with auth (Basic, Bearer, OAuth2), mTLS, OpenTelemetry tracing, multipart, cookie jar |

#### runner/ — Collection Runner
| File | Purpose |
|---|---|
| `runner.go` | Sequential/parallel collection execution, assertion evaluation, retries, data-driven support |
| `csv_provider.go` | CSV/JSON test data parser for data-driven runs |

#### scheduler/ — Cron Scheduler
| File | Purpose |
|---|---|
| `cron.go` | Cron expression parser and next-run calculator |
| `engine.go` | Scheduled collection executor — runs collections on cron schedule |
| `store.go` | Scheduled run persistence and history |

#### schema/ — OpenAPI Schema Drift
| File | Purpose |
|---|---|
| `drift.go` | Schema drift detection — compares OpenAPI snapshots, reports changes |
| `snapshot.go` | Captures normalized OpenAPI spec snapshots for comparison |

#### scripting/ — Pre/Post-Request Scripts
| File | Purpose |
|---|---|
| `engine.go` | Goja JavaScript runtime with sandboxed HTTP and crypto APIs |

#### security/ — Input Validation
| File | Purpose |
|---|---|
| `security.go` | Path traversal prevention, URL safety validation |
| `security_test.go` | 28 tests for security validators |

#### soap/ — SOAP Envelope Builder
| File | Purpose |
|---|---|
| `soap.go` | SOAP 1.1 and 1.2 XML envelope construction |

#### sock/ — WebSocket Client
| File | Purpose |
|---|---|
| `sock.go` | Raw WebSocket client with event callbacks and message buffering |

#### socketio/ — Socket.IO Client
| File | Purpose |
|---|---|
| `socketio.go` | Socket.IO v4 client over WebSocket, emit/listen events |

#### sso/ — Enterprise SSO
| File | Purpose |
|---|---|
| `sso.go` | SAML 2.0 and OIDC provider management, authentication |

#### storage/ — Atomic JSON File I/O
| File | Purpose |
|---|---|
| `storage.go` | Atomic read/write to OS app data directory files |

#### telemetry/ — Opt-In Telemetry
| File | Purpose |
|---|---|
| `telemetry.go` | Tracks launch, request, feature, integration events |

#### testbuilder/ — Test Suites
| File | Purpose |
|---|---|
| `testbuilder.go` | Create/manage nested groups of assertions for structured API testing |

#### tray/ — System Tray & Notifications
| File | Purpose |
|---|---|
| `tray.go` | System tray icon, desktop notifications, CLI runner template |

#### updater/ — Self-Updater
| File | Purpose |
|---|---|
| `updater.go` | Fetches release manifest, verifies SHA256, applies binary update via selfupdate, supports Windows NSIS installer fallback, post-update restart |
| `manifest.go` | Update manifest struct with per-platform assets and platform resolution |
| `updater_test.go` | Unit tests for updater |

#### vault/ — Secret Vault
| File | Purpose |
|---|---|
| `vault.go` | 1Password CLI and local encrypted file secret providers |

#### watcher/ — File System Watcher
| File | Purpose |
|---|---|
| `watcher.go` | Debounced fsnotify watcher for workspace file change events |

#### workspaces/ — Workspace Manager
| File | Purpose |
|---|---|
| `workspaces.go` | CRUD for named workspace directories with active selection |

---

### frontend/ — React/TypeScript UI

#### Entry Points

| File | Purpose |
|---|---|
| `frontend/index.html` | HTML shell for the Wails desktop build |
| `frontend/web.html` | HTML shell for the web version |
| `frontend/src/main.tsx` | Desktop entry — renders `<App>` with `<ErrorBoundary>` |
| `frontend/src/App.tsx` | Main app shell — assembles layout (Sidebar, TabBar, UrlBar, RequestPanel, ResponsePane), mounts all modals and UpdateBanner |
| `frontend/src/App.css` | Global CSS |
| `frontend/src/style.css` | Tailwind base styles + custom CSS variables |
| `frontend/vite.config.ts` | Vite build config (proxy rules, HMR, Wails integration) |
| `frontend/tailwind.config.ts` | Tailwind CSS theme config |
| `frontend/tsconfig.json` | TypeScript compiler config |
| `frontend/package.json` | Node dependencies — React, Zustand, Tailwind, CodeMirror, Lucide icons |

#### app/ — Core App Shell

| File | Purpose |
|---|---|
| `components/SettingsModal.tsx` | App settings — profile, AI config, themes, keyboard shortcuts |
| `components/WelcomeModal.tsx` | First-launch welcome and initial profile setup |
| `components/MilestoneBanner.tsx` | Confetti celebration on reaching 300 requests |
| `hooks/useUpdater.ts` | Update check/install lifecycle — auto-check at startup, install, restart, dismiss |
| `layout/Sidebar.tsx` | Left sidebar navigation — collections tree, history, env switcher, search, tools menu |
| `layout/RequestPanel.tsx` | Tabbed request editor — Params, Headers, Body, Auth, Scripts, Notes |
| `screens/HomeScreen.tsx` | Home screen — workspace grid, recent activity, request stats, quick actions |
| `stores/useUIStore.ts` | UI state — active view, panels, modals, theme, response tabs |
| `stores/useProfileStore.ts` | User profile state |
| `stores/useToastStore.ts` | Toast notification state |

#### features/ — Feature Modules

| File | Purpose |
|---|---|
| `agentlens/components/AgentLensPanel.tsx` | Agent-readiness scoring UI |
| `ai/components/AIDiagnosisPanel.tsx` | AI-powered response diagnosis |
| `ai/components/AISettingsPanel.tsx` | AI provider configuration form |
| `ai/stores/useAIStore.ts` | AI settings state |
| `assertions/components/AssertionEditor.tsx` | Visual assertion builder |
| `blog/blogData.ts` | Blog post content data |
| `blog/components/BlogPanel.tsx` | Blog reader panel |
| `collections/components/CollectionMenu.tsx` | Collection right-click context menu |
| `collections/components/CollectionsTree.tsx` | Tree view of collections and saved requests (with folder nesting) |
| `collections/components/HTMLExportModal.tsx` | HTML documentation export dialog |
| `collections/components/MarkdownExportModal.tsx` | Markdown documentation export dialog |
| `collections/components/RunnerModal.tsx` | Collection runner dialog — execute, data-driven, results |
| `collections/components/SaveRequestModal.tsx` | Save current request to a collection |
| `collections/components/SearchBar.tsx` | Search/filter collections |
| `collections/components/VariablesEditorModal.tsx` | Collection-level variables editor |
| `collections/hooks/useTabSync.ts` | Sync open tabs to collection requests |
| `collections/lib/folderTree.ts` | Slash-delimited folder tree builder |
| `collections/stores/useCollectionStore.ts` | Collections state store |
| `docs/components/DocsContentViewer.tsx` | Rendered API documentation viewer |
| `docs/components/DocsPanel.tsx` | API doc panel |
| `docs/components/WebDocsPage.tsx` | Web-facing documentation page |
| `env/components/EnvCompareModal.tsx` | Side-by-side environment variable comparison |
| `env/components/EnvironmentsModal.tsx` | Environment editor modal |
| `env/components/EnvSwitcher.tsx` | Active environment dropdown selector |
| `env/components/StatusBarEnvSwitcher.tsx` | Quick env switch in status bar |
| `env/stores/useEnvStore.ts` | Environment state store |
| `external/components/ExternalRunnerPanel.tsx` | External test and CI generation panel |
| `git/components/GitPanel.tsx` | Git operations panel — commit, push, pull, branches |
| `git/components/TeamModal.tsx` | Team contributors modal |
| `git/stores/useGitStore.ts` | Git state store |
| `graphql/components/GraphQLPanel.tsx` | GraphQL explorer |
| `growth/components/GrowthPanel.tsx` | Community/growth panel — tiers, badges, roadmap |
| `grpc/components/GRPCPanel.tsx` | gRPC invocation panel |
| `history/components/HistoryList.tsx` | Request history list |
| `history/stores/useHistoryStore.ts` | History state store |
| `integrations/components/IntegrationsPanel.tsx` | External integrations panel |
| `interceptor/components/InterceptorPanel.tsx` | Browser traffic interceptor control panel |
| `loadtest/components/LoadTestPanel.tsx` | Load test config and results panel |
| `migration/components/MigrationPanel.tsx` | Data migration panel |
| `mock/components/MockPanel.tsx` | Mock server management panel |
| `plugins/components/PluginManager.tsx` | Plugin management UI |
| `pr/components/PRPreviewPanel.tsx` | PR preview panel |
| `profile/components/DevProfilePanel.tsx` | Developer profile editor |
| `profile/components/PublicProfilePage.tsx` | Public developer profile page |
| `profile/components/ShareButton.tsx` | Profile share button |
| `request/components/AuthTab.tsx` | Auth config — Basic, Bearer, OAuth2, API Key, Digest |
| `request/components/BodyTab.tsx` | Request body editor — raw, form, multipart, binary |
| `request/components/Breadcrumb.tsx` | Request breadcrumb navigation |
| `request/components/CodeGenModal.tsx` | Code generation modal (JS, Python, Go, etc.) |
| `request/components/GRPCPanel.tsx` | gRPC request panel |
| `request/components/HeadersTab.tsx` | Request headers editor |
| `request/components/JWTDecoder.tsx` | JWT decoder modal |
| `request/components/MQTTPanel.tsx` | MQTT client panel |
| `request/components/NotesTab.tsx` | Request notes tab |
| `request/components/OAuth2Flow.tsx` | OAuth2 authorization flow UI |
| `request/components/ParamsTab.tsx` | URL parameters editor |
| `request/components/SOAPPanel.tsx` | SOAP envelope builder |
| `request/components/UrlBar.tsx` | URL input bar with method selector |
| `request/components/UrlPreview.tsx` | Resolved URL preview with variable substitution |
| `request/hooks/useSendRequest.ts` | Send request hook with response handling |
| `request/lib/introspectGraphQL.ts` | GraphQL schema introspection logic |
| `request/lib/securityCheck.ts` | Client-side URL/input security check |
| `request/stores/useRequestStore.ts` | Request state store |
| `request/stores/useResponseStore.ts` | Response state store |
| `request/stores/useEndpointCache.ts` | Endpoint cache store |
| `response/components/BodyView.tsx` | Response body renderer — preview, raw, image, JSON tree |
| `response/components/ContractBadge.tsx` | Contract validation pass/fail badge |
| `response/components/CookiesView.tsx` | Response cookies viewer |
| `response/components/CopyButton.tsx` | Copy-to-clipboard button |
| `response/components/DiffSnapshots.tsx` | Response diff between snapshots |
| `response/components/ErrorState.tsx` | Error state display |
| `response/components/HeadersView.tsx` | Response headers display |
| `response/components/JsonTreeView.tsx` | Collapsible JSON tree viewer |
| `response/components/LoadingState.tsx` | Loading spinner state |
| `response/components/PartyMode.tsx` | Celebration animation on success |
| `response/components/PerformanceChart.tsx` | Response timing SVG chart (avg/P95/max) |
| `response/components/ResponsePane.tsx` | Main response pane — tabs for body, headers, cookies, timeline, performance |
| `response/components/SecurityWarnings.tsx` | Security warnings display |
| `response/components/StatusBar.tsx` | Response status bar — status code, time, size |
| `response/components/TimelineView.tsx` | Request timeline visualization |
| `scheduler/components/SchedulerPanel.tsx` | Scheduled runs panel |
| `scripts/components/ScriptsPanel.tsx` | Pre/post-request script editor |
| `security/components/SecurityPanel.tsx` | Security settings — E2EE, vault, SSO, masking, audit trail, RBAC, air-gap |
| `spec/components/SpecEditor.tsx` | OpenAPI spec editor |
| `spec/components/DriftPanel.tsx` | Schema drift detection display |
| `tabs/components/TabBar.tsx` | Request tab bar with close/reorder |
| `tabs/stores/useTabsStore.ts` | Tab state store |
| `testbuilder/components/TestSuitePanel.tsx` | Test suite builder panel |
| `websocket/components/SocketPanel.tsx` | WebSocket/Socket.IO client panel |
| `websocket/components/SSEViewer.tsx` | Server-Sent Events viewer |
| `websocket/stores/useSocketStore.ts` | WebSocket state store |
| `workspace/components/CreateWorkspaceModal.tsx` | Create workspace dialog |
| `workspace/stores/useWorkspaceStore.ts` | Workspace state store |

#### shared/ — Shared Components & Hooks

| File | Purpose |
|---|---|
| `components/Button.tsx` | Reusable button component with variants |
| `components/CaptureVarMenu.tsx` | Variable capture context menu |
| `components/CommandPalette.tsx` | Command palette (Ctrl+K) |
| `components/ContextMenu.tsx` | Right-click context menu |
| `components/ErrorBoundary.tsx` | React error boundary |
| `components/GraphqlEditor.tsx` | GraphQL query editor (CodeMirror) |
| `components/IconButton.tsx` | Icon button component |
| `components/ImportPostmanModal.tsx` | Import dialog for Postman/Insomnia/Hoppscotch |
| `components/JsonEditor.tsx` | JSON editor (CodeMirror) |
| `components/KeyValueEditor.tsx` | Key-value pair editor |
| `components/MethodBadge.tsx` | HTTP method colored badge |
| `components/MethodSelect.tsx` | HTTP method dropdown |
| `components/Modal.tsx` | Generic modal wrapper |
| `components/PasteCurlModal.tsx` | Paste cURL command dialog |
| `components/ShortcutsModal.tsx` | Keyboard shortcuts reference (with remapping) |
| `components/Splitter.tsx` | Resizable panel splitter |
| `components/Tabs.tsx` | Reusable tabs component |
| `components/ToastHost.tsx` | Toast notification host |
| `components/UpdateBanner.tsx` | Update available banner with Install/Restart buttons |
| `components/VariableAutocomplete.tsx` | Environment variable autocomplete |
| `hooks/useDebounce.ts` | Debounce hook |
| `hooks/useKeyboardShortcuts.ts` | Global keyboard shortcut handler |
| `hooks/useResizablePanel.ts` | Resizable panel drag hook |
| `lib/cmTheme.ts` | CodeMirror syntax highlighting theme |
| `lib/cn.ts` | Tailwind classname merge utility |
| `lib/codegen.ts` | Code generation for JS, Python, Go, cURL, etc. |
| `lib/commands.ts` | Keyboard command definitions |
| `lib/curlParser.ts` | Client-side cURL parser |
| `lib/docs.ts` | Documentation markdown content |
| `lib/download.ts` | Binary download helpers |
| `lib/format.ts` | Data formatting utilities (size, time, JSON) |
| `lib/id.ts` | ID generation utility |
| `lib/loadPayload.ts` | Load payload from file |
| `lib/seo.ts` | SEO metadata (web version) |
| `lib/url.ts` | URL validation and manipulation |
| `lib/useTheme.ts` | Theme (dark/light) management |
| `lib/useUndoRedo.ts` | Undo/redo hook |

#### wailsjs/ — Auto-Generated Wails Bindings (DO NOT EDIT)
| Directory | Purpose |
|---|---|
| `wailsjs/go/main/` | Generated TypeScript bindings for all `App` methods |
| `wailsjs/go/models.ts` | Generated Go struct ↔ TypeScript type mappings |
| `wailsjs/runtime/` | Wails runtime helpers (EventsOn, EventsEmit, Window*) |

#### public/ — Static Assets
| File | Purpose |
|---|---|
| `favicon.png` | App favicon |
| `favicon.svg` | SVG favicon |
| `logo192.png` | 192px app logo |
| `robots.txt` | SEO robots |
| `sitemap.xml` | SEO sitemap |
| `llms.txt` | LLM knowledge base reference |
| Various screenshots | GitHub/landing page preview images |

#### Web Version (separate entry point)

| File | Purpose |
|---|---|
| `src/web/WebApp.tsx` | Web landing page — hero, features, download links, blog, docs |
| `src/web/main-web.tsx` | Web entry point |

---

## Auto-Update System

The app checks for updates at startup and surfaces an `UpdateBanner` in the UI.

### Flow

1. **Startup check**: `app.go:163` fires a goroutine that fetches `latest.json` from GitHub Releases. If a newer version exists, it emits `"update:available"` via `runtime.EventsEmit`.
2. **Manual check**: `CheckForUpdates()` binding can be called from the frontend any time.
3. **Install**: User clicks "Install" → `InstallUpdate(manifest)` binding → `updater.Apply()`:
   - Downloads the platform-specific binary
   - Verifies SHA256 checksum
   - On Windows: tries `selfupdate.Apply()` first; if permission denied (e.g. Program Files), falls back to downloading the NSIS installer and running it silently with `/S`
   - On macOS/Linux: uses `selfupdate.Apply()` directly
4. **Restart**: After successful install, user clicks "Restart" → `RestartApp()` spawns a new process and `os.Exit(0)`.

### Manifest Format (`latest.json`)

```json
{
  "version": "v1.1.0",
  "notes": "https://github.com/HalxDocs/reqit/releases/tag/v1.1.0",
  "pub_date": "",
  "platforms": {
    "linux-amd64": { "url": "...", "sha256": "..." },
    "darwin-amd64": { "url": "...", "sha256": "..." },
    "darwin-arm64": { "url": "...", "sha256": "..." },
    "windows-amd64": { "url": "...", "sha256": "..." },
    "windows-amd64-installer": { "url": "...", "sha256": "..." }
  }
}
```

### Version Injection

```bash
wails build -ldflags "-s -w -X 'flux/internal/updater.CurrentVersion=v1.1.0'"
```

### Manifest Generation

```bash
python3 scripts/gen_manifest.py v1.1.0 > latest.json
```

Reads SHA256SUMS.txt for hash values. In CI, hashes are overlaid via stdin.

---

## CI / Release

Releases are built by GitHub Actions on `v*.*.*` tag pushes:

```bash
git tag v1.1.0
git push origin v1.1.0
```

The workflow (`.github/workflows/release.yml`):
1. **build** (matrix): Builds for linux-amd64, darwin-universal, windows-amd64, packages, computes SHA256, uploads to release
2. **build-windows-installer**: Builds the NSIS installer via Wails, uploads to release
3. **generate-manifest**: Downloads all artifacts, generates SHA256SUMS.txt and `latest.json`, uploads manifest

---

## Data Storage

| Platform | Path |
|---|---|
| Windows | `%APPDATA%\reqit\` |
| macOS | `~/Library/Application Support/reqit/` |
| Linux | `~/.config/reqit/` |

Each workspace is a subdirectory containing JSON files for collections, environments, history, cookies, and git metadata.

---

## Adding a Backend Method

1. Add a method on `*App` in a binding file (or `app.go`)
2. Run `wails generate module` — the JS bindings in `frontend/wailsjs/` are regenerated automatically
3. Import and call from the frontend: `import { YourMethod } from "../../wailsjs/go/main/App"`

---

## License

MIT