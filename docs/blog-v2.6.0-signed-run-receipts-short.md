# reqit 2.6.0: every request leaves a signed receipt

Ever tried to answer “what exactly did we send?” a day after an incident? Usually it is memory, a screenshot, and a token that has since rotated.

reqit 2.6.0 changes that. Every execution now writes a **run receipt** to `.reqit/runs/`.

A receipt records:

- the request as written, with `{{variables}}` intact
- where each variable came from — never its value
- response status, safe headers, timing, and a SHA-256 of the body
- a hash link to the previous receipt
- an HMAC-SHA256 signature keyed from your OS keychain

Redaction happens before anything reaches disk: query values outside a safe allowlist, credential-shaped path segments and unknown header values are masked. Bodies are stored as hashes, not content. You can attach a receipt to a ticket or commit it without a secret sweep.

Verify anytime:

```bash
reqit runs verify
✓ 128 receipts verified — hashes and chain intact
```

Or open **Trust → Run receipts** in the desktop app for the same history in a UI.

What it is **not**: tamper-proof. It is tamper-evident — editing a receipt breaks the chain, and recomputing the chain still fails the signature without your key. Redaction is defense in depth, and recording stays best-effort so it can never fail a request. Those limits are documented.

**Changelog:** https://github.com/HalxDocs/reqit/blob/main/flux/CHANGELOG.md#260---2026-11-13--signed-run-receipts

**Release:** https://github.com/HalxDocs/reqit/releases/tag/v2.6.0

Shipped in 59 commits, with signed receipts across the app, CLI, runner, scheduler, MCP server and event replay.

![How reqit signed run receipts work](run-receipts.svg)