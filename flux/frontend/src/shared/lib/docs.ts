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
      { name: "Duplicate requests", desc: "Copy any saved request with one click. Useful for creating variants without starting from scratch." },
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
      { name: "URL bar", desc: "Type or paste any URL. {{VARIABLES}} resolve live and are highlighted in cyan when valid, white when unknown. Press Ctrl+Enter to send immediately." },
      { name: "Query params", desc: "Add, remove, and toggle query parameters in a table. Disabled rows are excluded from the request without deleting them." },
      { name: "Headers", desc: "Set any request header with name/value pairs. Toggle headers on/off individually." },
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
      { name: "{{VAR}} interpolation", desc: "Any {{VARIABLE}} in URLs, headers, body, or query params is automatically replaced with the active environment's value before the request is sent. Valid vars are highlighted in cyan in the URL bar." },
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
      { name: "Collapsible JSON tree", desc: "JSON responses render as an expandable tree by default. Large payloads use lazy expansion — nodes load on click, so even 10 MB responses don't freeze the UI." },
      { name: "Tree / Raw / Pretty toggle", desc: "Switch between collapsible tree view, raw text, and pretty-printed JSON with Ctrl+Shift+R. Each view auto-formats for readability." },
      { name: "Headers", desc: "All response headers in a clean table. Useful for inspecting cache-control, content-type, rate-limit, and CORS headers." },
      { name: "Cookies tab", desc: "See every cookie set by the response — name, value, domain, path, expiry, HttpOnly, and Secure flags — in a readable table." },
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
    id: "websocket",
    title: "WebSocket & SSE",
    subtitle: "Real-time messaging",
    features: [
      { name: "Connect to any WS/WSS", desc: "Enter any WebSocket URL and connect instantly. Messages are displayed in a scrollable log with timestamps." },
      { name: "Send messages", desc: "Type or paste JSON/text messages and send them over the active connection. The message log shows both sent and received payloads." },
      { name: "Server-Sent Events", desc: "Connect to SSE endpoints and stream events in real time. Events are parsed and displayed as they arrive." },
      { name: "Connection state", desc: "The panel shows live connection status (connected, disconnected, reconnecting), with auto-reconnect for WebSocket drops." },
    ],
  },
  {
    id: "socketio",
    title: "Socket.IO",
    subtitle: "Engine.IO v4 bidirectional client",
    features: [
      { name: "Full Engine.IO v4 handshake", desc: "Implements the complete Engine.IO v4 transport negotiation — polling handshake then WebSocket upgrade. Works with any Socket.IO v4+ server." },
      { name: "Namespace connection", desc: "Connect to any Socket.IO namespace (including the default /). Supports custom namespace paths out of the box." },
      { name: "Event emission & acknowledgements", desc: "Emit named events with JSON payloads. Callback-based acknowledgements (the server's ack function) are fully supported." },
      { name: "Cookie & header passthrough", desc: "Cookies and custom headers from the initial HTTP request are forwarded to the WebSocket transport, preserving session state across the upgrade." },
    ],
  },
  {
    id: "graphql",
    title: "GraphQL",
    subtitle: "Queries, mutations, subscriptions",
    features: [
      { name: "Query editor", desc: "Write GraphQL queries and mutations with syntax highlighting in a dedicated editor panel. Variables are separate from the query string." },
      { name: "Variables & headers", desc: "Set GraphQL variables as a JSON object alongside the query. Headers (like Authorization) work the same as HTTP requests." },
      { name: "Subscription support", desc: "Connect to GraphQL subscription endpoints over WebSocket. Streamed events appear in real time in the response panel." },
      { name: "Schema introspection", desc: "Run introspection queries against your GraphQL endpoint. Save the schema alongside your collection for offline reference." },
    ],
  },
  {
    id: "grpc",
    title: "gRPC",
    subtitle: "gRPC-web-text unary & streaming",
    features: [
      { name: "gRPC-web-text protocol", desc: "Connect to gRPC-web-text endpoints without a proxy. No envoy required — reqit speaks the protocol directly over HTTP." },
      { name: "Unary calls", desc: "Send a single request and receive a single response. Full support for request metadata (headers) and response trailers." },
      { name: "Server-streaming", desc: "Receive a stream of messages from the server. Each message is displayed as it arrives in a scrollable log." },
      { name: "Proto or JSON payload", desc: "Send payloads as JSON. The gRPC-web-text protocol handles the framing; reqit handles the serialisation." },
    ],
  },
  {
    id: "soap",
    title: "SOAP",
    subtitle: "SOAP 1.1 / 1.2 envelope builder",
    features: [
      { name: "Envelope builder", desc: "Construct SOAP envelopes with a form-based editor. Set the action, body XML, and headers without hand-writing XML." },
      { name: "SOAP 1.1 & 1.2", desc: "Toggle between SOAP 1.1 (uses SOAPAction header) and SOAP 1.2 (uses Content-Type action parameter). The envelope format adjusts automatically." },
      { name: "Raw XML editor", desc: "Prefer to write the envelope by hand? Switch to raw XML mode for full control over the message." },
    ],
  },
  {
    id: "mqtt",
    title: "MQTT",
    subtitle: "Publish / subscribe messaging",
    features: [
      { name: "Connect to any broker", desc: "Connect to MQTT v3.1.1 / v5 brokers over TCP, TLS, or WebSocket. Supports username/password authentication." },
      { name: "Publish messages", desc: "Publish to any topic with a configurable QoS level (0, 1, or 2) and retain flag." },
      { name: "Subscribe to topics", desc: "Subscribe to one or more topics with wildcard support (+ and #). Messages are displayed in a live log as they arrive." },
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
    id: "schema-drift",
    title: "Schema Drift Detection",
    subtitle: "Track OpenAPI spec changes over time",
    features: [
      { name: "Snapshot specs", desc: "Take a snapshot of any OpenAPI spec with one click. The snapshot captures the full schema — endpoints, methods, request/response shapes, and parameters." },
      { name: "Compare snapshots", desc: "Compare any two snapshots side-by-side. Adds, removals, and changes are highlighted: new endpoints in green, removed in red, modified in yellow." },
      { name: "Drift report", desc: "A human-readable diff shows exactly what changed between spec versions — useful for CI/CD pipelines and pull request reviews." },
      { name: "Historical tracking", desc: "Snapshots are stored with timestamps. Scroll back through weeks of spec changes to see how an API evolved." },
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
    id: "collection-runner",
    title: "Collection Runner",
    subtitle: "Run entire collections with assertions",
    features: [
      { name: "Run all requests", desc: "Execute every request in a collection sequentially with one click. Results are aggregated into a pass/fail report." },
      { name: "Assertions", desc: "Write JavaScript assertions that run after each response. Assert on status code, response body, headers, timing, and more." },
      { name: "Pass / fail summary", desc: "After the run, a summary shows how many assertions passed, failed, or errored. Expand any failure to see the assertion error." },
      { name: "CI-ready output", desc: "Collection runs can be exported as JSON reports for integration into CI/CD pipelines." },
    ],
  },
  {
    id: "load-testing",
    title: "Load Testing",
    subtitle: "Benchmark your endpoints",
    features: [
      { name: "Configurable concurrency", desc: "Set the number of concurrent workers (1–100) and total request count. reqit distributes requests across workers and collects metrics." },
      { name: "Latency percentiles", desc: "After the run, view p50, p75, p90, p95, p99 latency, and the slowest request. See exactly how your API performs under load." },
      { name: "Real-time progress", desc: "A live progress bar shows requests completed / total, with running averages for latency and throughput." },
    ],
  },
  {
    id: "cicd",
    title: "CI/CD Pipeline Generation",
    subtitle: "Export runnable CI workflows",
    features: [
      { name: "GitHub Actions", desc: "Generate a ready-to-use GitHub Actions workflow that runs your collection with assertions on every push or PR." },
      { name: "GitLab CI", desc: "Generate a .gitlab-ci.yml job that runs the collection and fails the pipeline on assertion failures." },
      { name: "Custom command", desc: "Use reqit run --collection my-collection --env staging in any CI system. The exit code reflects pass/fail status." },
    ],
  },
  {
    id: "ai",
    title: "AI Features",
    subtitle: "Bring your own key",
    features: [
      { name: "Diagnose with AI", desc: "Got a failing request? Click Diagnose to send the response and request details to an LLM (OpenAI or Anthropic). The AI explains what went wrong and suggests fixes." },
      { name: "Generate assertions", desc: "Describe what you want to test in plain English, and reqit generates JavaScript assertions for the collection runner." },
      { name: "BYOK (Bring Your Own Key)", desc: "Use your own OpenAI or Anthropic API key. No data is sent to reqit servers — everything goes directly to the LLM provider." },
      { name: "No telemetry", desc: "AI feature calls are between you and the LLM provider. reqit never logs, stores, or inspects your API keys or the content you send." },
    ],
  },
  {
    id: "mcp",
    title: "MCP Server",
    subtitle: "Let AI agents control reqit",
    features: [
      { name: "Model Context Protocol", desc: "reqit exposes an MCP server that AI agents (Claude, Cursor, etc.) can connect to. Agents can send requests, inspect responses, run collections, and check results." },
      { name: "15+ tools", desc: "Agents have access to tools like SendRequest, RunCollection, GetEnvironments, GetHistory, DiagnoseWithAI, and GenerateAssertions." },
      { name: "Zero-config setup", desc: "Start the MCP server with reqit serve-mcp. The server auto-discovers your workspace and environments — no configuration needed." },
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
      { name: "Postman environments", desc: "Import Postman environment JSON files directly into reqit environments — variable names and values are preserved." },
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
    id: "profiles",
    title: "Dev Profiles",
    subtitle: "Your public API developer identity",
    features: [
      { name: "Create a profile", desc: "Go to reqit.dev/:username and claim your developer profile. Add your name, bio, skills, GitHub link, and a profile picture." },
      { name: "Projects & links", desc: "Showcase your projects with live URLs, GitHub repos, and screenshot thumbnails. Add social links (GitHub, Twitter, LinkedIn, website)." },
      { name: "Upstash backend", desc: "Profiles are stored in Upstash Redis — globally available with low-latency reads. No database to manage." },
      { name: "Public shareable URL", desc: "Your profile lives at reqit.dev/your-username. Share it anywhere: resume, GitHub bio, LinkedIn, Twitter." },
    ],
  },
  {
    id: "agent-lens",
    title: "Agent Lens",
    subtitle: "Lint, evaluate & export API collections",
    features: [
      { name: "Collection linting", desc: "Run lint rules against any collection. Detects missing auth, inconsistent naming, unused variables, and other common issues before they reach production." },
      { name: "Evaluation engine", desc: "Evaluate collection runs against custom rules. Useful for enforcing team conventions and API design guidelines." },
      { name: "Export reports", desc: "Export lint and evaluation results as structured JSON or markdown reports for CI/CD and code review." },
    ],
  },
  {
    id: "shortcuts",
    title: "Keyboard Shortcuts",
    subtitle: "45+ commands across 4 scopes",
    features: [
      { name: "Command palette (Ctrl+K)", desc: "Press Ctrl+K to open the command palette. Search and execute any command by name — no need to remember keybindings." },
      { name: "Global shortcuts", desc: "Ctrl+T new tab, Ctrl+W close tab, Ctrl+S save request, Ctrl+Shift+I import cURL, Ctrl+Shift+R toggle response view." },
      { name: "Contextual scopes", desc: "Shortcuts adapt to context: URL bar (Ctrl+Enter to send), response tree (Ctrl+Arrow to navigate), sidebar (arrow keys to move between items)." },
      { name: "Discovery", desc: "Open the command palette and type ? to see all available commands and their keybindings for the current scope." },
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
];