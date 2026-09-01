<p align="center">
  <img src="flux/frontend/src/assets/images/reqitlogo.jpeg" alt="reqit" height="56" />
</p>

<h1 align="center">reqit</h1>
<p align="center">local-first, Git-native API client. No account. No cloud. No Electron.</p>

<p align="center">
  <a href="https://github.com/HalxDocs/reqit/releases/latest"><img src="https://img.shields.io/badge/install-%3C20MB-3FB950?style=flat-square" alt="Install size < 20MB" /></a>
  <a href="https://github.com/HalxDocs/reqit/releases/latest"><img src="https://img.shields.io/badge/startup-%3C400ms-0891B2?style=flat-square" alt="Startup < 400ms" /></a>
  <a href="#"><img src="https://img.shields.io/badge/telemetry-zero-6B7280?style=flat-square" alt="Zero telemetry" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-5B9CF6?style=flat-square" alt="MIT License" /></a>
  <a href="CODE_OF_CONDUCT.md"><img src="https://img.shields.io/badge/code%20of%20conduct-Contributor%20Covenant-5B9CF6?style=flat-square" alt="Code of Conduct" /></a>
  <a href="SECURITY.md"><img src="https://img.shields.io/badge/security-policy-3FB950?style=flat-square" alt="Security Policy" /></a>
  <a href="https://github.com/HalxDocs/reqit/stargazers"><img src="https://img.shields.io/github/stars/HalxDocs/reqit?style=flat-square&label=stars" alt="GitHub Stars" /></a>
  <a href="https://github.com/HalxDocs/reqit/releases/latest"><img src="https://img.shields.io/github/downloads/HalxDocs/reqit/total?style=flat-square&label=downloads" alt="GitHub Downloads" /></a>
</p>

<p align="center">
  <img src="flux/frontend/src/assets/images/reqitlogo.jpeg" alt="reqit screenshot" width="720" />
</p>

---

## Why reqit

- starts in under **400ms** on a mid-range machine
- collections are **plain JSON files** — commit them to Git like code
- **no account, no telemetry, no cloud dependency** — ever

---

## Install

```bash
curl -LO https://github.com/HalxDocs/reqit/releases/latest/download/reqit-windows-amd64.exe
```

| Platform | File |
|----------|------|
| Windows  | [reqit-windows-amd64.exe](https://github.com/HalxDocs/reqit/releases/latest/download/reqit-windows-amd64.exe) |
| macOS    | [reqit-macos-universal.zip](https://github.com/HalxDocs/reqit/releases/latest/download/reqit-macos-universal.zip) |
| Linux    | [reqit-linux-amd64](https://github.com/HalxDocs/reqit/releases/latest/download/reqit-linux-amd64) |

### Linux dependencies

reqit requires WebKit2GTK to render its UI.

**Ubuntu 24.04+** (default):
```bash
sudo apt install libwebkit2gtk-4.1-0
```

**Ubuntu 22.04 and earlier** (legacy):
```bash
sudo apt install libwebkit2gtk-4.0-37 libjavascriptcoregtk-4.0-18
```

**Fedora 40+** (and other RPM distros):
```bash
sudo dnf install webkit2gtk4.1 libsecret gnome-keyring
# If you run a minimal install without Secret Service, reqit falls back to
# ~/.config/flux/keyring-fallback.json (0600) — no extra setup, but
# consider installing gnome-keyring for stronger isolation.
# OAuth browser fallback on Wayland: xdg-open → gio open → sensible-browser
```

---

## Quick start

1. **Download** reqit for your platform
2. **Import** a Postman collection or paste a cURL command
3. **Select an environment** from the dropdown
4. **Pick a request** and click **Send**
5. **Inspect the response** — status, timing, headers, formatted body

---

## Features

### Core

| Feature | Description |
|---------|-------------|
| HTTP client | GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS with full response inspection |
| WebSocket / SSE | Real-time bidirectional messaging with message log |
| Socket.IO | Engine.IO v4 client with event emission, cookie/header passthrough |
| GraphQL | Queries, mutations, subscriptions with introspection |
| gRPC | gRPC-web-text unary and streaming via HTTP POST |
| SOAP | SOAP 1.1/1.2 envelope builder with WSDL parsing |
| MQTT | Publish/subscribe with QoS and message history |
| Collection runner | Sequential and concurrent execution with assertions |
| Mock server | One-click local HTTP server with saved responses, delays, overrides |
| Contract testing | Auto-validate responses against OpenAPI specs |
| Cookie jar | Auto-capture and replay `Set-Cookie` with persistent storage |
| Environment variables | `{{VAR}}` interpolation across all request fields |
| Code generation | Export as cURL, JavaScript fetch, Python requests |
| Auth methods | Bearer, Basic, API Key, Digest, NTLM, OAuth2 (PKCE + refresh), JWT decoder |
| Scripting | Pre-request / post-response JavaScript (goja) with variable extraction |

### Collections

| Feature | Description |
|---------|-------------|
| Full CRUD | Create, rename, delete collections and individual requests |
| Virtual scrolling | Handles 1000+ items with zero lag (ResizeObserver + binary search) |
| Drag-and-drop | Reorder collections and requests with visual drop indicators |
| Batch operations | Select, move, delete multiple requests at once |
| Search | Live filter by name with auto-hide empty collections |
| Spec linking | Link a collection to an OpenAPI spec for contract validation |

### Git & Collaboration

| Feature | Description |
|---------|-------------|
| Git-native storage | Collections as JSON files in `.reqit/` — diff, branch, review |
| Full git client | Status, branch management, commit, push, pull, stash, merge |
| PR preview | Side-by-side diff review for API payloads |
| Conflict resolution | Visual merge UI for JSON, headers, form-data (ours/theirs/three-way) |
| Self-hosted sync | Optional WebSocket-based real-time collaboration server |
| Inline comments | Threaded discussions on requests and collections |
| RBAC | Viewer / Editor / Administrator workspace roles |
| Audit logs | Append-only tamper-evident trail with timeline viewer |
| Team invites | Git ref–based invites and permission-wrapped URLs |

### API Design & Docs

| Feature | Description |
|---------|-------------|
| OpenAPI designer | Create and edit specs with endpoint CRUD |
| OpenAPI import | Import yaml/yml/json specs as collections |
| OpenAPI export | Export collections as OpenAPI 3.0.3 JSON or Swagger UI HTML |
| API reference | In-app documentation viewer from linked specs |
| Markdown export | Configurable API docs with headers, body, examples, timestamp |
| Registry push/pull | SwaggerHub and Stoplight integration |

### Testing & Automation

| Feature | Description |
|---------|-------------|
| Assertions | Status code, JSON body, headers, response time checks |
| Test suites | Nested test groups with runner integration |
| Load testing | Configurable virtual users with latency percentiles |
| Reports | JSON and HTML report generation + export |
| CI/CD generation | GitHub Actions, GitLab CI, Jenkins pipeline YAML |
| Test generation | Playwright and Jest (JS/TS) from collections |
| CLI mode | Headless collection execution for CI/CD pipelines |

### Import / Export

| Feature | Description |
|---------|-------------|
| Import | Postman v2.1 (full with pm.\* transpile), Insomnia, Hoppscotch, OpenAPI, cURL |
| Export | Postman, Insomnia, Hoppscotch, OpenAPI (JSON + HTML), Markdown, cURL |

### Security

| Feature | Description |
|---------|-------------|
| OAuth2 | Full authorize / exchange / refresh flow with PKCE |
| Enterprise SSO | SAML 2.0 and OpenID Connect provider management |
| Encryption | AES-256-GCM with Argon2id key derivation |
| Secret vault | 1Password, HashiCorp Vault, AWS Secrets Manager |
| Data masker | Regex-based masking for tokens, keys, secrets |
| Air-gap mode | Disable network features for restricted environments |
| Interceptor proxy | Browser traffic capture via local HTTP proxy + Chrome extension |

### Developer Experience

| Feature | Description |
|---------|-------------|
| Multi-workspace | Create, switch, rename, relocate workspaces with file watcher |
| Theme system | Dark/light with system preference auto-detect |
| Command palette | Cmd+K searchable actions with scoped context filtering |
| Keyboard shortcuts | Every action reachable by keyboard — 45+ registered commands across global, response, sidebar, and env scopes |
| Response formatting | Collapsible JSON tree view, Pretty/Raw/Tree toggle (Ctrl+Shift+R), lazy expansion for large payloads |
| Dev profiles | Publish your developer profile to `reqit.dev/:username` with skills, projects, badges, and GitHub activity |
| reqit AI | BYOK error intelligence — paste an error, get diagnosis and generated assertions (requires your own API key) |
| MCP Server | Model Context Protocol server for AI agent integration — 24 tools, stdio + Streamable HTTP/SSE, universal configs (OpenCode/Claude/Cursor/VS Code) — see `flux/MCP_BRIDGE.md` |
| MCP Traffic Inspector | Wireshark for your MCP server — live JSON-RPC frames, latency, tool names, params/result pretty-printed via `BodyView` |
| Agent Lens | Agent-readiness mapper, linter (now with **R6 Tool-Poisoning** — imperative/hidden-unicode/secret scan), and export — score your API collections for AI consumption |
| Schema drift detection | Snapshot OpenAPI specs and detect breaking changes between versions |
| Tool Drift Snapshots | Git-native `tools-<collID>.json` snapshots + `DiffToolSnapshots` — diff a tool description against its last commit |

### New in this release — Inspector Suite (low-bloat, extends existing surfaces)

| Feature | What it is | Where |
|---------|------------|-------|
| **Response Diffing** | Diff today's response vs a saved snapshot **or** any `history.json` entry — header/status/body canonical JSON (sorted keys) + side-by-side | `ResponsePane → Diff with snapshot/history` |
| **Flaky Detection** | `runhistory.json` (cap 500) + `FlakyStats` over last 20 runs — `Retries>0 && Passed` → amber **FLAKY** badge in Runner, `runhistory:changed` event | `RunnerModal` |
| **Adversarial Assertions** | `promptInjection` assertion type + 6 smuggled-instruction payloads (`billing_address` etc.) — reuses `goja` engine, no new runner | `AssertionEditor → Prompt Injection` |
| **Custom Visualizers** | Render mode inside `ResponsePane` — `visualizer.set(template,data)` from post-response script or Table/Geo/Chart picker, `localStorage` persisted | `ResponsePane → Visualize` tab |
| **Tool-Poisoning** | Already in Agent Lens R6 above — no new UI, just a new `error` that tanks the score | `Agent Lens → Lint` |

All 7 reuse existing panels — no new product categories, no new mental models.
| Auto-updater | GitHub release checking with one-click install |
| Plugin system | Directory-based plugin discovery and install |
| System tray | Background execution with notifications |
| Telemetry | Opt-in only, zero by default |

---

## GitOps

```text
.reqit/
  collections/
    auth-api/
      login.json
      refresh.json
    payment-service/
      charge.json
  environments/
    dev.json
    staging.json
  exports/
```

Collections commit to Git like any other file. No cloud sync. No proprietary format. Your API collections live alongside your code, diff in pull requests, and branch per feature.

---

## Comparison

| Feature | reqit | Postman | Bruno |
|---------|-------|---------|-------|
| Install size | < 20MB | 300MB+ | < 50MB |
| Account required | Never | Yes | Never |
| Local-first | Yes | No | Yes |
| Git-native storage | Yes | No | Yes |
| Startup time | < 400ms | 5-10s | ~1s |
| Telemetry | Zero | Yes | Optional |
| Collection runner | Yes | Yes | Yes |
| Mock server | Yes | Yes | No |
| OpenAPI import/export | Yes | Yes | Partial |
| WebSocket client | Yes | Yes | Yes |
| Socket.IO client | Yes | No | No |
| GraphQL client | Yes | Yes | No |
| gRPC client | Yes | No | No |
| SOAP client | Yes | Yes | No |
| MQTT client | Yes | No | No |
| Scripting (pre/post) | Yes | Yes | Yes |
| Load testing | Yes | Yes | No |
| CI/CD generation | Yes | No | No |
| SSO / RBAC | Yes | Yes | No |
| Audit logs | Yes | Enterprise | No |
| Self-hosted sync | Yes | No | No |
| Visual git merge | Yes | No | No |
| CLI / CI mode | Yes | No | Yes |
| Keyboard-first UX | Yes (scoped) | Partial | No |
| JSON tree view | Yes | Yes | No |
| Dev profiles | Yes (public) | No | No |
| MCP server | Yes (24 tools, HTTP + stdio, universal) | No | No |
| MCP traffic inspector | Yes | No | No |
| Agent readiness | Yes (incl. R6 poisoning + drift) | No | No |
| Response diffing | Yes (env/time + headers) | No | No |
| Flaky detection | Yes | No | No |
| Adversarial assertions | Yes | No | No |
| Custom visualizers | Yes | No | No |
| Price | Free / OSS | Free+$12/m | Free / OSS |

---

## Security

See [SECURITY.md](SECURITY.md) for supported versions, private reporting (`kamsyejindu@gmail.com` or GitHub Private Advisory), and secure-use notes (keyring fallback at `~/.config/flux/keyring-fallback.json`, visualizer HTML sandbox). Please **do not** open a public issue for security reports.

## Code of Conduct

We follow the [Contributor Covenant 2.1](CODE_OF_CONDUCT.md). Report unacceptable behavior to `kamsyejindu@gmail.com`.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](.github/CONTRIBUTING.md). Keep PRs focused — one feature or fix per PR. By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

Licensed under the [MIT License](LICENSE).

Built by [HalxDocs](https://halxdocs.com).
