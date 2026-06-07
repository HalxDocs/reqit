<p align="center">
  <img src="flux/frontend/src/assets/images/reqitloo.jpeg" alt="reqit" height="60" />
</p>

<h3 align="center">reqit</h3>
<p align="center">A native desktop app for testing APIs — lighter and faster than Postman or Insomnia. No Electron. No cloud account. No telemetry.</p>

<p align="center">
  <a href="https://github.com/HalxDocs/reqit/releases/latest"><img src="https://img.shields.io/github/v/release/HalxDocs/reqit?style=flat-square&label=latest" alt="Latest release" /></a>
  <a href="https://github.com/HalxDocs/reqit/releases"><img src="https://img.shields.io/github/downloads/HalxDocs/reqit/total?style=flat-square" alt="Downloads" /></a>
  <a href="https://github.com/HalxDocs/reqit/stargazers"><img src="https://img.shields.io/github/stars/HalxDocs/reqit?style=flat-square" alt="Stars" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/HalxDocs/reqit?style=flat-square" alt="License" /></a>
</p>

---

## What is this?

reqit replaces Postman, Insomnia, or Bruno — but runs as a real native desktop app (Go + Wails, not Electron). Point it at any HTTP API, WebSocket, or SSE endpoint, send requests, inspect responses, and organize everything into collections that live as plain JSON files on your machine. No signup, no cloud, no data leaves your computer unless you send a request.

---

## Download

| Platform | File |
|----------|------|
| Windows  | [reqit-windows-amd64.exe](https://github.com/HalxDocs/reqit/releases/latest/download/reqit-windows-amd64.exe) |
| macOS    | [reqit-macos-universal.zip](https://github.com/HalxDocs/reqit/releases/latest/download/reqit-macos-universal.zip) |
| Linux    | [reqit-linux-amd64](https://github.com/HalxDocs/reqit/releases/latest/download/reqit-linux-amd64) |

Or browse all releases on the [releases page](https://github.com/HalxDocs/reqit/releases).

> **macOS:** right-click the app → Open → Open, or run `xattr -cr reqit.app` in Terminal to bypass Gatekeeper.

---

## What is reqit?

reqit is a native desktop API client for developers. It replaces tools like Postman or Insomnia with something that is smaller, faster, and completely offline. Your collections live as plain JSON files in folders you own — commit them, sync them, or share them however you like.

---

## Features

### Core

- **HTTP client** — GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS with full query params, headers, and body support (JSON / form-urlencoded / multipart / raw)
- **Multi-tab interface** — open multiple requests simultaneously without losing state
- **URL preview** — see the fully expanded URL with variables resolved before you send
- **Response viewer** — syntax-highlighted JSON, XML, and HTML; status code, response time, and payload size at a glance
- **Copy response** — one-click copy of the full response body
- **Response chaining** — right-click any value in the status bar or headers to instantly set it as an environment variable

### Collections & Workspaces

- **Workspaces** — each workspace is a plain folder on disk; create as many as you need, one per project
- **Collections** — group requests into named collections; rename, duplicate, delete, and reorder inline
- **Save requests** — `Ctrl+S` saves the current request with name and collection
- **Export collection** — export any collection as a portable `.flux.json` JSON file
- **Search & filter** — live-filter collections and requests by name from the sidebar

### Environments & Auth

- **Environments** — named variable sets (Dev / Staging / Prod); `{{VAR}}` interpolation in URLs, headers, body, and query params
- **Env switcher** — swap active environment in one click; all open tabs update instantly
- **Bearer token** — auto-injects `Authorization: Bearer <token>`; supports env variables
- **Basic auth** — username + password auto-encoded as Base64
- **API key** — attach a key to any header name you choose

### WebSocket & SSE Client

- **Real-time connections** — connect to any `ws://` / `wss://` endpoint or Server-Sent Events (SSE) URL
- **Message log** — timestamped, color-coded sent/received messages with auto-scroll
- **Protocol toggle** — switch between WebSocket (bidirectional) and SSE (receive-only) in one click
- **Message input** — send text messages over WebSocket while connected
- **Status indicator** — live connection state with connect/disconnect control

### Cookie Jar

- **Auto-capture** — every `Set-Cookie` header is stored in a per-workspace cookie jar automatically
- **Auto-replay** — cookies are sent on subsequent requests to matching domains, like a real browser
- **Persistent** — the cookie jar survives app restarts; stored as a JSON file in your workspace
- **Inspect** — view all cookies in the response Cookies tab

### Contract Testing

- **Link an OpenAPI spec** — attach a `.yaml` / `.yml` / `.json` spec to any collection from the ⋮ menu
- **Auto-validation** — every response is validated against the spec: status code, response body JSON schema, and headers
- **Contract badge** — green ✓ `Contract OK` or red ✗ `N violations` badge in the status bar
- **Violation details** — click the badge to expand a panel with each violation's layer, field path, and message
- **Change / unlink** — swap or remove the linked spec at any time from the collection menu

### Local Mock Server

- **One-click start** — launch a real HTTP server on `localhost:4321` from the Mock panel in the toolbar
- **Save for Mock** — click `Save for Mock` after any live response to capture it; the mock server replays it for that route
- **Path parameter matching** — `/users/:id` matches `/users/123`, `/users/456`, etc.
- **Delay simulation** — add artificial latency (ms) to any route to test loading states and timeouts
- **Status override** — force any status code on a route without changing the saved body
- **CORS enabled** — permissive CORS headers let any browser frontend call `localhost:4321` directly

### Collection Runner

- **Run all requests** — execute every request in a collection sequentially or concurrently (up to 5 parallel)
- **Assertions** — define pass/fail rules per request: status code checks, max response time, body contains string
- **Pass/fail results** — color-coded results grid with per-request status, timing, and assertion breakdown
- **Run from sidebar** — right-click any collection and select "Run" to launch the runner modal
- **Scripted runs** — automatically resolves `{{var}}` references; applies pre-set variables and extracts values between requests

### Scripting (Pre-Request & Post-Response)

- **Pre-set variables** — define variables to set before a request executes; values can reference environment variables
- **Extract rules** — after a response arrives, extract values from JSON body (dot-path) or response headers into environment variables
- **Scripts tab** — dedicated "Scripts" tab in the request panel for managing both pre-set and extract rules
- **Request chaining** — pass data between requests in a collection run: extract a token from login → use it in subsequent requests

### OpenAPI Export

- **Spec generation** — export any collection as an OpenAPI 3.0.3 JSON spec
- **Schema inference** — request bodies get JSON schemas, query params are extracted, auth schemes are detected
- **Export from sidebar** — right-click any collection and select "Export OpenAPI Spec"

### CLI Mode

- **Headless execution** — run collections from the terminal without launching the GUI: `reqit run <collection>`
- **Environment selection** — `reqit run <collection> --env <name>` to pick the active variable set
- **Output formats** — `--output text` (human-readable) or `--output json` (machine-parseable)
- **Workspace targeting** — `--workspace <id>` to run against a specific workspace
- **CI/CD ready** — use in pipelines for smoke tests and contract checks

### Import & Code Generation

- **Postman import** — drop in a Postman v2.1 collection JSON; all requests, headers, auth, and bodies are imported instantly
- **cURL import** — paste any `curl` command and reqit parses it into a fully configured request tab
- **Code generation** — export the current request as `curl`, JavaScript `fetch`, or Python `requests`

### Git & Collaboration

- **Plain JSON format** — all collections are human-readable JSON; diff them in any git client
- **Commit alongside code** — workspace folders can live inside your project repo; track API changes with code changes
- **Git panel** — view the current git status of your workspace directory from inside reqit
- **Branch per feature** — teams can branch workspaces like code and review API changes via pull requests

### Developer Experience

- **Request history** — every request is auto-logged; click any entry to replay it in a new tab
- **Cross-device sync** — drop a workspace folder into Dropbox, OneDrive, or Google Drive; open it on any machine with "Open folder" — no account needed
- **Auto-updates** — reqit checks for new releases on startup and shows a dismissible banner if one is available
- **Keyboard shortcuts** — built for keyboard-first use

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Send request | `Ctrl + Enter` |
| Save request | `Ctrl + S` |
| New tab | `Ctrl + T` |
| Close tab | `Ctrl + W` |
| Focus URL bar | `Ctrl + E` |

---

## Data Storage

Everything is local. No data leaves your machine unless you explicitly send an API request or push to a git remote you control.

| Platform | Path |
|----------|------|
| Windows  | `%APPDATA%\reqit\` |
| macOS    | `~/Library/Application Support/reqit/` |
| Linux    | `~/.config/reqit/` |

---

## Built With

| Layer | Technology |
|-------|-----------|
| Desktop framework | [Wails v2](https://wails.io) |
| Backend | [Go](https://go.dev) (latest stable) |
| HTTP engine | Go `net/http` with custom persistent cookie jar |
| OpenAPI validation & export | [kin-openapi](https://github.com/getkin/kin-openapi) |
| WebSocket | [gorilla/websocket](https://github.com/gorilla/websocket) |
| Frontend | [React 18](https://react.dev) + [TypeScript](https://www.typescriptlang.org) |
| Build tool | [Vite](https://vitejs.dev) |
| Styling | [Tailwind CSS v3](https://tailwindcss.com) |
| State management | [Zustand](https://zustand-demo.pmnd.rs) |
| JSON editor | [CodeMirror 6](https://codemirror.net) |
| Icons | [HugeIcons](https://hugeicons.com) |

---

## Running from Source

**Prerequisites:** Go (latest stable), Node 20+, [Wails CLI v2](https://wails.io/docs/gettingstarted/installation)

```bash
# Install Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Clone
git clone https://github.com/HalxDocs/reqit.git
cd reqit/flux

# Dev mode (live reload)
wails dev

# Production build
wails build
```

The binary lands in `flux/build/bin/`.

---

## Documentation

See [DOCS.md](DOCS.md) for the full user guide.

---

## Support

If reqit saves you time, consider supporting the project:

| Region | Platform |
|--------|----------|
| 🌍 International | [GitHub Sponsors](https://github.com/sponsors/HalxDocs) |
| 🌍 Africa / Nigeria | [myhappr.xyz](https://myhappr.xyz/halxdocs) |

---

## Contributing

Issues and pull requests are welcome. Keep PRs focused — one feature or fix per PR.

---

Built by [HalxDocs](https://halxdocs.com) · MIT License
