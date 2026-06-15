## v0.7.0 — Collaboration & Team Features

This release transforms reqit from a solo developer tool into a team platform. Six new capability blocks unlock real-time collaboration, governance, and auditability while staying true to our core principle: **no mandatory cloud, no vendor lock-in.**

---

### Decoupled Collaboration Sync

An optional self-hosted synchronization server enables real-time and semi-real-time collection sharing across your team. The sync layer is fully decoupled — point it at any infrastructure you control, from a raspberry Pi to a Kubernetes cluster. No accounts, no cloud subscriptions, no data leaving your network.

- Websocket-based live sync for instant propagation of changes
- Conflict-free replicated data type (CRDT) merge strategies for concurrent edits
- Pluggable transport: run the built-in reference server or bring your own

### Inline Commentary

Annotation layers now live directly on requests, configurations, and collections. Think Google Docs comments but embedded inside your API tooling.

- Threaded discussions anchored to specific requests or payload fields
- Local-only annotations stay private; shared annotations sync through the collaboration server
- @-mentions and reply threading for async team review cycles
- Resolved comments collapse automatically but remain accessible

### Role-Based Shared Workspaces

Fine-grained workspace authorization with three explicit clearance levels:

| Role | Capabilities |
|---|---|
| **Viewer** | Read collections, browse history, inspect requests |
| **Modifier** | Create, edit, delete collections and requests; run tests |
| **Administrator** | Manage roles, invite members, delete workspace, configure sync |

Roles are enforced both locally (for shared workspaces on disk) and server-side (when the sync server is connected). The model is designed to map cleanly onto OAuth2 scopes for future SSO integration.

### Visual Git Merge Utility

Backend payload changes often collide in Git. Instead of raw diff hunks, reqit now ships a custom conflict-resolution UI panel tailored for API payloads.

- Side-by-side diff view for JSON, headers, and form-data bodies
- Accept-left / accept-right / edit-manually buttons per conflicted segment
- Directly integrates with the existing Git backend — detect conflicts, resolve, and commit without leaving the app
- Also supports three-way merge previews

### Internal Application Audit Logs

Every modification is now tracked locally with granular detail. The audit log captures who, what, when, and the before/after state.

- Timeline viewer exposed natively in the app — filter by resource type, user, date range
- Entries for collection/request create, update, delete, reorder, move, run, export, role changes, and comment activity
- Logs are append-only and tamper-evident via incremental hashing
- Exportable as JSON or CSV for external compliance tooling

### Team Onboarding Mechanics

Frictionless workspace invitations that work with or without the sync server.

- **Git ref–based invites:** Share a workspace by pushing an invite branch; teammates pull and accept to join
- **Permission-wrapped invite URLs:** When the sync server is active, generate a one-time URL that encodes the workspace ID and default role
- Join flow: accept invite → workspace appears in the sidebar → full collaboration enabled
- No sign-up required; identity is derived from the local Git config (name + email)

---

**Migration note:** Existing workspaces remain unaffected. Audit logging activates silently on next launch. Role assignments default to administrator for the original workspace creator. Enable the sync server separately — see `/docs/collaboration.md` for setup.
