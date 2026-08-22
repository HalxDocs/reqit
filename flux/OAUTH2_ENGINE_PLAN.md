# reqit OAuth 2.0 Engine — Phased Rebuild Plan

Status: ready to execute · Owner: OpenCode agent (follow this doc top to bottom)
Scope: rebuild `flux/internal/oauth2` + `flux/bindings_oauth2.go` + the OAuth frontend per RFC 6749 / 6750 / 7636 / 8252 / 8414 / 8628, OIDC Core, and RFC 9700 deprecations.

---

## 1. Audit of the current implementation (verified against `flux/` HEAD)

Trace done from "Get New Access Token" → `OAuth2Authorize` (bindings_oauth2.go) → `internal/oauth2` exchange → token stored into `AuthValue` JSON → sent via `internal/requester/requester.go` `case "oauth2"`.

### 1.1 The 10 root causes — actual status

| # | Root cause from spec | Status in code today | Evidence |
|---|---|---|---|
| 1 | Embedded webview auth | ✅ NOT present | Frontend calls Wails `BrowserOpenURL(authorizeUrl)` — OS default browser. Keep this. |
| 2 | Hardcoded redirect port | ❌ PRESENT | `DefaultOAuthPort = 7317` (bindings_oauth2.go) + `REDIRECT = "http://127.0.0.1:7317/callback"` hardcoded in `OAuth2Flow.tsx`. Port collision + strict providers reject mismatch. |
| 3 | PKCE not default | ❌ PRESENT | `usePkce: false` default checkbox in `OAuth2Flow.tsx`; `UsePKCE bool` in config. |
| 4 | `client_secret` alongside PKCE | ⚠️ PARTIAL | Go omits empty secret (`if s.config.ClientSecret != ""`), but sends it whenever non-empty, even in PKCE mode. UI always exposes the secret field. |
| 5 | State not verified | ✅ PRESENT & correct | `ValidateState` before exchange; mismatch aborts + surfaces error. Keep, move into engine. |
| 6 | Fragment handling (Implicit) | ❌ NOT PRESENT | Implicit grant doesn't exist; callback handler reads query params only. |
| 7 | Exchange in renderer | ✅ NOT present — exchange is in Go | All token POSTs happen in `internal/oauth2` via Wails bindings. Keep. |
| 8 | Tokens in git-tracked JSON | ❌ PRESENT (security bug) | `buildPayload.ts` writes `accessToken`/`refreshToken`/`expiresAt` into `AuthValue` JSON → `RequestPayload` → `SavedRequest` → `Collection.Requests` → collection JSON (git-tracked). `clientSecret` too. |
| 9 | No auto-refresh | ❌ PRESENT | `requester.go` `case "oauth2"` reads `accessToken` from JSON and sets `Authorization`. No expiry check, no refresh, no retry. Only a manual "Refresh Token" button exists. |
| 10 | No OIDC discovery | ❌ NOT PRESENT | Users hand-fill all URLs; presets are hardcoded. |

### 1.2 Additional bugs found (will cause "doesn't work properly" if not fixed)

- **B1 — Expiry unit mismatch (ms vs seconds).** Go sets `ExpiresAt = time.Now().Unix()` (seconds); the frontend computes `(cfg.expiresAt - Date.now()) / 1000` where `Date.now()` is **milliseconds**. Result: countdown is always ≤ 0 → UI always shows "expired", and any future auto-refresh trigger keyed on this value fires instantly or never. Must standardize on **ms** (`time.Now().UnixMilli()`) at the Go boundary.
- **B2 — Loopback server lives in the App layer.** `oauthState/oauthServer/oauthListeners/oauthMu` in `app.go`; the callback handler, state check, result page, and shutdown all live in `bindings_oauth2.go`. The engine (`internal/oauth2`) has no loopback at all. Refactor target per spec §4.
- **B3 — Missing grants.** Only Authorization Code and Device exist. Client Credentials, Password, and Implicit are absent; the PKCE-off "legacy" path exists only via the checkbox.
- **B4 — XSS-ish result page.** `serveOAuthResultPage` interpolates `title`/`message` (which can carry provider `error_description`) into HTML without escaping. Local-only risk, but escape it.
- **B5 — Duplicated config types.** `OAuth2Config` exists in `internal/models/models.go`, `internal/oauth2/oauth2.go`, and TS `request.ts` — drift risk. Canonicalize in `internal/oauth2/types.go`; keep a thin compat alias for Wails bindings.
- **B6 — `clientSecret` in keyring already an established convention.** `github.com/zalando/go-keyring v0.2.8` is already a dep and used in `internal/crypto`, `internal/ai/settings.go`, `internal/git/git.go` (PAT keyed by workspace dir), `internal/eventinspector/secret.go`. `store.go` follows the same pattern.

### 1.3 What already works — preserve

- OS-browser launch (`BrowserOpenURL`) — root cause #1 satisfied.
- State generation + validation with abort on mismatch.
- All token exchanges in Go, JSON **and** form-encoded response parsing (`Accept: application/json`).
- The GitHub `bad_verification_code` → retry-without-`redirect_uri` fallback (git log `bbfcf95`).
- Device flow lifecycle (`authorization_pending` / `slow_down` / `access_denied` / `expired_token` → typed statuses), dual IPv4+IPv6 loopback listening, 5-minute auto-cancel.
- `go-keyring` already vendored; existing oauth2 unit tests pass (`go test ./internal/oauth2/...` → ok).

---

## 2. Architecture decisions (fixed up front)

- **D1 — Canonical engine in `internal/oauth2`.** `types.go / errors.go / pkce.go / loopback.go / exchange.go / discovery.go / store.go`. `bindings_oauth2.go` becomes a thin Wails wrapper; App-level server fields move into the engine. `internal/models.OAuth2Config` keeps a compat JSON shape (Wails TS generation) but the engine is the source of truth.
- **D2 — Redirect strategy.** Default: ephemeral loopback `http://127.0.0.1:{port}/callback` with `net.Listen("tcp", "127.0.0.1:0")` (RFC 8252 §7.3). Opt-in "use my registered redirect URI" advanced field → fixed-port dual-stack listener (preserves today's GitHub/Slack/Spotify behavior — those providers require exact pre-registration and cannot accept an arbitrary port). Fallback mode: show authorize URL, user pastes the redirect URL back; engine parses `code`+`state` from it. Never render the provider login in a Wails window.
- **D3 — Expiry units: milliseconds everywhere.** `ExpiresAtMs` computed as `time.Now().UnixMilli() + expiresIn*1000` at one boundary in the engine. Frontend displays/compares ms natively. Kill B1.
- **D4 — Token identity & storage.** Keyring key `reqit:{workspaceID}:{requestOrFolderID}:{providerHost}` (workspaceID from `workspaces.Store`, same convention as `internal/git` PAT). Collection JSON stores only config + `tokenRef` — never tokens or secrets. Legacy inline tokens are migrated to the keyring once on first load (keep reading inline for backward compat so saved collections don't break).
- **D5 — Client auth modes.** Every token exchange supports `client_auth: body` (default, current behavior) or `client_auth: basic` (Basic header) — Hoppscotch parity for Client Credentials and for providers that reject body auth. Never send `client_secret` in a PKCE public-client exchange unless the user explicitly marks the client **confidential**.
- **D6 — PKCE default.** Authorization Code generates S256 verifier/challenge unconditionally by default. The `usePkce` checkbox becomes an **advanced "disable PKCE (legacy provider)"** toggle, default off. Root causes #3/#4.
- **D7 — Auto-refresh is engine-level, not per-UI.** `oauth2.AttachAuth(ctx, req, cfg, store)`: load token → expiry check with 60 s skew → silent refresh once → retry original request once → `ErrRefreshFailed` fallback to a clear re-auth prompt. `requester.go` `case "oauth2"` calls it. Root cause #9.
- **D8 — Fragment path for Implicit.** Loopback serves `GET /callback` (query code) **and** a tiny HTML+JS page that reads `window.location.hash`, re-POSTs it to `/callback/fragment` on the same origin (no CORS). Only served when `response_type=token`. Root cause #6.

---

## 3. Phases

Each phase ends with a verification gate. Gates: `cd flux && go test ./... ` (scoped to touched packages), `go vet ./...`, `cd frontend && npm run build` (tsc + vite), and `wails generate` only when binding signatures change. Keep the tree green after every phase.

### Phase 0 — Baseline + spike (0.5 d)
1. Record baseline: `go test ./internal/oauth2/... ./internal/requester/... ./internal/models/...`, `go build ./...`, frontend `tsc --noEmit`.
2. Spike: prove ephemeral loopback bind + `BrowserOpenURL` round-trip manually; confirm `go-keyring` works in this app's context (it already does in `internal/crypto`).
3. Scaffold new test files as the target contract (red tests allowed at this point, not yet wired).

Exit: toolchain green, spike notes in this doc, failing-but-correct target tests committed.

### Phase 1 — Engine core: types, errors, PKCE (1 d)
- `types.go`: `GrantType` (auth_code, client_credentials, device_code, password, implicit), canonical `OAuthConfig` (incl. `Confidential bool`, `ClientAuthMode`, `TokenRef`), `TokenResult`, `ProviderError`, `RedirectResult`.
- `errors.go`: `ErrStateMismatch`, `ErrTimeout`, `ErrProviderDenied`, `ErrPortBindFailed`, `ErrRefreshFailed`, `ErrFlowInProgress` — all `errors.Is`-comparable, each carrying provider `error`/`error_description`.
- `pkce.go`: `NewCodeVerifier()` (43–128 chars, RFC 7636 §4.1 unreserved charset, crypto/rand), `S256Challenge(verifier)`.
- Unit tests: length/charset compliance, uniqueness, deterministic challenge, RFC 7636 §4.1 conformance (43 char min enforced).

Gate: `go test ./internal/oauth2/...`, `go build ./...`.

### Phase 2 — Loopback server + browser launch (1.5 d)
- `loopback.go`: `Start(ctx, opts)` — ephemeral `127.0.0.1:0` default, or fixed registered port (dual IPv4+IPv6 listener like today); mux with `/callback` (query code) and `/callback/fragment` (Implicit re-POST); state validation first; branded "You can close this tab and return to reqit" page; 5 min context timeout; immediate teardown on success/error/timeout; reject non-loopback `Host` headers; HTML-escape all interpolated values (B4).
- `browser.go`: `OpenURL` per OS — `open` (darwin), `xdg-open` (linux), `rundll32 url.dll,FileProtocolHandler` (windows); Wails `BrowserOpenURL` remains the primary path in the app; engine exposes the URL so either can open it.
- Tests (httptest-driven fake provider): query-code callback success; state-mismatch rejection; provider `error`/`error_description` passthrough; fragment page served for `response_type=token` and its re-POST parsed; timeout shutdown frees the port; fixed-port dual-stack bind.

Gate: `go test ./internal/oauth2/...`, `go vet ./...`. Manually: two flows back-to-back on the same machine (port must be free).

### Phase 3 — Exchange engine (2 d)
- `exchange.go`: one `Exchange(ctx, grant, cfg, params)` with per-grant param sets:
  - `authorization_code`: `grant_type, code, redirect_uri, client_id` + `code_verifier` (PKCE) — `client_secret` **only** when `Confidential`; keep GitHub `bad_verification_code` → retry-without-`redirect_uri` fallback.
  - `refresh_token`: `grant_type, refresh_token, client_id` (+ secret if confidential / Basic).
  - `client_credentials`: `grant_type, scope` + client auth (body or Basic, D5).
  - `password`: `grant_type, username, password, scope` — surfaced with RFC 9700 deprecation notice (UI concern, engine only needs the grant).
  - `device_code`: start (no `grant_type`, hits `device_authorization_endpoint`) + poll (`urn:ietf:params:oauth:grant-type:device_code`) — port the existing, working logic.
  - `implicit`: no token exchange — the loopback fragment path (Phase 2) produces the token client-side; engine validates + stores it.
- Parse both JSON and `application/x-www-form-urlencoded` responses; `expires_in` → `ExpiresAtMs` (D3); provider errors always surfaced verbatim.
- Unit tests per grant incl.: Azure-style rejection when a stray `client_secret` is sent with PKCE (assert absent), Basic vs body client auth, `slow_down` handling, empty-secret never serialized as `"undefined"`, refresh-token grant param set.

Gate: `go test ./internal/oauth2/...`, `go vet ./...`.

### Phase 4 — Discovery (0.5 d)
- `discovery.go`: `Discover(ctx, issuer) (*Metadata, error)` — fetch `{issuer}/.well-known/openid-configuration` (trailing-slash tolerant), 15 s timeout, 10 min in-memory cache per issuer; extract `authorization_endpoint`, `token_endpoint`, `device_authorization_endpoint`, `code_challenge_methods_supported`, `scopes_supported`, `issuer`.
- Tests: httptest metadata server, cache hit (single fetch), trailing-slash normalization, malformed/non-200 → typed error.

Gate: `go test ./internal/oauth2/...`.

### Phase 5 — Secure store (1 d)
- `store.go`: keyring-backed `Store` — `SaveToken(workspaceID, ref, host, TokenRecord)` / `LoadToken` / `DeleteToken` / `SaveClientSecret` / `LoadClientSecret`; keys `reqit:{workspaceID}:{ref}:{host}`. `workspaceID` from `workspaces.Store` (ActiveDir-based, same as git PAT).
- `TokenRecord`: `{AccessToken, RefreshToken, TokenType, ExpiresAtMs, Scope, IDToken?}`.
- Migration: on load, if a collection payload still has inline `accessToken` (legacy), copy to keyring, set `tokenRef`, and stop writing inline on next save.
- Tests via go-keyring's built-in mock (`keyring_mock.go`); a real-keyring smoke test guarded by build tags / env so CI stays green on headless Linux (Secret Service absent) — same approach the rest of the repo must tolerate.

Gate: `go test ./internal/oauth2/... ./internal/models/...`.

### Phase 6 — Send-path integration + auto-refresh (1.5 d)
- `models.go`: `OAuth2Config` gains `TokenRef string`; keep legacy `AccessToken/RefreshToken/ExpiresAt` for compat/migration.
- `oauth2.ResolveToken(ctx, cfg, store)`: load by `TokenRef` (fallback to inline legacy) → if `ExpiresAtMs` within 60 s skew or past → refresh via Phase 3 → persist new pair → return; on refresh failure → `ErrRefreshFailed`; no refresh token → return existing + `ExpiresSoon` flag (UI prompts re-auth, no silent loop).
- `requester.go` `case "oauth2"`: call `ResolveToken` + set `Authorization: {TokenType} {access}`. One retry of the original request after a successful silent refresh.
- Fix B1 end-to-end: `ExpiresAtMs` in ms everywhere; frontend countdown math corrected.
- Tests: expired token → refresh → retry succeeds; refresh revoked → `ErrRefreshFailed` and no infinite loop; no refresh token → request goes out with stored token + prompt signal; 401-after-refresh → surface, don't loop.

Gate: `go test ./internal/oauth2/... ./internal/requester/...`, `go build ./...`, frontend `tsc`.

### Phase 7 — Wails bindings rework (1 d)
- `bindings_oauth2.go`:
  - `StartOAuthFlow(cfg)` → `{ authorizeUrl, redirectUri, state, mode: "loopback" | "manual" }`; background goroutine runs exchange and emits progress.
  - `CancelOAuthFlow()`, `CompleteManualRedirect(pastedURL)` (parses `code`/`state` from a pasted redirect URL — the Postman-style fallback), `GetToken(ref)`, `RefreshToken(ref)`, `RevokeToken(ref)`.
  - Device bindings (`StartDevice`, `PollDevice`) re-routed through the engine, same wire shape.
  - Progress events `oauth2:progress` with status `waiting_for_browser → exchanging_code → success | error`, provider `error`/`error_description` verbatim in the payload.
- Delete App-level `oauthState/oauthServer/oauthListeners/oauthMu`; engine owns lifecycle.
- Regenerate `frontend/wailsjs` bindings after signature changes.

Gate: `go build ./...`, `go vet ./...`, frontend `tsc`, manual two-flow run.

### Phase 8 — Frontend (2 d)
- `features/auth/oauth2/useOAuth2.ts`: subscribes to `oauth2:progress`, wraps all bindings, exposes state machine + verbatim provider errors.
- `OAuth2Form.tsx`: grant picker — Authorization Code + PKCE (default), Client Credentials, Device Code, and under a **legacy** group: Password + Implicit, each with a non-dismissible-until-acknowledged RFC 9700 deprecation banner. Fields: issuer/discovery autofill, client ID, client secret (only for confidential / non-PKCE), scopes, client-auth mode for client_credentials, "use my registered redirect URI" advanced toggle (fixed port) vs ephemeral default, PKCE-off legacy toggle.
- `OAuth2DiscoveryField.tsx`: issuer URL → `Discover` → autofill URLs + scopes, with "fetching/failed" states.
- `OAuth2TokenPanel.tsx`: token type, expiry countdown (ms-fixed), "Get New Access Token", Refresh, Revoke, Use Token, Clear; manual paste-redirect fallback UI; provider `error_description` shown verbatim.
- `buildPayload.ts`: persist `tokenRef` only — never `accessToken`/`refreshToken` (root cause #8). Keep the in-memory token for the live session.
- Keep the GitHub "no refresh token" hint; add per-provider redirect-URI guidance.

Gate: `npm run build` (tsc + vite), manual Google + GitHub + Entra smoke.

### Phase 9 — Provider integration tests (2 d)
- Keycloak (Docker) harness, gated by env (`KEYCLOAK_URL`) so CI without Docker skips: auth_code+PKCE success, state-mismatch rejection, expired-token auto-refresh mid-request, refresh-token-revoked → re-auth fallback, client_credentials, device flow (Keycloak supports device grant on modern versions).
- Manual matrix (recorded in `CHANGELOG`):
  - **Google**: auth code + PKCE in OS browser; no `disallowed_useragent`; ephemeral loopback accepted.
  - **GitHub**: auth code completes via registered fixed port; app never assumes a refresh token exists; no error when absent.
  - **Microsoft Entra ID**: auth code + PKCE without any `client_secret`; client_credentials standalone.
  - **Auth0/Okta**: `redirect_uri` exact match (scheme/host/port/path); device flow via polling.
- Acceptance: every grant from §6 of the spec doc, plus the 10 root causes re-checked against the audit table in §1.

### Phase 10 — Hardening + docs (0.5 d)
- Escape result-page HTML (B4); bound fragment-POST body size; reject non-loopback `Host`; ensure teardown on every path (`defer`/`t.Cleanup`-style).
- Update `DOCS.md`/`CHANGELOG.md`: redirect-URI registration guidance per provider, ephemeral-vs-fixed port explanation, keyring storage note, deprecation notices.

---

## 4. Provider sharp edges to keep encoded in tests

| Provider | Grant(s) | Sharp edge |
|---|---|---|
| Google | Auth code + PKCE | Blocks embedded webviews; accepts loopback |
| GitHub | Auth code | No refresh tokens (classic apps); requires exact registered redirect URI; form-encoded token response; `bad_verification_code` fallback |
| Entra ID | Auth code + PKCE, client_credentials | Rejects stray `client_secret` in PKCE exchange |
| Auth0 / Okta | Auth code + PKCE, client_credentials, device | Strict `redirect_uri` exact match |
| Keycloak | All (CI) | Full automated harness |
| Generic RFC 8628 | Device | No `redirect_uri` at all |

---

## 5. Global acceptance criteria (re-verify at end of every phase after 7)

1. No interactive login renders in a Wails webview — OS browser or manual-paste only.
2. No token / refresh_token / client_secret in any git-tracked file.
3. Every token exchange in Go; renderer calls bindings only.
4. `state` validated on every callback (query and fragment paths) before any exchange.
5. Expired tokens refresh silently, at most once per request, then fall back to a clear re-auth prompt.
6. Password and Implicit show a non-dismissible RFC 9700 deprecation notice.
7. Provider `error`/`error_description` shown verbatim — never swallowed into a generic toast.
8. `ExpiresAtMs` in ms everywhere; countdown and auto-refresh triggers correct (B1 closed).
9. No port collision: ephemeral port per flow; fixed port only when the user opts in with a registered URI.

## 6. Open risks / decisions to confirm

- **GitHub & co. vs ephemeral ports**: GitHub requires exact pre-registered redirect URIs, so Phase 2's default-ephemeral cannot be the only path for those providers — the fixed-port opt-in and manual-paste fallback are mandatory, not nice-to-have (spec §4.2 b/c).
- **Keyring on headless Linux CI**: Secret Service may be absent; store tests must not hard-fail (mock + skip pattern).
- **Wails binding regeneration**: requires `wails` CLI; if unavailable in this environment, keep old binding signatures as deprecated wrappers so `frontend/wailsjs` stays in sync until regeneration.
