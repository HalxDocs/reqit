# Real-time Protocols Research & Plan

**Scope:** gRPC, Server-Sent Events (SSE), WebSockets (incl. Socket.IO)
**Goal:** Reach Postman-quality functionality — identify why current features are not fully functional, and plan a phased fix without building.

---

## 1. Current State (what's actually implemented)

> Findings from code exploration at `flux/`. Line refs are approximate and current as of v1.2.1.

### 1.1 gRPC — `internal/grpc/grpc.go`

The current implementation is **not a real gRPC client**. It speaks a pseudo **gRPC-Web over plain HTTP** (`net/http` only), with the JSON body base64-encoded. It does **not** use any protobuf/gRPC runtime (`google.golang.org/grpc`, `protoreflect`, `grpcurl`).

- Unary invoke via `application/grpc-web-text` POST, service/method passed as custom headers (`grpc.go:49-53`).
- "Server streaming" (`StreamInvoke`, `grpc.go:87`) is **fake**: it `io.ReadAll`s the whole response, then parses gRPC-web frames after the fact. No incremental streaming to the UI.
- **No** reflection, **no** `.proto` loading, **no** client-streaming, **no** bidi-streaming, **no** binary envelope, **no** TLS config/certs.
- Errors silently swallowed (`io.ReadAll` errs dropped); 30s hard timeout; `context.Background()` so calls can't be canceled.
- `grpcBody` never reaches backend (`buildPayload.ts:77-78,122-123`).
- Two **duplicated** UIs call bindings differently; the request-tab one always passes empty headers.
- Generated Wails bindings are stale/awkward (`GRPCStreamInvoke` returns raw `string`, frontend does `JSON.parse`).

**Verdict:** It only "works" against servers that expose gRPC-Web through a proxy (Envoy style). Any real gRPC server (h2/HTTP2+protobuf binary) will be unreachable. "Streaming" is a post-hoc decompression of one buffered body.

### 1.2 SSE — `internal/sock/sock.go`

A genuine SSE wire parser in Go (`readLoopSSE`, `sock.go:216-321`) — NOT a fake one-shot fetch. It does parse `data:`/`event:`/`id:`/`retry:` lines.

- **Bug - killed after 30s:** `http.Client{Timeout: 30s}` (`sock.go:227`) kills any live stream past 30s mid-stream. This is the top "doesn't work" complaint.
- **Bug - fak replays auto-reconnect:** SSEViewer has an `autoReconnect` toggle + "Last-Event-ID will be sent" tooltip (`SSEViewer.tsx:10,132`), but **no reconnect logic exists** in frontend or backend. No `Last-Event-ID` is ever sent. Misleading.
- `bufio.Scanner` has a 64KB default buffer cap — large events silently truncated/dropped (`sock.go:258`).
- SSE tab shows a "Send" textarea even though SSE is receive-only; `send` errors "not connected" silently (`SocketPanel.tsx:72,61`).
- Connection opens via a shared raw socket path / reuse of WS state; status stays in memory only.

### 1.3 WebSocket (raw) + Socket.IO — `internal/sock/sock.go`

Connections run in the **Go backend** (good: no browser CORS), stateful single conn, message log, send while open all exist.

- **Raw WS headers/auth/subprotocols unsupported:** `websocket.DefaultDialer.Dial(url, nil)` (`sock.go:162`) — no custom headers, cookies, subprotocols.
- **Binary frames broken:** send is hardcoded `TextMessage` (`sock.go:145`); receive discards the message type (`_, msg`, `sock.go:200`) so binary is corrupted.
- **No reconnect / no keepalive ping.**
- Message cap mismatch (backend 500 vs store 1000); store sets `connected` optimistically before the read loop is up.
- `useSocketStore.cleanup()` is dead code; listeners leak.
- Socket.IO handshake headers are collected in UI for socket.IO tab but not for raw WS.

---

## 2. How Postman does it (research)

### 2.1 gRPC — Postman (v10+, Desktop Agent required)

Postman's gRPC client is **schema-driven and uses a real gRPC runtime** via its Desktop Agent (a local process that does the actual h2/protobuf transport; avoids browser restrictions).

Key bars Postman sets:
- **All 4 method types:** unary, client-streaming, server-streaming, bidirectional (unified time measure).
- **Server reflection:** drop in a URL; services/methods auto-populate via the reflection protocol (`grpc.reflection.v1`). Support canonical v1 reflection (a known Postman gap workaround fixes it).
- **Multi-file Protobuf:** imports a `.proto`, recursively fetches remaining imports automatically.
- **Message editing:** autocomplete, per-field type annotations, single-click **generate example frame**, metadata in/out.
- **Streaming UX:** a unified timeline of events on the wire; search/filter across streamed messages.
- **Cancel any call at any time** (context cancellation).
- **Variables:** env/collection variables interpolated into URL, metadata, message.

### 2.2 SSE — Postman

Postman deliberately made SSE **zero-config on any HTTP request** (no separate screen). When the response `Content-Type` is `text/event-stream`, Postman keeps the response open, streams events over time, renders each event, supports **search + event suggest** filters, and views **raw + pretty**. It scopes SSE as *client-side consumption/inspection only*.

Key contrast: SSE lives **inside the normal Send flow**, not a side panel tool.

### 2.3 WebSocket — Postman

- Connect/disconnect with **handshake details** surfaced (800 status codes, headers).
- **Custom headers + query params** on the upgrade. Auto-adds base WebSocket headers.
- **Message editor:** large compose area, syntax highlight, **auto-map JSON/XML**, raw **ArrayBuffer** messages.
- **Message stream with powerful search/filter** like other Postman panes.
- **Subprotocol support** (`Sec-WebSocket-Protocol`), including Socket.IO.
- **Session history revisit / reuse a session**, save messages, keep-alive pings.
- Uses native connection (Electron/agent), so no browser header limitation.

### 2.4 Key design philosophy takeaways

1. **Unify real-time in the standard request flow** where it makes sense (SSE in HTTP response; WS/stream in request).
2. **Real wire fidelity:** genuine transport (native h2/grpc, not HTTP; genuine WS framing, not text-only).
3. **Streaming playback matters:** incrementally, a time line, search/filter, not "wait for body to finish".
4. **Schema/indexing-first:** reflection & proto loading are beginners, not afterthoughts.
5. **Always cancelable:** user must be able to stop a live stream.
6. **Config-driven:** headers, subprotocols, TLS, vars are first-class, not hardcoded.

---

## 3. Gap analysis (reqit vs Postman)

| Capability | Postman | reqit today | Effort |
|---|---|---|---|
| Unary gRPC call | Native h/proto | gRPC-Web HTTP only | M |
| gRPC reflection | ✅ v1 | ❌ | M |
| proto file load + import | ✅ multi-file | ❌ | M |
| Client-streaming / bidi | ✅ | ❌ | L |
| Server streaming (true live) | ✅ timeline | fake buffered | M |
| Cancel a live call | ✅ | ❌ (context.Background) | S |
| gRPC TLS / certs | ✅ | ❌ | M |
| gRPC variables | ✅ | ❌ (not in payload) | S |
| SSE in main Send flow | ✅ in-request | ❌ sidecar | M |
| SSE reconnect + Last-Event-ID | ✅ | ❌ (fake UI) | S |
| SSE no-30s-drop | ✅ | ❌ (30s timeout) | S (critical) |
| SSE large msg / event filter | ✅ | ❌ (64KB) | S |
| WS custom headers/subproto | ✅ | ❌ | M |
| WS binary frames | ✅ ArrayBuffer | ❌ text-only | M |
| WS session history/revisit | ✅ | ❌ | L |
| Socket.IO headers | partial | partial | M |

**Why users say "ours doesn't work":**
- SSE: silently dies at 30s (top look bug), fake auto-reconnect, no filter.
- WS: can't set headers/auth/subprotocols → many real servers reject; binary corrupted.
- gRPC: only works against gRPC-Web proxies; real gRPC servers unreachable; streaming buffered, never cancelable, namespaces/method sent as ad-hoc headers.

---

## 4. Recommended plan (phased, no building yet)

Prioritize by user impact + effort. Phase 1 = "make it stop being broken". Phase 2 = "Postman-competitive features".

### Phase 1 — Correctness-first (current functionality actually works)
1. **SSE: remove the 30s stream timeout** — replace `http.Client{Timeout:30s}` with context + no-connect timeout (e.g. `Client{ no Timeout }`, rely on context cancel / read deadline). **Critical.**
2. **SSE: real auto-reconnect + Last-Event-ID** — backend stores last `id`; on EOF/DISCONNECT, re-open GET with `Last-Event-ID`. Wire `SSEViewer`'s toggle to this. Stop lying in UI.
3. **SSE: larger/infinite line buffer** — use a buffered reader (bufio: `bufio.NewReader` + `ScanLines` or raise buffer; handle partial lines).
4. **WS: support headers + cookies + subprotocols on dial** — pass a dialer with `Header`, `Subprotocols`; expose in raw-WS tab (currently only socket.IO tab has headers).
5. **WS: preserve message type (text vs binary)** — store `opcode`, render binary as base64/hex; allow sending binary frames.
6. **gRPC: fix payload binding** — get `grpcBody` (and service/method, metadata) into the backend; consolidate the duplicate `GRPCPanel`s into one.
7. **Wire to true gRPC** — adopt `google.golang.org/grpc` + `grpcurl`/`protoreflect`; replace the gRPC-Web shim with a real client; add `context` cancellation; surface gRPC status/trailers (not HTTP 9xx as status).

### Phase 2 — Postman-parity features
8. **gRPC reflection** — use `grpcurl` reflection client (v1 + v1alpha fallback) to auto-list services/methods on URL entry.
9. **gRPC proto loading** — import `.proto` file(s), resolve transitive imports, allow path imports; serve method autocomplete + example generation.
10. **gRPC all 4 streaming types** — server, client, bidi with live incremental frames flushed to UI (not `io.ReadAll`), search/filter across timeline.
11. **SSE into the normal request view** — when `Content-Type: text/event-stream`, show a live streaming response in the standard HTTP response pane (not a side-tool). Keep the event filter + JSON pretty.
12. **WS session history + reconnect + keep-alive ping** — save sessions; revisit; configurable ping; message search/filter inline.
13. **Variables/env everywhere** — interpolate `{{var}}` into gRPC URL/message/metadata and WS URL/headers.

### Phase 3 — Hardening
14. **Message caps consistent, listener cleanup on unmount, optimistic-status fix, not UI unclear.**
15. **TLS custom CA / client certs for gRPC & WS.**
16. **Persist real-time sessions/history to disk** (reuse existing persistence layer) so state survives restart.

Each phase is independently shippable. **Recommended to sequence 1→2→3**, testing each with a real stream server (e.g. SSE echo, grpc.postman-echo.com, a local ws server) before the release.

---

## 5. Open decisions

- Use a real gRPC Go client + protoreflect vs staying on gRPC-Web (→ recommend real client + optional gRPC-Web fallback).
- Parser choice for proto: `jhump/protoreflect` (grpcurl uses it) vs `protocompile`. → Recommend `jhump/protoreflect`.
- SSE product placement: keep separate SSE tool vs merge into HTTP response pane. → Recommend merge into standard response (Postman model), but keep the advanced filter tool as an opt-in.
- WS: keep all socket traffic in Go backend (recommended, avoids Wails/browser header limits) vs browser-native.