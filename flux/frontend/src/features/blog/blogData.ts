export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  tags: string[];
  content: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "postman-import",
    title: "I imported my entire Postman workspace into reqit in 30 seconds",
    description: "My team had 47 Postman collections spread across 6 workspace accounts. I spent an afternoon migrating everything to reqit. The import took 30 seconds.",
    date: "2026-06-10",
    readTime: "4 min read",
    tags: ["tutorial", "import", "postman"],
    content: `Every time I open Postman on my work laptop it takes 8 seconds to load, asks me to log in, and reminds me I've used 3 of 5 free team collections. My team had 47 collections spread across 6 workspace accounts. We were paying $12/month per person for something that should be a file on disk.

I spent an afternoon migrating everything to reqit. The import took 30 seconds. The whole team switched in a day.

## The problem with Postman imports

Most API clients make you re-import collections one by one. Export from Postman as v2.1 JSON, find the file, drag it into the new tool, repeat 47 times.

Reqit does it in one step: you point it at your exported collection file and it imports every request, folder structure, header, auth method, and body. No per-request mapping. No lost auth tokens.

## Step-by-step

1. Open Postman, select your workspace, and export as **Collection v2.1** (File > Export). This gives you a single .json file with every request in that workspace.
2. Open reqit and click the import button in the sidebar (or press Cmd+K and type "import").
3. Pick your exported file.
4. Reqit parses every request: method, URL, headers, auth (bearer, basic, API key), body (JSON, form-data, URL-encoded, raw), and folder structure.
5. Your collections appear in the sidebar, ready to send.

No account. No upload to a cloud service. The entire thing runs locally.

## What gets imported

- HTTP method, URL, query params, headers
- Bearer tokens, basic auth, API key auth
- JSON, form-data, x-www-form-urlencoded, and raw bodies
- Folder nesting (collections > folders > requests)
- Request names and descriptions

## What does not (yet)

- Postman scripts (pm.* pre-request and test scripts) are imported as comments for manual review
- Postman environment files import separately through the environment manager
- Postman examples are stored but not auto-linked to mock routes

## The result

Our team went from 6 Postman workspace accounts to a single Git repository. Collections live in .reqit/collections/ and version with the code. New team members clone the repo and have every API endpoint ready to test.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "git-native-storage",
    title: "Why we store API collections as plain JSON files",
    description: "Every API client stores collections in a database. reqit stores them as plain JSON files in a .reqit/ directory. This decision drives everything else in the product.",
    date: "2026-06-08",
    readTime: "5 min read",
    tags: ["engineering", "gitops", "architecture"],
    content: `Every API client I have used stores collections in a database. Postman stores them in a cloud DB. Insomnia stores them in a local DB. Bruno stores them as files.

Reqit stores them as plain JSON files in a .reqit/ directory inside your project. This decision drives everything else in the product.

## The problem with databases

When collections live in a database, you lose five things developers should not have to give up:

- **Diff.** You cannot run git diff on a database entry. When a co-worker changes a request URL, you see "collection updated" with no detail.
- **Branch.** Feature branches should have their own API collections. With a DB, you need a separate workspace.
- **Review.** Pull requests should show API changes alongside code changes.
- **History.** If someone deletes a collection in a cloud workspace, it is gone. With files in Git, you have the full commit history.
- **Sync.** Cloud sync requires an account, a subscription, and trust.

## How reqit does it

When you create a collection in reqit, it writes a JSON file to disk. The structure:

.reqit/collections/auth-api/login.json
.reqit/collections/auth-api/refresh.json
.reqit/collections/payment-service/charge.json
.reqit/environments/dev.json
.reqit/environments/staging.json

Each request is its own file. Each collection is a directory. Environments are separate files. Everything is plain JSON.

## What this enables

Pull requests show API changes. When a developer changes a request URL or adds a header, the diff is visible right in the PR alongside the code changes.

Feature branches carry their own collections. Merge the branch, merge the collections. No separate workspace management.

No vendor lock-in. The files are JSON. Open them in any editor. Parse them with any tool.

## The trade-off

Two developers editing the same request at the same time get a merge conflict, just like code. This is a feature: you resolve conflicts explicitly instead of silently losing changes.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "local-first-philosophy",
    title: "Building a local-first API client: no account, no cloud, no telemetry",
    description: "Postman's installer is 340MB. It takes 5-10 seconds to cold start. reqit's installer is under 20MB. It starts in under 400ms. This is not an accident.",
    date: "2026-06-05",
    readTime: "4 min read",
    tags: ["philosophy", "privacy", "engineering"],
    content: `Postman's installer is 340MB. It takes 5-10 seconds to cold start on a 2022 laptop. It requires an account and phones home on every launch.

Reqit's installer is under 20MB. It starts in under 400ms. It requires nothing but a download.

This is the result of a hard constraint we set before writing the first line of code.

## The constraint

Reqit must never require an account, a cloud connection, or telemetry. Every feature decision goes through this filter.

## What this means for the architecture

The backend is a native Go binary compiled with Wails v2. No Electron. No embedded browser. Go compiles to a single binary, starts instantly, and uses under 50MB of RAM at rest.

The frontend is React with a build output of ~800KB gzipped. No runtime dependencies on Node or any server process.

Data is stored as JSON files on the local filesystem. No SQLite, no LevelDB, no proprietary binary format.

## The trade-offs

No cloud backup out of the box. You own your data. You also own your backups.

No real-time collaboration. Two people cannot edit the same collection simultaneously unless they use Git branches.

No usage analytics. We rely on GitHub issues, Discord, and direct feedback.

## What we gain

**Trust.** Every developer who has been burned by a cloud tool that switched to a paid plan or shut down knows exactly what reqit is not.

**Performance.** No network call on startup. No sync spinner. The app is ready the instant you click it.

**Privacy.** Every request, every response, every environment variable stays on your machine.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
];
