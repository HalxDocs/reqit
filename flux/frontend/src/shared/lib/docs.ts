export interface DocResource {
  title: string;
  url: string;
  desc: string;
}

export interface DocContent {
  heading: string;
  body: string;
  code?: string;
  resources?: DocResource[];
}

export interface DocPage {
  id: string;
  title: string;
  subtitle?: string;
  content: DocContent[];
  pages?: DocPage[];
}

export interface DocCategory {
  id: string;
  title: string;
  pages: DocPage[];
}

export const DOC_CATEGORIES: DocCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    pages: [
      {
        id: "installation",
        title: "Installation",
        subtitle: "Download and install reqit on Windows, macOS, or Linux",
        content: [
          {
            heading: "System requirements",
            body: "reqit ships as a single binary for each platform. There are no external dependencies, no runtimes to install, and no cloud accounts to create. The desktop app is built with Go and Wails v2 — the frontend is React 18 with TypeScript, bundled into a <20 MB executable.",
          },
          {
            heading: "Windows",
            body: "Download the reqit-windows-amd64.exe from the latest release. Double-click to run — no installer needed. For convenience, pin it to your taskbar or create a Start menu shortcut.",
            code: "# Or install via winget\nwinget install reqit",
            resources: [
              { title: "Latest release", url: "https://github.com/HalxDocs/reqit/releases/latest", desc: "Download the latest Windows binary" },
              { title: "GitHub repository", url: "https://github.com/HalxDocs/reqit", desc: "Source code and issue tracker" },
            ],
          },
          {
            heading: "macOS",
            body: "Download reqit-macos-universal.zip, unzip it, and move reqit.app to your Applications folder. macOS may ask you to confirm opening an app from an unidentified developer — right-click the app and select Open to bypass this once.",
            resources: [
              { title: "Latest release", url: "https://github.com/HalxDocs/reqit/releases/latest", desc: "Download the macOS universal binary" },
            ],
          },
          {
            heading: "Linux",
            body: "Download reqit-linux-amd64, make it executable, and run it. The binary is statically linked — no system libraries beyond the usual GTK3/WebKit2GTK dependencies are required.",
            code: "chmod +x reqit-linux-amd64\n./reqit-linux-amd64",
          },
          {
            heading: "CLI-only mode",
            body: "reqit also runs headlessly for CI/CD pipelines and scripting. Pass any command as the first argument to skip the GUI entirely.",
            code: "reqit run --collection my-collection --env production\nreqit list --workspace ./my-api\nreqit mcp   # Start MCP server for AI agents",
          },
        ],
      },
      {
        id: "quick-start",
        title: "Quick Start",
        subtitle: "Send your first request in 30 seconds",
        content: [
          {
            heading: "Open reqit",
            body: "Launch reqit. You will see the request builder with a URL bar, method dropdown, and tabs for Params, Headers, Body, and Auth. The sidebar on the left shows your collections and environments.",
          },
          {
            heading: "Send a GET request",
            body: "Type a URL into the bar (e.g., https://api.github.com/repos/HalxDocs/reqit), select GET from the method dropdown, and click Send or press Ctrl+Enter. The response appears on the right — status code, headers, body, timing, and cookies.",
            code: "Method: GET\nURL:    https://api.github.com/repos/HalxDocs/reqit\n\n→ 200 OK  (body: JSON, 312ms, 2.1 KB)",
          },
          {
            heading: "Send a POST with JSON body",
            body: "Switch to POST, go to the Body tab, select JSON, and type a JSON payload. Add a Content-Type header of application/json if needed. Click Send.",
            code: "Method: POST\nURL:    https://jsonplaceholder.typicode.com/posts\nBody:   {\"title\": \"foo\", \"body\": \"bar\", \"userId\": 1}\n\n→ 201 Created",
          },
          {
            heading: "Next steps",
            body: "From here you can create collections to organise requests, set up environments with variables, configure authentication, or import your existing Postman collections. Everything is covered in the sections below.",
          },
        ],
      },
      {
        id: "first-request",
        title: "Your First Request",
        subtitle: "Walk through every part of the request builder",
        content: [
          {
            heading: "The URL bar",
            body: "The URL bar is where every request starts. Type or paste the full URL including the protocol (https://). The method dropdown to its left lets you pick GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, or QUERY.",
          },
          {
            heading: "Params tab",
            body: "Query parameters are key-value pairs appended to the URL after a ?. Add them in the Params tab — each row has a key, value, and enabled toggle. Disabled params are excluded from the request without deleting them. The URL preview below the bar shows the final URL with all enabled params appended.",
          },
          {
            heading: "Headers tab",
            body: "Set any HTTP header as key-value pairs. Common headers like Content-Type, Authorization, and Accept are handled automatically by other parts of reqit, but you can add or override any header here. Toggle rows on and off individually.",
          },
          {
            heading: "Body tab",
            body: "The Body tab offers several formats: JSON with syntax highlighting, form-urlencoded, multipart/form-data, and raw text. For JSON bodies the editor auto-formats on paste. The body is sent alongside the request for methods like POST, PUT, and PATCH.",
          },
          {
            heading: "Auth tab",
            body: "Configure authentication without manually adding headers. Choose from None, Bearer Token, Basic Auth, Digest Auth, NTLM Auth, API Key, or OAuth 2.0. reqit adds the correct Authorization header automatically when you send.",
          },
          {
            heading: "Sending and the response",
            body: "Click Send or press Ctrl+Enter. The right panel shows the response: status code with colour coding, response time, body size, response headers, cookies, and a timeline of request phases (DNS, TCP, TLS, TTFB, download).",
          },
        ],
      },
    ],
  },
  {
    id: "core-concepts",
    title: "Core Concepts",
    pages: [
      {
        id: "workspaces",
        title: "Workspaces",
        subtitle: "Project-level organisation for your API work",
        content: [
          {
            heading: "What is a workspace?",
            body: "A workspace is a folder on your disk that contains a .reqit/ subdirectory. Everything — collections, environments, cookie jars, settings — lives inside that folder. There is no database, no cloud sync, no proprietary storage. Your entire API workspace is a plain directory you can back up, share, or commit to git.",
          },
          {
            heading: "Creating a workspace",
            body: "On the home screen, click New Workspace. Give it a name, pick an accent colour, and optionally add a description. reqit creates the folder and opens it. You can also open any existing folder that already has a .reqit/ directory.",
          },
          {
            heading: "Switching between workspaces",
            body: "The home screen lists all recent workspaces. Click any one to switch. Each workspace remembers its own open tabs, active environment, and sidebar state — switching is instant because everything is local.",
          },
          {
            heading: "Cloud sync (no account)",
            body: "Because a workspace is just a folder, you can sync it across devices using Dropbox, Google Drive, OneDrive, or any file sync service. On another machine, open reqit, click Open Folder, and pick the synced directory. No account, no server, no setup.",
          },
          {
            heading: "Workspace structure",
            body: "Inside a workspace folder, the .reqit/ directory holds collections as .flux.json files, environments as environments.json, the cookie jar as cookie_jar.json, and workspace settings. Every file is plain JSON — readable, diffable, and hand-editable.",
          },
        ],
      },
      {
        id: "collections",
        title: "Collections",
        subtitle: "Organise and share groups of requests",
        content: [
          {
            heading: "What is a collection?",
            body: "A collection is a group of related API requests. Each collection is a single .flux.json file inside .reqit/collections/. You can organise requests into folders within a collection, just like files in a directory.",
          },
          {
            heading: "Creating a collection",
            body: "In the sidebar, click the + button next to Collections or use the context menu on an existing collection. Name it and start adding requests. Collections appear in the sidebar tree with their request count.",
          },
          {
            heading: "Adding requests",
            body: "Right-click a collection and select New Request, or click the + in the tab bar. Requests within a collection inherit the collection's OpenAPI spec link if one is set.",
          },
          {
            heading: "Exporting collections",
            body: "Right-click any collection and select Export. reqit exports the collection as a standalone .flux.json file — share it with teammates or archive it. Import it back on any other reqit workspace.",
          },
          {
            heading: "Collection files are JSON",
            body: "Open any .flux.json file in a text editor. Every request is a plain JSON object with deterministic field ordering. Adding a header adds one line. Changing a URL changes one line. These files are designed for clean git diffs.",
          },
        ],
      },
      {
        id: "environments",
        title: "Environments & Variables",
        subtitle: "Switch configuration sets without editing requests",
        content: [
          {
            heading: "How environments work",
            body: "An environment is a named set of key-value pairs called variables. You might have a Dev environment (base_url = https://dev.api.com), a Staging environment (base_url = https://staging.api.com), and a Production environment. Switch between them with one click.",
          },
          {
            heading: "Using {{VAR}} in requests",
            body: "Anywhere in a request — URL, headers, body, query params, auth fields — you can type {{VARIABLE_NAME}}. When you send the request, reqit replaces it with the value from the active environment. The URL bar highlights valid vars in cyan and unknown vars in white.",
          },
          {
            heading: "Creating and managing environments",
            body: "Open the Environments panel from the sidebar dropdown. Click New Environment, name it, and add variables. Each variable has a key, value, and enabled toggle. Duplicate an environment to create a variant (e.g., copy Dev to Staging and change the URLs).",
          },
          {
            heading: "Secrets safety",
            body: "Store API keys, tokens, and passwords in environment variables rather than hardcoding them into request files. When you share a collection or commit it to git, the variable references ({{API_KEY}}) are visible, but the actual values stay in your local environments.json.",
          },
        ],
      },
      {
        id: "authentication",
        title: "Authentication",
        subtitle: "Auth methods handled for you",
        content: [
          {
            heading: "Bearer Token",
            body: "Select Bearer Token in the Auth tab and paste your token. reqit sends Authorization: Bearer <token> on every request. Use an environment variable like {{ACCESS_TOKEN}} so you never paste tokens into request files. reqit also decodes JWTs inline so you can check claims and expiry.",
          },
          {
            heading: "Basic Auth",
            body: "Enter a username and password. reqit Base64-encodes them and sends Authorization: Basic <encoded> on every request. Simple and widely supported, but only use this over HTTPS.",
          },
          {
            heading: "API Key",
            body: "Attach an API key to any header name (e.g., X-API-Key) or as a query parameter (e.g., ?api_key=...). Configure the key name, value, and location (header or query) in the Auth tab.",
          },
          {
            heading: "Digest Auth",
            body: "Digest Access Authentication uses a challenge-response handshake. reqit handles the WWW-Authenticate challenge and sends the hashed response automatically. Useful for older enterprise systems.",
          },
          {
            heading: "NTLM Auth",
            body: "Windows NT LAN Manager authentication for enterprise APIs. reqit handles the handshake. Requires the server to support NTLM.",
          },
          {
            heading: "OAuth 2.0 with PKCE",
            body: "Configure the authorization URL, token URL, client ID, and scopes. reqit opens a browser for the user to authorize, captures the callback, exchanges the code for a token, and stores the access and refresh tokens. Refresh tokens are handled automatically when the access token expires.",
          },
        ],
      },
      {
        id: "response-viewer",
        title: "Response Viewer",
        subtitle: "Inspect every part of the response",
        content: [
          {
            heading: "Status bar",
            body: "The status bar at the top of the response panel shows the HTTP status code with colour coding: green for 2xx, yellow for 3xx, red for 4xx, and purple for 5xx. Beside it are the response time in milliseconds and the payload size in bytes.",
          },
          {
            heading: "Collapsible JSON tree",
            body: "JSON responses render as an expandable tree by default. Click any node to expand or collapse it. Large payloads use lazy expansion — nodes load on click, so even 10 MB responses don't freeze the UI. Array items show their index and length.",
          },
          {
            heading: "Tree / Raw / Pretty toggle",
            body: "Switch between three views: Tree (collapsible JSON nodes), Pretty (formatted and syntax-highlighted JSON), and Raw (the unformatted response body). Use Ctrl+Shift+R to cycle through them quickly.",
          },
          {
            heading: "Headers tab",
            body: "All response headers are displayed in a clean table with key and value columns. Useful for inspecting cache-control, content-type, rate-limit headers, and CORS configuration.",
          },
          {
            heading: "Cookies tab",
            body: "Every cookie set by the response appears in a table showing name, value, domain, path, expiry date, HttpOnly flag, and Secure flag. The cookie count is shown in the tab label.",
          },
          {
            heading: "Timeline tab",
            body: "A breakdown of every phase of the request: DNS lookup, TCP connection, TLS handshake, Time to First Byte, and content download. Each phase is shown in milliseconds so you can identify bottlenecks.",
          },
        ],
      },
    ],
  },
  {
    id: "protocols",
    title: "Protocols",
    pages: [
      {
        id: "http",
        title: "HTTP",
        subtitle: "Full HTTP client with every method and body type",
        content: [
          {
            heading: "Methods",
            body: "reqit supports GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, and QUERY (RFC 10008). Select any method from the dropdown left of the URL bar. The method determines how the server processes your request — use GET for reads, POST for creates, PUT for full replacements, PATCH for partial updates, DELETE for removals, and QUERY for read operations that need a request body.",
          },
          {
            heading: "Query parameters",
            body: "Add query parameters as key-value pairs in the Params tab. Each row has a key, value, and enabled toggle. Disabled rows are excluded without deleting them. The URL preview beneath the bar shows the final URL with all enabled parameters appended.",
          },
          {
            heading: "Headers",
            body: "Set any HTTP header. Common headers like Content-Type are set automatically based on the body type, but you can override or add additional headers. Toggle rows on and off without losing their values.",
          },
          {
            heading: "Body formats",
            body: "The Body tab supports JSON (with syntax highlighting and auto-formatting), form-urlencoded, multipart/form-data, and raw text. The body type is set independently per request. JSON bodies can be formatted with a single click.",
          },
          {
            heading: "QUERY method (RFC 10008)",
            body: "QUERY is a new HTTP method (published June 2026) that combines the safety and cacheability of GET with the body support of POST. Use it for complex searches, reporting queries, and GraphQL-style operations where the query payload is too large for a URL. reqit was one of the first API clients to support it.",
          },
        ],
      },
      {
        id: "websocket",
        title: "WebSocket & SSE",
        subtitle: "Real-time bidirectional and server-sent messaging",
        content: [
          {
            heading: "Connecting to a WebSocket",
            body: "Select WebSocket from the protocol selector (top-left, next to the method dropdown). Enter a ws:// or wss:// URL and click Connect. reqit handles the WebSocket handshake and opens a persistent connection.",
          },
          {
            heading: "Sending and receiving messages",
            body: "Once connected, type a message in the input box and press Enter or click Send. Both sent and received messages appear in a scrollable log with timestamps, direction indicators, and message size.",
          },
          {
            heading: "Server-Sent Events (SSE)",
            body: "Select SSE from the protocol selector. Enter an SSE endpoint URL and connect. Incoming events are parsed and displayed as they arrive, showing the event type, data, and ID. reqit maintains the connection and handles reconnection automatically.",
          },
          {
            heading: "Connection lifecycle",
            body: "The panel shows live connection state: Connecting, Connected, Disconnected, or Reconnecting. reqit automatically reconnects on unexpected WebSocket drops. Click Disconnect to close the connection manually.",
          },
        ],
      },
      {
        id: "socketio",
        title: "Socket.IO",
        subtitle: "Full Engine.IO v4 bidirectional client",
        content: [
          {
            heading: "How it works",
            body: "reqit implements the complete Engine.IO v4 transport negotiation — starting with an HTTP long-polling handshake, then upgrading to a WebSocket connection. This mirrors exactly how a Socket.IO client in the browser connects, so you can test any Socket.IO v4+ server without a browser.",
          },
          {
            heading: "Connecting to a namespace",
            body: "Enter the server URL and the namespace path (e.g., /chat or / for the default). reqit connects to the specified namespace and shows the connection status. Multiple namespaces are not supported in a single connection — create separate tabs for each.",
          },
          {
            heading: "Event emission",
            body: "Emit named events with a JSON payload. Type the event name, write your JSON payload, and click Emit. If the server uses acknowledgements, the ack callback result is displayed in the message log.",
          },
          {
            heading: "Cookie and header passthrough",
            body: "Cookies and custom headers from the initial HTTP request are forwarded to the WebSocket transport. This preserves session state across the upgrade — useful for testing authenticated Socket.IO connections.",
          },
        ],
      },
      {
        id: "graphql",
        title: "GraphQL",
        subtitle: "Queries, mutations, and subscriptions",
        content: [
          {
            heading: "Query editor",
            body: "Select GraphQL as the body type. A dedicated editor panel opens with syntax highlighting for GraphQL. Write your query or mutation in the top pane and variables (as JSON) in the bottom pane. The two are sent as separate fields in the GraphQL request.",
          },
          {
            heading: "Schema introspection",
            body: "Click Introspect to run an introspection query against your GraphQL endpoint. The schema is fetched and cached alongside your collection. Use it to explore available types, fields, and arguments without leaving reqit.",
          },
          {
            heading: "Subscriptions",
            body: "Connect to GraphQL subscription endpoints over WebSocket. Streamed events appear in real time in the response panel. Subscriptions use the same variables and headers as regular queries.",
          },
          {
            heading: "Headers and auth",
            body: "Headers (including Authorization) work the same as HTTP requests. Set them in the Headers tab. The auth type selected in the Auth tab is also applied to GraphQL requests.",
          },
        ],
      },
      {
        id: "grpc",
        title: "gRPC",
        subtitle: "gRPC-web-text unary and server-streaming",
        content: [
          {
            heading: "gRPC-web-text protocol",
            body: "reqit connects to gRPC-web-text endpoints directly over HTTP — no Envoy proxy required. It speaks the protocol natively, handling the HTTP/1.1 framing and base64-encoded trailers.",
          },
          {
            heading: "Unary calls",
            body: "Select gRPC from the protocol selector, enter the service and method names, and provide the request payload as JSON. reqit sends the request and displays the response, including metadata headers and response trailers.",
          },
          {
            heading: "Server-streaming",
            body: "For server-streaming methods, reqit receives each message as it arrives and displays them in a scrollable log. Each message shows its index, size, and content.",
          },
          {
            heading: "Service and method configuration",
            body: "Enter the gRPC service name (e.g., helloworld.Greeter) and method name (e.g., SayHello) in the panel. The payload format is JSON — reqit handles the protobuf serialization through the gRPC-web-text protocol layer.",
          },
        ],
      },
      {
        id: "soap",
        title: "SOAP",
        subtitle: "SOAP 1.1 and 1.2 envelope builder",
        content: [
          {
            heading: "Envelope builder",
            body: "Select SOAP as the body type. reqit provides a form-based builder for constructing SOAP envelopes. Set the action, the body XML, and any SOAP headers without writing XML by hand.",
          },
          {
            heading: "SOAP 1.1 vs 1.2",
            body: "Toggle between SOAP 1.1 (uses the SOAPAction header for action routing) and SOAP 1.2 (uses the action parameter in the Content-Type header). The envelope namespace and structure adjust automatically.",
          },
          {
            heading: "Raw XML mode",
            body: "Prefer to write the envelope yourself? Switch to raw XML mode for full control. The editor has XML syntax highlighting. reqit still sets the correct Content-Type and SOAPAction headers based on your version selection.",
          },
        ],
      },
      {
        id: "mqtt",
        title: "MQTT",
        subtitle: "Publish and subscribe messaging",
        content: [
          {
            heading: "Connecting to a broker",
            body: "Select MQTT from the protocol selector. Enter the broker URL (tcp://, tls://, or ws:// for WebSocket transport). Optionally set a username and password for authenticated brokers. reqit supports MQTT v3.1.1 and v5.",
          },
          {
            heading: "Publishing messages",
            body: "Once connected, enter a topic name, type your message, and select the QoS level (0, 1, or 2). Optionally set the retain flag. Click Publish to send. Published messages appear in the message log.",
          },
          {
            heading: "Subscribing to topics",
            body: "Subscribe to one or more topics with support for MQTT wildcards (+ for single-level, # for multi-level). Messages arrive in real time and are displayed with their topic, QoS level, and payload.",
          },
          {
            heading: "Message log",
            body: "All published and received messages appear in a scrollable log with timestamps, direction, topic, QoS, and size. The log persists within the tab for the duration of the session.",
          },
        ],
      },
    ],
  },
  {
    id: "features",
    title: "Features",
    pages: [
      {
        id: "cookie-jar",
        title: "Cookie Jar",
        subtitle: "Automatic cookie handling like a browser",
        content: [
          {
            heading: "Auto-capture",
            body: "Every Set-Cookie header in a response is automatically stored in the workspace cookie jar. No configuration needed — reqit handles it the same way a browser does.",
          },
          {
            heading: "Auto-replay",
            body: "Stored cookies are sent on subsequent requests to matching domains. Login once and keep testing authenticated routes. The cookie jar respects domain, path, secure, and httpOnly attributes.",
          },
          {
            heading: "Persistence",
            body: "The cookie jar is saved as a JSON file in your workspace (.reqit/cookie_jar.json). Sessions survive app restarts, workspace switches, and system reboots.",
          },
          {
            heading: "Inspecting cookies",
            body: "Open the Cookies tab in the response panel to see every cookie set by the response. The table shows name, value, domain, path, expiry, HttpOnly, and Secure flags.",
          },
        ],
      },
      {
        id: "contract-testing",
        title: "Contract Testing",
        subtitle: "Validate responses against OpenAPI specs",
        content: [
          {
            heading: "Linking an OpenAPI spec",
            body: "In the collection menu, select Link OpenAPI Spec. Pick any .yaml, .yml, or .json spec file from within your workspace folder. The spec is parsed and stored as a reference in the collection metadata.",
          },
          {
            heading: "Auto-validation",
            body: "After every request in a linked collection, reqit automatically validates the response against the spec. It checks the status code, response body JSON schema, and response headers. A green Contract OK badge or a red violations badge appears in the status bar.",
          },
          {
            heading: "Violation details",
            body: "Click the contract badge to expand a panel listing each violation: which layer (status/body/header), the field path, and a human-readable error message. Fix the issue and resend to confirm.",
          },
          {
            heading: "Switching or removing specs",
            body: "Change to a different spec version or remove the link entirely from the collection menu at any time. Multiple collections can each have their own spec link.",
          },
        ],
      },
      {
        id: "schema-drift",
        title: "Schema Drift Detection",
        subtitle: "Track OpenAPI changes over time",
        content: [
          {
            heading: "Snapshots",
            body: "Take a snapshot of any linked OpenAPI spec with one click. The snapshot captures the full schema — endpoints, methods, request/response shapes, parameters, and security schemes.",
          },
          {
            heading: "Comparing snapshots",
            body: "Compare any two snapshots side-by-side. Additions are highlighted in green, removals in red, and modifications in yellow. Each change shows exactly what field or endpoint was affected.",
          },
          {
            heading: "Drift reports",
            body: "Export a human-readable diff report showing what changed between spec versions. Useful for CI/CD pipelines and pull request reviews — catch breaking changes before they reach production.",
          },
          {
            heading: "Historical tracking",
            body: "Snapshots are stored with timestamps. Scroll back through weeks or months of spec changes to see how your API evolved. Each snapshot is a small JSON file in your workspace.",
          },
        ],
      },
      {
        id: "mock-server",
        title: "Local Mock Server",
        subtitle: "Serve fake APIs without a real backend",
        content: [
          {
            heading: "Starting the mock server",
            body: "Click Start in the mock panel (toolbar) to launch a real HTTP server on localhost:4321. The server runs inside the reqit process — no external tools, no Docker containers, no configuration.",
          },
          {
            heading: "Saved response replay",
            body: "After sending a real request, click Save for Mock. The mock server replays that exact body, status code, and headers for matching requests. Your frontend can hit the mock server without waiting for the real backend.",
          },
          {
            heading: "Route parameter matching",
            body: "Paths like /users/:id automatically match /users/123, /users/456, etc. You do not need to register every ID explicitly. Wildcards and optional segments are supported.",
          },
          {
            heading: "Delay simulation",
            body: "Add a configurable delay (in milliseconds) to any route. Test loading states, spinners, timeout handling, and race conditions in your frontend without modifying the actual API.",
          },
          {
            heading: "Status overrides",
            body: "Override the status code for any route independently of the saved body. Force a 500 to test error states, or a 429 to test rate limiting.",
          },
          {
            heading: "CORS enabled",
            body: "The mock server includes permissive CORS headers (Access-Control-Allow-Origin: *) so any browser-based frontend can call localhost:4321 without proxy configuration.",
          },
        ],
      },
      {
        id: "collection-runner",
        title: "Collection Runner",
        subtitle: "Run entire collections with pass/fail assertions",
        content: [
          {
            heading: "Running a collection",
            body: "Right-click any collection and select Run, or open the Runner panel. reqit executes every request in the collection sequentially. Results are aggregated into a pass/fail report showing which requests passed, failed, or errored.",
          },
          {
            heading: "Writing assertions",
            body: "In the Scripts tab of any request, write JavaScript assertions that run after the response is received. Assert on status code, response body, headers, timing, and more. Multiple assertions can run on a single response.",
            code: `// Assert status is 200
if (response.statusCode !== 200) throw new Error("Expected 200");

// Assert response body has expected field
const body = JSON.parse(response.body);
if (!body.id) throw new Error("Response missing id field");

// Assert response time is under 500ms
if (response.timingMs > 500) throw new Error("Too slow");`,
          },
          {
            heading: "Pass/fail summary",
            body: "After the run, a summary shows total requests, passed, failed, and errored. Expand any failure to see the assertion error message and the actual response that triggered it.",
          },
          {
            heading: "CI/CD integration",
            body: "Collection runs produce a JSON report that can be exported. Use the CLI (reqit run) in CI/CD pipelines — the exit code reflects pass/fail status. Generate GitHub Actions or GitLab CI YAML from the CI/CD panel.",
          },
        ],
      },
      {
        id: "load-testing",
        title: "Load Testing",
        subtitle: "Benchmark endpoint performance under concurrency",
        content: [
          {
            heading: "Configuring a load test",
            body: "Open the Load Test panel. Select a saved request, set the number of concurrent workers (1-100) and the total number of requests to send. reqit distributes requests across workers and collects metrics from every response.",
          },
          {
            heading: "Latency percentiles",
            body: "After the run, view p50, p75, p90, p95, and p99 latency along with the fastest and slowest request. See exactly how your API performs under load and identify tail latency issues.",
          },
          {
            heading: "Real-time progress",
            body: "A live progress bar shows requests completed out of total, with running averages for latency and throughput. The display updates as each request completes.",
          },
          {
            heading: "Environment support",
            body: "Load tests use the currently active environment. Switch environments to test the same endpoint against different targets (e.g., staging vs production) without changing the request configuration.",
          },
        ],
      },
      {
        id: "cicd",
        title: "CI/CD Pipeline Generation",
        subtitle: "Export ready-to-run CI workflows",
        content: [
          {
            heading: "GitHub Actions",
            body: "Generate a complete GitHub Actions workflow YAML that runs your collection with assertions on every push or pull request. The workflow installs reqit, runs the collection, and fails the pipeline on assertion failures.",
          },
          {
            heading: "GitLab CI",
            body: "Generate a .gitlab-ci.yml job that runs the collection and fails the pipeline on assertion failures. The generated YAML includes caching, artifact collection, and environment variable passthrough.",
          },
          {
            heading: "Custom CI",
            body: "Use reqit run --collection name --env staging in any CI system. The binary is a single static executable — download it in your CI step and run it. The exit code is 0 if all assertions pass, non-zero on failure.",
          },
        ],
      },
      {
        id: "code-generation",
        title: "Code Generation",
        subtitle: "Copy-paste ready code snippets",
        content: [
          {
            heading: "cURL",
            body: "Export any request as a ready-to-paste curl command. All headers, auth, query parameters, and body are included. Useful for sharing requests in documentation, issues, or chat.",
          },
          {
            heading: "JavaScript (fetch)",
            body: "Generate a fetch() call with async/await. Headers are set, body is JSON-stringified, and the auth header is included. Paste straight into a browser console, Node.js script, or React component.",
          },
          {
            heading: "Python (requests)",
            body: "Generate a requests.get/post/put/delete() snippet with headers dict and JSON body. Paste straight into a script, notebook, or Django view.",
          },
          {
            heading: "Other languages",
            body: "Additional code generation targets are available through the command palette. Each generates idiomatic code for that language or framework.",
          },
        ],
      },
      {
        id: "import-export",
        title: "Import & Export",
        subtitle: "Bring your existing work in and take it out",
        content: [
          {
            heading: "Postman import",
            body: "Import any Postman collection JSON file (v2.1 format). All requests, folders, headers, auth methods, and body types are preserved. Postman environment files can also be imported as reqit environments.",
          },
          {
            heading: "cURL paste",
            body: "Paste any curl command directly into reqit — including -H headers, -d body, --data, --user auth, and -b cookies. reqit parses it into a fully configured request tab instantly.",
          },
          {
            heading: "Insomnia import",
            body: "Import Insomnia export JSON files. Requests, folders, environments, bearer/basic auth, and body formats are converted to reqit equivalents.",
          },
          {
            heading: "Hoppscotch import",
            body: "Import Hoppscotch collection exports. The same conversion applies — requests, auth, headers, and body types are preserved.",
          },
          {
            heading: "OpenAPI import",
            body: "Import an OpenAPI spec file directly as a collection. Every endpoint, method, parameter, and request body is converted to individual requests organized by path.",
          },
          {
            heading: "Export formats",
            body: "Export collections as JSON (.flux.json), OpenAPI 3.0.3 YAML, or markdown documentation. The OpenAPI export includes all endpoints, methods, and request/response shapes from your collection.",
          },
        ],
      },
      {
        id: "git",
        title: "Git & Collaboration",
        subtitle: "Version-control your API layer",
        content: [
          {
            heading: "Git-native by design",
            body: "Every collection, environment, and setting in reqit is a plain JSON file. This means git can diff your API changes the same way it diffs code. Additions, removals, and modifications to endpoints show up as clean, readable diffs in pull requests.",
          },
          {
            heading: "Built-in git panel",
            body: "View the current git status of your workspace from the sidebar Git tab. See which files are modified, staged, or untracked — without switching to a terminal. Stage files, write commit messages, and commit from within reqit.",
          },
          {
            heading: "Branch and merge",
            body: "Branch your API workspace like you branch your code. Create a feature branch, add new endpoints, commit them, and open a PR. Your reviewer sees exactly what changed in the API alongside the code changes.",
          },
          {
            heading: "Clone and collaborate",
            body: "Clone a repo that has a .reqit/ directory and open it as a workspace. Everything is ready: collections, environments, and settings. Team members commit API changes alongside their code, keeping the two in sync.",
          },
        ],
      },
      {
        id: "history",
        title: "Request History",
        subtitle: "Never lose a request you sent",
        content: [
          {
            heading: "Auto-logging",
            body: "Every request you send is automatically logged in the sidebar history. No manual saving, no \"save response\" button. Method, URL, headers, body, status code, and timing are all captured.",
          },
          {
            heading: "One-click replay",
            body: "Click any history entry to open it in a new tab with everything restored — method, URL, headers, body, auth. Click Send again to re-execute the request exactly as it was sent before.",
          },
          {
            heading: "Search and filter",
            body: "Filter history by URL, method, or status code. Tag important requests to find them later. Clear history at any time from the history panel menu.",
          },
        ],
      },
      {
        id: "search-filter",
        title: "Search & Filter",
        subtitle: "Find anything in your workspace instantly",
        content: [
          {
            heading: "Sidebar filter",
            body: "Type in the search bar above the collections tree. Requests and collections are filtered in real time as you type — no need to press Enter. Collections with no matching requests are hidden automatically.",
          },
          {
            heading: "Response search",
            body: "In the response panel body view, press Ctrl+F or click the search icon. Type a term to highlight all matches in the response body. Use Enter and Shift+Enter to jump between matches.",
          },
          {
            heading: "Command palette",
            body: "Press Ctrl+K to open the command palette. Search across 45+ commands by name, scope, or keyboard shortcut. Type ? to see all available commands for the current context.",
          },
        ],
      },
    ],
  },
  {
    id: "developer-tools",
    title: "Developer Tools",
    pages: [
      {
        id: "ai-features",
        title: "AI Features",
        subtitle: "Bring Your Own Key — AI that helps without spying",
        content: [
          {
            heading: "Diagnose with AI",
            body: "Got a failing request? Click Diagnose to send the response and request details to an LLM (OpenAI or Anthropic). The AI explains what went wrong, suggests fixes, and can generate corrected request parameters.",
          },
          {
            heading: "Generate assertions",
            body: "Describe what you want to test in plain English, and reqit generates JavaScript assertions for the collection runner. For example, type \"status should be 200 and response should have an id field\" and reqit produces the assertion code.",
          },
          {
            heading: "BYOK (Bring Your Own Key)",
            body: "You provide your own OpenAI or Anthropic API key. All requests go directly from reqit to the LLM provider. reqit never logs, stores, or inspects your API keys or the content you send. No data touches reqit servers.",
          },
          {
            heading: "Provider support",
            body: "reqit supports OpenAI (GPT-4, GPT-4o), Anthropic (Claude 3, Claude 3.5), Google Gemini, Groq, and Ollama for local models. Configure the provider and API key in the AI settings panel.",
          },
        ],
      },
      {
        id: "mcp-server",
        title: "MCP Server",
        subtitle: "Let AI agents control reqit",
        content: [
          {
            heading: "What is MCP?",
            body: "The Model Context Protocol (MCP) is an open standard that lets AI agents (Claude, Cursor, GitHub Copilot, etc.) interact with tools. reqit exposes an MCP server that gives agents direct access to your API workspace.",
          },
          {
            heading: "Available tools",
            body: "Agents connected to reqit's MCP server can: send requests and inspect responses, run entire collections with assertions, list and switch environments, browse request history, diagnose errors with AI, and generate assertions — over 15 tools in total.",
          },
          {
            heading: "Starting the MCP server",
            body: "Run reqit mcp in the terminal. The server starts on a local port and auto-discovers your workspace and environments. No configuration needed. Connect any MCP-compatible client to start controlling reqit through natural language.",
          },
          {
            heading: "Use cases",
            body: "Ask an AI agent to 'run all the tests in my auth collection and tell me which ones fail', 'find the request to /users/me and check if it has the right auth headers', or 'create a new environment with the production URLs'. The agent handles the rest.",
          },
        ],
      },
      {
        id: "agent-lens",
        title: "Agent Lens",
        subtitle: "Lint, evaluate, and export API collections",
        content: [
          {
            heading: "Collection linting",
            body: "Run lint rules against any collection. Detects missing auth on authenticated endpoints, inconsistent naming conventions, unused environment variables, missing descriptions, and other common issues before they reach production.",
          },
          {
            heading: "Evaluation engine",
            body: "Evaluate collection runs against custom rules defined in your workspace. Enforce team conventions: require every POST endpoint to have a request body example, require every endpoint to have a description, or check that auth is configured everywhere it should be.",
          },
          {
            heading: "Export reports",
            body: "Export lint and evaluation results as structured JSON or markdown reports. Include these in CI/CD pipelines and code reviews. Each report shows the rule, the affected request, and a recommendation.",
          },
        ],
      },
      {
        id: "dev-profiles",
        title: "Dev Profiles",
        subtitle: "Your public API developer identity",
        content: [
          {
            heading: "Creating a profile",
            body: "Open the Dev Profile panel in reqit. Fill in your name, bio, skills, GitHub link, and upload a profile picture. Toggle the profile as public to make it visible at reqit.dev/your-username.",
          },
          {
            heading: "Showcasing projects",
            body: "Add projects with live URLs, GitHub repos, and screenshot thumbnails. Each project displays alongside your profile. Stats like collections created, requests sent, and assertions written are pulled from your actual reqit usage.",
          },
          {
            heading: "Upstash backend",
            body: "Profiles are stored in Upstash Redis — globally available with low-latency reads. You configure the Upstash connection in reqit. No database to manage, no server to run.",
          },
          {
            heading: "Sharing your profile",
            body: "Your profile lives at reqit.dev/your-username. Share it anywhere: resume, GitHub bio, LinkedIn, Twitter, or portfolio. Each profile shows your API work, skills, and open-source contributions.",
          },
        ],
      },
      {
        id: "command-palette",
        title: "Command Palette",
        subtitle: "45+ commands across 4 scopes",
        content: [
          {
            heading: "Opening the palette",
            body: "Press Ctrl+K (or Cmd+K on macOS) to open the command palette. It overlays the current view with a searchable list of every available command. Type part of the command name to filter.",
          },
          {
            heading: "Command scopes",
            body: "Commands are grouped by scope: Global (open settings, toggle sidebar, switch view), Request (send, save, duplicate, close tab), Response (toggle tree/raw/pretty, search body), and Sidebar (create collection, import, filter). The palette shows which scope each command belongs to.",
          },
          {
            heading: "Keyboard shortcut discovery",
            body: "Type ? in the command palette to see all available commands and their keyboard shortcuts for the current scope. Learn shortcuts progressively as you work.",
          },
          {
            heading: "Executing commands",
            body: "Click a command or press Enter with a command selected to execute it. The palette closes and the action runs immediately. Some commands open sub-panels or dialogs for additional input.",
          },
        ],
      },
    ],
  },
  {
    id: "reference",
    title: "Reference",
    pages: [
      {
        id: "keyboard-shortcuts",
        title: "Keyboard Shortcuts",
        subtitle: "Complete reference for every shortcut",
        content: [
          {
            heading: "Global shortcuts",
            body: "These work from anywhere in the application.",
            code: `Ctrl+K        Open command palette
Ctrl+T        New tab
Ctrl+W        Close current tab
Ctrl+S        Save current request
Ctrl+Shift+I  Import from cURL
Ctrl+Shift+R  Toggle response view (Tree/Raw/Pretty)
Ctrl+Shift+E  Export current collection`,
          },
          {
            heading: "Request builder",
            body: "These work when the request builder has focus.",
            code: `Ctrl+Enter    Send request
Ctrl+D        Duplicate request
Ctrl+Shift+S  Save as new request
Ctrl+Shift+F  Format JSON body`,
          },
          {
            heading: "Response viewer",
            body: "These work in the response panel.",
            code: `Ctrl+F        Search response body
Ctrl+Shift+R  Toggle Tree/Raw/Pretty
Ctrl+Arrow    Navigate JSON tree nodes
Escape        Close search`,
          },
          {
            heading: "Sidebar and navigation",
            body: "These work when the sidebar or collections are focused.",
            code: `Arrow keys    Navigate between items
Enter         Select / open item
Ctrl+Shift+N  New collection
Ctrl+Shift+R  Rename selected item
Delete        Delete selected item`,
          },
        ],
      },
      {
        id: "cli-reference",
        title: "CLI Reference",
        subtitle: "Run reqit headlessly from the terminal",
        content: [
          {
            heading: "Available commands",
            body: "reqit can run entirely from the command line for CI/CD, scripting, and automation.",
            code: `reqit run [flags]        Run a collection with assertions
reqit list [flags]       List collections and requests
reqit mcp                Start MCP server
reqit --help             Show full help`,
          },
          {
            heading: "reqit run",
            body: "Execute a collection and return pass/fail exit codes. Useful for CI/CD pipelines.",
            code: `reqit run --collection auth-api --env production
reqit run --collection .reqit/collections/auth-api.json --env staging
reqit run --collection users --env dev --output report.json`,
          },
          {
            heading: "reqit list",
            body: "List all collections and their requests in a workspace.",
            code: `reqit list
reqit list --workspace ./my-project
reqit list --format json`,
          },
        ],
      },
      {
        id: "file-format",
        title: "File Format",
        subtitle: "Understanding .flux.json and other workspace files",
        content: [
          {
            heading: "Collection file (.flux.json)",
            body: "Each collection is a JSON file with deterministic field ordering. Every request is a plain JSON object containing method, URL, headers, body, auth, and scripts.",
            code: `{
  "id": "coll_abc123",
  "name": "Users API",
  "requests": [
    {
      "id": "req_xyz789",
      "name": "Get Users",
      "payload": {
        "method": "GET",
        "url": "https://api.example.com/users",
        "headers": [{ "key": "Accept", "value": "application/json", "enabled": true }],
        "authType": "bearer",
        "authValue": "{{API_TOKEN}}"
      }
    }
  ]
}`,
          },
          {
            heading: "Environment file (environments.json)",
            body: "All environments are stored in a single environments.json file. Each environment has a name, ID, and array of variables with key, value, and enabled flag.",
          },
          {
            heading: "Cookie jar (cookie_jar.json)",
            body: "Cookies are stored as an array of cookie objects with name, value, domain, path, expiry, and flags. The file is managed automatically but can be inspected or edited.",
          },
        ],
      },
    ],
  },
];

export function findDocPage(categoryId: string, pageId: string): DocPage | null {
  for (const cat of DOC_CATEGORIES) {
    if (cat.id === categoryId) {
      for (const page of cat.pages) {
        if (page.id === pageId) return page;
        if (page.pages) {
          for (const sub of page.pages) {
            if (sub.id === pageId) return sub;
          }
        }
      }
    }
  }
  return null;
}

export function findDocCategory(categoryId: string): DocCategory | null {
  return DOC_CATEGORIES.find((c) => c.id === categoryId) ?? null;
}
