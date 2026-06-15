# Building a local-first API client: no account, no cloud, no telemetry

Postman's installer is 340MB. It takes 5-10 seconds to cold start on a 2022 laptop. It requires an account and phones home on every launch.

Reqit's installer is under 20MB. It starts in under 400ms. It requires nothing but a download.

This is not an accident. It is the result of a hard constraint we set before writing the first line of code.

## The constraint

Reqit must never require:

- An account
- A cloud connection
- Telemetry or analytics

Every feature decision goes through this filter. If a feature needs a server, it has to add the server as optional infrastructure, not a requirement.

## What this means for the architecture

The backend is a native Go binary compiled with Wails v2. No Electron. No embedded browser. Go compiles to a single binary, starts instantly, and uses under 50MB of RAM at rest.

The frontend is React with a build output of ~800KB gzipped. No runtime dependencies on Node or any server process.

Data is stored as JSON files on the local filesystem. No SQLite, no LevelDB, no proprietary binary format. The filesystem is the database.

## The trade-offs

Local-first means some things are harder:

**No cloud backup out of the box.** You own your data. You also own your backups. Documentation tells you where data lives and how to sync it with Dropbox, rsync, or a Git push.

**No real-time collaboration.** Two people cannot edit the same collection simultaneously unless they use Git branches. This is fine for our use case. API collections change less frequently than code, and most teams already use Git branches for code.

**No usage analytics.** We do not know how many people use reqit, what features they use most, or where they get stuck. We rely on GitHub issues, Discord, and direct feedback.

## What we gain

**Trust.** Every developer who has been burned by a cloud tool that switched to a paid plan, shut down, or started mining their data knows exactly what reqit is not.

**Performance.** No network call on startup. No sync spinner. No "checking for updates" dialog. The app is ready to use the instant you click it.

**Portability.** The data directory is a folder. Copy it to a USB drive. Rsync it to another machine. Check it into Git. It works everywhere the same way.

**Privacy.** Every request, every response, every environment variable stays on your machine. The only data that leaves is what you explicitly send to an API endpoint.

Reqit is free, open source, and stores nothing but JSON files. If you want to try it: [github.com/HalxDocs/reqit](https://github.com/HalxDocs/reqit)
