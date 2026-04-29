# Flux

A fast, local-first API client for developers. Built with [Wails](https://wails.io) (Go + React), no Electron, no cloud account required.

---

## Features

- **HTTP requests** — GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS with params, headers, body (JSON, form-encoded, raw)
- **Auth tab** — Bearer token and Basic auth with one click
- **Multiple tabs** — open and switch between requests without losing state
- **Collections** — save and organise requests; rename, delete, export as JSON
- **History** — every request you send is automatically logged
- **Environments** — named variable sets; use `{{VAR_NAME}}` in any URL, header, or body field
- **Response viewer** — status + timing + size, JSON viewer with syntax highlighting and in-body search (Ctrl+F / ⌘F), XML/HTML pretty-print
- **Code generation** — copy the current request as cURL, JavaScript `fetch`, or Python `requests`
- **Postman import** — drop in a Postman v2.1 collection JSON and it lands in your chosen collection
- **Paste cURL** — paste any `curl` command and it opens as a new tab with headers, body, and auth pre-filled
- **Export collection** — download any collection as a `flux/collection/v1` JSON file (git-friendly)

---

## Getting started

### Prerequisites

- [Go 1.22+](https://go.dev/dl/)
- [Node.js 18+](https://nodejs.org/)
- [Wails CLI v2](https://wails.io/docs/gettingstarted/installation)

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

### Dev mode

```bash
cd flux
wails dev
```

> **Note:** The app only works as a native Wails window. The browser URL that Wails prints (`http://localhost:34115`) will show the UI but all backend calls (sending requests, reading files, persistence) require the desktop runtime and will fail in the browser.

### Build

```bash
cd flux
wails build
```

The binary lands in `flux/build/bin/`. No installer needed — it's a single executable.

---

## Data storage

All data (collections, history, environments, profile) is stored as JSON files in your OS user-config directory:

| Platform | Path |
|----------|------|
| Windows  | `%APPDATA%\flux\` |
| macOS    | `~/Library/Application Support/flux/` |
| Linux    | `~/.config/flux/` |

Nothing leaves your machine.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | [Wails v2](https://wails.io) |
| Backend | Go 1.22+, `net/http` stdlib |
| Frontend | React 18 + TypeScript + Tailwind v3 |
| State | [Zustand](https://github.com/pmndrs/zustand) |
| Editor | [CodeMirror 6](https://codemirror.net/) |

---

## License

MIT
