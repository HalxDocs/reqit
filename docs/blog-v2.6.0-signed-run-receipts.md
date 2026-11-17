# Every API request now leaves a signed receipt

**reqit 2.6.0 — Signed Run Receipts**

There is a particular kind of silence after an API call goes wrong.

The request returned a 500. Or it returned a 200 that should have been a 500. Or it worked on your machine and failed in CI. Someone asks, “What exactly did we send?” and the honest answer is: a URL reconstructed from memory, a header someone edited an hour ago, a token that has since rotated, and a response that only exists in a screenshot.

reqit has always been good at sending the request. Version 2.6.0 is about remembering it — safely, durably, and in a form you can prove.

Every execution now writes a **run receipt**: a small, versioned record of what was asked for, how each variable was resolved, what came back, and whether it matched. Receipts are redacted by construction, hash-chained, and signed with a key held in your operating system’s keychain.

![How reqit signed run receipts work](run-receipts.svg)

---

## The idea: a receipt, not a log

Logs are written for machines. They are noisy, mutable, and usually live somewhere you cannot attach to a bug report. A receipt is different. It is written for the person who has to answer, “Did this actually happen, and can I trust the answer?”

Think about the receipt in your pocket after buying coffee. It is not a recording of the entire shop. It is a compact, structured claim: what was purchased, when, for how much, and from whom. reqit’s run receipts follow the same principle for HTTP.

Each receipt answers four questions:

1. **What did we mean to send?** The request as written, with `{{variables}}` still visible.
2. **Where did the values come from?** The variable names and their sources — environment, vault, collection — never the resolved secrets.
3. **What came back?** Status, safe headers, timing, and a SHA-256 fingerprint of the body.
4. **Has anything changed since?** A hash that commits to the previous receipt, plus a signature from your machine’s key.

That last point is what makes a receipt more than a log line.

---

## How it works

The illustration above follows one request through the system.

### 1. You write the request

You compose the request the way you always have, with placeholders instead of secrets: `GET /{{env}}/users`, `Authorization: {{token}}`. The receipt records this templated form rather than the expanded one. Six months later, `{{env}}` still tells you which environment was meant, and `{{token}}` tells you a credential was involved without storing the credential.

### 2. It crosses the trust boundary

Every surface in reqit — the desktop app, the CLI, the collection runner, the scheduler, the MCP server, and event replay — now executes through one boundary, `internal/trust`. That boundary does three things before a byte reaches disk:

- **Redacts** URLs, path segments and headers.
- **Records** the request, response summary and timing.
- **Signs** the resulting receipt with a key from the OS keychain.

The transport layer still sends the real request. The trust layer decides what is safe to remember.

### 3. It goes on the wire

The resolved request is sent normally. Nothing about the transport changes. There is no proxy, no capture daemon, and no extra round trip.

### 4. A receipt is written

The receipt lands in `.reqit/runs/` inside your workspace. Writes are atomic, so a crash cannot leave a half-written file. Each receipt points at the hash of the one before it, forming a chain.

At the bottom of the illustration, the two halves of the guarantee sit side by side: the **hash chain** makes silent edits visible, and the **signature** makes a recomputed hash insufficient.

---

## What is inside a receipt

Here is a real receipt shape, with hashes shortened for readability:

```json
{
  "version": 1,
  "id": "20261113T091422.184000000Z-9f2c4e1b7a30",
  "kind": "run",
  "time": "2026-11-13T09:14:22.184Z",
  "source": "cli",
  "environment": "staging",
  "request": {
    "method": "GET",
    "url": "https://api.example.com/{{env}}/users?limit=20&api_key=«redacted»",
    "headers": [
      { "name": "Accept", "value": "application/json" },
      { "name": "Authorization", "redacted": true }
    ]
  },
  "resolution": [
    { "name": "env", "source": "environment" },
    { "name": "api_key", "source": "vault" }
  ],
  "response": {
    "status": "200 OK",
    "statusCode": 200,
    "headers": {
      "content-type": "application/json",
      "cache-control": "no-store"
    },
    "bodySha256": "sha256:9f2c4e…",
    "bodyBytes": 18422
  },
  "timing": {
    "dnsLookupMs": 3,
    "tcpConnectMs": 14,
    "tlsHandshakeMs": 27,
    "ttfbMs": 71,
    "downloadMs": 9,
    "totalMs": 124
  },
  "prevHash": "sha256:1a7d…",
  "hash": "sha256:5c93…",
  "keyId": "4c1d9a7f3e2b8a60",
  "signature": "hmac-sha256:8b41…"
}
```

Notice what is present and what is absent.

**Present:** the method, the endpoint shape, the parameter names, the variable names and where they came from, the status, the safe headers, the body fingerprint, and the timing breakdown.

**Absent:** the resolved token, the resolved environment value if it is sensitive, the response body, and any header value that is not on a small allowlist.

The `«redacted»` marker is deliberate. It tells you a value existed without telling you what it was.

---

## Redaction is a default, not a cleanup step

Most tools redact after the fact: write everything, then run a filter over it. That fails in two ways. A crash between write and filter leaves secrets on disk, and a filter that misses one field leaks silently.

reqit redacts before the receipt exists.

- **Query values** are masked unless the parameter name is on a short, safe allowlist (`limit`, `offset`, `page`, `sort`, `order`, `format`, `lang`, and a handful of others). An innocuously named `?id=sk_live_…` is still masked.
- **Path segments** are kept when they identify a resource, but masked when they match a known credential prefix or the high-entropy shape of a token. Placeholders such as `/{{tenant}}/users` stay readable, because they are not values.
- **Headers** always keep their names. Values survive only for headers like `Content-Type`, `Accept`, `User-Agent` and `X-Request-Id`. A custom header such as `X-Internal-Auth` keeps its name and loses its value.
- **Bodies** are reduced to a SHA-256 hash and a byte count. Body previews are off by default and capped at 8 KiB when explicitly enabled.

The result is a receipt you can attach to a ticket, paste into Slack, or commit to a repository without doing a secret sweep first.

---

## Using receipts from the CLI

Four commands cover the workflow:

```bash
# Newest first, with source, status, URL and timing
reqit runs list

# The full receipt; a unique ID prefix is enough
reqit runs show 20261113T0914

# Compare two executions; exits non-zero when they differ
reqit runs diff <id> <id>

# Verify hashes, chain links and signatures
reqit runs verify
```

`reqit runs verify` is the one to put in CI or a pre-release checklist. It reports signed and unsigned receipts separately:

```
✓ 128 receipts verified — hashes and chain intact (128 signed, 0 unsigned)
```

An unsigned receipt does not fail verification. It is reported honestly: the history is intact, but it was written on a machine where no signing key was available.

Both `list` and `show` support `--json`, so receipts fit into scripts without scraping the table output.

---

## Using receipts in the desktop app

The same history is available under **Trust → Run receipts**. The panel lists executions with their source, status and duration. Selecting one opens the full receipt: the templated request, the resolution sources, the response summary, the load-test block when present, the chain hashes, and the signature status.

Verification runs in place. There is no separate export step, and no second format to keep in sync with the CLI — both read the same files.

---

## Why a hash chain and a signature

A hash alone answers a narrow question: “Does this file still match the hash recorded next to it?” It does not stop someone from editing the file and updating the hash.

A hash chain raises the cost. Each receipt includes the hash of its predecessor, so changing receipt 40 invalidates the link from 41. To hide the edit, an attacker must rewrite every later receipt too.

A signature raises it again. Each receipt’s hash is signed with HMAC-SHA256 using a key stored in the OS keychain under the `reqit-receipts` service. Recomputing the chain is no longer enough: without the key, the final signature will not match. A receipt committed to a repository, shared with a teammate, or attached to an incident report therefore carries evidence of whether it was altered elsewhere.

This is **tamper-evident**, not tamper-proof. The distinction matters, and it is covered in the limitations below.

---

## Load tests leave one receipt, not ten thousand

A load test can issue thousands of requests per second. Writing one receipt per request would bury the history that receipts exist to make reviewable, and it would turn a diagnostic feature into a disk-space problem.

Instead, a load test writes a single summary receipt with `kind: "loadtest"`:

- virtual users, duration and iterations
- total requests, passed and failed counts
- average, p50, p95 and p99 latency
- the error, if the test itself failed

The request that was under test is recorded once, in templated form, alongside those numbers. Individual load-test requests are intentionally not replayable.

---

## Safe history when several processes write at once

The desktop app, a scheduled job, the CLI and an MCP client can all finish a request at the same moment. A naive lock file can go stale when a process crashes, leaving the history permanently stuck.

reqit uses a real advisory OS lock instead: `flock` on Unix and `LockFileEx` on Windows. The kernel releases the lock when the owning process exits, so a crash cannot strand the chain. A polling fallback exists for platforms that provide neither primitive.

Receipt writes remain best-effort. If the disk is full or the workspace is read-only, the request still succeeds and the failure is logged. Recording must never be the reason a request fails.

---

## What this does not do

A release note that only lists wins is marketing. Here is the honest boundary of what shipped.

- **Redaction is defense in depth, not a guarantee.** Query values and credential-shaped path segments are masked, but a low-entropy secret placed in an innocuously named path segment cannot be distinguished from a resource ID. Do not put secrets in URL paths.
- **Receipts are tamper-evident, not tamper-proof.** Anyone who can read the signing key from your OS keychain can sign a forged receipt. The signature detects edits made elsewhere, or receipts committed to a repository, without that key. It does not defend against a local attacker who already controls your unlocked account.
- **Recording is best-effort by design.** A failed write is logged and never fails the request. Use `reqit runs verify` and the receipts panel to confirm history was written.
- **Advisory locks depend on the filesystem honouring them.** They are reliable on local disks. A network filesystem with broken lock semantics can still allow two writers to fork the chain.
- **Load tests record one summary receipt, not one receipt per request.** Individual load-test requests are intentionally not replayable.
- **The UI, app and MCP surfaces are covered by tests at the boundary, but they are not a proof of every path.** The trust layer is the single execution point; if a future surface bypasses it, it will not produce receipts.

These limits are documented in the changelog rather than buried in a wiki.

---

## Upgrading

Version 2.6.0 is available now:

- **Release:** [github.com/HalxDocs/reqit/releases/tag/v2.6.0](https://github.com/HalxDocs/reqit/releases/tag/v2.6.0)
- **Changelog:** [Changelog — reqit 2.6.0, Signed Run Receipts](https://github.com/HalxDocs/reqit/blob/main/flux/CHANGELOG.md#260---2026-11-13--signed-run-receipts)
- **Source:** [github.com/HalxDocs/reqit](https://github.com/HalxDocs/reqit)

Existing workspaces pick up the `.reqit/runs/` ignore rule on launch. Receipts are local by default and are not committed unless you choose to share them.

The next time someone asks what you sent, the answer will not be a reconstruction. It will be a receipt — redacted, chained, signed, and one command away from proof.

---

*reqit 2.6.0 was released on 13 November 2026. The changelog linked above includes the full feature list, implementation notes and limitations.*