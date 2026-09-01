# Security Policy

## Supported Versions

We release patches for security vulnerabilities. The following versions are currently supported:

| Version | Supported          |
| ------- | ------------------ |
| 1.2.x   | :white_check_mark: |
| 1.1.x   | :white_check_mark: |
| < 1.1   | :x:                |

We recommend running the latest release from https://github.com/HalxDocs/reqit/releases/latest.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security reports.**

Use one of these private channels:

1. **GitHub Private Vulnerability Reporting** (preferred) — https://github.com/HalxDocs/reqit/security/advisories/new
2. **Email:** kamsyejindu@gmail.com — subject `[reqit security]`

Include:

- Affected version / commit, OS (Windows / macOS / Linux distro, e.g. Fedora 41), and how you installed reqit
- Steps to reproduce, proof-of-concept, and impact (e.g. token leak, XSS, SSRF bypass, keychain fallback file permissions)
- Whether the issue is in the desktop binary, the MCP server (`reqit mcp`), the collection runner, or the frontend
- Any logs (sanitize tokens first) or `reqit mcp --help` output

What happens next:

- **Acknowledgement** within **48 hours**
- **Triage** within **5 business days** — we confirm the issue, assess severity (CVSS), and share a remediation timeline
- **Fix & disclosure** — we ship a patch to `main` and a GitHub Release, then publish an advisory after you confirm the fix. We credit reporters unless you prefer anonymity.
- We will not take legal action against good-faith researchers who follow this policy.

## Scope

In scope (we will fix):

- Token/secret leakage: OAuth access/refresh tokens, client secrets, API keys written to git-tracked files (`flux/.reqit/`, `flux/collections/`, `flux/history.json`), exported collections, or logs
- Auth bypass: OAuth state/PKCE not verified, SSRF bypass in `send_request` (`isSSRFRisk`), WebSocket/SSE auth header leak
- Injection: Stored XSS via custom visualizers (`VisualizerView` `dangerouslySetInnerHTML`), prompt-injection payloads not flagged by Agent Lens R6, `visualizer.set` template injection
- Keychain fallback file at `~/.config/flux/keyring-fallback.json` (0600) — permission or encryption issues
- MCP traffic inspector: information disclosure via `mcp_traffic.json` or `POST /mcp` without auth on `127.0.0.1:7247`
- Supply chain: `go mod` / `npm` dependency vulnerabilities in the released binary

Out of scope (we will not fix as security issues):

- Social engineering, physical access, or a compromised OS keychain / `~/.config` directory
- Denial-of-service via large response bodies (500KB+ banner is a performance guard, not a security boundary — use `wails dev` limits)
- Vulnerabilities in bundled `webkit2gtk` / `WebView2` themselves — report upstream, then tell us the version range
- `reqit mcp --http` bound to `127.0.0.1` without auth by design (local-only). Do not expose it to the public internet; use an SSH tunnel if you need remote access.

## Secure Use

- **Keep collections in a private repo if they contain `{{VAR}}` that resolves to secrets at runtime** — `StripAuthValue` prevents tokens at rest, but `{{VAR}}` is still interpolated from your active environment.
- **On Fedora / headless Linux without `gnome-keyring` / `libsecret`**, tokens fall back to `~/.config/flux/keyring-fallback.json` (0600). Ensure that file is not world-readable and consider using a full SecretService provider for stronger isolation.
- **Custom visualizers**: `VisualizerView` renders HTML from `visualizer.set(template, data)`. Only run visualizers from trusted collections. We sanitize `{{field}}` via `escapeHtml`, but a malicious collection could still inject a template — review before clicking **Visualize**.

## Past Advisories

None published yet. Future advisories will appear at https://github.com/HalxDocs/reqit/security/advisories.

## Attribution

We follow the GitHub-recommended private reporting flow. Thanks to everyone who reports responsibly.
