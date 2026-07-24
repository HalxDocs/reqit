export type NavTarget =
  | "view:http"
  | "view:socket"
  | "view:sse"
  | "view:scheduler"
  | "view:graphql"
  | "view:grpc"
  | "view:spec"
  | "view:docs"
  | "view:pr"
  | "view:interceptor"
  | "view:integrations"
  | "view:security"
  | "view:migration"
  | "view:agentlens"
  | "view:growth"
  | "view:plugins"
  | "view:loadtest"
  | "view:mockpanel"
  | "modal:settings"
  | "modal:shortcuts"
  | "modal:env"
  | "modal:import"
  | "modal:codegen"
  | "modal:team"
  | "modal:devprofile"
  | "modal:pastecurl"
  | "modal:save"
  | "modal:runner"
  | "modal:envcompare"
  | "modal:testsuites";

export interface FeatureItem {
  label: string;
  nav: NavTarget;
}

export interface FeatureCategory {
  category: string;
  items: FeatureItem[];
}

export const allFeatures: FeatureCategory[] = [
  {
    category: "Protocols",
    items: [
      { label: "HTTP/HTTPS request execution with full auth support (Basic, Bearer, OAuth2, Digest, API Key)", nav: "view:http" },
      { label: "WebSocket client with real-time message search and event callbacks", nav: "view:socket" },
      { label: "Socket.IO client — connect, emit, and listen to events", nav: "view:socket" },
      { label: "Server-Sent Events viewer", nav: "view:sse" },
      { label: "gRPC unary and server-streaming invocation via gRPC-Web", nav: "view:grpc" },
      { label: "GraphQL query execution and schema introspection", nav: "view:graphql" },
      { label: "MQTT client — publish and subscribe over HTTP bridge", nav: "view:http" },
      { label: "SOAP envelope builder (1.1 and 1.2)", nav: "view:http" },
    ],
  },
  {
    category: "Collections & Environments",
    items: [
      { label: "Collection CRUD with folder nesting (slash-delimited names)", nav: "view:http" },
      { label: "Tab pinning — keep important requests from closing", nav: "view:http" },
      { label: "Request notes — attach context to every call", nav: "view:http" },
      { label: "Environment variables with named environments and quick-switch", nav: "modal:env" },
      { label: "Environment comparison — side-by-side diff of any two environments", nav: "modal:envcompare" },
      { label: "Auto-save — unsaved changes don't vanish", nav: "view:http" },
      { label: "Collection search and filtering", nav: "view:http" },
      { label: "Collection-level variables editor", nav: "view:http" },
    ],
  },
  {
    category: "Request Builder",
    items: [
      { label: "URL parameters editor with key-value pairs", nav: "view:http" },
      { label: "Headers editor with autocomplete", nav: "view:http" },
      { label: "Request body — raw, form-data, multipart, binary, GraphQL", nav: "view:http" },
      { label: "Authentication configuration — Basic, Bearer, OAuth2, API Key, Digest", nav: "view:http" },
      { label: "Pre-request and post-request JavaScript scripts (Goja runtime)", nav: "view:http" },
      { label: "Faker variables — {{$randomInt}}, {{$randomEmail}}, {{$randomUUID}}, etc.", nav: "view:http" },
      { label: "cURL command import and export", nav: "modal:pastecurl" },
      { label: "Code generation — JavaScript, Python, Go, cURL, and more", nav: "modal:codegen" },
      { label: "OAuth2 authorization code flow with PKCE", nav: "view:http" },
      { label: "JWT decoder — inspect header and claims", nav: "view:http" },
    ],
  },
  {
    category: "Response Viewer",
    items: [
      { label: "Response body — pretty-print, raw, hex, collapsible JSON tree view", nav: "view:http" },
      { label: "Response headers viewer", nav: "view:http" },
      { label: "Response cookies viewer", nav: "view:http" },
      { label: "Response status bar — status code, timing, size", nav: "view:http" },
      { label: "Response body search with match navigation", nav: "view:http" },
      { label: "Security warnings for suspicious responses", nav: "view:http" },
      { label: "Performance charts — timing SVG chart with avg, P95, max over time", nav: "view:http" },
      { label: "Request timeline visualization", nav: "view:http" },
      { label: "Diff snapshots — compare responses between runs", nav: "view:http" },
      { label: "Contract validation badge — OpenAPI spec compliance", nav: "view:http" },
      { label: "Copy headers to clipboard — one click", nav: "view:http" },
    ],
  },
  {
    category: "Runner & Testing",
    items: [
      { label: "Collection runner — execute all requests in sequence or parallel", nav: "modal:runner" },
      { label: "Data-driven runner — feed CSV/JSON rows, iterate per row", nav: "modal:runner" },
      { label: "Response assertions — status, timing, body, JSONPath, header, regex, custom JS", nav: "modal:testsuites" },
      { label: "Test suite builder — nested groups of assertions", nav: "modal:testsuites" },
      { label: "Load testing — configurable virtual users and duration", nav: "view:loadtest" },
      { label: "Scheduled runs — cron-based collection execution", nav: "view:scheduler" },
      { label: "JSON and HTML test report generation", nav: "view:http" },
    ],
  },
  {
    category: "Import & Export",
    items: [
      { label: "OpenAPI 3.0 import/export — convert specs to collections and back", nav: "modal:import" },
      { label: "Postman v2.0/v2.1 import/export with secret scanning", nav: "modal:import" },
      { label: "Insomnia import/export", nav: "modal:import" },
      { label: "Hoppscotch import/export", nav: "modal:import" },
      { label: "HAR import — drag in browser archives, get collections back", nav: "modal:import" },
      { label: "cURL command import", nav: "modal:pastecurl" },
      { label: "Markdown and HTML API documentation export", nav: "view:http" },
      { label: "SwaggerHub and Stoplight registry push/pull", nav: "view:integrations" },
    ],
  },
  {
    category: "Collaboration",
    items: [
      { label: "Native Git integration — commit, push, pull, branches, merge, stash, diff, conflict resolution", nav: "view:pr" },
      { label: "WebSocket-based real-time collaboration sync", nav: "view:pr" },
      { label: "Inline commentary — threaded discussions on requests", nav: "view:pr" },
      { label: "Role-based access control (Viewer, Editor, Admin)", nav: "view:security" },
      { label: "Team invites via Git ref branches", nav: "modal:team" },
      { label: "Developer profile for public web sharing", nav: "modal:devprofile" },
    ],
  },
  {
    category: "Mock Server",
    items: [
      { label: "In-memory mock HTTP server with dynamic route registry", nav: "view:mockpanel" },
      { label: "Condition-based response rules (header, query, method, path matching)", nav: "view:mockpanel" },
      { label: "Traffic recording — capture real requests and replay as mocks", nav: "view:mockpanel" },
      { label: "Stateful mock behavior — per-route/session counters", nav: "view:mockpanel" },
    ],
  },
  {
    category: "Developer Tools",
    items: [
      { label: "OpenAPI spec designer — programmatic spec construction and editing", nav: "view:spec" },
      { label: "Schema drift detection — compare OpenAPI snapshots", nav: "view:spec" },
      { label: "Agent Lens — analyze collections for AI agent readiness", nav: "view:agentlens" },
      { label: "Browser traffic interceptor — local HTTP MITM proxy with Chrome extension", nav: "view:interceptor" },
      { label: "Keyboard shortcut remapping — click any shortcut, press your key", nav: "modal:shortcuts" },
      { label: "Command palette (Ctrl+K)", nav: "view:http" },
      { label: "AI-powered response diagnosis and assertion generation", nav: "view:http" },
      { label: "Plugin system — auth providers, visualizers, codegen, hooks", nav: "view:plugins" },
      { label: "Air-gapped mode for security-sensitive environments", nav: "view:security" },
    ],
  },
  {
    category: "Security & Compliance",
    items: [
      { label: "AES-256-GCM encryption with Argon2 key derivation", nav: "view:security" },
      { label: "Secrets vault — 1Password CLI and local encrypted file providers", nav: "view:security" },
      { label: "Enterprise SSO — SAML 2.0 and OIDC provider management", nav: "view:security" },
      { label: "Data masking engine with configurable regex rules", nav: "view:security" },
      { label: "Audit trail — all operations logged and filterable", nav: "view:security" },
      { label: "Role-based access control (RBAC)", nav: "view:security" },
      { label: "Path traversal and URL safety validation", nav: "view:security" },
    ],
  },
];

export interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  highlights: { category?: string; items: string[] }[];
}

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
          "What's New modal with auto-show on version change and navigable feature catalog",
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
