export interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  highlights: { category?: string; items: string[] }[];
}

export const allFeatures: { category: string; items: string[] }[] = [
  {
    category: "Protocols",
    items: [
      "HTTP/HTTPS request execution with full auth support (Basic, Bearer, OAuth2, Digest, API Key)",
      "WebSocket client with real-time message search and event callbacks",
      "Socket.IO client — connect, emit, and listen to events",
      "Server-Sent Events viewer",
      "gRPC unary and server-streaming invocation via gRPC-Web",
      "GraphQL query execution and schema introspection",
      "MQTT client — publish and subscribe over HTTP bridge",
      "SOAP envelope builder (1.1 and 1.2)",
    ],
  },
  {
    category: "Collections & Environments",
    items: [
      "Collection CRUD with folder nesting (slash-delimited names)",
      "Tab pinning — keep important requests from closing",
      "Request notes — attach context to every call",
      "Environment variables with named environments and quick-switch",
      "Environment comparison — side-by-side diff of any two environments",
      "Auto-save — unsaved changes don't vanish",
      "Collection search and filtering",
      "Collection-level variables editor",
    ],
  },
  {
    category: "Request Builder",
    items: [
      "URL parameters editor with key-value pairs",
      "Headers editor with autocomplete",
      "Request body — raw, form-data, multipart, binary, GraphQL",
      "Authentication configuration — Basic, Bearer, OAuth2, API Key, Digest",
      "Pre-request and post-request JavaScript scripts (Goja runtime)",
      "Faker variables — {{$randomInt}}, {{$randomEmail}}, {{$randomUUID}}, etc.",
      "cURL command import and export",
      "Code generation — JavaScript, Python, Go, cURL, and more",
      "OAuth2 authorization code flow with PKCE",
      "JWT decoder — inspect header and claims",
    ],
  },
  {
    category: "Response Viewer",
    items: [
      "Response body — pretty-print, raw, hex, collapsible JSON tree view",
      "Response headers viewer",
      "Response cookies viewer",
      "Response status bar — status code, timing, size",
      "Response body search with match navigation",
      "Security warnings for suspicious responses",
      "Performance charts — timing SVG chart with avg, P95, max over time",
      "Request timeline visualization",
      "Diff snapshots — compare responses between runs",
      "Contract validation badge — OpenAPI spec compliance",
      "Copy headers to clipboard — one click",
    ],
  },
  {
    category: "Runner & Testing",
    items: [
      "Collection runner — execute all requests in sequence or parallel",
      "Data-driven runner — feed CSV/JSON rows, iterate per row",
      "Response assertions — status, timing, body, JSONPath, header, regex, custom JS",
      "Test suite builder — nested groups of assertions",
      "Load testing — configurable virtual users and duration",
      "Scheduled runs — cron-based collection execution",
      "JSON and HTML test report generation",
    ],
  },
  {
    category: "Import & Export",
    items: [
      "OpenAPI 3.0 import/export — convert specs to collections and back",
      "Postman v2.0/v2.1 import/export with secret scanning",
      "Insomnia import/export",
      "Hoppscotch import/export",
      "HAR import — drag in browser archives, get collections back",
      "cURL command import",
      "Markdown and HTML API documentation export",
      "SwaggerHub and Stoplight registry push/pull",
    ],
  },
  {
    category: "Collaboration",
    items: [
      "Native Git integration — commit, push, pull, branches, merge, stash, diff, conflict resolution",
      "WebSocket-based real-time collaboration sync",
      "Inline commentary — threaded discussions on requests",
      "Role-based access control (Viewer, Editor, Admin)",
      "Team invites via Git ref branches",
      "Developer profile for public web sharing",
    ],
  },
  {
    category: "Mock Server",
    items: [
      "In-memory mock HTTP server with dynamic route registry",
      "Condition-based response rules (header, query, method, path matching)",
      "Traffic recording — capture real requests and replay as mocks",
      "Stateful mock behavior — per-route/session counters",
    ],
  },
  {
    category: "Developer Tools",
    items: [
      "OpenAPI spec designer — programmatic spec construction and editing",
      "Schema drift detection — compare OpenAPI snapshots",
      "Agent Lens — analyze collections for AI agent readiness",
      "Browser traffic interceptor — local HTTP MITM proxy with Chrome extension",
      "Keyboard shortcut remapping — click any shortcut, press your key",
      "Command palette (Ctrl+K)",
      "AI-powered response diagnosis and assertion generation",
      "Plugin system — auth providers, visualizers, codegen, hooks",
      "Air-gapped mode for security-sensitive environments",
    ],
  },
  {
    category: "Security & Compliance",
    items: [
      "AES-256-GCM encryption with Argon2 key derivation",
      "Secrets vault — 1Password CLI and local encrypted file providers",
      "Enterprise SSO — SAML 2.0 and OIDC provider management",
      "Data masking engine with configurable regex rules",
      "Audit trail — all operations logged and filterable",
      "Role-based access control (RBAC)",
      "Path traversal and URL safety validation",
      "Opt-in telemetry (zero by default)",
    ],
  },
];

export const releaseHistory: ReleaseNote[] = [
  {
    version: "v1.1.0",
    date: "2026-07-24",
    title: "Audit Trail, Self-Updater, Full Codebase Map",
    highlights: [
      {
        category: "New",
        items: [
          "Self-updater with Install + Restart flow — works on all platforms",
          "Windows NSIS installer fallback when app is in Program Files",
          "Comprehensive README documenting every file in the codebase",
          "GitHub Actions release workflow with proper SHA256 checksums",
        ],
      },
      {
        category: "Fixed",
        items: [
          "Audit trail now actually logs all operations (request runs, CRUD, import/export)",
          "Updater manifest CI pipeline generates real SHA256 hashes (was always empty)",
          "Boot-to-black loading on Windows — IPC race condition resolved",
        ],
      },
    ],
  },
  {
    version: "Sprint 4",
    date: "2026-07-20",
    title: "Data-Driven Runner, Performance Charts, Folder Nesting",
    highlights: [
      {
        category: "Runner",
        items: [
          "Data-driven collection runner — CSV/JSON data injection, one iteration per row",
          "Assertions evaluated against every data row",
        ],
      },
      {
        category: "Response",
        items: [
          "Performance charts — SVG line chart with avg, P95, and max timing over history",
          "New Performance tab in response pane",
        ],
      },
      {
        category: "Collections",
        items: [
          "Folder nesting — slash-delimited names render as collapsible tree",
          "No separate folder concept — just use slashes in names",
        ],
      },
      {
        category: "Environments",
        items: [
          "Side-by-side environment comparison — see which variables differ",
          "Quick-switch from status bar",
        ],
      },
      {
        category: "Customization",
        items: [
          "Keyboard shortcut remapping — click any shortcut, press your key, it's saved",
          "Persisted across restarts with full reset option",
        ],
      },
    ],
  },
  {
    version: "Sprint 3",
    date: "2026-07-15",
    title: "Context Menus, Response Search, 98 Tests",
    highlights: [
      {
        items: [
          "Right-click context menus on every tree, tab, and list",
          "Response body search with up/down match navigation",
          "98 component tests locked in across all feature modules",
          "Accessibility pass — keyboard nav, aria labels, focus management",
          "File splits — large components broken into focused modules",
          "API Designer fix — CreateSpec returns real file paths from Save()",
          "Test Suites fix — returns empty array instead of nil",
          "Mock server layout redesigned — centered start button with card layout",
        ],
      },
    ],
  },
  {
    version: "Sprint 2",
    date: "2026-07-10",
    title: "Response Search, Env Quick-Switch, Auto-Save",
    highlights: [
      {
        items: [
          "Response body search — Ctrl+F inside any response",
          "Environment quick-switch from status bar — no modal needed",
          "Per-request timeout — override the default per call",
          "Copy all response headers to clipboard — one click",
          "Auto-save — unsaved changes don't vanish on tab close",
        ],
      },
    ],
  },
  {
    version: "Sprint 1",
    date: "2026-07-05",
    title: "Notes, Tab Pinning, HAR Import, Faker Variables",
    highlights: [
      {
        items: [
          "Request notes — attach context to every API call",
          "Tab pinning — keep important requests from closing accidentally",
          "HAR import — drag in browser archives, get collections back",
          "Faker variables — {{$randomInt}}, {{$randomEmail}}, {{$randomUUID}}, etc.",
          "WebSocket message search — find in real-time streams",
          "Jenkins UI integration and scheduler history",
          "Toast error handling across all bindings",
          "app.go split into focused binding files",
        ],
      },
    ],
  },
];
