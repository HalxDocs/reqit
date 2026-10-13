# Data Recovery Plan — surviving a system flash

Goal: after wiping and reinstalling a laptop, a user restores **every** piece of
reqit data — collections, environments, history, events, test suites, agent-lens
runs, cookies, git history, and workspace wiring — from a remote they control.

## Where data lives today

| Data | Location | Survives flash? |
|---|---|---|
| Collections, environments, exports | `<workspace>/.reqit/` | Only if committed **and** pushed |
| History, run history, events, test suites, agent-lens, cookies, `ai.json` | `<workspace>/` (gitignored or untracked) | **No** — see gaps |
| Workspace registry, profile, devprofile, `.flux-git.json` | `~/.config/flux/` | **No** — outside any repo |
| Git remote URL | `<workspace>/.flux-git.json` (committed) | Yes |
| Git PAT | OS keychain | **No** — must be re-entered |

Two git back the project up:

- `internal/git/git.go` — repo operations (commit/push/pull/branch/stash/conflicts).
- `internal/storage/storage.go` — atomic JSON writes into the workspace dir.

## The five gaps that actually lose data

1. **Untracked files are never committed.** `CommitAll` uses `git add -A`, but
   `.gitignore` excludes `*.env`, `*.key`, `*.pem`, `**/secrets.json`,
   `.reqit/ai.json`, `.reqit/cookies.json`, `.reqit/interceptor/`, `*.log`.
   Those are correctly never pushed — so cookies, AI keys, and interceptor
   captures are **permanently lost** on flash.
2. **`~/.config/flux/` is outside every repo.** The workspace list and devprofile
   are the index that tells reqit *which* repos to open. Losing it means the user
   must re-add every workspace by path.
3. **PAT lives in the OS keychain only.** Flashing wipes it; recovery needs a
   re-auth step, so pushes silently stop.
4. **Sync is pull → commit → push, and only when a PAT exists.** With no PAT,
   data accumulates locally and silently until the disk dies.
5. **Nothing verifies a backup actually works.** No integrity check, no
   "last successful push" signal, no restore drill.

## Guiding constraint

Never push secrets in plaintext. Any design that commits tokens, cookies or
interceptor payloads to a remote is unacceptable. So the plan separates:

- **Versioned data** → plain files, committed and pushed to Git as today.
- **Secrets** → encrypted-at-rest, user-keyed, opt-in.

## The plan

### Phase 1 — Make backups automatic and verifiable

Goal: no user action required for ordinary data.

1. **Guarantee a dirty commit.** Extend `autoSync` in `bindings_git.go` so it runs
   on a debounce after any mutation (save collection, run request, record event),
   not only on explicit action. Commit with the workspace profile identity.
2. **Never silently stop.** Track `lastPushAt`, `lastPushErr` and surface them in
   the Git panel. A workspace whose pushes have been failing for days must say so
   loudly — that is the difference between a recoverable and an unrecoverable setup.
3. **Preflight on startup.** Check: is this a git repo, does it have a remote, is
   the PAT present, did the last push succeed. Render a single honest status chip.
4. **Backup health check (new).** `BackupStatus` returning per-workspace
   `{repo, remote, pat, lastPushAt, uncommitted, unpushedCommits, errors}`. Drive
   the Git panel and an optional CLI `flux doctor`.

### Phase 2 — Recover the app-level index

Goal: a new machine knows where everything is.

5. **Version the workspace registry.** Add `~/.config/flux/backup/` holding a
   manifest of every workspace (path, git remote, collections index, devprofile).
   Commit that manifest to a dedicated private repo (`reqit-backup`), pushed with
   a key stored in the OS keyring — never a PAT inside the file.
6. **First-run restore wizard.** On empty install, detect the backup repo, offer
   to restore: workspace list, devprofile, then clone each referenced repo.
7. **`flux restore <remote>`** CLI so recovery is scriptable and testable.

### Phase 3 — Secrets, encrypted

Goal: recover secrets without ever committing them in the clear.

8. **Encrypted vault.** `.reqit/vault.json` holding AES-GCM ciphertext for cookies,
   interceptor captures, AI keys, OAuth client secrets. Key derived from a user
   passphrase via Argon2id; **not** stored. Losing the passphrase means losing the
   vault — that trade-off is the point.
9. **Separate private repo.** Vault pushed to a second private repo
   (`reqit-secrets`), never the workspace repo, so a shared project repo cannot
   leak them.
10. **Secret inventory + gap report.** Enumerate what is local-only and tell the
    user plainly: "these 3 items are not backed up because you have no vault."
    Silent loss is the real enemy; make it visible.

### Phase 4 — Make it provable

Goal: trust the backup by testing it.

11. **Restore drill (new CLI + test).** `flux backup verify` — clone the backup
    repo to a temp dir, decrypt the vault, diff collections and environments
    against live state, report drift. Run in CI on a fixture repo.
12. **Restore-from-scratch test.** A CI job that flashes a simulated clean machine
    (`HOME` pointed at a temp dir), restores, and asserts collections,
    environments and history match. This is the test that proves the whole plan.
13. **Golden fixture repo.** A small `.reqit/` fixture committed to the repo so
    every future change is tested against known-good data.

## What I would not do

- **Do not commit secrets in plaintext** to "just save everything". The current
  gitignore is correct and should stay.
- **Do not auto-create a public remote.** Default to private, require explicit
  opt-in, and never print a token to a log.
- **Do not make the keychain the only copy of the vault key.** That is the exact
  failure being fixed.

## Success criteria

- A user never has to think about backups for collections/environments/history.
- Wiping a machine and running `flux restore` returns the full workspace.
- Anything not backed up is reported explicitly, not lost quietly.
- CI proves it by restoring into a clean `HOME`.

## Open questions for the maintainer

1. Should the backup repo be per-user or per-machine?
2. Is a passphrase-derived vault acceptable, or should we support a hardware key?
3. Do we want cloud-provider sync (S3/GDrive) as a fallback for users without Git?
4. Should Phase 2 and 3 ship together, or is Phase 1 enough to call it safe?