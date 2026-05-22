export interface DocFeature {
  name: string;
  desc: string;
}

export interface DocSection {
  id: string;
  title: string;
  subtitle: string;
  features: DocFeature[];
}

export const DOC_SECTIONS: DocSection[] = [
  {
    id: "workspaces",
    title: "Workspaces",
    subtitle: "Project-level organisation",
    features: [
      { name: "Create a workspace", desc: "Start a new workspace with a name, accent colour, and optional description. Each workspace is a plain folder on your disk — no database, no cloud." },
      { name: "Open from folder", desc: "Already have an API folder? Point reqit at it. Collection data lives in a .flux/ subdirectory inside the folder you pick." },
      { name: "Switch workspaces", desc: "Jump between projects instantly from the home screen. Each workspace remembers its own open tabs, active environment, and cookie jar." },
      { name: "Cloud sync (no account)", desc: "Drop the workspace folder into Dropbox, OneDrive, or Google Drive. On any other device, open reqit → Open folder → pick the synced directory. Done." },
    ],
  },
  {
    id: "collections",
    title: "Collections",
    subtitle: "Organise and share requests",
    features: [
      { name: "Create & rename", desc: "Group requests into named collections. Click the pencil icon on any collection or request to rename it inline without leaving the sidebar." },
      { name: "Duplicate requests", desc: "Copy any saved request with one click. Useful for creating variants (e.g. auth vs. no-auth) without starting from scratch." },
      { name: "Delete", desc: "Remove a request or an entire collection with a confirmation prompt. Deletions are permanent — back up important work with the export feature." },
      { name: "Export as JSON", desc: "Export any collection as a portable .flux.json file. Share it with teammates or import it into another reqit workspace." },
    ],
  },
  {
    id: "request-builder",
    title: "Request Builder",
    subtitle: "Compose any HTTP request",
    features: [
      { name: "HTTP methods", desc: "Full support for GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS. Select the method from the dropdown left of the URL bar." },
      { name: "URL bar", desc: "Type or paste any URL. {{VARIABLES}} are resolved live. Press Ctrl+Enter to send immediately without touching the mouse." },
      { name: "Query params", desc: "Add, remove, and toggle query parameters in a table. Disabled rows are excluded from the request without deleting them." },
      { name: "Headers", desc: "Set any request header with name/value pairs. Toggle headers on/off individually. Common headers like Content-Type are pre-suggested." },
      { name: "Body", desc: "Send JSON (syntax-highlighted editor), form-urlencoded, multipart/form-data, or raw text. The JSON editor auto-formats on paste." },
      { name: "URL preview", desc: "A live preview bar shows the fully expanded URL — with all query params appended and variables resolved — before you send." },
    ],
  },
  {
    id: "environments",
    title: "Environments & Variables",
    subtitle: "Switch configs without editing requests",
    features: [
      { name: "Create environments", desc: "Define key/value pairs (e.g. base_url = https://api.prod.com). Create as many environments as you need: Dev, Staging, Production, etc." },
      { name: "{{VAR}} interpolation", desc: "Any {{VARIABLE}} in URLs, headers, body, or query params is automatically replaced with the active environment's value before the request is sent." },
      { name: "Env switcher", desc: "Switch the active environment from the sidebar dropdown in one click. All open tabs immediately reflect the new values." },
      { name: "Secrets-safe", desc: "Store tokens and API keys in environment variables rather than hardcoding them. Share collection files without exposing credentials." },
    ],
  },
  {
    id: "auth",
    title: "Authentication",
    subtitle: "Auth flows handled for you",
    features: [
      { name: "Bearer token", desc: "Adds Authorization: Bearer <token> automatically. Reference environment variables (e.g. {{ACCESS_TOKEN}}) so you never paste tokens into request files." },
      { name: "Basic auth", desc: "Enter a username and password — reqit Base64-encodes them and sends Authorization: Basic ... on every request." },
      { name: "API key", desc: "Attach an API key to any header name you specify (e.g. X-API-Key). Supports environment variable references." },
    ],
  },
  {
    id: "response",
    title: "Response Viewer",
    subtitle: "Inspect what came back",
    features: [
      { name: "Status bar", desc: "Instant display of HTTP status code with colour coding (green 2xx, yellow 3xx, red 4xx/5xx), response time in ms, and payload size." },
      { name: "Body viewer", desc: "Syntax-highlighted JSON, XML, and HTML with pretty-printing and collapsible nodes. Switch to raw view for plain text responses." },
      { name: "Headers", desc: "All response headers in a clean table. Useful for inspecting cache-control, content-type, rate-limit, and CORS headers." },
      { name: "Cookies tab", desc: "See every cookie set by the response — name, value, domain, path, expiry, HttpOnly, and Secure flags — in a readable table." },
      { name: "One-click copy", desc: "Copy the entire response body to the clipboard with a single button click, no selection needed." },
      { name: "Save for Mock", desc: "Click Save for Mock to capture the live response. The mock server will replay it for that route from that point on." },
    ],
  },
  {
    id: "cookies",
    title: "Cookie Jar",
    subtitle: "Automatic session handling",
    features: [
      { name: "Auto-capture", desc: "Every Set-Cookie header in a response is stored automatically in the workspace's cookie jar — no configuration required." },
      { name: "Auto-replay", desc: "Stored cookies are sent on subsequent requests to matching domains, just like a real browser. Login once and keep testing authenticated routes." },
      { name: "Persistent across restarts", desc: "The cookie jar is saved as a JSON file in your workspace so sessions survive app restarts." },
      { name: "Inspect cookies", desc: "Open the Cookies tab on any response to see exactly which cookies are set and what their attributes are." },
    ],
  },
  {
    id: "contract-testing",
    title: "Contract Testing",
    subtitle: "Validate responses against your OpenAPI spec",
    features: [
      { name: "Link an OpenAPI spec", desc: "In the collection ⋮ menu → Link OpenAPI Spec. Pick any .yaml, .yml, or .json spec file from within your workspace folder." },
      { name: "Auto-validation", desc: "After every request in that collection, reqit validates the response — status code, response body JSON schema, and headers — against the linked spec." },
      { name: "Contract badge", desc: "A green ✓ Contract OK badge or a red ✗ N violations badge appears in the status bar. You always know at a glance whether the API matches its contract." },
      { name: "Violation details", desc: "Click the badge to expand a panel listing each violation: layer (status / body / header), field path, and a human-readable error message." },
      { name: "Change or unlink", desc: "Switch to a different spec version or remove the link entirely from the collection ⋮ menu at any time." },
    ],
  },
  {
    id: "mock-server",
    title: "Local Mock Server",
    subtitle: "Serve fake APIs without a backend",
    features: [
      { name: "One-click start", desc: "Click Start in the Mock panel (toolbar) to launch a real HTTP server on localhost:4321 inside the reqit process. No external tools needed." },
      { name: "Saved response replay", desc: "After saving a response with Save for Mock, the mock server replays that exact body, status, and headers for matching requests." },
      { name: "Route parameter matching", desc: "Paths like /users/:id automatically match /users/123, /users/456, etc. — you don't need to register every ID explicitly." },
      { name: "Delay simulation", desc: "Add a delay (ms) to any route to test loading states, spinners, and timeout handling in your frontend." },
      { name: "Status override", desc: "Override the status code for any route independently from the saved body — force a 500 to test error states." },
      { name: "CORS enabled", desc: "The mock server includes permissive CORS headers so any browser-based frontend can call localhost:4321 without proxy configuration." },
    ],
  },
  {
    id: "codegen",
    title: "Code Generation",
    subtitle: "Copy-paste ready snippets",
    features: [
      { name: "cURL", desc: "Export any request as a ready-to-paste curl command with all headers, auth, query params, and body included." },
      { name: "JavaScript (fetch)", desc: "Generate a fetch() call with async/await, all headers set, and the body JSON-stringified." },
      { name: "Python (requests)", desc: "Generate a requests.get/post/...() snippet with headers dict and body — paste straight into a script or notebook." },
    ],
  },
  {
    id: "import",
    title: "Import",
    subtitle: "Bring your existing work in",
    features: [
      { name: "Postman v2.1", desc: "Import any Postman collection JSON (v2.1 format). All requests, folders, headers, auth, and bodies are preserved and placed into a new collection." },
      { name: "Paste cURL", desc: "Paste any curl command (including -H headers, -d body, and --user auth) and reqit parses it into a fully configured request tab instantly." },
    ],
  },
  {
    id: "git",
    title: "Git & Collaboration",
    subtitle: "Version-control your API layer",
    features: [
      { name: "Plain JSON format", desc: "All collections are human-readable JSON files — no binary blobs, no proprietary encoding. Diff them in any git client." },
      { name: "Commit alongside code", desc: "Workspace folders can live inside your project repo. Track API changes alongside the code that implements them." },
      { name: "Git panel", desc: "View the current git status of your workspace directory from the sidebar Git tab without switching to a terminal." },
      { name: "Team collaboration", desc: "Branch workspaces like you branch code. Teammates can make API changes in a PR and you can review the JSON diff alongside the code diff." },
    ],
  },
  {
    id: "history",
    title: "Request History",
    subtitle: "Never lose a request you sent",
    features: [
      { name: "Auto-logged", desc: "Every request you send is automatically added to a history list in the sidebar — no manual saving required." },
      { name: "One-click replay", desc: "Click any history entry to open it in a new tab with the method, URL, headers, and body fully restored." },
    ],
  },
  {
    id: "search",
    title: "Search & Filter",
    subtitle: "Find anything fast",
    features: [
      { name: "Sidebar filter", desc: "Type in the search bar above the collections tree to instantly filter by collection name or request name." },
      { name: "Live results", desc: "Results narrow as you type — no need to press Enter. Collections with no matching requests are hidden automatically." },
    ],
  },
  {
    id: "updates",
    title: "Auto-updates",
    subtitle: "Always on the latest version",
    features: [
      { name: "Startup check", desc: "reqit silently checks the GitHub releases API each time it starts. The check is non-blocking and fails gracefully when offline." },
      { name: "Update banner", desc: "If a newer version is found, a dismissible banner appears at the top of the app showing the new version number and a direct download link." },
      { name: "No forced updates", desc: "The banner is informational only. Dismiss it and carry on — reqit never auto-downloads or auto-installs without your action." },
    ],
  },
  {
    id: "shortcuts",
    title: "Keyboard Shortcuts",
    subtitle: "Stay in flow",
    features: [
      { name: "Ctrl + Enter", desc: "Send the current request immediately, no matter which field is focused." },
      { name: "Ctrl + S", desc: "Save the current request. Opens the Save dialog if the request hasn't been saved yet." },
      { name: "Ctrl + T", desc: "Open a new blank request tab." },
      { name: "Ctrl + W", desc: "Close the current tab." },
      { name: "Ctrl + E", desc: "Focus the URL bar and select all text — ready to type a new URL." },
      { name: "Ctrl + Shift + I", desc: "Open the Postman import dialog directly." },
    ],
  },
];
