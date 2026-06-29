# reqit — Go + Wails source

This is the source tree for **reqit**, a local-first desktop API client built with [Wails v2](https://wails.io) (Go backend + React/TypeScript frontend).

See the [root README](../README.md) for the full feature list and download links.

---

## Project structure

```
flux/
├── app.go                    # Wails App — all backend methods exposed to frontend
├── main.go                   # Entry point
├── wails.json                # Wails project config (name, build settings)
├── go.mod / go.sum
├── build/
│   ├── appicon.png           # App icon (1024×1024, used by all platforms)
│   └── windows/
│       └── icon.ico          # Windows taskbar / exe icon (multi-size)
├── frontend/
│   ├── src/
│   │   ├── app/              # Layout, stores, routing
│   │   ├── features/         # Feature modules (request, response, mock, env, profile, blog, websocket…)
│   │   ├── shared/           # Shared hooks, components, lib (commands, keyboard shortcuts)
│   │   └── web/              # Web-only entry point (WebApp, main-web.tsx)
│   └── wailsjs/              # Auto-generated Wails JS bindings (do not edit)
└── internal/
    ├── agentlens/            # Agent-readiness mapper, linter, and export
    ├── ai/                   # reqit AI — BYOK error intelligence and assertion generation
    ├── collections/          # CRUD for collections and saved requests
    ├── contract/             # OpenAPI spec loading and response validation
    ├── cookies/              # Persistent per-workspace cookie jar
    ├── environments/         # Environment variable sets
    ├── history/              # Request history log
    ├── mcp/                  # Model Context Protocol server for AI agents
    ├── mock/                 # Local mock HTTP server
    ├── models/               # Shared Go structs (request, response, collection…)
    ├── profile/              # Dev profile store + Upstash publish/fetch
    ├── requester/            # HTTP request execution engine
    ├── schema/               # OpenAPI snapshot and drift detection
    ├── socketio/             # Socket.IO / Engine.IO v4 client
    ├── updater/              # GitHub release version checker
    └── workspaces/           # Workspace metadata management
```

---

## Prerequisites

- Go (latest stable)
- Node.js 20+
- Wails CLI v2

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

---

## Dev mode

```bash
cd flux
wails dev
```

Hot-reload is active for both Go and the frontend. The app runs as a native window — backend calls (file I/O, HTTP engine, mock server) require the Wails runtime and will not work in a plain browser tab.

---

## Production build

```bash
cd flux
wails build
```

Output: `flux/build/bin/reqit` (or `reqit.exe` on Windows). Single binary, no installer needed.

### Platform targets

```bash
# Windows
wails build -platform windows/amd64 -o reqit

# macOS (universal — Intel + Apple Silicon)
wails build -platform darwin/universal -o reqit

# Linux (requires libwebkit2gtk-4.1-dev on Ubuntu 24.04+)
wails build -platform linux/amd64 -o reqit -tags webkit2_41
```

> **Note:** The `-tags webkit2_41` flag is required for WebKit2GTK 4.1 on Ubuntu 24.04+. On older Ubuntu (22.04), install the compatibility libs and omit the tag.

---

## CI / Release

Releases are built by GitHub Actions on `v*.*.*` tag pushes. See [`.github/workflows/release.yml`](../.github/workflows/release.yml). Three jobs run in parallel (Windows, macOS, Linux) and upload artifacts to a GitHub Release automatically.

```bash
# Trigger a release
git tag v0.x.y
git push origin v0.x.y
```

---

## Adding a backend method

1. Add a method on `*App` in `app.go` (or a new file)
2. Run `wails generate module` or restart `wails dev` — the JS bindings in `frontend/wailsjs/` are regenerated automatically
3. Import and call from the frontend via `import { YourMethod } from "../../wailsjs/go/main/App"`

---

## Data storage

| Platform | Path |
|----------|------|
| Windows  | `%APPDATA%\reqit\` |
| macOS    | `~/Library/Application Support/reqit/` |
| Linux    | `~/.config/reqit/` |

Each workspace is a subdirectory containing JSON files for collections, environments, history, cookies, and git metadata.

---

## License

MIT
