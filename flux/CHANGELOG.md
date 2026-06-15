# Changelog

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
