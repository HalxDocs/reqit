# Incident remediation checklist — wfx/ci-wfx campaign (2026-11)

_Generated: 2026-11-13 09:35 UTC from repository state and GitHub API._

## 1) Actions completed in this session

- **Inventory & verification (139 accessible repos):** identified `wfx-docs` campaign artifacts; verified each `wfx-docs` head changed only `docs/wfx-audit.md` (benign decoy) with expected content. **0 anomalous diffs, 0 injection-named branches found.**
- **Decoy cleanup:** closed **139** verified open `wfx-docs` PRs and deleted **139** `wfx-docs` branches across those repos.
- **`reqit` (HalxDocs/reqit):** replaced the flagged Stripe/Svix-format webhook signing secret in `onceo-core/providers/svix/svix_test.go` with a clearly non-sensitive dummy test value; tests passed; committed and pushed to `main` (`d5c572d`).
- **`onceo-core` (HalxDocs/onceo-core):** same replacement committed and pushed to `main` (`6129f02`).
- **Local (`reqit`):** `git reflog expire --expire=now --all && git gc --prune=now` completed. No `.ci-wfx*` files tracked; no `wfx-docs` ref/PR remains.

> Note: the dummy replacement value matches the `whsec_*` secret pattern and may trigger **new** secret-scanning alerts (false positive / test-only). The **original leaked secret values remain in git history** and in still-public dangling commits/blobs until purged — replacement in HEAD does not remediate historical exposure.

## 2) `reqit` — malicious dangling commits/blobs (still public)

These commits are unreachable from branches/PR refs but were **HTTP 200 (publicly accessible)** at time of check. They contain credential-exfiltration scripts (`.ci-wfx-*.sh`) with embedded Telegram bot tokens/chat (alerts #2–#6) and related configs.

| Commit | File | Blob | Status |
|---|---|---|---|
| `d46514e0451a` | `.ci-wfx-ceji9r.sh` | `2a86602a2ef1` | public, dangling |
| `6baa40e25928` | `.ci-wfx-pwfeh0.sh` | `ea1b91631b5b` | public, dangling |
| `608d1e44fe45` | `.ci-wfx-g7bdwy.sh` | `5f737d07621e` | public, dangling |
| `26bce59da1b2` | `.ci-wfx-zkvrzw.sh` | `d3e70d86b765` | public, dangling |
| `2d8b35eea744` | `.ci-wfx-vdbwe1.sh` | `1c53ed366ed1` | public, dangling |
| `3fc552ff8eaf4` | `.ci-wfx-qj8pk2.sh` | — | public, dangling (deleted injection-named branch; callback variant) |

**Required:** remove any remaining refs, then request GitHub purge/GC of dangling commits & blobs and cached views; verify URLs 404. Rotate all exposed credentials regardless of purge timing.

## 3) Per-repo campaign checklist (wfx-docs) and remaining open secret-scanning alerts

Legend: **wfx-docs cleaned** = verified decoy PR closed + `wfx-docs` branch deleted (this session). Alert details exclude secret values.

| Repo | Scope | wfx-docs | Open secret-scanning alerts (remaining) | Action |
|---|---|---:|---|---|
| `Aiki-org/aiki-flutter` | org/collab (Aiki-org) | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `Aiki-org/aiki-hr-dashboard` | org/collab (Aiki-org) | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `Aiki-org/aiki-server` | org/collab (Aiki-org) | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `Aiki-org/aiki-waitlist-page` | org/collab (Aiki-org) | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/3d` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/3d-dev` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/3d-dev-connect` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/aegis` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/AgentSandbox` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/Aidevhelper` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/AMC2` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/Aptech-Semester-1-project` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/aura` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/azadey-landing` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/bachs-go` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/bankcli` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/bid` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/cha` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/chennese` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/chinesse` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/contextpack` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/cortexos-backend` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/cortexos-frontend` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/crisp` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/crispy` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/crumbs` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/dashdev` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/devexcuse` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/devflowapi` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/devsupportAI` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/drawing-site` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/elibray-` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/email-verifier` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/emer` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/expense-tracker` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/expensetrackercli` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/falcam` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/feildministry` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/fire` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/first-ai` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/fiskana` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/fitgym` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/fm` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/fm3` | personal | ✅ cleaned (verified decoy) | #1 Google API Key — index.html:994 @`14b0f386cd61` (unknown, leaked=True, multi=True) [link](https://github.com/HalxDocs/fm3/security/secret-scanning/1) | monitor for reappearance; triage/rotate & resolve alerts |
| `HalxDocs/fm4` | personal | ✅ cleaned (verified decoy) | #1 Google API Key — index.html:1027 @`0a0827e7f83f` (unknown, leaked=True, multi=True) [link](https://github.com/HalxDocs/fm4/security/secret-scanning/1) | monitor for reappearance; triage/rotate & resolve alerts |
| `HalxDocs/fm5` | personal | ✅ cleaned (verified decoy) | #1 Google API Key — index.html:1101 @`3aa314d8addd` (unknown, leaked=True, multi=True) [link](https://github.com/HalxDocs/fm5/security/secret-scanning/1) | monitor for reappearance; triage/rotate & resolve alerts |
| `HalxDocs/fm6` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/fm7` | personal | ✅ cleaned (verified decoy) | #1 Google API Key — index.html:1101 @`81ece0c0f1c3` (unknown, leaked=True, multi=True) [link](https://github.com/HalxDocs/fm7/security/secret-scanning/1) | monitor for reappearance; triage/rotate & resolve alerts |
| `HalxDocs/fm8` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/fruitfresh` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/fruits` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/ft2` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/fullstack-school-website` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/gettoolforge` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/ghostapi` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/goldenhotel` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/halx-mart` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/HalxDocs` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/halxdocs-brand` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/HalxDocs-connect-card` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/HalxDocs-connect-card2` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/halxdocs.com` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/HalxDocs30day-codex` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/health-care` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/hhhh` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/ho` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/homebrew-tap` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/hospital-backend` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/impactgraph` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/jambquiz` | personal | ✅ cleaned (verified decoy) | #1 Google API Key — src/firebase.ts:5 @`88d76518ab7d` (unknown, leaked=True, multi=True) [link](https://github.com/HalxDocs/jambquiz/security/secret-scanning/1) | monitor for reappearance; triage/rotate & resolve alerts |
| `HalxDocs/javascript-journey` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/jokes` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/js-cracked` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/json-formatter` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/kamsy` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/keyway` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/lax` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/lazydb` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/ma` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/mai` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/maik` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/Med` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/med1` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/min-tra` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/mmmmfood` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/myshopletaudit` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/ndidi` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/Ne` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/Neuron` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/Neuronift` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/nior-studio` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/nobe` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/norahsbeauty-hub` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/norahsbeautyhubbackend` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/onceo-cloud` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/onceo-core` | personal | ✅ cleaned (verified decoy) | #2 Stripe Webhook Signing Secret — providers/svix/svix_test.go:86 @`6129f0264192` (unknown, leaked=True, multi=True) [link](https://github.com/HalxDocs/onceo-core/security/secret-scanning/2)<br>#1 Stripe Webhook Signing Secret — providers/svix/svix_test.go:86 @`8775f73557ae` (unknown, leaked=True, multi=True) [link](https://github.com/HalxDocs/onceo-core/security/secret-scanning/1) | monitor for reappearance; triage/rotate & resolve alerts; see repo-specific notes |
| `HalxDocs/onceo-test` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/pack` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/packetlab` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/petcare` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/plant` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/po` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/port` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/portai` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/portf` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/portfolio` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/portfoliore` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/porti` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/prompts-gen` | personal | ✅ cleaned (verified decoy) | #1 Google API Key — index.html:480 @`614df6eb848c` (unknown, leaked=True, multi=False) [link](https://github.com/HalxDocs/prompts-gen/security/secret-scanning/1) | monitor for reappearance; triage/rotate & resolve alerts |
| `HalxDocs/python-semester-4-project` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/raft` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/recipe-finder` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/recipe-finder2` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/reqit` | personal | ✅ cleaned (verified decoy) | #7 Stripe Webhook Signing Secret — onceo-core/providers/svix/svix_test.go:86 @`d5c572d733a7` (unknown, leaked=True, multi=True) [link](https://github.com/HalxDocs/reqit/security/secret-scanning/7)<br>#6 Telegram Bot Token — .ci-wfx-ceji9r.sh:8 @`d46514e0451a` (unknown, leaked=True, multi=True) [link](https://github.com/HalxDocs/reqit/security/secret-scanning/6)<br>#5 Telegram Bot Token — .ci-wfx-ceji9r.sh:8 @`d46514e0451a` (unknown, leaked=True, multi=True) [link](https://github.com/HalxDocs/reqit/security/secret-scanning/5)<br>#4 Telegram Bot Token — .ci-wfx-ceji9r.sh:8 @`d46514e0451a` (unknown, leaked=True, multi=True) [link](https://github.com/HalxDocs/reqit/security/secret-scanning/4)<br>#3 Telegram Bot Token — .ci-wfx-ceji9r.sh:8 @`d46514e0451a` (unknown, leaked=True, multi=True) [link](https://github.com/HalxDocs/reqit/security/secret-scanning/3)<br>#2 Telegram Bot Token — .ci-wfx-ceji9r.sh:8 @`d46514e0451a` (unknown, leaked=True, multi=True) [link](https://github.com/HalxDocs/reqit/security/secret-scanning/2)<br>#1 Stripe Webhook Signing Secret — onceo-core/providers/svix/svix_test.go:86 @`140f87243c29` (unknown, leaked=True, multi=True) [link](https://github.com/HalxDocs/reqit/security/secret-scanning/1) | monitor for reappearance; triage/rotate & resolve alerts; see repo-specific notes |
| `HalxDocs/reqwest` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/restaurant` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/sav` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/sch-web` | personal | ✅ cleaned (verified decoy) | #1 Google API Key — index.html:529 @`c26bc412da7d` (unknown, leaked=True, multi=True) [link](https://github.com/HalxDocs/sch-web/security/secret-scanning/1) | monitor for reappearance; triage/rotate & resolve alerts |
| `HalxDocs/server-ai` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/sgmcli` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/state` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/swifttree-frontend` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/sybico-backend` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/symphony` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/Tech-Connect` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/to-do` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/tra` | personal | ✅ cleaned (verified decoy) | #1 Google API Key — app.js:5 @`356c9f91d201` (unknown, leaked=True, multi=True) [link](https://github.com/HalxDocs/tra/security/secret-scanning/1) | monitor for reappearance; triage/rotate & resolve alerts |
| `HalxDocs/tracelite` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/tri-ve` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/updated-portfolio` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/vibekeys` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/vtu-backend` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/vtu-frontend` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `HalxDocs/weather` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/zryl` | personal | ✅ cleaned (verified decoy) | none (open) | monitor for reappearance |
| `HalxDocs/zryl-cli` | personal | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `iamxenon404/School-Ecosystem` | org/collab (iamxenon404) | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `IndigoSoftwares21/dreep-go` | org/collab (IndigoSoftwares21) | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |
| `Kevinart-maker/hero-collection` | org/collab (Kevinart-maker) | ✅ cleaned (verified decoy) | ⚠️ could not query alerts | monitor for reappearance |

## 4) Repo-specific alert notes

### HalxDocs/reqit
- **#1 Stripe Webhook Signing Secret** — original leaked value in historical commit (`onceo-core/providers/svix/svix_test.go:86`, commit `140f872…`). HEAD replaced with dummy, but **historical exposure remains**; rotate/invalidate if ever real and purge history/objects as feasible, then resolve.
- **#2–#6 Telegram Bot Token** — in dangling malicious `.ci-wfx-*.sh` commits (see §2). **Revoke/regenerate all 5 bot tokens and secure chat immediately**; assume exfiltrated data compromised. Resolve as revoked only after rotation + purge + no remaining locations (multi-repo).
- **#7 Stripe Webhook Signing Secret** — detected in fix commit `d5c572d` (dummy test value `whsec_dGVzdC...` format). **Likely false positive/test-only**; verify non-sensitive, then resolve appropriately (e.g. false positive/used in tests) per policy. Do not treat as equivalent to #1 without checking.

### HalxDocs/onceo-core
- **#1** original leaked Stripe/Svix webhook signing secret in history (`providers/svix/svix_test.go:86`, `8775f735…`); **#2** dummy value introduced by fix commit `6129f02…` (likely false positive/test-only). Same handling as reqit: rotate if real, purge history where possible, resolve #2 as test-only after verification.

### Other repos with open alerts (observed)
- `HalxDocs/fm3` — #1 Google API Key, `index.html:994` @`14b0f386cd61` (publicly leaked, multi-repo). [link](https://github.com/HalxDocs/fm3/security/secret-scanning/1)
- `HalxDocs/fm4` — #1 Google API Key, `index.html:1027` @`0a0827e7f83f` (publicly leaked, multi-repo). [link](https://github.com/HalxDocs/fm4/security/secret-scanning/1)
- `HalxDocs/fm5` — #1 Google API Key, `index.html:1101` @`3aa314d8addd` (publicly leaked, multi-repo). [link](https://github.com/HalxDocs/fm5/security/secret-scanning/1)
- `HalxDocs/fm7` — #1 Google API Key, `index.html:1101` @`81ece0c0f1c3` (publicly leaked, multi-repo). [link](https://github.com/HalxDocs/fm7/security/secret-scanning/1)
- `HalxDocs/jambquiz` — #1 Google API Key, `src/firebase.ts:5` @`88d76518ab7d` (publicly leaked, multi-repo). [link](https://github.com/HalxDocs/jambquiz/security/secret-scanning/1)
- `HalxDocs/prompts-gen` — #1 Google API Key, `index.html:480` @`614df6eb848c` (publicly leaked). [link](https://github.com/HalxDocs/prompts-gen/security/secret-scanning/1)
- `HalxDocs/sch-web` — #1 Google API Key, `index.html:529` @`c26bc412da7d` (publicly leaked, multi-repo). [link](https://github.com/HalxDocs/sch-web/security/secret-scanning/1)
- `HalxDocs/tra` — #1 Google API Key, `app.js:5` @`356c9f91d201` (publicly leaked, multi-repo). [link](https://github.com/HalxDocs/tra/security/secret-scanning/1)

**Action:** these are separate from the wfx exfil scripts but still exposed credentials. Restrict/rotate/regenerate the keys (apply API & referrer restrictions), remove them from source/history as appropriate, and resolve alerts. Audit each repo for any additional unauthorized changes.

## 5) Global actions still required

1. **Credentials & account:** review GitHub **Security log** (not sessions only), revoke/rotate PATs/OAuth/SSH/GPG/deploy keys and `gh` tokens; rotate all potentially exposed cloud/CI/registry/DB/API secrets; revoke/regenerate Telegram bot tokens (#2–#6 and any others found).
2. **GitHub object purge:** purge dangling malicious commits/blobs and cached views in `reqit` (and any other repo with dangling exfil commits); verify URLs 404.
3. **Resolve alerts correctly:** after rotation/purge/remediation, close Telegram alerts as revoked, close historical Stripe alerts per policy once exposure mitigated, and close dummy-secret false positives only after verification.
4. **Broaden hunt:** audit all repos (including org/collab repos you access) for `.ci-wfx*`, unexpected workflow changes, malicious `chore/x$(...)` refs, unknown Actions runs/secrets/apps/keys; re-run secret scanning review account-wide.
5. **Host hygiene:** audit this machine for persistence/untrusted tooling (e.g. `freebuff`, assessment repos executed locally), scrub secrets from history/config, and consider rebuild if high-value credentials were present.

## 6) Prevention (ongoing)
- Enforce 2FA/passkeys; least-privilege, short-lived tokens; regular review of OAuth/PAT/SSH keys.
- Branch protection, required reviews, secret scanning + push protection.
- Actions hardening: minimal `permissions`, pin actions to SHAs, avoid unsafe interpolation of untrusted refs/inputs, restrict workflow triggers.
- Run untrusted code in isolated sandboxes; keep secrets in vaults/secret stores; pre-commit secret scanning.
