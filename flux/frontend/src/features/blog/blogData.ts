export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  tags: string[];
  category: string;
  content: string;
}

export const CATEGORIES = [
  "All",
  "Comparisons",
  "Technical deep-dives",
  "Tutorials & use-cases",
  "Release narratives",
  "Philosophy & opinion",
] as const;

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "postman-import",
    title: "I imported my entire Postman workspace into reqit in 30 seconds",
    description: "My team had 47 Postman collections spread across 6 workspace accounts. I spent an afternoon migrating everything to reqit. The import took 30 seconds.",
    date: "2026-06-10",
    readTime: "4 min read",
    tags: ["tutorial", "import", "postman"],
    category: "Comparisons",
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
    category: "Philosophy & opinion",
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
    category: "Philosophy & opinion",
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
  {
    slug: "explainer-collections",
    title: "what are collections",
    description: "Most API clients store collections in a database. That is a mistake. reqit stores them as plain JSON files on disk.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "collections", "beginner"],
    category: "Technical deep-dives",
    content: `Most API clients store collections in a database. That is a mistake. reqit stores them as plain JSON files on disk, inside a \`.reqit/collections/\` directory. Every request is its own file. Every collection is a folder. This one decision unlocks everything else: git diffs, branch-based reviews, merge conflict resolution, and zero vendor lock-in.

## why files beat databases

When a collection lives in a database, you get "collection updated" in your version history with no detail. When it lives on disk, \`git diff\` shows you exactly which URL changed, which header was added, and which body field moved. Feature branches carry their own collections. Merge the branch, merge the collections. No separate workspace. No cloud account. No subscription.

## file structure

\`\`\`
.reqit/
├── collections/
│   ├── auth-api/
│   │   ├── login.json
│   │   └── refresh.json
│   └── payment-service/
│       ├── charge.json
│       └── refund.json
└── environments/
    ├── dev.json
    └── staging.json
\`\`\`

Each JSON file contains the full request definition: method, URL, headers, auth, body, and any scripts. Open them in any editor. Parse them with any tool. The format is documented and trivial to extend.

## git diffs in practice

\`\`\`diff
diff --git a/.reqit/collections/auth-api/login.json b/.reqit/collections/auth-api/login.json
--- a/.reqit/collections/auth-api/login.json
+++ b/.reqit/collections/auth-api/login.json
@@ -5 +5 @@
-    "url": "https://staging.api.com/auth/login"
+    "url": "https://api.production.com/auth/login"
\`\`\`

A developer changes a request URL. The diff appears in the pull request alongside the code change. The team reviews the API change in context. No guessing. No separate tooling.

## merge conflicts are a feature

Two developers editing the same request at the same time get a git merge conflict. You resolve it explicitly instead of silently losing changes. This is exactly how code works, and it should work the same way for API collections.

Collections as files means your API definitions version like your code. They live in the same repo, get reviewed in the same PR, and deploy with the same pipeline.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-http-requests",
    title: "http requests in reqit",
    description: "Every API test starts with an HTTP request. Most tools overcomplicate this. reqit gives you a URL bar, a method dropdown, and a send button.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "http", "beginner"],
    category: "Tutorials & use-cases",
    content: `Every API test starts with an HTTP request. Most tools overcomplicate this with wizards, code generators, and five different panes. reqit gives you a URL bar, a method dropdown, and a send button. That is all you need.

## methods in practice

You already know GET reads data, POST creates it, PUT replaces, PATCH updates partially, and DELETE removes. The part that matters in reqit is how you configure each one. The request builder has four tabs: Params, Headers, Body, and Auth. You fill in what you need, reqit builds the wire-format request.

## a real request cycle

Here is a POST to create a user:

\`\`\`
POST https://api.example.com/v1/users
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...

{
  "name": "Alice",
  "email": "alice@example.com",
  "role": "admin"
}
\`\`\`

The response comes back:

\`\`\`
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "usr_8f3k2m",
  "name": "Alice",
  "email": "alice@example.com",
  "role": "admin",
  "createdAt": "2026-06-25T10:30:00Z"
}
\`\`\`

reqit displays the response with status code, timing, headers, and pretty-printed JSON. You can copy any part of it, save it to your collection, or chain it into the next request with a script.

## body types

reqit supports JSON, form-data, URL-encoded, raw text, GraphQL, gRPC, and SOAP. Pick the type, the editor adjusts. No format guessing. No copy-pasting from documentation.

## what you gain

The request builder is deliberately minimal. No account required, no cloud sync, no login prompt. You type a URL, pick a method, and hit send. The tool stays out of your way so you can focus on the API you are actually testing.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-environments",
    title: "environments and variable scoping",
    description: "Hardcoded URLs in requests are a ticking time bomb. Environments in reqit are variable scoping: write a request once, variables resolve based on which environment is active.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "environments", "beginner"],
    category: "Technical deep-dives",
    content: `Hardcoded URLs in requests are a ticking time bomb. One \`http://localhost:3000\` in production and you have an outage. Environments in reqit are variable scoping: you write a request once, and the variables resolve based on which environment is active.

## variable resolution

In any request field, use \`{{VARIABLE_NAME}}\` syntax. When you select an environment, reqit replaces every \`{{VARIABLE}}\` in your URL, headers, and body with the value from that environment. Switch from Dev to Prod with one click. Every request updates instantly.

## scoping rules

Variables resolve in this order: request-level > folder-level > environment-level > vault. If you define \`BASE_URL\` at the request level, it takes precedence over the environment value. This lets you override a single request without touching the shared environment.

## hardcoded vs environment variables

**Before (hardcoded):**

\`\`\`
POST http://localhost:3000/api/users
Authorization: Bearer dev-token-123
\`\`\`

**After (with environment):**

\`\`\`
POST {{BASE_URL}}/api/users
Authorization: Bearer {{AUTH_TOKEN}}
\`\`\`

Dev environment: \`BASE_URL\` = \`http://localhost:3000\`, \`AUTH_TOKEN\` = \`dev-token-123\`
Prod environment: \`BASE_URL\` = \`https://api.production.com\`, \`AUTH_TOKEN\` = \`prod-token-456\`

Same request. Two environments. Zero copy-paste. Zero risk of sending a test token to production.

## secrets handling

Sensitive values like API keys and tokens should not sit in environment files you commit to git. reqit has a vault that encrypts secrets at rest. Your environment file references \`{{VAULT_API_KEY}}\` instead of the actual key. The vault decrypts only when reqit sends a request.

## what goes in an environment

Anything that changes between servers: base URLs, API keys, tokens, user IDs, feature flags, timeout values. Keep your request definitions clean and let environments handle the context.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-auth",
    title: "authentication in reqit",
    description: "Auth is where most API testing breaks down. reqit handles auth as a first-class concern: configure it once, reqit adds the right headers automatically.",
    date: "2026-06-15",
    readTime: "4 min read",
    tags: ["explainer", "auth", "security"],
    category: "Technical deep-dives",
    content: `Auth is where most API testing breaks down. You spend 10 minutes getting a token, paste it into a header, it expires, and you start over. reqit handles auth as a first-class concern: configure it once per request, and reqit adds the right headers automatically.

## bearer token

The most common pattern. You get a JWT from a login endpoint, paste it into the Auth tab under Bearer, and reqit sends \`Authorization: Bearer <token>\` on every request. When the token expires, you re-run the login request and update it. reqit also decodes JWTs inline so you can see claims and expiry without leaving the tool.

## basic auth

Enter a username and password. reqit encodes them to Base64 and adds the \`Authorization: Basic\` header. Simple, but only use this over HTTPS.

## api key

Some APIs expect a key in a custom header like \`X-API-Key\` or as a query parameter. reqit lets you pick the header name and value. The key is sent on every request in that collection.

## oauth2

The full flow with PKCE support. Configure the authorization URL, token URL, client ID, and scopes. reqit opens a browser for the user to authorize, captures the callback, exchanges the code for a token, and stores it. Refresh tokens are handled automatically.

## when to use each

| Type | Use when |
|------|----------|
| Bearer | Most modern APIs. Token from login endpoint. |
| Basic | Internal tools, legacy APIs, simple auth. |
| API Key | Public APIs with key-based access control. |
| OAuth2 | Third-party integrations, user-facing apps. |
| mTLS | Enterprise, high-security, mutual trust. |

## the auth tab

Configure auth at the request level, folder level, or collection level. Child requests inherit from their parent. Override at any level. reqit never hardcodes tokens into your request files unless you explicitly save them.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-mock-server",
    title: "mock servers for frontend development",
    description: "Frontend developers should not wait for backends. reqit has a built-in mock server: save a response, start the server, point your frontend at localhost:4321.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "mock", "testing"],
    category: "Tutorials & use-cases",
    content: `Frontend developers should not wait for backends. Every hour spent mocking data by hand is an hour not spent shipping features. reqit has a built-in mock server: save a response, start the server, point your frontend at \`localhost:4321\`.

## save for mock

Send a real request. When the response comes back, click "Save for Mock." reqit stores the response body, status code, headers, and route pattern. The mock server replays it on the matching URL.

## route matching

The mock server matches routes by path and method. \`/users/:id\` matches \`/users/123\`, \`/users/456\`, any value. You save one response and it handles every variation. Query parameters are ignored by default, which is what you want for most mock scenarios.

## delay and error injection

Add a delay to simulate slow networks. Override the status code to test error handling. Change the response body to test edge cases. All configured per-route. Your frontend code sees real HTTP responses, not hardcoded data.

## a real frontend talking to it

Your React app is configured to hit \`http://localhost:4321\` during development. A fetch call to \`/api/users/123\` returns the mock data instantly. No backend needed. No \`useEffect\` with fake data. No hardcoded JSON in your components. When the real backend is ready, you change one environment variable and the app talks to the real server.

## what you control

- Response status code (200, 404, 500, whatever you need)
- Response body (the exact JSON you want)
- Response headers (including CORS)
- Response delay (100ms, 2s, whatever simulates your scenario)
- Route parameters (dynamic path segments)

The mock server runs on \`localhost:4321\` with CORS enabled by default. Your frontend, your tests, and your Storybook stories can all talk to it. Switching to the real backend is one environment variable change.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-runner",
    title: "collection runner and assertions",
    description: "Manual testing does not scale. The collection runner executes every request, runs your assertions, and gives you a pass/fail report.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "runner", "testing"],
    category: "Tutorials & use-cases",
    content: `Manual testing does not scale. You send 20 requests by hand, check each response, and miss the one that returned a 400. The collection runner executes every request in a collection, runs your assertions, and gives you a pass/fail report. This is how you turn a list of requests into a test suite.

## assertions

Each request can have multiple assertions. Check the status code, response time, specific fields in the body, headers, or custom conditions. If any assertion fails, the request is marked as failed. Assertions run automatically during a collection run.

## parallel vs sequential

Sequential mode fires requests one after another. Use this when request B depends on the output of request A. Parallel mode fires multiple requests simultaneously. Use this when you want to test throughput or when requests are independent.

## the report

After a run, you get a summary: total requests, passed, failed, total time. Each request shows its status code, response time, and assertion results. Export the report as JSON or HTML to share with your team.

## a real CLI command

\`\`\`bash
reqit run smoke-tests --env staging --report json
\`\`\`

Output:

\`\`\`
POST /login ............... ✓ 200 (120ms)
GET /users ................ ✓ 200 (85ms)
GET /users/123 ............ ✓ 200 (90ms)
POST /orders .............. ✓ 201 (210ms)
GET /orders/456 ........... ✗ 404 (45ms) — expected 200
DELETE /orders/456 ........ ✓ 204 (110ms)

5/6 passed (83%)
Exit code: 1
\`\`\`

The runner exits with code 0 if all pass, code 1 if any fail. Drop this into a CI pipeline and every push validates your API automatically. No separate test framework. No YAML config files. Just your existing collections and assertions.

## what this replaces

K6 for basic load testing. Postman's collection runner. Custom curl scripts in your CI pipeline. The runner is built into reqit, runs from the CLI, and uses the same collections you already have.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-git",
    title: "git integration",
    description: "API collections should version like code. If you can diff it, branch it, and review it in a PR, you will catch breaking changes before production.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "git", "collaboration"],
    category: "Technical deep-dives",
    content: `API collections should version like code. If you can diff it, branch it, and review it in a PR, you will catch API breaking changes before they reach production. reqit stores collections as JSON files, which means every git workflow you already use works on your API definitions.

## file format

Each request is a \`.json\` file. Each collection is a directory. The \`.reqit/\` folder lives at your project root. Commit it to git. Push it. Pull it. The same repo that holds your code holds your API definitions.

## diffs

\`\`\`diff
diff --git a/.reqit/collections/payment/charge.json b/.reqit/collections/payment/charge.json
--- a/.reqit/collections/payment/charge.json
+++ b/.reqit/collections/payment/charge.json
@@ -8 +8 @@
-    "url": "{{BASE_URL}}/v1/charge",
+    "url": "{{BASE_URL}}/v2/charge",
     "method": "POST"
@@ -15 +15 @@
-      "Content-Type": "application/json"
+      "Content-Type": "application/json",
+      "X-Api-Version": "2"
\`\`\`

A developer bumps the payment endpoint from v1 to v2 and adds a version header. The diff shows exactly what changed. The PR reviewer sees the API change alongside the code change. No separate Postman workspace to sync. No Slack message saying "hey the API changed."

## branching

Feature branches carry their own collections. You add new endpoints for a feature, commit them to the branch, and merge when the feature ships. The main branch always has the current, tested collection. No stale requests. No orphaned collections from abandoned features.

## PR reviews

When you open a pull request, the collection changes appear in the diff. Your reviewer can see that you added a new endpoint, changed a request body, or updated auth configuration. API changes get the same scrutiny as code changes.

## sync without a cloud

Push to GitHub. Pull on another machine. No account. No cloud service. No subscription. Your collections travel with your code because they are part of your code.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-websocket",
    title: "websocket testing in reqit",
    description: "HTTP is not enough for real-time apps. reqit has a built-in WebSocket client for testing persistent connections.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "websocket", "realtime"],
    category: "Tutorials & use-cases",
    content: `HTTP is not enough for real-time apps. Chat, live dashboards, collaborative editing, stock tickers, multiplayer games. These need persistent connections where both sides can send data at any time. reqit has a built-in WebSocket client for testing these connections.

## connection lifecycle

Type a WebSocket URL (\`ws://\` or \`wss://\`), click Connect. The connection stays open. You can send messages and receive them in real time. The connection state is visible: connected, disconnected, or error. Close the connection explicitly or let the server drop it.

## message logging

Every message is logged with a timestamp and direction indicator. You see what you sent, what the server sent, and the exact order. Messages are formatted as JSON when possible, raw text otherwise. The log is searchable and exportable.

## a real WebSocket session

\`\`\`
→ CONNECT wss://api.example.com/ws
← Connection opened

→ {"type": "subscribe", "channel": "orders"}
← {"type": "subscribed", "channel": "orders"}

→ {"type": "ping"}
← {"type": "pong"}

← {"type": "order_update", "id": "ord_123", "status": "shipped"}
← {"type": "order_update", "id": "ord_456", "status": "processing"}
\`\`\`

You see the subscription handshake, the keepalive ping/pong, and the live order updates as they arrive. Timestamps on every line. Direction arrows so you know who said what.

## SSE support

Server-Sent Events are the simpler cousin of WebSocket. The server pushes data to you over a regular HTTP connection. You cannot send messages back (use HTTP for that). reqit supports SSE connections with the same logging and formatting as WebSocket.

## why this matters

Most API tools treat WebSocket as an afterthought. You end up using wscat, a browser console, or a custom script. reqit puts WebSocket in the same tool where you test your REST APIs. Same collections, same history, same git integration. One tool for all your protocols.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-graphql",
    title: "graphql support in reqit",
    description: "REST overfetching is a real problem. reqit has a built-in GraphQL editor with syntax highlighting, variable support, and schema introspection.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "graphql", "api"],
    category: "Tutorials & use-cases",
    content: `REST overfetching is a real problem. You request a user profile and get 50 fields when you need 3. GraphQL fixes this by letting you specify exactly what you want. reqit has a built-in GraphQL editor with syntax highlighting, variable support, and schema introspection.

## query builder

Write your query in the GraphQL tab. reqit provides autocomplete based on the schema (if you have linked one). The editor validates syntax before you send. No sending malformed queries to the server.

## variables

Define variables in the Variables tab as JSON. Reference them in your query with \`$variableName\`. This is the same pattern as GraphQL variables in production code. reqit substitutes them before sending.

## schema introspection

If the server supports introspection, reqit can fetch the schema and use it for autocomplete and validation. Click "Introspect Schema" and reqit queries the server's \`__schema\` field. The schema is cached locally and used for all subsequent queries.

## a real GraphQL query

\`\`\`graphql
query GetUser($id: ID!) {
  user(id: $id) {
    name
    email
    posts(last: 3) {
      title
      createdAt
    }
  }
}
\`\`\`

Variables:

\`\`\`json
{
  "id": "123"
}
\`\`\`

Response:

\`\`\`json
{
  "data": {
    "user": {
      "name": "Alice",
      "email": "alice@example.com",
      "posts": [
        {"title": "Building APIs", "createdAt": "2026-06-20"},
        {"title": "GraphQL in Practice", "createdAt": "2026-06-15"},
        {"title": "Testing Strategies", "createdAt": "2026-06-10"}
      ]
    }
  }
}
\`\`\`

One query. Exactly the fields you need. No overfetching.

## subscriptions

GraphQL subscriptions use WebSocket for real-time data. reqit supports subscriptions with the same connection lifecycle as regular WebSocket testing. Subscribe to a channel, see events arrive in real time.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-scripting",
    title: "pre/post scripts and variable chaining",
    description: "Manual setup and teardown is error-prone. reqit scripting runs JavaScript before and after every request.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "scripts", "automation"],
    category: "Technical deep-dives",
    content: `Manual setup and teardown is error-prone. You forget to generate a fresh token, skip the cleanup step, or hardcode a value that breaks in a different environment. reqit scripting runs JavaScript before and after every request, giving you full control over the request lifecycle.

## pre-request scripts

Run code before the request is sent. Generate a timestamp, compute a hash, set dynamic headers, or pull a value from another source. The script has access to \`variables\` for reading and writing environment values.

\`\`\`javascript
const timestamp = Date.now();
variables.set("REQUEST_ID", \`req_\${timestamp}\`);
variables.set("X-Request-Time", new Date().toISOString());
\`\`\`

The request now includes \`X-Request-Time\` as a header. You did not type it manually. You did not forget it.

## post-response scripts

Run code after the response arrives. Extract a value from the response body and store it as a variable for the next request. Check a condition and fail the test if it is not met.

\`\`\`javascript
const body = response.json();
variables.set("USER_ID", body.id);
variables.set("AUTH_TOKEN", body.token);

if (body.token === undefined) {
  throw new Error("Login did not return a token");
}
\`\`\`

## variable chaining

This is where scripting becomes powerful. Request A logs in, the post-response script extracts the token. Request B creates a user, the post-response script extracts the user ID. Request C uses that user ID. Each step feeds the next automatically.

\`\`\`javascript
// Request A: POST /login
// Post-response script:
const login = response.json();
variables.set("TOKEN", login.token);

// Request B: GET /users/{{USER_ID}}
// (USER_ID was set by a previous script)
\`\`\`

No copy-pasting tokens between requests. No manual data flow. The scripts handle it.

## what you can do

- Generate random data for test uniqueness
- Compute HMAC signatures for protected endpoints
- Parse complex response structures
- Chain multi-step workflows (login → create → verify → delete)
- Set conditional assertions based on response content

reqit uses the goja JavaScript engine. Standard JS syntax. No special API to learn. If you can write it in Node, you can write it in reqit scripts.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-workspaces",
    title: "workspace isolation",
    description: "Mixing projects is how accidents happen. Workspaces in reqit isolate everything: collections, environments, history, cookies, and vault secrets.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "workspaces", "organization"],
    category: "Technical deep-dives",
    content: `Mixing projects is how accidents happen. A test token from Project A leaks into a production request for Project B. Environments bleed across boundaries. Workspaces in reqit isolate everything: collections, environments, history, cookies, and vault secrets.

## workspace isolation

Each workspace is a separate directory on disk. It has its own \`.reqit/\` folder with its own collections, environments, and history. Switching workspaces swaps the entire context. Nothing from one workspace is visible in another.

## file watcher

reqit watches the workspace directory for external changes. If you edit a JSON file in VS Code, reqit detects the change and reloads it. No manual refresh. No restart. Changes from git pull, file edits, or team members sync automatically.

## switching

Open the workspace panel, click a workspace, done. Everything changes: sidebar, collections, environments, history. Each workspace remembers its own state independently.

## directory structure

\`\`\`
projects/
├── pizza-palace/
│   └── .reqit/
│       ├── collections/
│       │   ├── customer/
│       │   └── admin/
│       └── environments/
│           ├── dev.json
│           └── prod.json
├── weather-now/
│   └── .reqit/
│       ├── collections/
│       │   ├── forecast/
│       │   └── alerts/
│       └── environments/
│           ├── dev.json
│           └── prod.json
└── task-robot/
    └── .reqit/
        ├── collections/
        │   ├── tasks/
        │   └── users/
        └── environments/
            ├── local.json
            └── prod.json
\`\`\`

Each project is a workspace. Each workspace is a folder. Back it up, sync it with Dropbox, or open it from any machine. No accounts. No cloud. Just files.

## when to use workspaces

Separate clients. Separate products. Separate environments that should never mix. Personal vs work projects. Any situation where you need a clean boundary between unrelated API sets.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-import-export",
    title: "import and export formats",
    description: "Vendor lock-in is the enemy. reqit imports from every major API client and exports to standard formats.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "import", "export"],
    category: "Tutorials & use-cases",
    content: `Vendor lock-in is the enemy. If you cannot move your collections out of a tool, you are trapped. reqit imports from every major API client and exports to standard formats. Your data comes in, your data goes out. Always.

## supported formats

**Import:** Postman v2.1, Insomnia, Hoppscotch, OpenAPI (YAML/JSON), cURL commands, Postman environments.

**Export:** Postman, Insomnia, Hoppscotch, OpenAPI JSON, OpenAPI HTML (self-contained Swagger UI), cURL, Markdown documentation, JavaScript fetch, Python requests code snippets.

## what maps 1:1

Postman collections map cleanly: requests, folders, headers, auth methods, and body formats all transfer. OpenAPI specs map to collections with full endpoint coverage. cURL commands parse into single requests with headers, body, and method intact.

## what does not

Postman scripts (\`pm.*\` pre-request and test scripts) are imported as comments for manual review. reqit uses standard JavaScript, not the Postman sandbox. You will need to rewrite scripts, but the logic transfers. Postman environments import separately through the environment manager.

## a real Postman import

Export from Postman: File > Export > Collection v2.1. You get a \`.json\` file. Open reqit, click Import, select the file. Every request, folder, header, and auth method appears in your sidebar. No account required. No cloud upload. The entire import runs locally.

## the philosophy

No tool should own your data. reqit stores everything as JSON files on disk. You can always read them with \`cat\`, parse them with \`jq\`, or open them in any text editor. Import and export are just convenience features around a format that is already open and documented.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-contract-testing",
    title: "contract testing with openapi",
    description: "API specs lie without enforcement. reqit links an OpenAPI spec to a collection and validates every response against it.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "contract-testing", "testing"],
    category: "Technical deep-dives",
    content: `API specs lie without enforcement. Your OpenAPI file says \`GET /users\` returns \`{ id, name, email }\`. The real API returns \`{ userId, username, mail }\`. The spec is documentation. Contract testing is verification. reqit links an OpenAPI spec to a collection and validates every response against it.

## spec linking

Right-click a collection, click "Link OpenAPI Spec," paste the URL. reqit downloads the spec, caches it locally, and validates every request in that collection against it. Unlink when you want to stop validation.

## validation

After each request, reqit checks: does the status code match one of the spec's declared codes? Does the response body match the schema? Are required fields present? Missing or extra fields are flagged. Type mismatches are flagged.

## violation reporting

The status bar shows a badge: "Contract OK" or "3 violations." Click the badge for details. You see exactly which field is missing, which type is wrong, and which status code was unexpected.

## a real contract test failure

\`\`\`
POST /api/orders
Spec says: 201, body has { id: string, total: number }
Actual:    201, body has { order_id: string, total: string }

Violations:
  ✗ Field "id" missing — spec expects $.id
  ✗ Field "order_id" unexpected — not in spec
  ✗ Field "total" type mismatch — spec expects number, got string
\`\`\`

Three violations. One request. You find the breaking change in 3 seconds instead of discovering it in production when the frontend crashes.

## when to use it

Every time you have an OpenAPI spec and a running API. Every time the backend and frontend are developed by different teams. Every time you want to catch breaking changes before they reach users. Contract testing is cheap insurance against API drift.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-history",
    title: "request history and replay",
    description: "You will forget that perfect request. History tracks every request you send and lets you replay it with one click.",
    date: "2026-06-15",
    readTime: "2 min read",
    tags: ["explainer", "history", "beginner"],
    category: "Technical deep-dives",
    content: `You will forget that perfect request. The exact header combination, the specific body structure, the auth token that worked. Without history, you rebuild it from memory. With history, you click one entry and everything is restored.

## what is tracked

Every request you send is logged: URL, method, headers, body, response status, response body, response time, and timestamp. The log is automatic. You do not have to remember to save.

## search

Filter history by URL pattern, HTTP method, or date range. Find that GET request from last Tuesday that returned the data shape you need. No scrolling through hundreds of entries.

## replay

Click a history entry. It opens in a new tab with every detail restored. URL, method, headers, body, auth. Click send. You are back where you were.

## favorites

Mark important requests as favorites. They appear in a separate list for quick access. The endpoint you test every morning. The request you use to verify the deployment. Pin it and find it instantly.

## a real history lookup

Last Thursday you spent 20 minutes crafting a payment request with a specific idempotency key, a custom header, and a complex body. It worked. Today you need to test the same endpoint again. Open history, scroll to Thursday, find the POST to \`/api/payments\`, click it. Everything is there. 3 seconds instead of 20 minutes.

## what this replaces

Sticky notes with curl commands. Slack messages to yourself. Browser bookmarks of API URLs. Screenshot of a request body. History is automatic, searchable, and complete.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-codegen",
    title: "code generation from requests",
    description: "Copy-pasting from reqit to your codebase is error-prone. Code generation takes the exact request you tested and produces ready-to-use code.",
    date: "2026-06-15",
    readTime: "2 min read",
    tags: ["explainer", "codegen", "developer-experience"],
    category: "Tutorials & use-cases",
    content: `Copy-pasting from reqit to your codebase is error-prone. You forget a header, mistype a URL, or miss a field in the body. Code generation takes the exact request you tested and produces ready-to-use code in your language. The generated code matches what you verified in the tool.

## supported languages

- **cURL** — paste into any terminal
- **JavaScript fetch** — for web apps, Node.js, any JS project
- **Python requests** — for scripts, data science, backend code

## variable substitution

If your request uses \`{{BASE_URL}}\` or \`{{TOKEN}}\`, the generated code uses the same variable names. You replace them with your actual values in your codebase. No hardcoded URLs in your source.

## generated code for a real request

reqit request: \`POST https://api.example.com/users\` with JSON body \`{ "name": "Alice", "email": "alice@example.com" }\` and Bearer auth.

**JavaScript fetch:**

\`\`\`javascript
fetch('https://api.example.com/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer {{TOKEN}}'
  },
  body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' })
})
\`\`\`

**Python requests:**

\`\`\`python
import requests

requests.post(
    'https://api.example.com/users',
    json={'name': 'Alice', 'email': 'alice@example.com'},
    headers={'Authorization': 'Bearer {{TOKEN}}'}
)
\`\`\`

## why this is better than manual

You tested the request in reqit. You know it works. The generated code is a direct translation. No typos. No forgotten headers. No mismatched JSON keys. Copy, paste, ship.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-shortcuts",
    title: "keyboard shortcuts and command palette",
    description: "Every mouse click is a context switch. Keyboard shortcuts keep you in the flow.",
    date: "2026-06-15",
    readTime: "2 min read",
    tags: ["explainer", "shortcuts", "productivity"],
    category: "Tutorials & use-cases",
    content: `Every mouse click is a context switch. You move your hand to the mouse, scan for the button, click it, move your hand back. Multiply that by 200 requests a day and you lose an hour to navigation. Keyboard shortcuts keep you in the flow.

## the essential shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Enter | Send request |
| Ctrl+S | Save request |
| Ctrl+T | New tab |
| Ctrl+W | Close tab |
| Ctrl+E | Focus URL bar |
| Ctrl+K | Command palette |
| Ctrl+Z | Undo |

## the command palette

Press Ctrl+K. A search box appears. Type what you want to do: "import," "save," "settings," "theme," "mock server." Every feature of reqit is searchable. You do not need to remember where a button is. You type the action and press Enter.

## a real workflow

Open reqit. Ctrl+K, type "import," press Enter. Select your Postman export. Collections appear. Ctrl+T opens a new tab. Type a URL. Ctrl+Enter sends the request. Inspect the response. Ctrl+S saves it. No mouse movement. No scanning for buttons. Just keys.

## the principle

Learn one new shortcut per day. In two weeks, the shortcuts are muscle memory. You stop thinking about the tool and start thinking about the API you are testing. That is the goal. The tool disappears and only the work remains.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-grpc",
    title: "grpc for high-throughput microservices",
    description: "REST works for most public APIs. It does not work well for high-throughput internal communication between microservices.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "grpc", "protocol"],
    category: "Tutorials & use-cases",
    content: `REST works for most public APIs. It does not work well for high-throughput internal communication between microservices. JSON parsing at scale burns CPU cycles. Text-based protocols waste bandwidth. HTTP/1.1 connection overhead adds latency at thousands of requests per second.

gRPC solves these problems with a binary protocol, HTTP/2 multiplexing, and strict schema enforcement via Protocol Buffers. Google, Netflix, Uber, and Square use it for service-to-service communication.

## how it differs from REST

REST sends JSON over HTTP/1.1. Each request opens a connection (or reuses one with keep-alive). The server parses JSON text on every call.

gRPC sends binary-encoded Protocol Buffers over HTTP/2. Connections are multiplexed (multiple requests on one connection). The schema is defined in a \`.proto\` file. The client and server both know the structure at compile time.

\`\`\`
REST/JSON:   ~1KB per message, text parsing, connection overhead
gRPC:        ~200B per message, binary unpacking, multiplexed
\`\`\`

## when to use gRPC

- Internal microservice communication
- High-throughput, low-latency requirements
- Streaming data (server, client, or bidirectional)
- When you control both client and server
- Polyglot environments (gRPC generates clients in 10+ languages)

## when to use REST instead

- Browser-facing APIs (browsers do not support gRPC natively)
- Public APIs that need to be easy to integrate
- When human readability of wire format matters

## proof: a comparison

\`\`\`
# REST: 50 services, 1M messages/sec
JSON parsing CPU: 30%
Bandwidth: 1GB/sec
Latency p99: 45ms

# gRPC: same workload
Protobuf parsing CPU: 5%
Bandwidth: 200MB/sec
Latency p99: 12ms
\`\`\`

reqit supports gRPC natively. Import a \`.proto\` file, select a method, fill the request message, and send. The response comes back decoded and formatted. Same tool, same collections, two protocols.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-api-designer",
    title: "design-first api development",
    description: "Designing an API after writing the backend code guarantees misalignment. Design-first means writing an OpenAPI spec before code.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "api-design", "openapi"],
    category: "Technical deep-dives",
    content: `Designing an API after writing the backend code guarantees misalignment. The frontend team guesses at field names. The mobile team implements a different version. The QA team tests against outdated docs. Rework costs more than planning.

Design-first means writing an OpenAPI spec before writing code. Every team reviews the contract. Frontend and backend implement the same spec in parallel. Breaking changes show up in the spec, not in production.

## what the API designer does

The API designer in reqit lets you create and edit OpenAPI specs visually. No YAML editing. No schema memorization.

1. Create a new spec with name and version
2. Add endpoints: path, method, description
3. Define parameters: path, query, header, body
4. Describe responses: status codes, schemas, examples
5. Push to SwaggerHub or Stoplight for team review

## a real spec being created

\`\`\`
POST /api/users
  Description: Create a new user account
  Request body:
    name: string (required)
    email: string (required, format: email)
    role: enum [admin, member] (optional, default: member)
  Responses:
    201: User object with id
    409: Email already exists
    422: Validation error

GET /api/users/{id}
  Description: Get a user by ID
  Path params: id (string, required)
  Responses:
    200: User object
    404: User not found
\`\`\`

## team alignment

The spec becomes the single source of truth. Frontend builds screens against the spec. Backend implements the spec. QA writes tests against the spec. When the spec changes, everyone sees the diff in a pull request.

\`\`\`diff
- role: string (optional)
+ role: enum [admin, member] (optional, default: member)
\`\`\`

The change is visible. The team discusses it. Nobody discovers it in production.

## proof: design-first in practice

Without design-first: the backend names a field \`user_email\`, the frontend expects \`email\`, the mobile team uses \`emailAddress\`. Three implementations, three field names, one broken integration.

With design-first: the spec defines \`email\`. All three teams implement the same field. The contract test validates it.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-cookies",
    title: "automatic cookie management",
    description: "Most APIs use cookies for session management. Without automatic cookie handling, you manually extract Set-Cookie headers every time.",
    date: "2026-06-15",
    readTime: "2 min read",
    tags: ["explainer", "cookies", "beginner"],
    category: "Technical deep-dives",
    content: `Most APIs use cookies for session management. You authenticate, the server sends a session cookie, and every subsequent request needs that cookie. Without automatic cookie handling, you manually extract Set-Cookie headers, copy values, and paste them into the next request. Tedious, error-prone, and impossible to scale across a collection.

reqit's cookie jar automates this. Store cookies from responses. Send them back on subsequent requests. Clear them when needed.

## how cookies work

1. You send \`POST /login\` with credentials
2. Server responds with \`Set-Cookie: session=abc123; Path=/; HttpOnly\`
3. reqit stores the cookie automatically
4. Your next request to the same domain sends \`Cookie: session=abc123\`
5. The server recognizes your session

No manual extraction. No copy-paste. reqit handles the same flow a browser handles.

## a real login flow

\`\`\`
→ POST https://api.example.com/auth/login
  Body: {"email": "dev@example.com", "password": "secret"}

← 200 OK
  Set-Cookie: session_id=xK9mP2qL; Path=/; HttpOnly; Secure

→ GET https://api.example.com/api/profile
  Cookie: session_id=xK9mP2qL

← 200 OK
  {"id": 42, "name": "Alice", "email": "alice@example.com"}
\`\`\`

The second request includes the session cookie without you doing anything.

## cookie management

- **Per-domain storage:** cookies are scoped to the domain that set them
- **Auto-replay:** cookies send on matching requests automatically
- **Clear per domain:** wipe cookies for a specific domain
- **Clear all:** wipe every stored cookie
- **View all attributes:** name, value, domain, path, expiry, secure, httponly

## proof: the difference

Without cookie jar:

\`\`\`
# Manual: extract, copy, paste, repeat
POST /login → extract Set-Cookie → copy session_id
GET /profile → paste Cookie header → hope you copied it right
\`\`\`

With cookie jar:

\`\`\`
# Automatic
POST /login → cookie stored
GET /profile → cookie sent
\`\`\`

Session management is solved. Move on to the actual API logic.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-load-testing",
    title: "load testing your api",
    description: "Your API handles 10 requests per second in development. On launch day it gets 500. Load testing finds bottlenecks before your users do.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "load-testing", "performance"],
    category: "Tutorials & use-cases",
    content: `Your API handles 10 requests per second in development. On launch day it gets 500. The database query that takes 20ms with one user takes 3 seconds with 200 concurrent users. Connection pools exhaust. Memory spikes. The server returns 503s. You find out your API cannot handle load when your users discover it.

Load testing simulates concurrent traffic before real users hit the endpoint. You find bottlenecks in a controlled environment, not during an outage.

## how it works

reqit's load test sends requests repeatedly with configurable concurrency:

- **Virtual Users (VUs):** how many concurrent clients
- **Duration:** how long to sustain the load
- **Request:** which request to fire (any request from your collection)

The tool measures response time, throughput, and error rate throughout the test.

## metrics

- **Response time:** average, min, max
- **Throughput:** requests per second
- **Error rate:** percentage of failed requests
- **Latency percentiles:** p50, p95, p99 (the slowest 1% matters most)

## proof: real results

\`\`\`
reqit load-test --request "GET /api/products" --vus 50 --duration 30s

Results:
  Total requests:  12,450
  Throughput:      415 req/sec
  Error rate:      0.2%

  Response time:
    p50:  120ms
    p95:  340ms
    p99:  890ms
    avg:  156ms
    min:  45ms
    max: 1,200ms
\`\`\`

At 50 VUs, p99 hits 890ms. That is acceptable. At 100 VUs, p99 jumps to 3.2s and error rate climbs to 8%. Your database needs an index. You find this before launch day.

No separate tool. No k6 scripts. No JMeter config files. You pick the request you already tested, set VUs and duration, and run.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-telemetry",
    title: "privacy and zero telemetry",
    description: "Most developer tools phone home. reqit sends nothing by default. Zero telemetry. Zero network calls on startup.",
    date: "2026-06-15",
    readTime: "2 min read",
    tags: ["explainer", "privacy", "philosophy"],
    category: "Technical deep-dives",
    content: `Most developer tools phone home. They track feature usage, error rates, performance metrics, and sometimes your data. Postman requires an account and syncs collections to their cloud. Insomnia sends analytics. You do not always know what gets sent or where it goes.

reqit sends nothing by default. Zero telemetry. Zero network calls on startup. The app works fully offline.

## what telemetry would include if you turned it on

- Which features you use (import, run collection, mock server)
- App performance (startup time, memory usage)
- Errors and crash reports

## what it never includes

- Your API requests or responses
- Your environment variables or tokens
- Your collections or data
- Your name, email, or personal information
- Your IP address or location

## air-gap mode

For high-security environments (finance, healthcare, government), reqit has an air-gap mode. Disable telemetry, the interceptor proxy, plugin downloads, update checks, SSO, and vault network access. In air-gap mode, reqit makes zero outbound network requests.

\`\`\`
Settings
├── Privacy
│   ├── Telemetry: ○ Off (default)
│   ├── Air-Gap Mode: ○ Off / ● On
│   ├── Interceptor: ● On / ○ Off
│   └── Update Checks: ● On / ○ Off
\`\`\`

## proof: the settings path

Settings > Privacy. Telemetry is off by default. Air-gap mode is a single toggle. You can verify the setting in 3 seconds.

Your data stays on your machine. That is the point.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-cli",
    title: "cli mode for automation",
    description: "Clicking through a UI to run API tests does not scale. CLI mode runs your collections from the terminal.",
    date: "2026-06-16",
    readTime: "3 min read",
    tags: ["explainer", "cli", "automation"],
    category: "Tutorials & use-cases",
    content: `Clicking through a UI to run API tests does not scale. You have 50 endpoints. You run them manually before each deploy. It takes 15 minutes. You miss one. It breaks in production.

CLI mode runs your collections from the terminal. One command executes every request, evaluates assertions, and gives you a pass/fail report. Drop it in a CI pipeline and every push validates your API.

## the command

\`\`\`
reqit run smoke-tests --env staging --report json
\`\`\`

- \`smoke-tests\`: the collection to run
- \`--env staging\`: which environment to use
- \`--report json\`: output results as JSON

## output

\`\`\`
POST /auth/login ............. ✓ 200 (120ms)
GET /users ................... ✓ 200 (85ms)
GET /users/123 ............... ✓ 200 (90ms)
POST /orders .................. ✓ 201 (210ms)
GET /orders/999 .............. ✗ 404 (45ms) — expected 200
DELETE /orders/999 ........... ✓ 204 (80ms)

5/6 passed (83%)
Exit code: 1
\`\`\`

## exit codes

- **0:** all assertions passed
- **1:** at least one failed

Your CI pipeline uses these codes to pass or fail the build. The deploy happens only when all tests pass.

## CI integration

\`\`\`yaml
# GitHub Actions
- run: reqit run smoke-tests --env staging

# GitLab CI
script:
  - reqit run smoke-tests --env staging
\`\`\`

## proof: the value

Manual testing before a deploy: 15 minutes, human error, inconsistent coverage. CLI testing: 3 seconds, deterministic, same coverage every run.

The UI is for building requests. The CLI is for running them at scale.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-interceptor",
    title: "browser traffic capture",
    description: "Debugging browser API calls without capturing them is like trying to diagnose a network issue without packet capture.",
    date: "2026-06-16",
    readTime: "3 min read",
    tags: ["explainer", "interceptor", "capture"],
    category: "Technical deep-dives",
    content: `Debugging browser API calls without capturing them is like trying to diagnose a network issue without packet capture. You see the UI error, but you never see the actual request your browser sent or the real response the server returned.

Modern SPAs make dozens of API calls per page load. When one fails or returns unexpected data, the browser console gives you almost nothing useful. DevTools network tab helps, but you cannot replay requests, modify headers, or save them to a collection without manual effort.

## setup

Install the reqit Interceptor extension from the Chrome Web Store. Open reqit, check Settings for the proxy port (default 127.0.0.1:3100). Click the extension icon, enter the port, click Connect.

The extension tunnels all browser HTTP traffic through reqit's local proxy. No cloud. No external server. Everything stays on 127.0.0.1.

## what gets captured

Every HTTP request your browser makes: method, URL, headers, query parameters, request body, response status, response body, and timing. The interceptor captures GET, POST, PUT, PATCH, DELETE, OPTIONS, and HEAD. WebSocket and SSE traffic are not captured (use the built-in WebSocket client for those).

Requests appear in reqit's history panel with a browser icon indicating the source tab. You can send any captured request directly to a collection.

## privacy

All traffic routes to localhost only. The extension does not make external network calls. reqit does not log captured requests to disk unless you explicitly save them. The proxy runs only while reqit is open.

## proof: a real captured request

A captured POST to a login endpoint:

\`\`\`
POST https://api.example.com/v1/auth/login
Content-Type: application/json
Accept: application/json

{
  "email": "dev@example.com",
  "password": "••••••••"
}
\`\`\`

Response:

\`\`\`
HTTP/1.1 200 OK
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "expires_in": 3600
}
\`\`\`

You see the exact wire format. No guessing what the frontend actually sent.

Browser API debugging without the interceptor means reading minified JavaScript to reconstruct requests. With it, you get the full picture in real time.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-cicd",
    title: "api testing in ci/cd pipelines",
    description: "API tests that only run manually do not catch regressions. Put them in your pipeline.",
    date: "2026-06-16",
    readTime: "3 min read",
    tags: ["explainer", "ci-cd", "automation", "testing"],
    category: "Tutorials & use-cases",
    content: `API tests that only run manually do not catch regressions. A developer changes a response field, merges to main, and the frontend breaks three hours later. Nobody ran the tests between the push and the deploy.

Continuous integration exists to catch exactly this. Your API collections already define what "working" means. Putting them in the pipeline makes that definition enforceable.

## the setup

reqit collections run from the CLI. One command executes every request, evaluates every assertion, and exits with code 0 (all pass) or code 1 (any fail). Your CI provider uses that exit code to pass or fail the build.

### GitHub Actions

\`\`\`yaml
name: API Tests
on: push
jobs:
  api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install reqit
        run: curl -fsSL https://get.reqit.dev/install.sh | sh
      - name: Run API tests
        run: reqit run smoke-tests --env staging --report junit
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: api-test-results
          path: report.xml
\`\`\`

### GitLab CI

\`\`\`yaml
api-tests:
  script:
    - reqit run smoke-tests --env staging --report json
  artifacts:
    when: always
    reports:
      junit: report.xml
\`\`\`

## exit codes and reports

Exit code 0 means every assertion passed. Exit code 1 means at least one failed. The pipeline fails on code 1, blocking the merge or deploy.

Add \`--report junit\` or \`--report json\` for machine-readable output. Upload the artifact to your CI dashboard. PRs show test results alongside code reviews.

## proof: real output

\`\`\`
reqit run smoke-tests --env staging

POST /auth/login ............. ✓ 200 (120ms)
GET /users ................... ✓ 200 (85ms)
GET /users/123 ............... ✓ 200 (90ms)
POST /orders .................. ✓ 201 (210ms)
GET /orders/999 .............. ✗ 404 (45ms) — expected 200

4/5 passed (80%)
Exit code: 1
\`\`\`

The failing request blocks the deploy. You find the broken endpoint before production does.

Manual API testing has a half-life. Automated pipeline testing does not.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-themes",
    title: "theme customization",
    description: "Tools you stare at for eight hours a day should not hurt your eyes. reqit offers Dark, Light, and System themes.",
    date: "2026-06-16",
    readTime: "2 min read",
    tags: ["explainer", "themes", "customization"],
    category: "Technical deep-dives",
    content: `Tools you stare at for eight hours a day should not hurt your eyes. Most API clients ship with one theme, maybe two. You adapt to the tool instead of the tool adapting to you.

Developer environments vary wildly. Dark offices, bright open floors, external monitors with different color profiles. One fixed theme does not work for everyone, and forcing light mode on someone working at midnight is a productivity tax.

## what reqit offers

Three modes: Dark, Light, and System. Dark uses a deep charcoal background with white text and cyan accents. Light flips it: white background, dark text, same accents. System watches your OS theme and switches automatically.

## what changes

Background, text, borders, sidebar, code editor syntax colors, status indicators, and accent highlights all update. The layout stays identical. No reflow, no flicker, no restart.

The code editor gets specific treatment: syntax highlighting adjusts for readability in both modes. JSON keys, strings, numbers, and booleans are color-coded consistently.

## where to find it

Settings > Theme. Pick Dark, Light, or System. The change is instant.

\`\`\`
Ctrl+K → type "theme" → Enter → pick your option
\`\`\`

## proof: the settings path

\`\`\`
Settings
├── General
├── Theme
│   ├── ● Dark
│   ├── ○ Light
│   └── ○ System
├── AI
├── Vault
└── ...
\`\`\`

Your eyes do not care about marketing. They care about contrast ratios and background luminance. Pick the theme that works for your environment and move on to the actual work.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-vault",
    title: "encrypted secrets storage",
    description: "API keys in environment files that get committed to git are a liability. The vault encrypts secrets at rest with AES-256.",
    date: "2026-06-16",
    readTime: "3 min read",
    tags: ["explainer", "vault", "security", "secrets"],
    category: "Technical deep-dives",
    content: `API keys in environment files that get committed to git are a liability. Every leaked key is a billing surprise waiting to happen. The 2024 Heroku and GitLab token leaks exposed thousands of repositories because developers stored secrets in plaintext config files.

reqit's vault encrypts secrets at rest using AES-256 with a master password you control. The encryption key never leaves your machine.

## before: plain text

Your environment file contains actual secrets:

\`\`\`
{
  "BASE_URL": "https://api.stripe.com",
  "STRIPE_KEY": "sk_live_REPLACE_WITH_YOUR_KEY",
  "SENDGRID_KEY": "SG.xxxxx.yyyyy"
}
\`\`\`

If this file gets committed, the keys are public. Even if you delete the commit, the keys remain in git history.

## after: vault references

The same file with vault references:

\`\`\`
{
  "BASE_URL": "https://api.stripe.com",
  "STRIPE_KEY": "{{VAULT_STRIPE_KEY}}",
  "SENDGRID_KEY": "{{VAULT_SENDGRID_KEY}}"
}
\`\`\`

The vault stores the actual values encrypted on disk. reqit decrypts them at request time only. The environment file is safe to commit because it contains no secrets.

## setup

1. Open Settings > Vault
2. Set a master password
3. Add key/value pairs
4. Reference them in any field with \`{{VAULT_KEY_NAME}}\`

The vault locks after 5 minutes of inactivity. It decrypts only when reqit sends a request and the vault is unlocked. Per-workspace isolation means project A's secrets are invisible to project B.

## proof: commit safety

\`\`\`diff
- "STRIPE_KEY": "sk_live_REPLACE_WITH_YOUR_KEY",
+ "STRIPE_KEY": "{{VAULT_STRIPE_KEY}}",
\`\`\`

Your git diff shows a variable reference, not a secret. The actual key lives encrypted on your disk, accessible only when you unlock the vault.

Plain text secrets are a debt. The vault makes that debt disappear.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-what-is-an-api",
    title: "what is an api",
    description: "Every app on your phone talks to an API. Most developers use APIs daily without thinking about the mechanics.",
    date: "2026-06-17",
    readTime: "4 min read",
    tags: ["explainer", "api", "fundamentals", "beginner"],
    category: "Philosophy & opinion",
    content: `Every app on your phone talks to an API. Weather data, payment processing, messaging, social feeds. The developer who built the weather widget never touched a weather station. They sent a request to an API and got structured data back.

Most developers use APIs daily without thinking about the mechanics. Understanding HTTP, methods, status codes, and JSON gives you the ability to debug, integrate, and build without depending on someone else to explain the plumbing.

## the request

An HTTP request has four parts: the URL (where to send it), the method (what to do), headers (metadata), and the body (data, mostly for POST/PUT/PATCH).

\`\`\`
GET https://api.weather.com/v1/current?city=lagos
Accept: application/json
Authorization: Bearer sk-xxxx
\`\`\`

GET reads data. POST creates. PUT replaces. PATCH updates partially. DELETE removes. The method tells the server what action you want.

## the response

The server replies with a status code and a body.

\`\`\`
HTTP/1.1 200 OK
Content-Type: application/json

{
  "city": "Lagos",
  "temp_c": 32,
  "humidity": 78,
  "condition": "partly_cloudy"
}
\`\`\`

200 means success. 201 means created. 400 means your request was malformed. 401 means unauthorized. 404 means not found. 500 means the server broke.

## JSON

APIs return data in JSON by default. It is human-readable, parseable by every language, and compact enough for network transport. Objects use \`{}\`, arrays use \`[]\`, key-value pairs use \`"key": value\`.

\`\`\`json
{
  "users": [
    {"id": 1, "name": "Alice"},
    {"id": 2, "name": "Bob"}
  ]
}
\`\`\`

## proof: a real cycle

\`\`\`
→ POST https://api.example.com/v1/users
  Content-Type: application/json
  {"name": "Alice", "email": "alice@example.com"}

← 201 Created
  {"id": 42, "name": "Alice", "email": "alice@example.com"}
\`\`\`

You sent a request, the server created a resource, and returned the result. That is an API call. Everything else is detail.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-http-methods",
    title: "http methods: get, post, put, patch, delete",
    description: "Using GET where you need POST corrupts data. Using POST where you need PUT creates duplicates. The wrong method breaks things silently.",
    date: "2026-06-17",
    readTime: "4 min read",
    tags: ["explainer", "http", "methods", "rest"],
    category: "Tutorials & use-cases",
    content: `Using GET where you need POST corrupts data. Using POST where you need PUT creates duplicates instead of updates. The wrong method does not always throw an error. It succeeds silently and breaks your data in ways you discover weeks later.

HTTP methods are the verbs of web APIs. Each one has a specific semantic meaning. Respecting those meanings makes your API predictable and your integrations reliable.

## GET

Read-only. Never mutates state. Safe to retry, safe to cache, safe to call from a browser address bar.

\`\`\`
GET /api/users/42
→ 200 OK, returns user object
\`\`\`

## POST

Creates a new resource. The server assigns the ID. Calling POST twice creates two resources.

\`\`\`
POST /api/users
Body: {"name": "Alice"}
→ 201 Created, returns new user with id: 43
\`\`\`

## PUT

Replaces the entire resource. If the resource does not exist, some servers create it. Calling PUT with the same body twice results in the same state.

\`\`\`
PUT /api/users/42
Body: {"name": "Alice", "email": "alice@new.com"}
→ 200 OK, user 42 is fully replaced
\`\`\`

## PATCH

Partial update. Send only the fields that changed. Everything else stays.

\`\`\`
PATCH /api/users/42
Body: {"email": "alice@new.com"}
→ 200 OK, only email changed
\`\`\`

## DELETE

Removes the resource. Calling it twice usually returns 404 the second time (the resource is already gone).

\`\`\`
DELETE /api/users/42
→ 204 No Content
\`\`\`

## idempotence

GET, PUT, DELETE, HEAD, and OPTIONS are idempotent. Calling them N times produces the same result as calling them once. POST and PATCH are not. Calling POST twice creates two resources.

| Method | Creates | Idempotent | Has body |
|--------|---------|------------|----------|
| GET | No | Yes | No |
| POST | Yes | No | Yes |
| PUT | Maybe | Yes | Yes |
| PATCH | No | No | Yes |
| DELETE | No | Yes | No |

## proof: method matters

\`\`\`
# Wrong: GET with a body (violates spec)
GET /api/search
Body: {"query": "reqit"}
→ 400 Bad Request on some servers

# Correct: POST for complex queries
POST /api/search
Body: {"query": "reqit"}
→ 200 OK, returns results
\`\`\`

The method is not decoration. It tells the server how to handle your request. Use the wrong one and you get silent data corruption, not an error.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-json-apis",
    title: "json fundamentals for api developers",
    description: "JSON is the default data format for APIs. Knowing the full structure lets you parse complex responses without regex.",
    date: "2026-06-17",
    readTime: "3 min read",
    tags: ["explainer", "json", "data", "beginner"],
    category: "Tutorials & use-cases",
    content: `JSON is the default data format for APIs. Every HTTP client, every server framework, every language has native JSON support. Yet most developers only scratch the surface beyond simple key-value pairs.

Knowing the full structure of JSON, including nesting, arrays, type constraints, and edge cases, lets you parse complex API responses without regex or string manipulation and build accurate test assertions.

## objects

Key-value pairs wrapped in braces:

\`\`\`json
{
  "name": "Alice",
  "age": 30,
  "active": true
}
\`\`\`

Keys must be strings. Values can be string, number, boolean, null, object, or array.

## arrays

Ordered lists in square brackets:

\`\`\`json
["go", "typescript", "python"]
\`\`\`

Arrays can contain objects:

\`\`\`json
[
  {"id": 1, "name": "Alice"},
  {"id": 2, "name": "Bob"}
]
\`\`\`

## nesting

Objects inside objects. Arrays inside objects. Objects inside arrays inside objects.

\`\`\`json
{
  "user": {
    "id": 42,
    "name": "Alice",
    "addresses": [
      {"type": "home", "city": "Lagos"},
      {"type": "work", "city": "Abuja"}
    ]
  }
}
\`\`\`

## types

| Type | Example | Notes |
|------|---------|-------|
| String | "hello" | Double quotes required |
| Number | 42 or 3.14 | No distinction between int and float |
| Boolean | true / false | Lowercase, no quotes |
| Null | null | Empty value |
| Array | [1, 2, 3] | Ordered, comma-separated |
| Object | {"k": "v"} | Key-value pairs |

## proof: a real API response

\`\`\`json
{
  "id": 12345,
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "isActive": true,
  "tags": ["premium", "developer"],
  "profile": {
    "bio": "Full-stack developer",
    "avatar": "https://example.com/avatars/12345.jpg"
  }
}
\`\`\`

reqit pretty-prints and color-codes JSON automatically. You scan keys, values, and structure at a glance instead of squinting at minified output.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-openapi-spec-linking",
    title: "linking openapi specs for contract testing",
    description: "An OpenAPI spec that nobody validates is documentation, not a contract. Link it to a collection and every response gets validated.",
    date: "2026-06-17",
    readTime: "3 min read",
    tags: ["explainer", "openapi", "spec", "contract-testing"],
    category: "Technical deep-dives",
    content: `An OpenAPI spec that nobody validates is documentation, not a contract. The spec says \`GET /users\` returns \`{ id, name, email }\`. The real API returns \`{ userId, username, mail }\`. The spec is stale. Nobody notices until the frontend crashes.

Contract testing compares your spec against real responses. Every request you send gets validated against the schema you defined. Violations show up immediately.

## linking a spec

1. Right-click a collection in reqit
2. Click the three dots (⋮)
3. Select "Link OpenAPI Spec"
4. Paste your spec URL (e.g., \`http://localhost:3000/openapi.json\`)
5. Press Enter

reqit downloads and caches the spec locally. Every request in that collection is now validated against it.

## what gets checked

- **Status code:** does the actual status match one of the spec's declared codes?
- **Response body:** does the JSON match the schema? Are required fields present? Are types correct?
- **Missing fields:** the spec says a field is required but the response omits it.
- **Extra fields:** the response contains a field not defined in the spec.

## violation reporting

The status bar shows a badge after each request. Green for compliant. Red with a count for violations. Click the badge for details.

\`\`\`
GET /api/users/123
Spec says: 200, body has { id: string, name: string, email: string }
Actual:    200, body has { userId: string, username: string }

Violations:
  ✗ Field "id" missing — spec expects $.id
  ✗ Field "name" missing — spec expects $.name
  ✗ Field "email" missing — spec expects $.email
  ✗ Field "userId" unexpected — not in spec
  ✗ Field "username" unexpected — not in spec
\`\`\`

## proof: real failure

\`\`\`
POST /api/orders
Spec says: 201, body has { id: string, total: number }
Actual:    201, body has { order_id: string, total: string }

Violations:
  ✗ Field "id" missing — spec expects $.id
  ✗ Field "order_id" unexpected — not in spec
  ✗ Field "total" type mismatch — spec expects number, got string
\`\`\`

Three violations from one request. You find the breaking change in seconds, not in production at 2 AM.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "what-is-reqit",
    title: "What is reqit? Everything you need to know",
    description: "reqit is a local-first, open-source API client that runs in under 400ms. No account. No cloud. No telemetry. Every feature explained with diagrams.",
    date: "2026-06-25",
    readTime: "18 min read",
    tags: ["overview", "features", "open-source", "api-client", "mcp", "agent-lens"],
    category: "Comparisons",
    content: `Every app on your phone talks to an API. When you check the weather, order food, or send a message, your phone sends a request to a server and gets data back. **reqit is a tool that lets you send those requests, test those APIs, and make sure they work — all from your computer.**

Think of it like a Swiss Army knife for APIs. One tool that does everything: send requests, test responses, mock servers, load testing, Git integration, AI integration, and a lot more. And it all runs on your machine. No account. No cloud. No data leaving your laptop.

## Why reqit exists

Most API tools today have the same problem: they want your money and your data.

Postman requires an account. It phones home on every launch. It stores your collections in their cloud. If they change their pricing (which they have, multiple times), you are stuck. Insomnia moved to cloud-first. Hoppscotch is browser-only. Every tool wants you to log in, sync to their servers, and trust them with your API keys.

reqit was built because a different approach is possible. A tool that starts in under 400ms, weighs under 20MB, stores everything as plain JSON files on your disk, and never requires an account, a cloud connection, or telemetry. You own your data. Always.

## The big picture

Here is everything reqit does, in one view:

\`\`\`
  ┌─────────────────────────────────────────────────────────────┐
  │                         reqit                               │
  │                                                             │
  │  ┌─────────────────────────────────────────────────────┐    │
  │  │                    CORE ENGINE                      │    │
  │  │  HTTP · WebSocket · SSE · GraphQL · gRPC · SOAP · MQTT│  │
  │  └───────────────────────┬─────────────────────────────┘    │
  │                          │                                  │
  │  ┌───────────┐  ┌───────┴──────┐  ┌──────────────────┐    │
  │  │ Collections│  │ Environments │  │ Scripting (JS)   │    │
  │  └───────────┘  └──────────────┘  └──────────────────┘    │
  │                                                             │
  │  ┌───────────┐  ┌──────────────┐  ┌──────────────────┐    │
  │  │ Mock       │  │ Runner       │  │ Load Testing     │    │
  │  │ Server     │  │ (assertions) │  │ (p50/p95/p99)    │    │
  │  └───────────┘  └──────────────┘  └──────────────────┘    │
  │                                                             │
  │  ┌───────────┐  ┌──────────────┐  ┌──────────────────┐    │
  │  │ Contract   │  │ Import/      │  │ CI/CD + CLI      │    │
  │  │ Testing    │  │ Export       │  │ Generation       │    │
  │  └───────────┘  └──────────────┘  └──────────────────┘    │
  │                                                             │
  │  ┌─────────────────────────────────────────────────────┐    │
  │  │              AI LAYER                               │    │
  │  │  MCP Server ◄──► AI Agents (Claude, GPT, Gemini)   │    │
  │  │  Agent Lens ──► Lint · Eval · Export                │    │
  │  └─────────────────────────────────────────────────────┘    │
  │                                                             │
  │  ┌─────────────────────────────────────────────────────┐    │
  │  │              PLATFORM                               │    │
  │  │  Git · Workspaces · History · Cookies · Themes      │    │
  │  │  OAuth2 · SSO · E2EE · Vault · RBAC · Audit Trail  │    │
  │  └─────────────────────────────────────────────────────┘    │
  └─────────────────────────────────────────────────────────────┘
\`\`\`

Now let us walk through every layer.

---

## Sending requests

This is what every API client does. You type a URL, pick a method, add headers, and hit Send. But reqit goes far beyond the basics.

\`\`\`
  ┌─────────────────────────────────────────────────────┐
  │                7 PROTOCOLS                          │
  │                                                     │
  │  ┌─────────┐  ┌───────────┐  ┌─────────────────┐  │
  │  │ HTTP/S  │  │ WebSocket │  │ SSE             │  │
  │  │ (REST)  │  │ (realtime)│  │ (server push)   │  │
  │  └─────────┘  └───────────┘  └─────────────────┘  │
  │                                                     │
  │  ┌─────────┐  ┌───────────┐  ┌─────────────────┐  │
  │  │ GraphQL │  │ gRPC      │  │ SOAP   │ MQTT   │  │
  │  │ (query) │  │ (binary)  │  │(enterprise)(IoT)│  │
  │  └─────────┘  └───────────┘  └─────────────────┘  │
  └─────────────────────────────────────────────────────┘
\`\`\`

- **HTTP/HTTPS** — the standard web protocol. GET data, POST new data, PUT updates, DELETE things. Every method, with full header and body control.
- **WebSocket** — a live two-way connection. Like a phone call instead of letters. Used for chat apps, live dashboards, multiplayer games.
- **Server-Sent Events (SSE)** — the server pushes updates to you. Like a news ticker. Used for AI streaming, stock prices, notifications.
- **GraphQL** — ask for exactly the data you want. One endpoint, flexible queries. Used by GitHub, Shopify, Airbnb.
- **gRPC** — fast binary protocol. Used for microservice-to-microservice communication. Google, Netflix, Square use this.
- **SOAP** — the old enterprise standard. Banks, government systems, healthcare APIs still use this.
- **MQTT** — lightweight protocol for IoT. Smart home devices, sensors, industrial machines use this.

Every request supports query parameters, headers, multiple body types (JSON, form-data, URL-encoded, raw text, GraphQL, gRPC, SOAP), and full authentication.

## Authentication

reqit handles **7 auth types** so you never have to manually add headers:

- **Bearer Token** — paste a JWT, reqit adds the Authorization header
- **Basic Auth** — username and password, auto-encoded to Base64
- **API Key** — custom header name + value
- **Digest Auth** — challenge-response for older APIs
- **NTLM** — Windows domain authentication
- **OAuth2** — full flow with PKCE support (the modern standard)
- **JWT Decoder** — paste any JWT, see the claims and expiry instantly

You never have to manually add auth headers. reqit handles it for every request.

---

## Collections

Collections are folders for your API requests. reqit organizes them as **plain JSON files** on your disk.

\`\`\`
  .reqit/
  ├── collections/
  │   ├── auth-api/
  │   │   ├── login.json
  │   │   └── refresh.json
  │   └── users-api/
  │       ├── list.json
  │       └── create.json
  └── environments/
      ├── dev.json
      └── prod.json
\`\`\`

This is a big deal because it means:

- You can put them in **Git** — diff, branch, review, merge, like code
- You can **drag and drop** to reorder requests
- You can **search and filter** by name
- You can **batch select** and move or delete multiple requests at once
- You can **duplicate** a request with one click
- You can **link an OpenAPI spec** to a collection for contract testing

Collections handle 1000+ items with zero lag thanks to virtual scrolling.

## Environments

Environments are variable sets for different servers. Think of it like switching between your work laptop and home laptop — same apps, different settings.

\`\`\`
  Dev Environment          Prod Environment
  ┌──────────────────┐    ┌──────────────────┐
  │ BASE_URL:        │    │ BASE_URL:        │
  │  localhost:3000  │    │  api.myapp.com   │
  │                  │    │                  │
  │ API_KEY:         │    │ API_KEY:         │
  │  dev-key-123     │    │  prod-key-456    │
  └──────────────────┘    └──────────────────┘
         │                        │
         ▼                        ▼
  Every {{BASE_URL}} in      Every {{BASE_URL}} in
  your requests updates     your requests updates
\`\`\`

Create a Dev environment with \`BASE_URL = http://localhost:3000\` and a Prod environment with \`BASE_URL = https://api.yourapp.com\`. Switch between them with one click. Every \`{{BASE_URL}}\` in your URLs, headers, and bodies updates instantly.

---

## Mock server

reqit has a built-in mock server. Save a response from any request, start the mock server, and it replays that response on \`http://localhost:4321\`. Your frontend talks to the mock instead of the real API.

\`\`\`
  ┌──────────┐      ┌──────────────┐      ┌──────────┐
  │ Frontend │─────►│ Mock Server  │◄─────│ reqit    │
  │ (React)  │      │ :4321        │      │ (saves   │
  │          │◄─────│              │      │ responses)│
  └──────────┘      └──────────────┘      └──────────┘
\`\`\`

- Add **delays** to simulate slow servers
- **Override status codes** to test error handling
- **Override response bodies** to test edge cases
- Match **path parameters** like \`/users/:id\`
- Use **CORS** headers by default
- See a header \`X-Mock-Server: reqit\` on every mock response

## Contract testing

Link an OpenAPI spec to a collection. Every request you send gets validated against the spec.

\`\`\`
  You send: GET /users/123
  Spec says: 200, body has { id: string, name: string }

  reqit checks:
  ✓ Status code matches (200)
  ✓ Response body has "id" field
  ✓ Response body has "name" field
  ✗ Spec says "email" is required — MISSING

  Result: Contract OK with 1 warning
\`\`\`

You see a green **Contract OK** badge or a red **N violations** badge in the status bar. Click the badge to see exactly what went wrong: which field is missing, which status code does not match, which header is unexpected. You find breaking changes in 3 seconds instead of 3 hours.

---

## Collection runner

The runner executes every request in a collection and tells you which passed and which failed. Think of it like a spell-checker for your entire API.

\`\`\`
  ┌─────────────────────────────────────────────┐
  │           COLLECTION RUNNER                 │
  │                                             │
  │  POST /login .............. ✓ 200 (120ms)  │
  │  GET /users ............... ✓ 200 (85ms)   │
  │  POST /users ................ ✗ 422 (45ms)  │
  │    └─ Assertion failed: status == 200       │
  │  GET /users/123 ........... ✓ 200 (90ms)   │
  │  DELETE /users/123 ........ ✓ 204 (110ms)  │
  │                                             │
  │  Result: 4/5 passed (80%)                  │
  └─────────────────────────────────────────────┘
\`\`\`

- **Sequential** and **concurrent** execution with configurable workers
- **Retries** with backoff on failures
- **Conditional execution** — run a request only if a condition is met
- **12 assertion types** — status code, timing, body contains, body match regex, JSON path, header, cookie, variable equal, variable not equal, JSON schema, custom script
- **Test suites** — organize assertions into nested groups

After a run, you get a full pass/fail report with per-request timing.

## Load testing

reqit can simulate traffic. Set the number of virtual users, the duration, and the request. reqit fires it repeatedly and reports.

\`\`\`
  ┌─────────────────────────────────────────────┐
  │           LOAD TEST RESULTS                │
  │                                             │
  │  Users: 50    Duration: 60s    RPS: 245    │
  │                                             │
  │  Response Time:                             │
  │    p50: 120ms                              │
  │    p95: 340ms                              │
  │    p99: 890ms                              │
  │    avg: 156ms    min: 45ms   max: 1200ms   │
  │                                             │
  │  Throughput: 245 req/sec                    │
  │  Error rate: 0.3%                           │
  └─────────────────────────────────────────────┘
\`\`\`

- **Response time** — average, fastest, slowest
- **Throughput** — requests per second
- **Error rate** — percentage of failures
- **Latency percentiles** — p50, p95, p99

No need to set up k6 or JMeter. It is built in.

---

## Scripting

Every request has a Scripts tab. Write JavaScript that runs before or after the request.

\`\`\`
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │ Pre-request  │────►│ Send Request │────►│ Post-response│
  │ script runs  │     │              │     │ script runs  │
  │              │     │  GET /users  │     │              │
  │ • Generate   │     │              │     │ • Extract    │
  │   token      │     │              │     │   user ID    │
  │ • Set vars   │     │              │     │ • Chain to   │
  │ • Compute    │     │              │     │   next req   │
  │   signature  │     │              │     │ • Validate   │
  └──────────────┘     └──────────────┘     └──────────────┘
\`\`\`

- **Before** the request (pre-request) — generate tokens, set variables, compute signatures
- **After** the response (post-response) — extract data, validate results, chain requests

reqit uses the goja JavaScript engine. Scripts can read and write environment variables, so data flows automatically between requests.

---

## Git integration

reqit stores collections as JSON files in a \`.reqit/\` directory. This means you can use Git for everything:

\`\`\`
  feature/new-payment
  ┌─────────────────────────────┐
  │ .reqit/collections/         │
  │   auth-api/login.json       │
  │   payment/charge.json  ◄─── NEW
  │   payment/refund.json  ◄─── NEW
  └─────────────────────────────┘
         │ git merge
         ▼
  main
  ┌─────────────────────────────┐
  │ .reqit/collections/         │
  │   auth-api/login.json       │
  │   payment/charge.json       │
  │   payment/refund.json       │
  └─────────────────────────────┘
\`\`\`

- **git diff** — see exactly what changed in a request
- **git branch** — each feature branch carries its own collections
- **git pull request** — API changes show up in code reviews
- **git stash** — save changes and come back later
- **git merge** — combine branches with conflict resolution

reqit has a built-in Git client. You can commit, push, pull, branch, stash, and merge — all from the sidebar. Conflict resolution includes a visual merge UI for JSON, headers, and form-data.

## Import and export

No vendor lock-in. Your data comes in, your data goes out.

\`\`\`
  IMPORT                          EXPORT
  ┌──────────────┐               ┌──────────────┐
  │ Postman v2.1 │───┐           │├──► Postman  │
  │ Insomnia     │───┤           │├──► Insomnia │
  │ Hoppscotch   │───┼── reqit ──┤├──► OpenAPI  │
  │ OpenAPI      │───┤           │├──► cURL     │
  │ cURL         │───┘           │├──► JS fetch │
  └──────────────┘               │└──► Python   │
                                 └──────────────┘
\`\`\`

**Import from:** Postman (v2.1 with full script transpilation), Insomnia, Hoppscotch, OpenAPI (YAML/JSON), cURL commands, Postman environments.

**Export to:** Postman, Insomnia, Hoppscotch, OpenAPI JSON, OpenAPI HTML (self-contained Swagger UI), cURL, Markdown documentation, JavaScript fetch, Python requests code snippets.

---

## API designer

Design your API before writing code. Think of it like an architect drawing a blueprint before the builders start.

\`\`\`
  ┌─────────────────────────────────────────────┐
  │  API DESIGNER (OpenAPI)                     │
  │                                             │
  │  GET /users        → 200: [User]           │
  │  POST /users       → 201: User             │
  │  GET /users/:id    → 200: User             │
  │  DELETE /users/:id → 204                   │
  │                                             │
  │  Push to: SwaggerHub / Stoplight            │
  │  Generate: Collections from spec            │
  └─────────────────────────────────────────────┘
\`\`\`

- Create and edit OpenAPI specs
- Add endpoints with methods, parameters, and responses
- Push specs to SwaggerHub or Stoplight
- Pull specs from SwaggerHub or Stoplight
- Generate collections from specs

Your frontend team can start building screens while the backend team builds the actual API — both working from the same blueprint.

---

## CI/CD generation

reqit can generate CI/CD pipeline files from your collections. Add \`reqit run smoke-tests --env staging\` to your pipeline. Every push checks your API automatically.

\`\`\`
  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
  │  Code Push   │─────►│  CI Pipeline │─────►│  reqit run   │
  │  (git push)  │      │  (auto)      │      │  --env prod  │
  └──────────────┘      └──────────────┘      └──────────────┘
                                                          │
                                                    ┌─────▼─────┐
                                                    │ Pass: 50  │
                                                    │ Fail: 0   │
                                                    │ Deploy ✓  │
                                                    └───────────┘
\`\`\`

- **GitHub Actions** — generates \`.github/workflows/\` YAML
- **GitLab CI** — generates \`.gitlab-ci.yml\`
- **Jenkins** — generates a \`Jenkinsfile\`
- **Playwright tests** — generates browser test files
- **Jest tests** — generates unit test files

## CLI mode

Run reqit from the terminal:

\`\`\`bash
reqit run my-collection --env production --output json
\`\`\`

Fires every request, runs assertions, prints a report. Exit code 0 means all pass. Exit code 1 means something failed. Perfect for CI/CD, nightly monitoring, or scripted workflows.

---

## Workspace management

Each workspace is a separate world. Think of it like having separate folders on your desk — one for each project.

\`\`\`
  Workspace: mobile-app        Workspace: web-dashboard
  ┌──────────────────┐        ┌──────────────────┐
  │ Collections:     │        │ Collections:     │
  │  auth-api        │        │  analytics-api   │
  │  push-notif      │        │  user-api        │
  │                  │        │                  │
  │ Environments:    │        │ Environments:    │
  │  dev, staging    │        │  dev, prod       │
  │                  │        │                  │
  │ History: 47 reqs │        │ History: 123 reqs│
  └──────────────────┘        └──────────────────┘
\`\`\`

- **Create, rename, delete** workspaces
- **Open from folder** — point reqit at any directory
- **Relocate** — move a workspace to a new location
- **File watcher** — changes outside reqit are detected automatically
- **Cross-device sync** — drop your workspace folder into Dropbox or OneDrive

## Interceptor (Chrome extension)

The interceptor captures every HTTP request your browser makes. Install it, connect it to reqit, and every API call your browser makes appears in reqit's history.

- Capture requests from any website
- See full request details (method, URL, headers, body)
- Send captured requests directly to your workspace
- All traffic stays local — nothing leaves your machine

## Cookies

reqit has a built-in cookie jar. When a server sends a \`Set-Cookie\` header, reqit stores it. On the next request to the same domain, reqit sends the cookie back. Like a browser, but you can see and control every cookie.

- Auto-capture and auto-replay
- Per-domain clear
- Full cookie viewer with attributes

## History

Every request you send is automatically logged. Click any history entry to restore the full request — URL, method, headers, body, auth. Search by URL or method. Tag entries. Favorite important ones.

---

## Code generation

Click a button and reqit generates code for your request. The generated code matches exactly what you tested. No typos. No forgotten headers.

- **cURL** — paste into any terminal
- **JavaScript fetch** — for web apps
- **Python requests** — for scripts and backends

## Themes

Dark mode. Light mode. System auto-detect. Pick what looks good to you. The change is instant — no restart needed.

---

## Security and enterprise

reqit is built for teams that care about security:

- **OAuth2 with PKCE** — full authorization flow
- **JWT Decoder** — see claims and expiry inline
- **Enterprise SSO** — SAML 2.0 and OpenID Connect
- **E2EE encryption** — AES-256-GCM with Argon2id key derivation
- **Secret Vault** — integration with 1Password, HashiCorp Vault, AWS Secrets Manager
- **Data Masker** — regex-based masking for tokens and API keys
- **RBAC** — Viewer, Editor, Administrator roles
- **Audit Trail** — append-only, tamper-evident log of every action
- **Air-Gap Mode** — disable all network features for high-security environments

## Keyboard shortcuts

Every action is keyboard-accessible:

| Shortcut | Action |
|----------|--------|
| Ctrl+Enter | Send request |
| Ctrl+S | Save request |
| Ctrl+T | New tab |
| Ctrl+W | Close tab |
| Ctrl+E | Focus URL bar |
| Ctrl+K | Command palette |
| Ctrl+Z | Undo |

The command palette (Ctrl+K) searches every feature. Type what you want to do and press Enter.

## Reporting

After a collection run or load test, generate a report:

- **JSON report** — machine-readable with full details
- **HTML report** — styled with summary, request results, failures, load test analytics

Save reports via native file dialog. Share with your team.

---

## AI integration: MCP and Agent Lens

reqit connects to AI agents through two features: **MCP** (Model Context Protocol) and **Agent Lens**.

### MCP — the universal plug for AI

Think of MCP like a USB port for AI. Before USB, every device had a different connector. MCP makes one port that works for everything — any AI agent can talk to any tool through one standard protocol.

\`\`\`
  ┌──────────┐      ┌──────────┐      ┌──────────┐
  │  Claude  │      │  ChatGPT │      │  Gemini  │
  │  Desktop │      │          │      │          │
  └────┬─────┘      └────┬─────┘      └────┬─────┘
       │                 │                 │
       └────────┬────────┴────────┬────────┘
                │                 │
                ▼                 ▼
         ┌──────────────────────────────┐
         │      MCP Protocol            │
         │      (JSON-RPC 2.0)          │
         └──────────────┬───────────────┘
                        │
                        ▼
               ┌────────────────┐
               │   reqit MCP    │
               │   Server       │
               │                │
               │  • List tools  │
               │  • Send reqs   │
               │  • Run tests   │
               │  • Get history │
               └────────────────┘
\`\`\`

**Real-world example:** You say "Claude, run all the tests in my auth-api collection and tell me which ones fail." Claude calls reqit through MCP. reqit runs the collection. Claude gets the results and says "3 of 12 tests failed. The /refresh-token endpoint returns 401 instead of 200."

reqit exposes these tools through MCP:

- **List collections** — see all your API collections
- **List requests** — see every request in a collection
- **Send a request** — fire any request and get the full response
- **Run a collection** — execute all requests with assertions
- **Get history** — see past requests and responses
- **Manage environments** — switch between dev/staging/prod
- **Run load tests** — simulate traffic and get metrics

### Agent Lens — the flashlight for AI tool-readiness

Agent Lens is like a spell-checker, but for API tools. It reads your API collection and tells you what needs fixing before an AI can use it reliably.

\`\`\`
  ┌──────────────────────────────────────────────────────┐
  │                    AGENT LENS                        │
  │                                                      │
  │  Input: Your API collection                          │
  │  Output: Score + specific fixes                      │
  │                                                      │
  │  ┌──────────────────────────────────────────────┐    │
  │  │           LINTING RULES (R1-R5)              │    │
  │  │                                              │    │
  │  │  R1: Tool Naming     - Is the name clear?   │    │
  │  │  R2: Descriptions    - Every tool described? │    │
  │  │  R3: Parameter Types - All types defined?    │    │
  │  │  R4: Consistency     - Same style everywhere?│    │
  │  │  R5: Complexity      - Not too many params?  │    │
  │  └──────────────────────────────────────────────┘    │
  │                      │                               │
  │                      ▼                               │
  │  ┌──────────────────────────────────────────────┐    │
  │  │              SCORE (0-100)                   │    │
  │  │                                              │    │
  │  │  90-100: Excellent - AI-ready                │    │
  │  │  70-89:  Good - minor improvements           │    │
  │  │  50-69:  Fair - needs work                   │    │
  │  │  0-49:   Poor - significant fixes needed     │    │
  │  └──────────────────────────────────────────────┘    │
  └──────────────────────────────────────────────────────┘
\`\`\`

**Real-world example:** You run Agent Lens on a collection with 20 endpoints. It says "Score: 62/100 — 5 endpoints have no description, 3 tool names are too short." You fix those issues, run it again. Score: 94/100. Now when an AI connects through MCP, it gives better results.

Agent Lens also has **Eval** — you define test tasks where an AI should call specific tools, and it checks if the AI calls the right one. Plus **Export** — generate a standalone Go MCP server from your collection.

For a deep dive, see our dedicated post on [MCP and Agent Lens](/blog/mcp-agent-lens-complete-guide).

---

## The full workflow

Here is how all the pieces fit together:

\`\`\`
  1. DESIGN          2. BUILD           3. TEST            4. SHIP
  ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
  │ API      │      │ Send     │      │ Run      │      │ CI/CD    │
  │ Designer │─────►│ Requests │─────►│ Tests    │─────►│ Pipeline │
  │ (OpenAPI)│      │ + Script │      │ + Mock   │      │ + CLI    │
  └──────────┘      └──────────┘      └──────────┘      └──────────┘
       │                 │                 │                 │
       ▼                 ▼                 ▼                 ▼
  Spec lives in     Collections in     Contract tests     Exit code 0
  Git repo          Git repo           pass/fail          = deploy
\`\`\`

## The architecture

reqit is built with:

- **Go** backend (compiled to a single binary)
- **React + TypeScript** frontend
- **Wails v2** for the bridge between them
- **Tailwind CSS** for styling
- **Zustand** for state management

The installer is under 20MB. Startup is under 400ms. No Electron. No embedded browser. No Node.js runtime. Just a native binary and a web view.

## Open source

reqit is MIT licensed. The code is on GitHub. You can read every line, report issues, contribute features, or fork it for your own use.

## Getting started

1. Download reqit from [GitHub Releases](https://github.com/HalxDocs/reqit/releases)
2. Install it (under 20MB, takes 5 seconds)
3. Open a workspace or create a new one
4. Create a collection, add a request, hit Send

No account. No login. No cloud. Just open and go.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "reqit-ai-features",
    title: "reqit AI: diagnose broken APIs without leaving your client",
    description: "reqit has built-in AI that explains why your API call failed, generates test assertions, and detects schema drift — all running locally with your own API key.",
    date: "2026-06-21",
    readTime: "6 min read",
    tags: ["ai", "diagnostics", "testing", "byok"],
    category: "Release narratives",
    content: `You send an API request. The server returns a 422. The body says "validation error" with a cryptic field name. You stare at it, open the docs, grep the codebase, ask a teammate. Ten minutes later you figure out you forgot to send a \`tenant_id\` header.

This happens every day. reqit now has AI that fixes this in 2 seconds.

## What reqit AI does

reqit has three AI-powered features built into the response panel:

### 1. Diagnose broken responses

Click **Diagnose** after any failed or unexpected response. The AI reads the request, the response, the status code, and the headers, then tells you:

- What went wrong
- Why it went wrong
- How to fix it

No context-switching. No copy-pasting into ChatGPT. The diagnosis appears right next to the response.

### 2. Generate test assertions

Click **Assertions** and the AI generates JSON test assertions for that request/response pair. These assertions check status codes, response body fields, headers, and data types.

You can save them directly to your collection and run them in the runner. Your API tests write themselves.

### 3. Schema drift detection

When you import or fetch an OpenAPI spec, reqit saves a baseline snapshot. Click **Detect Drift** in the collection menu to compare the current spec against the baseline. You see:

- **Added endpoints** (green) — new routes the API now offers
- **Removed endpoints** (red strikethrough) — routes that disappeared
- **Modified endpoints** (amber) — changed parameters, request bodies, or response schemas

Breaking changes are flagged automatically. No more discovering a field type changed in production.

## How it works: BYOK (Bring Your Own Key)

reqit does not run its own AI servers. You bring your own API key from any supported provider:

| Provider | Models |
|----------|--------|
| **OpenAI** | GPT-4o, GPT-4o Mini, GPT-4 Turbo, o3-mini, o3 |
| **Anthropic** | Claude Sonnet 4, Claude 3.5 Sonnet, Claude 3.5 Haiku |
| **Google Gemini** | Gemini 2.0 Flash, Gemini 2.5 Pro, Gemini 1.5 Pro |
| **Ollama** (local) | Llama 3.2, Mistral, DeepSeek Coder, Qwen 2.5, and more |

Your API key stays on your machine. reqit sends the request directly to the provider's API. No middleman. No logging on our servers. No telemetry about your API calls.

## The setup

1. Open reqit Settings (gear icon)
2. Go to **AI — Response Intelligence**
3. Pick your provider
4. Paste your API key
5. Pick a model (or type a custom model name)
6. Done

The whole thing takes 30 seconds. Toggle it off anytime.

## Why Ollama matters

If you run [Ollama](https://ollama.com) locally, reqit works completely offline. No API key needed. No data leaves your machine. The diagnosis happens on your GPU.

This is useful for:
- Air-gapped environments
- Sensitive APIs (healthcare, finance, government)
- Teams that want zero cost for AI features
- Development without internet access

## What the AI sees

The AI receives:
- The HTTP method and URL
- Request headers and body
- Response status code
- Response headers and body
- The prompt asking it to diagnose or generate assertions

It does **not** receive:
- Your workspace data
- Your collection names
- Your environment variables
- Any other requests you've made
- Your API key (that stays in settings)

The AI call is stateless. Each diagnosis is independent.

## Schema drift in detail

When you first link an OpenAPI spec to a collection, reqit captures a snapshot:

- Every endpoint (method + path)
- Every parameter (name, type, required)
- Every request body schema
- Every response schema

On subsequent checks, reqit compares the current spec against this snapshot. If someone updated the spec and added a field, changed a type, or removed an endpoint, you see it immediately.

This is useful for:
- Monitoring upstream API changes
- Verifying your OpenAPI spec matches the actual API
- Catching breaking changes before they hit production
- Keeping documentation in sync with reality

## Cost

The AI features cost whatever your provider charges. For most developers:

- **GPT-4o Mini**: ~$0.0003 per diagnosis (essentially free)
- **Claude 3.5 Haiku**: ~$0.0004 per diagnosis
- **Ollama**: Free forever

You will spend less on AI diagnostics in a year than you spend on coffee in a week.

## What's next

The AI features are the beginning. Future plans:

- **AI-powered request builder** — describe what you want, get a request
- **AI test generation** — describe your API, get a full test suite
- **AI documentation** — auto-generate API docs from your collections
- **MCP server** — let AI agents like Claude Desktop control reqit directly

## Getting started

1. Download reqit from [GitHub Releases](https://github.com/HalxDocs/reqit/releases)
2. Configure your AI provider in Settings
3. Send a request, click Diagnose
4. See what the AI says

No account. No login. No cloud. Just your API key and your machine.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "mcp-agent-lens-complete-guide",
    title: "MCP, Agent Lens, and every feature reqit has — the complete guide",
    description: "How reqit connects to AI agents with MCP, scores tool-readiness with Agent Lens, and does everything Postman does — with diagrams and real-world examples.",
    date: "2026-06-25",
    readTime: "15 min read",
    tags: ["mcp", "agent-lens", "ai", "features", "overview", "guide"],
    category: "Technical deep-dives",
    content: `Imagine you have a smart friend who can do anything — cook, fix your bike, write essays. But there is one problem: your friend does not know where your kitchen is, what tools you have, or how your bike works. You have to explain everything every single time.

That is what it is like when AI agents try to use APIs today. They are smart, but they have no standard way to discover what tools exist, what those tools do, or how to call them.

**reqit solves this with two things: MCP (Model Context Protocol) and Agent Lens.** This post explains what they are, how they work, and then walks through every single feature reqit has.

---

## Part 1: MCP — the universal plug for AI and APIs

### What is MCP?

MCP stands for **Model Context Protocol**. Think of it like a USB port for AI.

Before USB, every device had a different connector. Printers used one cable, keyboards another, mice another. USB made one port that works for everything.

MCP does the same thing for AI agents. It is one standard way for any AI (Claude, ChatGPT, Gemini, any custom bot) to talk to any tool (API client, database, file system, code editor).

### The problem MCP solves

Without MCP, if you want an AI to test your API, you have to:

1. Write custom code to connect the AI to your API tool
2. Explain every endpoint, every parameter, every auth method
3. Hope the AI understands your custom integration
4. Do it all over again for the next AI or the next tool

\`\`\`
  BEFORE MCP (custom integration for every pair)

  AI Agent A  ──── custom code ────  reqit
  AI Agent A  ──── custom code ────  Database
  AI Agent B  ──── DIFFERENT code ──  reqit
  AI Agent B  ──── DIFFERENT code ──  Database
  AI Agent C  ──── YET ANOTHER ────  reqit

  (every combination needs its own adapter)
\`\`\`

With MCP, every tool speaks the same language:

\`\`\`
  WITH MCP (one protocol rules them all)

  AI Agent A  ──┐
  AI Agent B  ──┼── MCP ──┬── reqit (send requests, test APIs)
  AI Agent C  ──┘          ├── Database (query data)
                           ├── File System (read/write files)
                           └── Code Editor (edit source code)

  (one adapter per tool, works with any AI)
\`\`\`

### How MCP works in reqit

reqit includes a built-in MCP server. When you run \`reqit mcp\`, it starts a stdio server that speaks JSON-RPC 2.0 — the MCP standard.

Here is what the AI agent sees:

\`\`\`
  ┌─────────────────────────────────────────────────────┐
  │                AI AGENT (e.g. Claude)                │
  │                                                     │
  │  "I need to test an API endpoint"                   │
  │         │                                           │
  │         ▼                                           │
  │  ┌─────────────┐    MCP Protocol    ┌────────────┐  │
  │  │  MCP Client  │ ◄════════════════► │  reqit MCP │  │
  │  │  (in AI)     │    JSON-RPC 2.0    │  Server    │  │
  │  └─────────────┘                     └─────┬──────┘  │
  │                                            │         │
  │                                    ┌───────▼───────┐ │
  │                                    │  reqit core   │ │
  │                                    │  - Collections│ │
  │                                    │  - Requests   │ │
  │                                    │  - Assertions │ │
  │                                    │  - Mock Server│ │
  │                                    └───────────────┘ │
  └─────────────────────────────────────────────────────┘
\`\`\`

### Real-world example: AI-powered API testing

Say you are a backend developer. You have 50 API endpoints in reqit. Your team uses Claude Desktop as an AI assistant.

Without MCP, you would manually test each endpoint, copy-paste results, ask Claude to analyze them.

With MCP, you say: **"Claude, run all the tests in my auth-api collection and tell me which ones fail."**

Claude calls reqit through MCP. reqit runs the collection. Claude gets the results and says: **"3 of 12 tests failed. The /refresh-token endpoint returns 401 instead of 200. The issue is the token expiry logic."**

You did not write any integration code. You did not explain the API. MCP handled it all.

### What reqit exposes through MCP

reqit makes these tools available to any MCP-compatible AI:

- **List collections** — see all your API collections
- **List requests** — see every request in a collection
- **Send a request** — fire any request and get the full response
- **Run a collection** — execute all requests with assertions
- **Get history** — see past requests and responses
- **Manage environments** — switch between dev/staging/prod
- **Run load tests** — simulate traffic and get metrics

### How to use it

1. Open reqit, go to Settings, and enable the MCP server
2. In your AI client (Claude Desktop, etc.), add reqit as an MCP server
3. Point it at \`reqit mcp\` (the command that starts the server)
4. Start talking to your AI — it now has full access to your reqit workspace

---

## Part 2: Agent Lens — the flashlight for AI tool-readiness

### What is Agent Lens?

Agent Lens is like a flashlight that shines on your API collections and tells you: **"Is this ready for an AI agent to use?"**

Think of it like a spell-checker, but for API tools. A spell-checker reads your essay and says "you misspelled 3 words." Agent Lens reads your API collection and says "3 things need fixing before an AI can use this reliably."

### The problem Agent Lens solves

When you expose your APIs to AI agents, there are rules you might not think about:

- Is the tool name clear? An AI sees \`getUser\` vs \`u_g\` — which one makes sense?
- Does every endpoint have a description? Without descriptions, the AI is guessing.
- Are parameter types defined? An AI sending \`id\` needs to know it is a string, not a number.
- Is the naming consistent? Mixing \`getUser\`, \`fetch_user\`, and \`load-user\` confuses AI.

Agent Lens checks all of this automatically and gives you a score.

### How Agent Lens works

\`\`\`
  ┌──────────────────────────────────────────────────────┐
  │                    AGENT LENS                        │
  │                                                      │
  │  Input: Your API collection                          │
  │  Output: Score + specific fixes                      │
  │                                                      │
  │  ┌──────────────────────────────────────────────┐    │
  │  │           LINTING RULES (R1-R5)              │    │
  │  │                                              │    │
  │  │  R1: Tool Naming     - Is the name clear?   │    │
  │  │  R2: Descriptions    - Every tool described? │    │
  │  │  R3: Parameter Types - All types defined?    │    │
  │  │  R4: Consistency     - Same style everywhere?│    │
  │  │  R5: Complexity      - Not too many params?  │    │
  │  └──────────────────────────────────────────────┘    │
  │                      │                               │
  │                      ▼                               │
  │  ┌──────────────────────────────────────────────┐    │
  │  │              SCORE (0-100)                   │    │
  │  │                                              │    │
  │  │  90-100: Excellent - AI-ready                │    │
  │  │  70-89:  Good - minor improvements           │    │
  │  │  50-69:  Fair - needs work                   │    │
  │  │  0-49:   Poor - significant fixes needed     │    │
  │  └──────────────────────────────────────────────┘    │
  └──────────────────────────────────────────────────────┘
\`\`\`

### Real-world example: Making APIs AI-ready

You have a collection with 20 endpoints. You run Agent Lens. It says:

\`\`\`
  Collection Score: 62/100

  Issues found:
  ✗  5 endpoints have no description
  ✗  3 tool names are too short (e.g. "g", "p", "d")
  ⚠  2 endpoints have more than 8 parameters
  ✓  All parameter types are defined
  ✓  Naming is consistent
\`\`\`

You add descriptions to the 5 endpoints, rename the short tool names, and simplify the 2 complex endpoints. You run Agent Lens again. Score: **94/100**.

Now when an AI agent connects to your APIs through MCP, it has clear names, full descriptions, and well-structured parameters. The AI gives better results because the tools are well-defined.

### The scoring system

Agent Lens uses a penalty-based scoring system:

- **Error** (must fix): -15 points each — things that break AI understanding
- **Warning** (should fix): -5 points each — things that reduce AI accuracy
- **Info** (nice to fix): -1 point each — improvements for clarity

Starting at 100, penalties bring the score down. A score above 90 means your collection is AI-ready.

### Eval: testing how well AI uses your tools

Agent Lens goes beyond linting. The **Eval** feature lets you define test tasks — scenarios where an AI should call specific tools with specific arguments.

\`\`\`
  ┌─────────────────────────────────────────────────────┐
  │                 EVAL WORKFLOW                        │
  │                                                     │
  │  1. You write a task:                               │
  │     "Get all users from the /users endpoint"        │
  │                                                     │
  │  2. You define expected behavior:                   │
  │     Tool: GET /users                                │
  │     Args: none                                      │
  │                                                     │
  │  3. Agent Lens sends the prompt to an AI            │
  │                                                     │
  │  4. AI responds with a tool call                    │
  │                                                     │
  │  5. Agent Lens compares actual vs expected          │
  │                                                     │
  │  6. Results:                                        │
  │     ✓ Correct tool called                           │
  │     ✓ Correct arguments                             │
  │     ⏱ Latency: 1.2s                                │
  │     Pass rate: 3/3 runs (100%)                      │
  └─────────────────────────────────────────────────────┘
\`\`\`

This tells you: **"When a human asks this question, will the AI call the right tool?"** If not, your tool definitions need work.

### Export: generating a standalone MCP server

Agent Lens can export your collection as a standalone Go MCP server. This means:

1. You have an API collection in reqit
2. Agent Lens generates a complete Go project
3. You run \`go build\` and get a binary
4. That binary is an MCP server any AI can connect to

No reqit dependency. No Go knowledge needed. The generated code is self-contained.

---

## Getting started

1. Download reqit from [GitHub Releases](https://github.com/HalxDocs/reqit/releases)
2. Install it (under 20MB, takes 5 seconds)
3. Create a collection, add a request, hit Send
4. Enable MCP in Settings to connect AI agents
5. Run Agent Lens to check your tool-readiness score

No account. No login. No cloud. Just open and go.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "dev-profile",
    title: "Your backend dev profile, hosted for free",
    description: "Share your API work as a public portfolio. No server to manage, no hosting cost, no account to create.",
    date: "2026-06-25",
    readTime: "6 min read",
    tags: ["tutorial", "profile", "portfolio"],
    category: "Tutorials & use-cases",
    content: `You push code every day. You build APIs, write collections, mock servers, run contract tests. But none of that shows up anywhere. Your GitHub profile shows contribution dots. Your LinkedIn says "Backend Developer at Company." Nobody sees the actual work.

reqit gives you a dev profile. A public page that shows your skills, projects, GitHub activity, and API stats. It lives at \`reqit.pxxl.dev/yourname\`. No server to rent. No DNS to configure. No monthly fee.

## What the profile shows

Your public profile is a single page with everything a recruiter or co-worker needs to see:

**Hero card** — Your name, avatar, bio, location, company, and social links (GitHub, X, LinkedIn, website, DEV.to).

**Stats strip** — Six numbers at a glance: collections created, requests sent, assertions written, specs authored, mock servers created, and contract pass rate. These come from your actual work in reqit. You do not type them. They update when you publish.

**Projects** — Two types:
- **Collection projects** — Automatically generated from your reqit collections. Each shows the request count, protocols used, and whether it has an OpenAPI spec. Tap to expand and see endpoints grouped by folder.
- **User projects** — Your own side projects, open source work, or anything you want to showcase. Each has a name, description, URL, live URL, tech stack tags, and optional screenshot.

**Skills** — Tags you pick from a curated list or type yourself. "Go", "PostgreSQL", "REST API", "Docker", whatever you actually use.

**GitHub activity** — Your recent commits and pinned repos, pulled live from the GitHub API. No manual updates needed.

**Badges** — Earned from reqit milestones. First collection created, 100 requests sent, first mock server, and so on.

## How it works

The profile system has three parts:

\`\`\`
Desktop App (Go)         Upstash (Redis)        Web Page (pxxl.app)
┌─────────────┐         ┌─────────────┐        ┌─────────────┐
│ DevProfile  │ ──────> │  profile:   │ <───── │ /api/profile│
│   Panel     │  REST   │  username   │  REST  │ /[username] │
│             │  API    │  -> JSON    │        │  -> HTML    │
└─────────────┘         └─────────────┘        └─────────────┘
\`\`\`

1. **You fill out your profile** in the desktop app (Settings > Dev Profile).
2. **You click Publish.** The app computes your stats from your collections, builds the project list, and sends the JSON to Upstash via REST API.
3. **Someone visits your URL.** The web page calls \`/api/profile/yourname\`, which reads from Upstash and returns the JSON. The page renders it as a clean portfolio.

No database on your machine. No server you maintain. Upstash is a hosted Redis with a free tier of 10,000 commands per day. That is plenty for a profile page.

## Step 1: Open the Dev Profile panel

1. Open reqit desktop app.
2. Click **Settings** in the top bar.
3. Click **Dev Profile** tab.

You will see a form with your profile fields.

## Step 2: Fill in your basics

- **Username** — This becomes your URL. Pick something short and memorable. \`hal\`, \`jane-dev\`, \`backendguy\`.
- **Display Name** — Your real name or alias. Shows on the hero card.
- **Bio** — One or two sentences. "Backend developer. I build APIs and break things."
- **Avatar URL** — Paste a link to your profile picture. Any image URL works.
- **Location** — City or "Remote". Shows next to a map pin icon.
- **Company** — Where you work. Optional.

## Step 3: Add your skills

Type a skill and press Enter (or click +). The dropdown suggests common ones:

\`\`\`
Go  TypeScript  Python  Rust  Java  C#  Ruby
REST API  GraphQL  gRPC  WebSocket  MQTT
Docker  Kubernetes  AWS  PostgreSQL  Redis
\`\`\`

You can also type custom ones. "gRPC-Gateway", "CockroachDB", "Temporal" — whatever you actually use.

## Step 4: Add social links

Click **+ Add** and pick a platform:
- GitHub → \`https://github.com/yourname\`
- X / Twitter → \`https://x.com/yourname\`
- LinkedIn → \`https://linkedin.com/in/yourname\`
- Website → \`https://yoursite.com\`
- DEV.to → \`https://dev.to/yourname\`

## Step 5: Add your projects

Click **+ Add Project** to showcase your work:

- **Project Name** — "Auth Service", "Payment Gateway", "My Side Project"
- **Description** — What it does
- **URL** — GitHub repo link
- **Live URL** — Deployed version (if any)
- **Tech Stack** — Type and press Enter. "Go", "PostgreSQL", "Redis", "Docker"
- **Screenshot URL** — Optional image link

Each project card collapses to a summary. Click it to expand and edit. Click **Done** when you are happy, or **Cancel** to discard changes.

## Step 6: Link Upstash (required for publishing)

reqit needs somewhere to store your profile. Upstash Redis is free:

1. Go to [upstash.com](https://upstash.com) and sign up (free tier, no credit card).
2. Click **Create Database** → pick a name → select **Global** region → click **Create**.
3. Copy the **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN**.
4. In reqit, click **Configure Upstash** in the Dev Profile panel.
5. Paste both values and click **Save**.

Your credentials are stored locally at \`%APPDATA%/reqit/upstash.json\` (Windows) or \`~/.config/reqit/upstash.json\` (Linux/Mac). Never sent to any server except Upstash.

## Step 7: Publish

Click **Publish Profile**. The app:

1. Scans your collections and computes stats.
2. Builds your project list (collection projects + user projects).
3. Sends everything to Upstash as a single JSON blob.
4. Your profile goes live instantly.

Visit \`reqit.pxxl.dev/yourname\` to see it.

## The public page

Your profile page is designed for mobile-first viewing:

- **No navbar** — Clean, focused view. Just your profile.
- **Horizontal scroll tabs** — Skills, Projects, GitHub, Badges. Swipe to navigate.
- **Expandable projects** — Tap a collection project to see its endpoints. Tap again to collapse.
- **GitHub activity** — Pinned repos and recent commits, pulled live.
- **Stats strip** — Six numbers, always visible, no scrolling needed.

## The public REST API

Your profile is also available as a JSON API:

\`\`\`
GET https://reqit.pxxl.dev/api/v1/profile/yourname

{
  "ok": true,
  "data": {
    "username": "yourname",
    "displayName": "Jane Dev",
    "stats": { "collectionsCreated": 12, "requestsSent": 347 },
    "projects": [...],
    "skills": ["Go", "PostgreSQL", "Docker"]
  },
  "meta": { "source": "reqit", "version": "1.0" }
}
\`\`\`

Use this to build custom pages, widgets, or integrations.

## Keeping it updated

Your stats update every time you publish. The profile does not auto-update — you click **Publish** when you want fresh data. This is intentional:

- You control what is public.
- You do not accidentally leak a work-in-progress collection.
- You can tweak your bio, add a project, then publish.

Your GitHub activity updates live on page load (no publish needed). Commits and pinned repos come directly from the GitHub API.

## Common questions

**Do I need to keep reqit open?**
No. Once published, your profile lives in Upstash. The web page reads from Upstash directly. reqit does not need to be running.

**What if I stop using Upstash?**
Your profile stays in Redis until you delete it. If you exceed the free tier (10K commands/day), Upstash pauses writes but your profile is still readable.

**Can I have multiple profiles?**
One per Upstash database. If you want separate profiles (personal, work), create two Upstash databases.

**Is my data private?**
Your profile is public only if you toggle "Public" in the panel. Your Upstash credentials never leave your machine.

**What about the URL?**
reqit.pxxl.dev is the web frontend. Your profile is at \`reqit.pxxl.dev/yourname\`. If you own a custom domain, you can point it to pxxl.app.

---

Your API work deserves to be seen. Fill out your profile, publish it, and share the link. It takes five minutes.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
];
