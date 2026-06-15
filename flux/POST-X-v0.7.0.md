reqit v0.7.0 is here — the biggest release yet. 60+ packages, 50+ components, one binary under 20MB.

What started as a Postman alternative is now a full API workspace: design, test, document, collaborate, and deploy — all local-first, all under your control.

## The headline: Team features, zero lock-in

- **Self-hosted sync** — WebSocket-based real-time collaboration through your own infrastructure. No cloud subscription, no data leaving your network.
- **Inline comments** — threaded discussions on any request or collection. Local-only or shared via sync server.
- **Role-based workspaces** — Viewer / Editor / Administrator, enforced locally and server-side.
- **Visual Git merge** — side-by-side conflict resolution for JSON, headers, and form-data. Resolve and commit without leaving the app.
- **Audit logs** — append-only, tamper-evident trail with timeline viewer and JSON/CSV export.
- **Team invites** — Git ref–based invites and permission-wrapped URLs. Identity from local git config — no sign-up.

## Every protocol you need

- **HTTP/HTTPS** — full method support, connection pooling, 30s timeout, cancel mid-flight
- **WebSocket / SSE** — bidirectional real-time with message buffer and connection state
- **GraphQL** — queries, mutations, subscriptions via WebSocket, schema introspection
- **gRPC** — gRPC-web-text unary and streaming
- **SOAP** — 1.1/1.2 envelope builder with WSDL parsing
- **MQTT** — publish/subscribe with QoS and message history

## Testing & automation

- Collection runner with sequential, concurrent (5 workers), and retry modes
- Assertion engine: status, JSON body, headers, timing
- Test suite builder with nested groups and direct runner integration
- Load testing with configurable virtual users and latency percentiles
- CI/CD pipeline generation: GitHub Actions, GitLab CI, Jenkins
- Playwright and Jest test generation from collections
- CLI mode for headless CI execution

## API design & docs

- OpenAPI spec designer with endpoint CRUD
- OpenAPI import (yaml/json) as collections; export as JSON or Swagger UI HTML
- In-app API reference viewer from linked specs
- Markdown API docs export with configurable toggles
- SwaggerHub and Stoplight registry push/pull

## Git-native to the core

- Full git client: status, branch, commit, push, pull, stash, merge, diff
- Collections as plain JSON — diff in PRs, branch per feature
- PR Preview panel with side-by-side diff review
- Conflict detection and resolution
- Auto-pull on workspace mount

## Security & enterprise

- OAuth2 with PKCE and refresh
- Enterprise SSO: SAML 2.0 and OpenID Connect
- AES-256-GCM encryption with Argon2id key derivation
- Secret vault: 1Password, HashiCorp Vault, AWS Secrets Manager
- Data masker with custom regex rules
- Air-gap mode for restricted environments
- Browser interceptor proxy with Chrome extension (MV3)

## Import & export

- Import: Postman v2.1 (full with pm.* transpile), Insomnia, Hoppscotch, OpenAPI, cURL
- Export: Postman, Insomnia, Hoppscotch, OpenAPI (JSON + HTML), Markdown, cURL, code snippets

## Developer experience

- < 400ms startup, < 20MB install, zero telemetry
- Virtual scrolling for 1000+ collections
- Drag-and-drop reorder with batch operations
- Dark/light theme with system auto-detect
- Command palette (Cmd+K), keyboard shortcuts
- Auto-updater with one-click install
- Plugin system and system tray
- Multi-workspace with file watcher and `{{VAR}}` environments

All free. All open source (MIT). No account, no cloud, no data collection.

github.com/HalxDocs/reqit

#reqit #api #testing #opensource #collaboration
