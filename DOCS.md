# reqit Documentation

> A local-first API client built for developers and teams. Fast, private, and sync-ready — no cloud account needed.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Your First Request](#your-first-request)
3. [Workspaces](#workspaces)
4. [Collections](#collections)
5. [Environments & Variables](#environments--variables)
6. [History](#history)
7. [Team Collaboration](#team-collaboration)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [Importing from Postman](#importing-from-postman)
10. [FAQ](#faq)

---

## Getting Started

### Download

| Platform | File |
|----------|------|
| Windows  | `reqit-windows-amd64.exe` |
| macOS    | `reqit-macos-universal.zip` |
| Linux    | `reqit-linux-amd64` |

Download the latest release from [GitHub Releases](https://github.com/HalxDocs/flux/releases/latest).

### macOS — First Launch

macOS will show a Gatekeeper warning because the app is not notarized. To bypass:

1. Right-click the app → **Open**
2. Click **Open** in the dialog
3. The app will run normally from now on

Or via Terminal:
```bash
xattr -cr /Applications/reqit.app
```

### Linux — Make Executable

```bash
chmod +x reqit-linux-amd64
./reqit-linux-amd64
```

---

## Your First Request

1. Open reqit — you land on the **Home** screen
2. Create or open a workspace
3. Click **New Tab** (or press `Ctrl/Cmd + T`)
4. Type your URL in the address bar (e.g. `https://jsonplaceholder.typicode.com/posts/1`)
5. Select the HTTP method (GET, POST, PUT, DELETE, PATCH)
6. Press **Send** or hit `Enter`

The response appears in the right panel — body, status code, headers, and timing.

### Adding Headers

Click the **Headers** tab in the request panel and add key-value pairs. Common ones:
- `Content-Type: application/json`
- `Authorization: Bearer <token>`

### Adding a Body

Switch to the **Body** tab, select `JSON`, and paste your payload:
```json
{
  "title": "My post",
  "body": "Hello world",
  "userId": 1
}
```

### Authentication

Use the **Auth** tab to add:
- **Bearer Token** — paste your JWT or API key
- **Basic Auth** — username + password (base64 encoded automatically)

Or add the `Authorization` header manually in the Headers tab.

---

## Workspaces

A workspace is just a **folder on your machine**. Everything inside it — collections, environments, history — lives as plain JSON files. No database, no proprietary format.

### Create a Workspace

1. Home screen → **New Workspace**
2. Give it a name and optional description
3. Pick a color to distinguish it in the workspace switcher

### Open an Existing Folder as a Workspace

If you have a folder syncing via Dropbox/OneDrive/Google Drive:

1. Home screen → **Open Folder**
2. Pick the folder
3. reqit detects existing data and loads it immediately

### Switch Workspaces

Click the workspace name at the top of the sidebar → **Switch** to another workspace. Each workspace has its own collections, environments, and history.

### Data Location

| Platform | Path |
|----------|------|
| Windows  | `%APPDATA%\reqit\workspaces\<id>\` |
| macOS    | `~/Library/Application Support/reqit/workspaces/<id>/` |
| Linux    | `~/.config/reqit/workspaces/<id>/` |

---

## Collections

Collections group saved requests into folders. Good for organizing requests by project, service, or flow.

### Save a Request

After sending a request:
1. Click **Save** (or `Ctrl/Cmd + S`)
2. Pick an existing collection or create a new one
3. Give the request a name

### Run a Saved Request

Click any request in the **Collections** panel in the sidebar. It loads into a new tab.

### Edit a Saved Request

Load the request, make your changes, then Save again — it updates in place.

### Export a Collection

Right-click a collection → **Export**. Saves as a `.flux.json` file you can share or back up.

### Import from Postman

See [Importing from Postman](#importing-from-postman).

---

## Environments & Variables

Environments let you switch between different configurations (dev, staging, prod) without editing requests.

### Create an Environment

1. Click the **Env** dropdown at the top of the sidebar → **+ New Environment**
2. Name it (e.g. "Production")
3. Add variables as key-value pairs

### Use a Variable

In any URL, header, or body field, reference variables with double curly braces:

```
https://{{base_url}}/api/users
Authorization: Bearer {{api_token}}
```

### Switch Environments

Click the Env dropdown → select a different environment. All `{{variables}}` resolve to the new values instantly.

### Environment Scope

Variables are per-workspace and stored locally. They are **never** sent to any external service.

---

## History

reqit automatically records every request you send.

- View history in the **History** section of the sidebar
- Click any entry to reload it into a new tab
- History is limited to the last 200 entries per workspace
- Clear history: **Settings** → **Storage** → **Clear History**

---

## Team Collaboration

reqit uses **Git** to sync workspaces between teammates. No separate server needed — just a shared private GitHub (or GitLab/Bitbucket) repository.

> Everything syncs through Git: collections, environments, and history are all plain JSON files committed to the repo.

### How It Works

```
Teammate A commits & pushes  →  GitHub repo  →  Teammate B pulls on open
```

- reqit auto-pulls every time you open a workspace
- You commit and push manually via the **Team** panel
- Active contributors (anyone who committed in the last 24h) appear at the top of the Team panel

### Step 1 — Create a GitHub Repository

1. Go to [github.com](https://github.com) → **New repository**
2. Set visibility to **Private** (recommended)
3. Do **not** initialize with a README (reqit will do the first commit)
4. Copy the HTTPS clone URL: `https://github.com/your-org/your-repo.git`

### Step 2 — Get a Personal Access Token (PAT)

GitHub requires a PAT for HTTPS push/pull access.

1. Go to [github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Set expiry (90 days recommended)
4. Check the **`repo`** scope (full repo access)
5. Click **Generate token** and copy it immediately (you won't see it again)

### Step 3 — Connect reqit to the Repository

1. Open reqit with your workspace active
2. Click **Team** in the sidebar (below Collections & History)
3. Paste your **Remote URL** and **PAT**
4. Click **Connect**

reqit will:
- Initialize a git repo in your workspace folder (if not already one)
- Set the remote origin to your URL
- Store your PAT securely in the OS keychain (Windows Credential Manager / macOS Keychain / Linux secret-service)
- Pull any existing data from the remote

### Step 4 — Invite a Teammate

Share these two things with your teammate:

1. **The remote URL** — use the "Copy remote URL" button in the Team panel
2. **Instructions** — they need to generate their own PAT and connect on their machine

Your teammate:
1. Opens reqit → creates or opens a workspace
2. Clicks **Team** → pastes the same remote URL + their own PAT → **Connect**
3. reqit pulls all your existing collections and environments automatically

### Committing & Pushing

When you've made changes (new requests, updated environments):

1. Click **Team** in the sidebar
2. Write a commit message describing what changed (e.g. "Add auth endpoints")
3. Click **Commit & Push**

Your teammate will see the changes next time they open the workspace (auto-pull) or click **Pull** in the Team panel.

### Branches

The Team panel includes a branch switcher. Use branches to work on a feature without affecting the main workspace:

1. Click the branch name → type a new branch name → press Enter
2. Work on your changes
3. Commit & Push to that branch
4. Merge on GitHub when ready

### Seeing Who's Active

The **Active today** section at the top of the Team panel shows everyone who committed in the last 24 hours — their name, commit count, and when they last pushed. This works offline by reading the git log.

### PAT Security

- PATs are stored in the **OS keychain**, never in plain files
- Each teammate uses their own PAT
- If a PAT is revoked or expired, reconnect via **Team → Edit** → enter the new PAT

### Conflict Resolution

If two teammates edit the same file and both push, git will detect a conflict on pull. Currently reqit surfaces the raw git error. In this case:
1. Open a terminal in the workspace folder
2. Run `git status` to see conflicted files
3. Resolve manually, then commit via the Team panel

---

## Keyboard Shortcuts

| Action | Windows / Linux | macOS |
|--------|----------------|-------|
| Send request | `Enter` (in URL bar) | `Enter` |
| New tab | `Ctrl + T` | `Cmd + T` |
| Close tab | `Ctrl + W` | `Cmd + W` |
| Focus URL bar | `Ctrl + L` | `Cmd + L` |
| Save request | `Ctrl + S` | `Cmd + S` |
| Next tab | `Ctrl + Tab` | `Cmd + Tab` |
| Previous tab | `Ctrl + Shift + Tab` | `Cmd + Shift + Tab` |

---

## Importing from Postman

Export your collection from Postman:
1. In Postman → right-click collection → **Export** → **Collection v2.1**
2. Save the `.json` file

Import into reqit:
1. In the sidebar → **Collections** → click the **Import** icon (↓)
2. Select the target collection (or create one first)
3. Pick the exported `.json` file
4. All requests are imported with their URLs, methods, headers, and bodies

> Note: Postman environment variables are not automatically imported. Add them manually via the **Env** panel.

---

## FAQ

**Is reqit free?**
Yes. reqit is fully open source under the MIT license. Always free, no premium tier.

**Does reqit send any data to the internet?**
Only when you explicitly send an API request. Your collections, environments, and history never leave your machine (unless you connect a Git remote — and then they go only to your own repo).

**Can I use GitLab or Bitbucket instead of GitHub?**
Yes. Any HTTPS git remote that supports PAT authentication works. The setup steps are the same — just use your GitLab/Bitbucket PAT.

**What happens if I lose my PAT?**
Generate a new one on GitHub and reconnect via **Team → Edit remote**. Your data is safe — it's all in the workspace folder.

**Can I use reqit without Git?**
Absolutely. Git sync is optional. If you don't click **Team**, nothing git-related runs.

**How do I back up my data without Git?**
Copy your workspace folder. Everything is plain JSON — `collections.json`, `environments.json`, `history.json`. Zip it and store it anywhere.

**The app says "no active workspace" — what do I do?**
Go to **Home** (click the logo at the top of the sidebar) and create or open a workspace.

---

*reqit is built with [Wails](https://wails.io) (Go + React). Source: [github.com/HalxDocs/flux](https://github.com/HalxDocs/flux)*
