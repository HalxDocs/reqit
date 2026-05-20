# reqit Documentation

> A local-first API client built for speed. No cloud account, no telemetry, no lock-in.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Your First Request](#your-first-request)
3. [Workspaces](#workspaces)
4. [Collections](#collections)
5. [Environments & Variables](#environments--variables)
6. [Authentication](#authentication)
7. [Response Viewer](#response-viewer)
8. [Cookie Jar](#cookie-jar)
9. [Contract Testing](#contract-testing)
10. [Local Mock Server](#local-mock-server)
11. [Code Generation](#code-generation)
12. [Import](#import)
13. [Git & Collaboration](#git--collaboration)
14. [Request History](#request-history)
15. [Auto-updates](#auto-updates)
16. [Keyboard Shortcuts](#keyboard-shortcuts)
17. [FAQ](#faq)

---

## Getting Started

### Download

| Platform | File |
|----------|------|
| Windows  | [reqit-windows-amd64.exe](https://github.com/HalxDocs/reqit/releases/latest/download/reqit-windows-amd64.exe) |
| macOS    | [reqit-macos-universal.zip](https://github.com/HalxDocs/reqit/releases/latest/download/reqit-macos-universal.zip) |
| Linux    | [reqit-linux-amd64](https://github.com/HalxDocs/reqit/releases/latest/download/reqit-linux-amd64) |

Latest release: [github.com/HalxDocs/reqit/releases/latest](https://github.com/HalxDocs/reqit/releases/latest)

### macOS — First Launch

macOS blocks unsigned apps. To open reqit:

1. Right-click `reqit.app` → **Open** → **Open** in the dialog
2. Or: **System Settings → Privacy & Security → Open Anyway**

Or via Terminal:
```bash
xattr -cr /path/to/reqit.app
```

### Linux — Make Executable

```bash
chmod +x reqit-linux-amd64
./reqit-linux-amd64
```

---

## Your First Request

1. Launch reqit — you land on the **Home** screen
2. Click **Open workspaces** → create or open a workspace
3. Press `Ctrl + T` to open a new request tab
4. Type a URL in the address bar (e.g. `https://jsonplaceholder.typicode.com/posts/1`)
5. Press `Ctrl + Enter` to send

The response appears in the right panel: body, status code, response time, size, headers, and cookies.

---

## Workspaces

A workspace is a **folder on your machine**. Everything inside — collections, environments, history, cookie jar — lives as plain JSON files. No database, no proprietary format.

### Create a Workspace

Home screen → **New workspace** → enter a name, pick an accent colour, add an optional description.

### Open an Existing Folder

Home screen → **Open folder** → pick any directory. reqit detects existing data in `.flux/` and loads it. Use this to open a workspace you already have synced via Dropbox, OneDrive, or Google Drive.

### Switch Workspaces

Click the reqit logo top-left to return to the Home screen, then open another workspace. Each workspace remembers its open tabs, active environment, and cookie jar independently.

### Cross-Device Sync (No Account)

Drop any workspace folder into Dropbox, OneDrive, or Google Drive. On another machine: Home → Open folder → pick the synced folder. All collections, environments, and history load immediately. No sign-in required.

### Data Location

| Platform | Default path |
|----------|-------------|
| Windows  | `%APPDATA%\reqit\workspaces\` |
| macOS    | `~/Library/Application Support/reqit/workspaces/` |
| Linux    | `~/.config/reqit/workspaces/` |

---

## Collections

Collections group saved requests. Each collection is a JSON file in your workspace folder.

### Create a Collection

Sidebar → **+ New collection** → type a name → Enter.

### Save a Request

With a request open: `Ctrl + S` → pick or create a collection → give it a name → Save.

### Open a Saved Request

Click any request in the sidebar Collections tree. It opens in a new tab with all settings restored.

### Rename

Hover a collection or request → click the pencil icon → type the new name → Enter. Press Escape to cancel.

### Duplicate a Request

Hover a request row → click the duplicate (copy) icon. A copy appears in the same collection ready to rename.

### Delete

Hover → click the trash icon → confirm. Deletions are permanent.

### Export a Collection

Collection ⋮ menu → **Export as JSON** → saves a `.flux.json` file you can share or import into another workspace.

### Search & Filter

Type in the sidebar search bar above the collections tree. Results update live as you type — collections with no matching requests are hidden automatically.

---

## Environments & Variables

Environments let you switch between configs (Dev / Staging / Prod) without editing individual requests.

### Create an Environment

Sidebar env dropdown → **+ New** → name it → add key-value pairs (e.g. `base_url = https://api.prod.com`).

### Use Variables

Reference any variable with `{{VARIABLE_NAME}}` in URLs, headers, query params, or the body:

```
https://{{base_url}}/api/users
Authorization: Bearer {{access_token}}
```

Variables are resolved before the request is sent. The URL preview bar shows the expanded result.

### Switch Environments

Click the env dropdown in the sidebar → select a different environment. All `{{variables}}` in every open tab resolve to the new values instantly.

### Variable Scope

Variables are per-workspace. They never leave your machine.

---

## Authentication

The **Auth** tab on each request provides shortcuts for common auth schemes. The value is injected as a header before every send.

### Bearer Token

Adds `Authorization: Bearer <token>`. Use an environment variable for the token value:

```
Token: {{access_token}}
```

### Basic Auth

Enter a username and password. reqit Base64-encodes them and sends `Authorization: Basic ...` automatically. Supports env variable references in both fields.

### API Key

Specify the header name (e.g. `X-API-Key`) and value. reqit adds that header on every send. Supports env variables.

---

## Response Viewer

### Status Bar

Displays: HTTP status code (colour-coded — green 2xx, yellow 3xx, red 4xx/5xx), response time in ms, and payload size.

### Body Tab

Syntax-highlighted JSON, XML, and HTML with pretty-printing. Switch to **Raw** for plain text. Use the copy button to copy the entire body to clipboard.

### Headers Tab

All response headers in a table. Useful for inspecting `cache-control`, `content-type`, `set-cookie`, rate-limit headers, and CORS headers.

### Cookies Tab

Every cookie set by the response: name, value, domain, path, expiry, `HttpOnly`, and `Secure` flags.

### Contract Badge

If the request's collection has a linked OpenAPI spec, a badge appears in the status bar after each response — see [Contract Testing](#contract-testing).

### Save for Mock

Click **Save for Mock** (bookmark icon in the response toolbar) to capture the current response. The [Local Mock Server](#local-mock-server) will replay it for this route.

---

## Cookie Jar

reqit maintains a persistent cookie jar per workspace that behaves like a real browser.

### How It Works

1. You send a request to `https://api.example.com/login`
2. The response includes `Set-Cookie: session=abc123; HttpOnly`
3. reqit stores the cookie in the workspace cookie jar automatically
4. On the next request to any matching domain, reqit sends `Cookie: session=abc123`
5. Authenticated endpoints work without you manually copying tokens

### Persistence

The cookie jar is saved as a JSON file in your workspace folder and survives app restarts.

### Viewing Cookies

Open the **Cookies** tab in the response panel to see exactly which cookies are stored and their attributes.

### Clearing Cookies

Delete the `cookies.json` file in your workspace folder, or manage it from the Settings modal.

---

## Contract Testing

Validate that your API responses match their OpenAPI specification automatically on every request.

### Link a Spec to a Collection

1. In the sidebar, hover the collection name → click ⋮
2. Select **Link OpenAPI Spec**
3. Pick a `.yaml`, `.yml`, or `.json` spec file from inside your workspace folder
4. A blue spec indicator (`⌗`) appears next to the collection name

> The spec file must be inside your workspace folder so it stays with the collection in git.

### Validation

After every request in that collection, reqit:

- Checks the **status code** against the spec's defined responses for that operation
- Validates the **response body** JSON schema against the spec's content schema
- Checks **response headers** against the spec's header definitions

### Contract Badge

A badge appears in the response status bar:

- **✓ Contract OK** (green) — response matches the spec
- **✗ N violations** (red) — one or more mismatches found

Click the badge to expand a violations panel showing each error:

| Column | Description |
|--------|-------------|
| Layer  | `status`, `body`, or `header` |
| Field  | JSON path of the failing field (e.g. `$.user.email`) |
| Message | Human-readable error |

### Skipped Validation

If the endpoint isn't defined in the spec (e.g. a request to an undocumented route), the badge shows `Skipped` in grey. No false positives.

### Change or Unlink a Spec

Collection ⋮ menu → **Change Spec** (swap to a different file) or **Unlink Spec** (remove contract validation entirely).

---

## Local Mock Server

Run a real HTTP server inside reqit that replays your saved responses — no backend needed.

### Start the Server

Click **Mock Server** in the toolbar (between the tab bar and URL bar) → **Start**. The server starts on `http://localhost:4321`.

### Register Routes (Save for Mock)

1. Send a real request to your API
2. In the response panel, click **Save for Mock** (bookmark icon)
3. reqit registers the request's method + path as a mock route

The mock server will now handle that route and return the captured body, status code, and headers.

### Path Parameter Matching

Routes support `:param` placeholders:

| Saved route | Matches |
|-------------|---------|
| `GET /users/:id` | `GET /users/1`, `GET /users/abc` |
| `POST /orders/:id/items` | `POST /orders/42/items` |

### Delay Simulation

Use **Set Override** (from the mock panel route list) to add a delay in milliseconds. Useful for testing loading spinners and timeout handling.

### Status Override

Override the HTTP status code returned for a route without changing the saved body. Force a `500` to test error states, or `429` to test rate-limit handling.

### CORS

The mock server includes permissive CORS headers (`Access-Control-Allow-Origin: *`). Any browser-based frontend can call `localhost:4321` directly without a proxy.

### X-Mock-Server Header

Every mock response includes `X-Mock-Server: reqit` so you can distinguish mock responses from real ones in your frontend.

### Stopping

Click **Stop** in the mock panel or close the reqit app.

---

## Code Generation

Open a request tab → click **`</>` Code** → pick a format:

### cURL

```bash
curl -X POST https://api.example.com/users \
  -H "Authorization: Bearer abc123" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice"}'
```

### JavaScript (fetch)

```js
const res = await fetch("https://api.example.com/users", {
  method: "POST",
  headers: {
    "Authorization": "Bearer abc123",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ name: "Alice" }),
});
const data = await res.json();
```

### Python (requests)

```python
import requests

res = requests.post(
    "https://api.example.com/users",
    headers={"Authorization": "Bearer abc123"},
    json={"name": "Alice"},
)
data = res.json()
```

Variables in the generated code are resolved using the active environment values.

---

## Import

### Postman Collection (v2.1)

1. In Postman: right-click collection → **Export** → **Collection v2.1** → save the `.json` file
2. In reqit: sidebar → **Import Postman** button (or `Ctrl + Shift + I`) → pick the file
3. All requests, folders, headers, auth, and bodies are imported into a new collection

> Postman environment variables are not automatically imported. Add them manually in the Env panel.

### Paste cURL

Toolbar → **Paste cURL** (or look for the cURL import option) → paste a `curl` command. reqit parses:

- `-X` / `--request` → HTTP method
- `-H` / `--header` → headers
- `-d` / `--data` / `--data-raw` → body
- `--user` / `-u` → Basic auth
- URL → URL bar

The request opens in a new tab ready to send.

---

## Git & Collaboration

### Why Git?

reqit stores everything as plain JSON. This means you get version control for free — track when endpoints changed, who added what, and roll back any mistake.

### Commit Your Workspace

```bash
cd /path/to/your/workspace
git init
git remote add origin https://github.com/your-org/api-workspace.git
git add .
git commit -m "initial collections"
git push -u origin main
```

### Git Panel

The **Git** tab in the sidebar shows the current git status of the workspace folder — modified files, staged changes, and current branch. Useful for a quick check before committing.

### Team Workflow

1. Each developer clones the workspace repo and opens it in reqit via **Open folder**
2. When someone adds or changes a request, they commit and push the JSON changes
3. Others pull and reqit picks up the changes immediately
4. API changes are reviewed in pull requests alongside the code that implements them

### Branching

Branch your workspace just like code:

```bash
git checkout -b feature/new-auth-endpoints
```

Work on your requests, commit, push the branch, open a PR. The diff is human-readable JSON.

---

## Request History

Every request you send is automatically logged in the sidebar **History** tab.

- Click any entry to open it in a new tab with the full request restored (method, URL, headers, body)
- History is stored per workspace
- Entries are ordered newest-first

---

## Auto-updates

reqit checks for new releases silently on startup by calling the GitHub releases API.

- If a newer version is found, a **dismissible banner** appears at the top of the app with the new version number and a download link
- Click the link to open the releases page in your browser
- Click **×** to dismiss — reqit never auto-downloads or force-updates
- The check fails silently when offline; no error is shown

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

## FAQ

**Is reqit free?**
Yes. reqit is fully open source under the MIT license. Always free, no premium tier.

**Does reqit send any data to the internet?**
Only when you explicitly send an API request. Your collections, environments, history, and cookie jar never leave your machine. The only outbound connections reqit makes on its own are: (1) a startup version check to the GitHub API, and (2) the live GitHub star count displayed on the home screen — both are read-only and contain no personal data.

**Can I use reqit offline?**
Yes. All core features work without an internet connection. The version check and star count will silently fail — everything else is unaffected.

**How do I back up my data?**
Copy your workspace folder. Everything is plain JSON — zip it and store it anywhere.

**The app says "no active workspace" — what do I do?**
Click the reqit logo at the top of the sidebar to return to the Home screen, then create or open a workspace.

**Can I use reqit with HTTPS and self-signed certificates?**
Yes — reqit's HTTP engine does not verify TLS certificates by default for local/dev servers. Disable this in Settings if needed for security.

**What OpenAPI versions does contract testing support?**
OpenAPI 3.0 and 3.1 (`.yaml`, `.yml`, `.json`). Swagger 2.0 is not supported.

**Can I run multiple mock servers?**
Currently reqit runs one mock server at a time on port 4321. Stop the current server to change the port (port selection coming in a future release).

**How do I report a bug or request a feature?**
Open an issue at [github.com/HalxDocs/reqit/issues](https://github.com/HalxDocs/reqit/issues).

---

*reqit v0.3.1 · Built with [Wails](https://wails.io) (Go + React) · [github.com/HalxDocs/reqit](https://github.com/HalxDocs/reqit)*
