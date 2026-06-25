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
  "API Fundamentals",
  "Core Concepts",
  "Testing & Automation",
  "Protocols & APIs",
  "Collaboration & Workflow",
  "Developer Experience",
] as const;

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "postman-import",
    title: "I imported my entire Postman workspace into reqit in 30 seconds",
    description: "My team had 47 Postman collections spread across 6 workspace accounts. I spent an afternoon migrating everything to reqit. The import took 30 seconds.",
    date: "2026-06-10",
    readTime: "4 min read",
    tags: ["tutorial", "import", "postman"],
    category: "Developer Experience",
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
    category: "Collaboration & Workflow",
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
    category: "Developer Experience",
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
    title: "What are Collections? Organizing API requests like folders on your computer",
    description: "If you have ever organized papers into folders, you already understand collections. Think of them as folders for your API requests.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "collections", "beginner"],
    category: "Core Concepts",
    content: `Imagine you have a desk covered in papers. Some are for shopping. Some are for school. Some are for your games. When you put each group of papers into its own folder, your desk becomes clean and you can find anything fast.

**Collections in reqit work exactly like those folders.**

A collection is a group of API requests that belong together. If you are building a shopping app, you might have a "Users" collection with requests for logging in and signing up, and a "Products" collection with requests for browsing and buying.

## A real-life story

Meet Sarah. She is building an app for a pizza delivery service. She has requests to:

- Get the menu (**GET /menu**)
- Place an order (**POST /orders**)
- Check if the driver is coming (**GET /orders/:id/status**)
- Add a new pizza to the menu (**POST /admin/pizzas**)

Without collections, these are just a messy pile of URLs. With collections, Sarah puts them in:

\`\`\`
🍕 Pizza App
  ├── 🛒 Customer
  │   ├── Get the menu
  │   ├── Place an order
  │   └── Check order status
  └── 🔧 Admin
      └── Add a new pizza
\`\`\`

Now she can find anything in one click. Her teammate can open the same collection and know exactly where everything lives.

## What else can collections do?

- **Rename** any request or collection with one click
- **Drag and drop** to reorder them
- **Move** a request from one collection to another
- **Duplicate** a request to make a variation
- **Export** an entire collection as a file to share

## Why this matters

When your API grows from 5 requests to 50, you need organization. Collections are how you keep your sanity. Every tool has them — but reqit stores them as simple JSON files you can put in Git. More on that in the Git explainer.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-http-requests",
    title: "What is an HTTP Request? Sending a letter across the internet",
    description: "Every time you type a URL and press Enter, you are sending a letter. HTTP requests are just letters your computer writes to other computers.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "http", "beginner"],
    category: "Core Concepts",
    content: `Imagine you want to ask your friend for a recipe. You write a letter, put it in an envelope, write their address, and drop it in a mailbox. Your friend gets it, reads it, writes the recipe on a new piece of paper, and mails it back.

**An HTTP request is exactly that — a letter from your computer to another computer.**

The other computer is called a **server**. The letter you send is the **request**. The letter you get back is the **response**.

## The parts of a request

A letter has: an address, a type of request, and maybe a note inside. An HTTP request has the same things.

- **URL** — the address (like \`https://api.pizza.com/menu\`)
- **Method** — what you want to do (GET means "give me something", POST means "here is something new")
- **Headers** — extra info, like "please send the answer in English"
- **Body** — the note inside (only for POST, PUT, PATCH)

## Methods are like verbs

- **GET** — "Can I see the menu please?" (read data)
- **POST** — "Here is my order, please make it" (create data)
- **PUT** — "Please replace my old address with this new one" (update everything)
- **PATCH** — "Please change just my phone number" (update one thing)
- **DELETE** — "Please remove my account" (delete data)

## Real life: ordering pizza

1. You open reqit and type \`https://api.pizza.com/menu\` with method **GET**
2. Reqit sends the letter. The pizza server looks up the menu.
3. The server writes back: \`{ "pizzas": ["Margherita", "Pepperoni"] }\`
4. You see the response in reqit — formatted, color-coded, easy to read.

That is it. An API is just a bunch of these letter exchanges, and reqit is the post office that handles every letter for you.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-environments",
    title: "What are Environments? A magic coloring book for your API",
    description: "Imagine a coloring book where the same picture can be colored differently every time. That is what environments do for your API requests.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "environments", "beginner"],
    category: "Core Concepts",
    content: `Imagine you have a coloring book page with a house, a tree, and a sun. You color it with your crayons. Now your friend wants to color the same page with different colors. You do not need a new book — you just use different crayons.

**Environments are those crayons for your API requests.**

You write your API request once, but use different values depending on where you are. When you are developing, you talk to a test server. When you are ready, you talk to the real server. The request stays the same — only the values change.

## A real-life story

Meet Alex. He is building a weather app. He has:

- **Development** — a test server on his own computer at \`http://localhost:3000\`
- **Staging** — a team test server at \`https://staging.weather.app\`
- **Production** — the real server at \`https://api.weather.app\`

Without environments, Alex would need three different copies of every request. Every time he changes something, he has to change it three times. One mistake and the production request breaks.

With environments, Alex writes his URL as \`{{BASE_URL}}/weather\`. Then he creates:

- A **Dev** environment where \`BASE_URL\` = \`http://localhost:3000\`
- A **Staging** environment where \`BASE_URL\` = \`https://staging.weather.app\`
- A **Production** environment where \`BASE_URL\` = \`https://api.weather.app\`

Now he just switches environments with one click. The same request hits different servers.

## What goes in an environment

Anything that changes between places:

- Server URLs (\`api.pizza.com\` vs \`localhost:3000\`)
- API keys (\`test-key-123\` vs \`real-key-456\`)
- User IDs, passwords, tokens
- Feature flags

## Why this is wonderful

You write your request once. You test it everywhere. You never accidentally send a test request to the real server. You never have to hunt through your requests to find hardcoded values. Environments are one of those features that seems boring until you use them — then you cannot live without them.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-auth",
    title: "What is Authentication? Showing your ID card to the server",
    description: "When you go to a club, you show your ID. When your computer talks to an API, it shows an auth token. Same thing.",
    date: "2026-06-15",
    readTime: "4 min read",
    tags: ["explainer", "auth", "security"],
    category: "Core Concepts",
    content: `Imagine you walk into a building with a security guard. The guard asks "who are you?" You show your ID card. The guard checks it and lets you in.

**Authentication in APIs is the same thing.** Your request needs to prove who it is before the server lets it in. The ID card for APIs is called an **auth token** or **API key**.

## Types of API ID cards

Different servers want different kinds of ID. Reqit supports them all.

### Bearer Token — like a VIP wristband

You get a special token when you log in. You put it in the header: \`Authorization: Bearer <token>\`. The server checks it and knows who you are.

**Real life:** You log into a website. The website gives you a wristband. Every time you come back, you show the wristband and they let you in without asking for your password again.

### Basic Auth — like writing your name and password on a note

The client sends \`username:password\` encoded in a special way. Simple but not very secure on its own.

**Real life:** You tell the guard "I am Alice, my password is pizza123". The guard writes it down and checks a list.

### API Key — like a secret handshake

A special key that identifies you. Usually sent in a header like \`X-API-Key: abc123\`.

**Real life:** You and your friend invent a secret handshake. Anyone who does the handshake is part of the group.

### OAuth2 — like a checked-in library card

You go to a library. You show your ID. The librarian gives you a temporary card that lets you borrow books for one day. When the day ends, you get a new one.

**Real life:** You log in with Google on a new app. The app never sees your Google password — it just gets a temporary token that says "this person is allowed to use the app for the next hour."

### Digest & NTLM — like a puzzle

The server gives you a puzzle. You solve it and send the answer back. If the answer is right, the server knows it is really you.

**Real life:** The guard asks "what is 2 + 2?" You say "4". The guard knows you are human because a robot could not have solved it. (This is simplified, but you get the idea.)

## How reqit helps

Instead of remembering all these different ID card types, reqit has an **Auth tab** on every request. You pick the type, fill in the details, and reqit adds the right headers automatically. No manual typing. No mistakes.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-mock-server",
    title: "What is a Mock Server? A pretend backend for when the real one is not ready",
    description: "Ever played pretend restaurant? You write a menu on paper and take fake orders. A mock server is the same thing for your frontend code.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "mock", "testing"],
    category: "Testing & Automation",
    content: `When you were a kid, you probably played "pretend". You pretended to be a chef, a teacher, or a superhero. You did not need real tools — your imagination was enough.

**A mock server is pretend for your API.**

Your frontend code needs data to work. But maybe the real backend is not built yet. Maybe it is too expensive to call every time. Maybe you want to test how your app handles errors.

A mock server pretends to be the real backend. Your frontend talks to it just like the real thing, but the mock server sends back pretend data that you control.

## A real-life story

Maria is building a weather app. The real weather API charges $0.01 per call. Every time Maria reloads her app during development, it costs money. By the time she is done, she has spent $50 just refreshing the page.

Maria uses reqit's mock server instead:

1. She sends one real request to get weather data
2. She clicks **Save for Mock**
3. She starts the mock server
4. Her app talks to \`http://localhost:4321/weather\` instead of the real API
5. The mock server sends back the exact same data

Now Maria can reload her app 1,000 times and it costs $0.

## What else can the mock server do?

- **Delay responses** — pretend the server is slow to test loading spinners
- **Send errors** — make the server return a 500 error to test your error handling
- **Override status codes** — force a 404 to see how your app handles "not found"
- **Match route parameters** — \`/users/:id\` automatically matches \`/users/123\` and \`/users/456\`

## Why this matters

Without a mock server, frontend developers either wait for the backend to be ready, or hardcode fake data that gets forgotten in the code. With a mock server, the frontend talks to a real HTTP server from day one. The switch to the real backend is one URL change.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-runner",
    title: "What is a Collection Runner? A robot that tests all your APIs automatically",
    description: "Imagine having a robot that clicks every button in your app and tells you which ones are broken. That is what a collection runner does for your APIs.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "runner", "testing"],
    category: "Testing & Automation",
    content: `Imagine you own a toy factory with 100 different toys. Every morning, you need to check that every toy works. Picking up each one and testing it by hand takes hours. Now imagine a robot that tests all 100 toys in seconds and hands you a list of the broken ones.

**A collection runner is that robot for your API requests.**

You put your requests in a collection, add some checks (called assertions), and press **Run**. Reqit fires every request, checks the responses, and tells you which passed and which failed.

## A real-life story

Jake runs an online store. Every week, something breaks after a deployment. Last week, the login page worked but the checkout page was returning errors. Nobody noticed for three hours. 47 customers abandoned their carts.

Jake creates a collection called "Smoke Test" with 20 requests:
- GET the homepage — expects status 200
- POST login with valid credentials — expects status 200 and a token
- GET the product list — expects an array of products
- POST add to cart — expects status 201
- POST checkout — expects status 200

He adds assertions:
- Status code must be 200 or 201
- Response time must be under 2 seconds
- The response must include specific fields

Now after every deployment, Jake clicks Run. If all 20 pass, he knows the site works. If any fail, he knows exactly what broke.

## What makes the runner powerful

- **Parallel mode** — fires multiple requests at once (like having 5 robots instead of 1)
- **Sequential mode** — fires requests one by one when order matters
- **Retries** — if a request fails, it tries again (servers sometimes hiccup)
- **Assertions** — check status codes, response bodies, headers, timing
- **Reports** — export results as JSON or HTML to share with your team

## The real magic

A runner turns your collection from a list of requests into a test suite. You are not just firing requests anymore — you are automatically verifying that your entire API works correctly.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-git",
    title: "What is Git Integration? A time machine for your API collections",
    description: "Imagine if every change to your collections was saved forever and you could go back to any moment. That is what Git gives you.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "git", "collaboration"],
    category: "Collaboration & Workflow",
    content: `Have you ever saved a game, made a mistake, and loaded your old save to fix it? That is what Git does for your files. It is like a time machine for your work.

**Reqit stores collections as plain JSON files.** This is a big deal because it means you can put them in Git — the same tool developers use for code.

## Why storing collections as files matters

Most API tools store your data in a database. You cannot run \`git diff\` on a database. You cannot branch a database. You cannot review a database change in a pull request.

Reqit stores each collection as a folder of JSON files. You put them in Git. Now everything that works for code works for your APIs too.

## A real-life story

Priya is on a team of 5 developers building a hotel booking app.

**Before reqit:** One person changes a request URL in their Postman workspace. Nobody knows. The next deployment fails because the API endpoint changed but nobody updated their collections. Debugging takes 2 hours.

**With reqit + Git:**
1. Priya changes a request URL in her collection
2. She commits: \`git add . && git commit -m "update booking URL"\`
3. She pushes: \`git push\`
4. Her teammate pulls: \`git pull\`
5. The change is there. Everyone can see the diff in the PR.

## What you can do with Git

- **See what changed** — \`git diff\` shows exactly which URLs, headers, or bodies changed
- **Go back in time** — \`git checkout <old-commit>\` restores your collections to any past state
- **Branch your APIs** — create a branch for a new feature, change your collections, merge when the feature ships
- **Review in PRs** — your API changes show up right alongside your code changes
- **Sync without a cloud** — push to GitHub, pull on another machine. No account needed.

## The magic sentence

Reqit stores collections as files. Files go in Git. Git is a time machine. You never lose work, you always know who changed what, and you can review API changes in the same place you review code changes.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-websocket",
    title: "What is WebSocket? A telephone call instead of sending letters",
    description: "HTTP is like mailing a letter every time you want to say something. WebSocket is like a telephone call — you stay connected and talk back and forth instantly.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "websocket", "realtime"],
    category: "Protocols & APIs",
    content: `With regular HTTP (letters), you send a request and get a response. Conversation over. If you want more data, you send another letter.

**WebSocket is different.** You open a connection (dial the phone), and both sides can talk anytime. The server does not have to wait for you to ask — it can send data whenever it wants.

## Real-life example: a chat app

Imagine WhatsApp or Telegram. When your friend sends a message, it appears on your phone instantly. You did not refresh the page. You did not click anything. The message just arrived.

That is WebSocket at work.

## Another example: live sports scores

When you watch a cricket or football scoreboard online, the numbers update by themselves. You do not keep clicking refresh. The server sends the new score to your browser the moment it changes.

Again, WebSocket.

## How reqit helps you test WebSocket

Reqit has a built-in WebSocket client. You type a WebSocket URL (they start with \`ws://\` or \`wss://\`), click Connect, and:

1. You see every message the server sends in real time
2. You can send your own messages
3. You can see the connection state (connected, disconnected, error)
4. Messages are logged with timestamps so you can see the order

## Also: Server-Sent Events (SSE)

SSE is like WebSocket's simpler cousin. The server sends data to you whenever it wants, but you can only send back by making regular HTTP requests. It is like a radio station — the station broadcasts, you listen.

Reqit supports SSE too.

## Why WebSocket matters

Modern apps are real-time. Chat, live notifications, collaborative editing, live scores, stock tickers, multiplayer games — all of these use WebSocket or SSE. If your app has any real-time features, you need to test the WebSocket connection. Reqit gives you the tool.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-graphql",
    title: "What is GraphQL? Ordering exactly what you want at a restaurant",
    description: "With REST APIs, the waiter brings you the full meal even if you only wanted a spoonful. GraphQL lets you say exactly what you want.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "graphql", "api"],
    category: "Protocols & APIs",
    content: `Imagine you go to a restaurant and order "the full meal." The waiter brings you soup, salad, steak, fries, dessert, and a drink. But you only wanted the steak and fries. You have to eat through everything to get to what you need. And you pay for everything.

**That is how REST APIs work.** You ask for a user, and the API returns the user's name, email, address, phone number, profile picture, friends list, settings, and 50 other fields. But your screen only needs the name.

**GraphQL is different.** You tell the waiter: "I want a steak and fries, nothing else." The kitchen makes exactly that. No extra food. No extra cost.

## A real-life story

Tyler is building a profile page. He needs to show:
- The user's name
- The user's profile picture
- The last 3 posts

With a REST API, Tyler might need to make:
1. \`GET /users/123\` — gets name, email, address, phone, picture, settings, friends... (100 fields, he needs 2)
2. \`GET /users/123/posts?limit=3\` — gets all post data, he needs the title and date

With GraphQL, Tyler sends one query:
\`\`\`graphql
query {
  user(id: 123) {
    name
    profilePicture
    posts(last: 3) {
      title
      date
    }
  }
}
\`\`\`

The server sends back only name, profilePicture, and the last 3 posts with their titles and dates. Nothing more.

## What reqit gives you

Reqit's GraphQL client lets you:
- Write queries and see results
- Use variables (like environments for GraphQL)
- Run schema introspection (ask the server "what queries do you support?")
- Subscribe to real-time updates via WebSocket

## Why GraphQL is popular

Mobile apps love GraphQL because less data means faster load times. Frontend teams love it because they can ask for exactly what they need without waiting for the backend team to build a new endpoint. GraphQL is like a buffet where you only pay for what you put on your plate.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-scripting",
    title: "What is Scripting? A little robot helper that prepares and checks your requests",
    description: "Imagine having a robot that fills out forms for you before you submit them, and then checks the result afterwards. That is scripting in reqit.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "scripts", "automation"],
    category: "Core Concepts",
    content: `Imagine you are filling out a form at the doctor's office. Before you see the doctor, a nurse takes your temperature and writes it down. After you see the doctor, another nurse checks your blood pressure.

**Scripting in reqit works the same way.** You can run code **before** a request and **after** a request.

## Pre-request scripts — the nurse before the doctor

A pre-request script runs before your request is sent. You can use it to:
- Generate a random email address for testing
- Set the current timestamp as a variable
- Compute a signature or hash
- Log what is about to happen

**Real life:** You are testing a signup form. Every time you test, you need a new email because "test@gmail.com" is already taken. A pre-request script generates a random email like "test-16234567@gmail.com" and sets it as a variable. Your request uses \`{{EMAIL}}\`. You never have to type an email again.

## Post-response scripts — the nurse after the doctor

A post-response script runs after the response comes back. You can use it to:
- Extract data from the response and save it as a variable
- Check that certain fields exist
- Log the response for debugging

**Real life:** You are testing a login flow. After you log in, the server sends back a token. You need that token for the next request. A post-response script grabs the token from the response and saves it as \`{{AUTH_TOKEN}}\`. The next request uses it automatically.

## Chaining requests together

This is where scripting becomes magical. You can chain requests:

1. **Sign up** → extract the user ID
2. **Create a post** using that user ID → extract the post ID
3. **Comment on the post** using that post ID

Each step uses data from the previous step, automatically. No copy-pasting. No manual work.

## How reqit helps

In the Scripts tab of any request, you write JavaScript that runs before and after. The \`variables\` object lets you read and set values. It is simple enough for a 5-minute script but powerful enough for complex API workflows.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-workspaces",
    title: "What are Workspaces? Different desks for different projects",
    description: "Imagine having one desk for work, one for school, and one for your hobbies. Each desk has its own papers and tools. Workspaces are those desks in reqit.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "workspaces", "organization"],
    category: "Collaboration & Workflow",
    content: `If you work on multiple projects, you know the pain of mixed-up papers. A request for the shopping app is next to a request for the weather app. Environments for one project leak into another. The cookie from the login page of one app messes up the other.

**Workspaces are the solution.** Each workspace is a completely separate world with its own collections, environments, history, and cookies.

## A real-life story

David is a freelance developer. He has three clients:
1. **Pizza Palace** — a delivery app
2. **Weather Now** — a weather website
3. **Task Robot** — a to-do list app

Without workspaces, all three projects live in the same list. David has 47 collections from three different companies mixed together. He accidentally sends a Pizza Palace request with Weather Now's API key. Nothing works.

With workspaces, David creates three workspaces:

\`\`\`
📁 Pizza Palace
  ├── Collections (menu, orders, customers)
  ├── Environments (dev, staging, prod)
  └── History

📁 Weather Now
  ├── Collections (forecast, alerts, locations)
  ├── Environments (dev, prod)
  └── History

📁 Task Robot
  ├── Collections (tasks, users, auth)
  ├── Environments (local, staging, prod)
  └── History
\`\`\`

He clicks between them like switching desks. Each workspace has its own state. No mixing. No mistakes.

## What makes workspaces powerful

- **Each workspace is a folder on your disk** — you can put it anywhere, back it up, or sync it via Dropbox
- **File watcher** — if you change a file outside reqit, the app detects it and reloads
- **Switch instantly** — click a workspace and everything changes: collections, environments, history, cookies
- **Open from folder** — already have a reqit workspace? Open its folder from the home screen

## The mental model

Think of reqit as a desk organizer. Each workspace is a drawer. Open one drawer, work on it. Close it, open another. Nothing from one drawer spills into another. Clean. Simple. Organized.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-import-export",
    title: "What is Import and Export? Moving your toys between different toy boxes",
    description: "When you outgrow a toy box or get a new one, you move your toys. Import and export let you move your API collections between tools.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "import", "export"],
    category: "Collaboration & Workflow",
    content: `When you were a kid and got a new toy box, you probably dumped all your toys from the old box into the new one. You did not want to lose your favorite action figure or building blocks.

**Import and export do the same thing for your API collections.**

## Import — bringing toys into your new box

Reqlet lets you import from:
- **Postman** — the most popular API client. Just export your collection from Postman as a JSON file and import it into reqit. Every request, folder, header, and auth method comes through.
- **Insomnia** — another popular client. Same thing — export, import, done.
- **Hoppscotch** — a web-based API tool. Export and import seamlessly.
- **OpenAPI** — a standard format for describing APIs. Import any \`.yaml\` or \`.json\` spec file and reqit creates collections from it.
- **cURL** — paste any curl command and reqit parses it into a ready-to-send request. Handy when someone shares a curl command in a GitHub issue or Slack message.

## Export — taking your toys to another box

Reqlet can export to:
- **Postman** format — if you need to share with a Postman user
- **Insomnia** format — same
- **Hoppscotch** format — same
- **OpenAPI JSON** — publish your collection as a standard API specification
- **OpenAPI HTML** — a self-contained Swagger UI page you can open in any browser
- **Markdown** — beautiful documentation you can put in your project's wiki or README
- **cURL** — copy any request as a curl command
- **Code snippets** — export as JavaScript fetch, Python requests, or cURL for copy-pasting into code

## A real-life story

Nina has been using Postman for 3 years. She has 120 collections. Her company is switching to reqit because of the Git-native storage. She is nervous about losing her work.

She opens Postman, exports all collections as v2.1 JSON files. Opens reqit, clicks Import, picks the files. 5 minutes later, all 120 collections are in reqit. Every request, every folder, every header, every auth method. Nothing lost.

Six months later, her team needs to share a collection with a partner who uses Insomnia. Nina clicks Export → Insomnia format, emails the file. The partner imports it. Everyone is happy.

## The philosophy

Reqlet does not lock you in. Your data comes in, your data goes out. You own it. Always.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-contract-testing",
    title: "What is Contract Testing? Making sure the API keeps its promises",
    description: "When a friend promises to meet you at 3pm, you expect them at 3pm. Contract testing checks that APIs keep their promises too.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "contract-testing", "testing"],
    category: "Testing & Automation",
    content: `If your friend says "I will meet you at the park at 3pm," you expect them to be at the park at 3pm. If they show up at 5pm or at the library instead, the promise is broken.

**An API spec (OpenAPI) is a promise.** It says: "If you call GET /users, you will get back a list of users with names and emails." Contract testing checks that the API actually keeps its promise.

## How it works

1. You have an OpenAPI spec file (a YAML or JSON file that describes what your API should do)
2. You link it to a collection in reqit
3. Every time you send a request from that collection, reqit checks the response against the spec
4. If the response matches, you get a green ✓. If not, you get a red ✗ with details.

## A real-life story

Emma's team has 15 microservices. Each one has an OpenAPI spec. Last month, the payment service started returning \`{ "error": "timeout" }\` instead of the expected \`{ "status": "failed", "code": 408 }\`. The frontend team's code crashed because it was looking for \`code\` but got \`error\`. It took 4 hours to find and fix.

Emma sets up contract testing:
1. She links each collection to its OpenAPI spec
2. After every deployment, she runs the collections
3. If any response does not match the spec, reqit shows exactly which field is wrong

Now when the payment service changes a response field, Emma knows in 2 minutes instead of 4 hours.

## What contract testing checks

- **Status code** — did the API return the right HTTP status?
- **Response body** — does the JSON match the schema defined in the spec?
- **Headers** — are the required headers present?

## The badge

After every request, you will see a badge in the status bar:
- Green ✓ Contract OK — the API kept its promise
- Red ✗ N violations — here is what went wrong

Click the badge to see details: "Field 'code' expected at $.error but got 'timeout'."

## Why this is important

APIs change. Teams make mistakes. Documentation goes out of date. Contract testing catches the gap between what the API promises and what it actually does. It is like having a referee for every API call.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-history",
    title: "What is Request History? A diary of every API call you ever made",
    description: "Remember that perfect API request you made last week but forgot the exact URL? History remembers it for you.",
    date: "2026-06-15",
    readTime: "2 min read",
    tags: ["explainer", "history", "beginner"],
    category: "Developer Experience",
    content: `Have you ever said "I did that thing last week but I cannot remember how"? It happens to everyone. Your brain is not a computer — it forgets things.

**History is your memory for API requests.** Every request you send in reqit is automatically saved to the history list. You can go back days, weeks, or months and see exactly what you sent.

## A real-life story

Carlos was testing a payment endpoint last Thursday. He spent 20 minutes crafting the perfect request with the right headers, a specific auth token, and a complex JSON body. It worked perfectly. But today, he needs to test it again. He cannot remember the exact URL or the body format.

Without history, Carlos has to rebuild the request from scratch. He checks Slack, checks his notes, tries to remember. 15 minutes later, he is close but not exact.

With history, Carlos opens the History list in reqit, scrolls to Thursday, clicks the request. It opens in a new tab with every detail restored — URL, method, headers, body, auth. He clicks Send and it works. 3 seconds instead of 15 minutes.

## What history tracks

- The URL you called
- The HTTP method (GET, POST, etc.)
- The headers you sent
- The body you sent
- The response you got back (status, timing, size)
- The exact time you sent it

## What you can do with history

- **Replay** any past request with one click
- **Browse** by date to find what you did yesterday
- **Favorite** important requests so they are easy to find
- **Search** through history by URL or method
- **Export** history as a file

## The best part

History is automatic. You do not have to remember to save. You do not have to organize it. Every request is logged, every time. Your past work is always one click away.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-codegen",
    title: "What is Code Generation? Turning your API requests into ready-to-use code",
    description: "You tested an API in reqit and it works. Now you need to call it from your app. Code generation writes the code for you.",
    date: "2026-06-15",
    readTime: "2 min read",
    tags: ["explainer", "codegen", "developer-experience"],
    category: "Developer Experience",
    content: `Imagine you just figured out the perfect way to call an API. The URL is right, the headers are correct, the body is perfect. Now you need to write code that does the same thing in your app.

You open a new file and start typing. You check the URL 3 times. You forget one header. You get the JSON body wrong. You spend 10 minutes debugging.

**Code generation does the typing for you.** Click a button, pick your language, and reqit writes the exact code to make that API call.

## A real-life story

Fatima is a frontend developer. She tests an API in reqit to make sure it works. Now she needs to call it from her React app. She opens the Code Generation modal in reqit, picks JavaScript fetch, and reqit gives her:

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

She copies it, pastes it into her code, done. 5 seconds instead of 5 minutes.

## What you can generate

- **cURL** — paste into any terminal
- **JavaScript fetch** — for web apps, Node.js, or any JS project
- **Python requests** — for scripts, data science, or backend code

## Why this is great

You tested the request in reqit. You know it works. The generated code is guaranteed to match exactly what you tested. No typos. No forgotten headers. No mismatched JSON. Copy. Paste. Ship.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-shortcuts",
    title: "What are Keyboard Shortcuts? Magic spells that make reqit faster",
    description: "Every time you reach for your mouse, you lose a second. Keyboard shortcuts let you control reqit without leaving the keyboard.",
    date: "2026-06-15",
    readTime: "2 min read",
    tags: ["explainer", "shortcuts", "productivity"],
    category: "Developer Experience",
    content: `Imagine you are playing a video game. Every time you want to jump, you have to click a button on the screen with your mouse. That would be slow and frustrating. Real games let you press a key — W, A, S, D, Space — and things happen instantly.

**Reqit gives you the same power.** Instead of clicking buttons on the screen, you press keys on your keyboard and things happen instantly.

## The most useful spells

| Spell | What it does |
|-------|-------------|
| **Ctrl + Enter** | Send the current request right now |
| **Ctrl + S** | Save the current request |
| **Ctrl + T** | Open a new blank tab |
| **Ctrl + W** | Close the current tab |
| **Ctrl + E** | Jump to the URL bar and select everything |
| **Ctrl + Shift + I** | Open the import dialog |
| **Ctrl + K** | Open the command palette (like a search bar for actions) |
| **Ctrl + Z** | Undo your last change |

## A real-life story

Ken watches a colleague use reqit. The colleague opens a request, types a URL, presses Ctrl+Enter, inspects the response, presses Ctrl+S to save it. Everything happens in a flow. No pauses. No mouse movement.

Ken tries to do the same thing with the mouse. Click the URL bar. Type. Click Send. Wait. Click the response. Click Save. Each click takes a second and a mental "where is that button?" pause.

After a week of using shortcuts, Ken is twice as fast. He does not think about where buttons are. His fingers just know the keys.

## The command palette (Ctrl+K)

The most powerful shortcut of all. Press Ctrl+K and a search box appears. Type what you want to do — "import", "save", "settings", "theme", "mock" — and press Enter. It is like having every feature of reqit in a search bar.

## The principle

Every time you take your hand off the keyboard to use the mouse, you lose momentum. Keyboard shortcuts keep you in the flow. Learn one new shortcut per day. In two weeks, you will wonder how you lived without them.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-grpc",
    title: "What is gRPC? A super-fast courier between services",
    description: "If HTTP is a regular mail truck, gRPC is a Formula 1 car. It is built for speed and efficiency when computers talk to each other.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "grpc", "protocol"],
    category: "Protocols & APIs",
    content: `Imagine you need to send a package across town. You can use a regular mail truck that stops at every house — or you can use a courier on a motorcycle that goes directly to the destination, fast.

**gRPC is the motorcycle courier.** It is a way for computers to talk to each other that is much faster and more efficient than regular HTTP.

## How it is different from HTTP

Regular HTTP sends messages as text (JSON or XML). The computer has to read the entire text, figure out what it means, and then use it. This takes time and bandwidth.

gRPC sends messages in a special binary format. The computer already knows the structure in advance. It does not have to read and figure out — it just unpacks the data directly. Like the difference between reading a recipe vs recognizing a dish by sight.

## A real-life story

A video streaming service has 50 different services that talk to each other: user service, video service, recommendation service, payment service, etc. They send millions of messages per second.

With regular HTTP/JSON, each message is about 1KB of text. That is 50GB of data per second just for communication between services. The servers spend 30% of their CPU time just parsing JSON.

The team switches to gRPC. Each message is now about 200 bytes in binary format. That is 10GB of data per second — 5x less. CPU usage for parsing drops to 5%. The service is faster, cheaper, and uses less electricity.

## How reqit helps

Reqit has a gRPC client that lets you:

- **Invoke gRPC methods** — call any gRPC service from your computer
- **Stream data** — gRPC supports streaming, and reqit handles it
- **See the response** — decoded and formatted for reading

## When to use gRPC

- Services talking to each other internally (microservices)
- Real-time streaming data
- When performance matters a lot
- When you control both the client and server

## When to use HTTP instead

- Browser applications (browsers do gRPC differently)
- Public APIs that need to be easy to use
- When you want human-readable messages

Reqit supports both, so you can use the right tool for each job.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-api-designer",
    title: "What is the API Designer? Drawing a blueprint before building a house",
    description: "You would not build a house without a blueprint. The API Designer lets you plan your API before writing a single line of code.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "api-design", "openapi"],
    category: "Developer Experience",
    content: `Before an architect builds a house, they draw a blueprint. The blueprint shows where every room goes, where the doors are, where the windows are. The builders follow the blueprint so they know exactly what to build.

**The API Designer is a blueprint for your API.** You describe every endpoint, every parameter, every response — and then your backend team builds the API to match the blueprint.

## How it works

The API Designer uses the **OpenAPI** format (also known as Swagger). It is a standard way to describe APIs that thousands of companies use.

You can:

1. **Create a new spec** — give it a name and version
2. **Add endpoints** — specify the path, method, and description
3. **Define parameters** — query params, headers, path variables
4. **Describe responses** — status codes, response bodies, headers

## A real-life story

A team of 8 is building a new banking app. The frontend team, the backend team, and the mobile team all need to agree on how the API will work.

Before writing any code, the team lead uses the API Designer to create a spec:

- \`POST /api/login\` — takes email and password, returns a token
- \`GET /api/accounts\` — returns a list of accounts
- \`GET /api/accounts/{id}/transactions\` — returns transactions for one account
- \`POST /api/transfer\` — sends money between accounts

Everyone reviews the spec. The frontend team starts building screens. The backend team starts building the actual API. The mobile team starts building the app. All three teams work from the same blueprint.

When the backend is ready, the frontend imports the spec into reqit using the OpenAPI import feature, and every request is already there, ready to test.

## Why design-first is better

- **Everyone agrees before building** — no "I thought the field was called 'email', not 'email_address'"
- **Frontend and backend can work in parallel** — frontend does not have to wait for backend
- **The spec becomes documentation** — import it into reqit's API Reference viewer and anyone can read it
- **Contract testing** — link your spec to a collection and reqit checks that the real API matches the blueprint

## Import existing specs

If you already have an OpenAPI spec (from Swagger Editor, Stoplight, or any other tool), you can import it into reqit and it becomes a collection. Request the API, read the docs, test the endpoints — all from one place.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-cookies",
    title: "What is a Cookie Jar? Remembering what the server told you",
    description: "When you visit a website and it remembers your name, that is a cookie. reqit remembers cookies for you automatically.",
    date: "2026-06-15",
    readTime: "2 min read",
    tags: ["explainer", "cookies", "beginner"],
    category: "Core Concepts",
    content: `When you visit a website for the first time, the server might give you a cookie. Not a real cookie — a small piece of data that says "this visitor is Alice." The next time you visit, your browser shows the cookie and the server remembers you.

**Cookies are how servers remember who you are between requests.** Without cookies, you would have to log in on every single page.

## How reqit handles cookies

Reqit has a built-in **cookie jar**. When a server sends a \`Set-Cookie\` header in a response, reqit automatically stores that cookie. On the next request to the same server, reqit sends the cookie back.

## A real-life story

You are testing a login flow:

1. You send \`POST /login\` with username and password
2. The server responds: \`Set-Cookie: sessionId=abc123; Domain=.example.com\`
3. Reqit stores the cookie automatically
4. You send \`GET /profile\`
5. Reqit automatically includes: \`Cookie: sessionId=abc123\`
6. The server sees the cookie and returns your profile

You did not have to copy anything. You did not have to remember anything. Reqit handled it, just like a browser does.

## What you can see

Reqit shows you every cookie in the response — name, value, domain, when it expires, and security flags. You can also:

- Clear cookies for a specific domain
- Clear all cookies
- See which cookies are stored in your workspace

## Why this matters

Many APIs use cookies for authentication and session management. Without a cookie jar, you would have to manually extract the cookie from every response and add it to every request. That is tedious and error-prone. Reqit does it automatically so you can focus on testing.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-load-testing",
    title: "What is Load Testing? Seeing if your API can handle a crowd",
    description: "Imagine 10,000 people walking into your shop at the same time. Would it handle the crowd? Load testing finds out before it happens.",
    date: "2026-06-15",
    readTime: "3 min read",
    tags: ["explainer", "load-testing", "performance"],
    category: "Testing & Automation",
    content: `Imagine you own a ice cream shop. On a normal day, 10 customers come in. Your one server can handle them easily. But on a hot summer day, 100 people show up at once. Will your shop handle it?

**Load testing is simulating 100 customers to find out before the hot day arrives.**

## How it works

You configure a load test with:
- **Virtual Users (VUs)** — how many pretend customers to simulate
- **Duration** — how long to run the test (e.g., 30 seconds)
- **Request** — what each customer does (e.g., GET /menu)

Reqlet fires the request repeatedly with the specified number of virtual users and measures how the API responds.

## A real-life story

Maya runs an online ticket platform. Tomorrow, tickets for a famous singer go on sale. She expects 50,000 people to visit her site in the first minute.

Maya runs a load test using reqit:
- 100 virtual users
- Each one calls \`GET /api/events/123\` and \`POST /api/book\`
- Duration: 60 seconds

The results show that at 50 concurrent users, response time jumps from 200ms to 2 seconds. At 80 users, some requests start failing with 503 errors.

Maya calls her backend team. They optimize the database query and add more servers. She runs the test again — this time, 100 users get 300ms response time with zero errors.

The next day, the ticket sale goes smoothly. 50,000 people get through without a crash. Load testing saved the launch.

## What load testing measures

- **Response time** — how fast the API responds (average, slowest, fastest)
- **Throughput** — how many requests per second the API can handle
- **Error rate** — what percentage of requests fail
- **Latency percentiles** — the slowest 1% of requests (these are usually the ones that fail)

## Why reqit's load testing is useful

You do not need to set up a separate tool like k6 or JMeter. You do not need to write YAML configs. You pick the request you already tested, configure VUs and duration, and press Run. The results are displayed in a clear report. Export it as JSON or HTML to share with your team.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-telemetry",
    title: "What is Telemetry? reqit does not spy on you — and here is why",
    description: "Some apps watch what you do and send reports home. reqit does the opposite. It tells you what it would send and asks permission first.",
    date: "2026-06-15",
    readTime: "2 min read",
    tags: ["explainer", "privacy", "philosophy"],
    category: "Developer Experience",
    content: `Imagine a toy that reports everything you do with it back to the toy company. "You pressed button A 5 times. You played with it for 3 hours. You live in this city." That is telemetry, and many apps do it without asking.

**Reqit does the opposite.** Telemetry is completely turned off by default. If you want to help us improve reqit, you can turn it on in Settings. And even then, we show you exactly what data would be sent.

## What telemetry would include if enabled

- **What features you use** — "user clicked 'Import from Postman'" or "user ran a collection"
- **App performance** — how fast reqit starts, how much memory it uses
- **Errors** — when something crashes, what went wrong

## What telemetry would never include

- Your API requests or responses
- Your environment variables or tokens
- Your collections or data
- Your name, email, or any personal information
- Your IP address or location

## Air-gap mode

If you work in a high-security environment (military, finance, healthcare), reqit has an **air-gap mode**. You can disable:
- Telemetry
- The interceptor (browser proxy)
- Plugin downloads
- Update checks
- SSO (single sign-on)
- Vault access

In air-gap mode, reqit cannot make any network requests at all. It is completely isolated.

## A real-life story

A bank's security team is evaluating reqit. They need to make sure the app does not send any data to external servers. They check two things:

1. **Telemetry is off by default** — verified
2. **Air-gap mode** — they enable it, disabling all network features — verified

The bank approves reqit for internal use. Their developers get a fast, modern API client that respects their security requirements.

## The principle

Your data is yours. Always. reqit is designed so you never have to wonder "is this app sending my API keys somewhere?" The answer is no — and we prove it by showing you exactly what telemetry would send, and letting you disable it completely.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-cli",
    title: "What is CLI Mode? Running reqit from the terminal",
    description: "You usually click buttons to send API requests. CLI mode lets you do it from the terminal — perfect for scripts, automation, and CI/CD.",
    date: "2026-06-16",
    readTime: "3 min read",
    tags: ["explainer", "cli", "automation"],
    category: "Testing & Automation",
    content: `Most of the time, you use reqit by clicking buttons. You type a URL, click Send, and see the response. That is the graphical way.

**CLI mode is different.** You open your terminal, type a command like \`reqit run my-collection --env staging\`, and reqit fires all the requests, runs assertions, and prints a report — all without opening a single window.

## A real-life story

Dennis deploys his app every Friday. After every deployment, he needs to check that 20 critical API endpoints still work. He used to open reqit, click each request one by one, and check the responses. It took 10 minutes and he sometimes missed a failed request.

Now Dennis runs a single command:

\`\`\`bash
reqit run smoke-tests --env production --report json
\`\`\`

Reqit fires all 20 requests, checks every assertion, and prints:

\`\`\`
✓ GET /health → 200 (42ms)
✓ POST /login → 200 (156ms)
✓ GET /users → 200 (89ms)
✗ POST /checkout → 500 (234ms) — expected 200
...

Failed: 1 / 20
\`\`\`

Dennis knows in 3 seconds whether the deployment is good.

## How it works

Reqit CLI runs a **collection** — any collection you already have in your workspace. It:

1. Loads every request in the collection
2. Sends each request
3. Runs any assertions you configured (status code, response time, body checks)
4. Prints a pass/fail report
5. Exits with code 0 if all pass, or code 1 if any fail

## Common use cases

- **CI/CD pipelines** — add \`reqit run smoke-tests\` to your GitHub Actions or GitLab CI config
- **Pre-deploy checks** — run a collection before every deployment
- **Nightly monitoring** — schedule a collection run with a cron job and email the report
- **Onboarding** — new team members run the collection to verify their setup

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-interceptor",
    title: "What is the Interceptor? A bridge between your browser and reqit",
    description: "Ever wanted to capture what your browser sends to an API and replay it in reqit? The interceptor does exactly that.",
    date: "2026-06-16",
    readTime: "3 min read",
    tags: ["explainer", "interceptor", "capture"],
    category: "Core Concepts",
    content: `Imagine you are using a website and you want to see what API calls it makes. Maybe you are debugging why a page is not loading, or you want to reuse an API request in your own app.

**The interceptor is a browser extension that captures every HTTP request your browser makes and sends it to reqit.**

## A real-life story

Leila is debugging a checkout page on her e-commerce site. The page shows an error after clicking "Place Order" but the error message is not helpful.

She opens Chrome, clicks the reqit Interceptor icon, and turns it on. Then she refreshes the page and clicks "Place Order" again.

In reqit, a list of captured requests appears:
- \`POST /api/cart/add\` — succeeded
- \`POST /api/checkout\` — failed with 500

Leila clicks the failed request in reqit. She sees the full request body, headers, and the 500 error response. The response says "payment_gateway_timeout". She knows the problem is with the payment service — not her frontend code.

## How to use it

1. Install the reqit Interceptor extension from the Chrome Web Store
2. Start reqit and make sure the proxy is running (check your settings for the port number)
3. Click the extension icon in Chrome and enter the port number
4. Click **Connect**
5. Browse normally — every API call is captured in reqit's history

## What gets captured

- All HTTP requests from your browser (GET, POST, PUT, PATCH, DELETE)
- Request method, URL, headers, and body
- Response status and timing
- Which tab made the request

## Privacy

The interceptor only sends requests to your local reqit instance at \`127.0.0.1\`. Nothing is sent to the cloud. Nothing is logged externally. You are the only one who sees your traffic.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-cicd",
    title: "Running reqit in CI/CD: Automated API testing in your pipeline",
    description: "Every time you push code, your CI runs tests. Now it can also run your API collections. Catch broken endpoints before they reach production.",
    date: "2026-06-16",
    readTime: "3 min read",
    tags: ["explainer", "ci-cd", "automation", "testing"],
    category: "Testing & Automation",
    content: `When you push code to GitHub, your CI pipeline runs unit tests, builds the app, and deploys it. But what about your API? If the backend returns a 500 or changes a response field, your tests still pass — but your app is broken.

**Reqit collections can run in CI/CD pipelines.** Add one command to your workflow file and every push runs your API tests automatically.

## A real-life story

Fatima's team uses GitHub Actions. Every time someone pushes to main, the pipeline builds the app and deploys it to staging. Last week, a developer changed the login API to return \`{ "token": "abc" }\` instead of \`{ "access_token": "abc" }\`. The frontend broke. Nobody noticed until a manual test 3 hours later.

Fatima adds a step to the pipeline:

\`\`\`yaml
- name: Run API tests
  run: reqit run api-smoke-tests --env staging
\`\`\`

Next push, the pipeline runs the collection. The login request expects \`access_token\` but gets \`token\`. The assertion fails. The pipeline stops. The developer gets a red X on their PR. They fix the API before merging.

## The full workflow

1. Create a collection called \`smoke-tests\` with all your critical endpoints
2. Add assertions: check status codes, response fields, response times
3. Add \`reqit run smoke-tests\` to your CI config
4. Every push checks your API automatically

## CI configuration examples

### GitHub Actions
\`\`\`yaml
- uses: actions/checkout@v4
- run: reqit run smoke-tests --env staging
\`\`\`

### GitLab CI
\`\`\`yaml
script:
  - reqit run smoke-tests --env staging
\`\`\`

## Exit codes

Reqit exits with:
- **0** — all requests passed their assertions
- **1** — one or more requests failed

Your CI pipeline can use these exit codes to pass or fail the build automatically.

## Reports

Add \`--report junit\` or \`--report json\` to output test results in standard formats. You can upload them to your CI dashboard just like unit test reports.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-themes",
    title: "What are Themes? Making reqit look the way you want",
    description: "Some people like dark mode. Some like light mode. Some want cyan accents. Themes let you make reqit look exactly how you prefer.",
    date: "2026-06-16",
    readTime: "2 min read",
    tags: ["explainer", "themes", "customization"],
    category: "Developer Experience",
    content: `Have you ever used an app and thought "I wish this was darker" or "I wish the colors were different"? Some apps only give you one look. reqit gives you choices.

**Themes change the colors of reqit — the background, the text, the accents, the buttons. You pick what looks good to you.**

## A real-life story

Hiro works in a dark office with dim lighting. Dark mode helps him focus. His colleague Maria works near a bright window. She prefers a lighter interface.

Hiro opens Settings → Theme and picks **Dark**. The background turns deep charcoal. The text turns white. The accent color stays cyan.

Maria picks **Light**. The background turns white. The text turns dark. Everything is crisp and readable in the sunlight.

Both are happy. Both use the same app. Neither squints.

## What themes affect

- Background color (main, sidebar, cards)
- Text color (headings, body, subtle labels)
- Accent colors (the cyan highlight used everywhere)
- Border colors
- Code editor colors
- Status colors (green for success, red for errors)

## How to change your theme

1. Open Settings (click your profile or press Ctrl+K and type "settings")
2. Find the **Theme** section
3. Pick **Dark**, **Light**, or **System** (follows your OS setting)
4. The change happens instantly — no restart needed

## The System option

If you pick **System**, reqit watches your OS theme setting. When your computer switches to dark mode at night, reqit switches too. When it goes back to light mode in the morning, reqit follows. You never think about it.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-vault",
    title: "What is the Vault? A locked box for your secrets",
    description: "API keys, tokens, and passwords should not sit in plain text files. The Vault keeps them encrypted so only you can read them.",
    date: "2026-06-16",
    readTime: "3 min read",
    tags: ["explainer", "vault", "security", "secrets"],
    category: "Developer Experience",
    content: `Imagine you write your ATM pin on a sticky note and stick it to your monitor. Everyone who walks past can see it. That is what happens when you put API keys in plain text files.

**The Vault is a locked box for your secrets.** You put your API keys, tokens, and passwords inside. The Vault encrypts them. Only you can unlock the box.

## A real-life story

Omar works on a team of 6 developers. Each developer has their own API key for the payment service. The keys are stored in environment files that live in the project folder.

One day, Omar accidentally commits his environment file to Git. His payment API key — worth thousands of dollars in potential fraud — is now on GitHub for anyone to find.

Omar switches to the Vault:
1. He removes all secrets from environment files
2. He adds them to the Vault: \`VAULT_PAYMENT_KEY = sk_live_abc123\`
3. He locks the Vault with a master password
4. Now his environment file just says \`{{VAULT_PAYMENT_KEY}}\` — no actual secret

If he accidentally commits the environment file again, it contains only variable names, not real secrets.

## How the Vault works

1. Open the Vault from Settings or the sidebar
2. Set a master password (this encrypts everything)
3. Add your secrets as key/value pairs
4. Reference them in any request as \`{{VAULT_KEY_NAME}}\`
5. The Vault decrypts them only when reqit sends a request

## Security features

- **Encrypted at rest** — vault data is AES-256 encrypted on disk
- **Master password** — you choose it, reqit never stores it
- **Locks automatically** — the vault locks after 5 minutes of inactivity
- **Per-workspace** — each workspace has its own vault. Projects stay isolated.

## What the Vault is not

The Vault is not a cloud service. Your secrets never leave your computer. It is not a replacement for a proper secrets manager in production (like HashiCorp Vault or AWS Secrets Manager). It is for local development — keeping secrets out of your Git history and off your screen.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-what-is-an-api",
    title: "What is an API? A waiter between your app and the kitchen",
    description: "Every time your phone shows weather, sends a message, or loads a feed, it talks to an API. This is what an API is and how it works.",
    date: "2026-06-17",
    readTime: "4 min read",
    tags: ["explainer", "api", "fundamentals", "beginner"],
    category: "API Fundamentals",
    content: `Imagine you are sitting in a restaurant. You look at the menu, decide what you want, and tell the waiter. The waiter goes to the kitchen, tells the chef, and comes back with your food. You never go into the kitchen yourself. The waiter is the bridge between you and the kitchen.

**An API is that waiter.** It stands between your app (the customer) and a server (the kitchen). Your app sends a request (places an order), and the API delivers a response (brings the food). You do not need to know how the kitchen works. You just need to know how to order from the menu.

## A real-life example

Open your weather app. It shows the temperature, humidity, and forecast. Where does that data come from?

Your weather app sends a request to a weather API: "Give me the weather for Lagos." The API checks its database, finds the current weather, and sends it back. Your app displays it. You see the temperature.

You never connected to the weather database directly. You never wrote SQL queries. You just asked the API, and the API handled everything else.

## How APIs talk: HTTP

Most APIs on the internet speak a language called **HTTP**. When your app sends an HTTP request, it has four parts:

1. **URL** — the address of the thing you want (like \`https://api.weather.com/weather/lagos\`)
2. **Method** — what you want to do (GET means "read", POST means "create")
3. **Headers** — extra information (like "send the response in JSON format")
4. **Body** — data you are sending (only for creating or updating)

The server sends back a **response** with:

1. **Status code** — a number that tells you if it worked (200 = OK, 404 = not found, 500 = server error)
2. **Body** — the actual data, usually in JSON format
3. **Headers** — extra information about the response

## Methods — the verbs of APIs

| Method | What it does | Real-life equivalent |
|--------|-------------|---------------------|
| **GET** | Read data | Looking at the menu |
| **POST** | Create new data | Placing a new order |
| **PUT** | Replace everything | Changing your entire order |
| **PATCH** | Update one part | Adding extra cheese to your order |
| **DELETE** | Remove data | Cancelling your order |

## Status codes — the kitchen's reply

| Code | Meaning | Real-life equivalent |
|------|---------|---------------------|
| **200** | OK, here is your data | "Here is your food" |
| **201** | Created successfully | "Your order has been placed" |
| **400** | Bad request — you made a mistake | "We do not have that item on the menu" |
| **401** | Unauthorized — who are you? | "I need to see your ID first" |
| **404** | Not found | "That item is not on the menu" |
| **500** | Server error — something broke | "The kitchen is on fire" |

## JSON — the language APIs use

When an API responds, it usually sends data in a format called **JSON**. It looks like this:

\`\`\`json
{
  "city": "Lagos",
  "temperature": 32,
  "humidity": 78,
  "forecast": "Sunny"
}
\`\`\`

This is text that both humans and computers can read easily.

## Summary

An API is just a waiter. Your app tells it what it wants, the API talks to the server, and brings back the result. Every app you use — Instagram, Twitter, WhatsApp, your banking app — talks to APIs all day long. Understanding APIs means understanding how the modern internet works.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-http-methods",
    title: "HTTP Methods Explained: GET, POST, PUT, PATCH, DELETE",
    description: "Each HTTP method is a different verb for a different action. This guide covers every method with real-world examples.",
    date: "2026-06-17",
    readTime: "4 min read",
    tags: ["explainer", "http", "methods", "rest"],
    category: "API Fundamentals",
    content: `If you speak to an API, you need to use the right verb. Saying "give me the menu" is different from saying "here is my order." HTTP methods are those verbs.

**Each HTTP method tells the server what you want to do with the data.** There are five main methods you will use every day.

## GET — "Show me something"

GET is the most common method. You use it whenever you want to read data without changing anything.

**Real life:** You walk into a library and ask "Do you have 'The Great Gatsby'?" The librarian checks and says yes or no. Nothing changes. You just asked.

**API example:**
\`\`\`
GET /api/books
→ Returns a list of all books
\`\`\`

\`\`\`
GET /api/books/42
→ Returns the book with ID 42
\`\`\`

**Rule:** GET never changes data. It only reads.

## POST — "Create something new"

POST tells the server to add a new item. It is like saying "here is a new book, please add it to the collection."

**Real life:** You go to the library counter and say "I wrote a new book. Please add it to the catalog." The librarian creates a new entry.

**API example:**
\`\`\`
POST /api/books
Body: { "title": "My New Book", "author": "Alice" }
→ Returns 201 Created with the new book's ID
\`\`\`

**Rule:** POST creates new data. The server assigns an ID.

## PUT — "Replace everything"

PUT replaces an entire item. If the item exists, it overwrites it. If it does not exist, it creates it.

**Real life:** You borrowed a book and lost it. You buy a replacement copy and tell the librarian "replace the old entry with this new copy." The old entry is completely replaced.

**API example:**
\`\`\`
PUT /api/books/42
Body: { "title": "Completely New Title", "author": "Bob" }
→ Replaces everything about book 42
\`\`\`

**Rule:** PUT replaces the whole resource. If you forget to include a field, it gets removed.

## PATCH — "Update one part"

PATCH is like PUT but you only send the fields you want to change. Everything else stays the same.

**Real life:** You moved to a new address. You tell the library "please update just my address." Your name, phone number, and membership remain unchanged.

**API example:**
\`\`\`
PATCH /api/books/42
Body: { "title": "New Title Only" }
→ Only the title changes. Author and other fields stay.
\`\`\`

**Rule:** PATCH is for partial updates. Send only what changed.

## DELETE — "Remove this"

DELETE removes an item permanently.

**Real life:** You return a book and tell the librarian "you can remove this from my account." The record is deleted.

**API example:**
\`\`\`
DELETE /api/books/42
→ Returns 200 OK or 204 No Content
\`\`\`

**Rule:** DELETE is permanent. There is no undo (usually).

## HEAD and OPTIONS — less common but useful

**HEAD** is like GET but the server only sends back headers — no body. Use it to check if a resource exists or to see headers without downloading the full response.

**OPTIONS** asks the server "what methods are allowed on this endpoint?" The server replies with something like \`Allow: GET, POST, DELETE\`.

## Idempotence — the fancy word

Some methods are **idempotent** — calling them once or 100 times gives the same result.

- **GET, PUT, DELETE, HEAD, OPTIONS** — idempotent. Calling GET /books/42 ten times always returns the same book.
- **POST, PATCH** — NOT idempotent. Calling POST /books ten times creates ten books.

## Summary

| Method | Action | Has body | Idempotent |
|--------|--------|----------|------------|
| GET | Read | No | Yes |
| POST | Create | Yes | No |
| PUT | Replace all | Yes | Yes |
| PATCH | Update part | Yes | No |
| DELETE | Remove | No | Yes |

Use the right method, and your API will understand exactly what you want.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-json-apis",
    title: "What is JSON? The language APIs speak",
    description: "JSON is how APIs send data back and forth. It is simple enough for a computer to read and easy enough for a human to understand.",
    date: "2026-06-17",
    readTime: "3 min read",
    tags: ["explainer", "json", "data", "beginner"],
    category: "API Fundamentals",
    content: `When two people speak different languages, they need a translator. When your app talks to an API, they need a common format for data. That format is **JSON** (JavaScript Object Notation).

**JSON is a way of writing data that both humans and computers can read.** It looks like a list of labels with values.

## The building blocks

JSON has only a few rules. Learn these and you can read any API response.

### Objects — a thing with properties

An object is wrapped in curly braces \`{}\` and contains key-value pairs:

\`\`\`json
{
  "name": "Alice",
  "age": 30,
  "city": "Lagos"
}
\`\`\`

Think of this as a person: name is Alice, age is 30, city is Lagos.

### Arrays — a list of things

An array is wrapped in square brackets \`[]\` and contains items separated by commas:

\`\`\`json
["apple", "banana", "cherry"]
\`\`\`

### Nesting — objects inside objects

This is where JSON gets powerful. You can put objects inside objects:

\`\`\`json
{
  "user": {
    "name": "Alice",
    "address": {
      "city": "Lagos",
      "street": "123 Main St"
    },
    "hobbies": ["reading", "coding", "swimming"]
  }
}
\`\`\`

## Data types in JSON

| Type | Example | Description |
|------|---------|-------------|
| String | "hello" | Text in double quotes |
| Number | 42 or 3.14 | Integer or decimal |
| Boolean | true or false | Yes or no |
| Null | null | Nothing / empty |
| Array | [1, 2, 3] | A list |
| Object | {"key": "value"} | A collection of properties |

## A real API response

Here is what a real API might return when you ask for a user's profile:

\`\`\`json
{
  "id": 12345,
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "isActive": true,
  "createdAt": "2026-01-15T08:30:00Z",
  "tags": ["premium", "developer"],
  "profile": {
    "bio": "Full-stack developer",
    "avatar": "https://example.com/avatars/12345.jpg"
  }
}
\`\`\`

## Why JSON won

There are other formats (XML, YAML, Protobuf), but JSON won because:

1. **It is simple** — you can learn it in 5 minutes
2. **It is text** — open it in any editor
3. **Every language reads it** — JavaScript, Python, Go, Rust, all of them
4. **It is fast** — computers can parse JSON very quickly

## Pretty-printed vs minified

APIs usually send **minified** JSON (no spaces, no newlines) to save bandwidth:

\`\`\`json
{"id":12345,"name":"Alice"}
\`\`\`

Reqit automatically **pretty-prints** JSON responses so you can read them:

\`\`\`json
{
  "id": 12345,
  "name": "Alice"
}
\`\`\`

Reqit also color-codes keys, strings, and numbers so you can scan responses at a glance.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "explainer-openapi-spec-linking",
    title: "How to link an OpenAPI spec to your collection",
    description: "Have an OpenAPI spec running on localhost? Link it to a collection in reqit and every response gets validated against your blueprint automatically.",
    date: "2026-06-17",
    readTime: "3 min read",
    tags: ["explainer", "openapi", "spec", "contract-testing"],
    category: "API Fundamentals",
    content: `You wrote an OpenAPI spec. Your API is running on localhost. Now you want reqit to check that every response matches the spec. Here is how to link them.

[video](https://youtu.be/C-HM2YHjrUY)

## The problem

You have a spec file that describes what your API should return. Your API is running at something like \`http://localhost:3000\`. Every time you change the backend, you want to know if the responses still match the spec. Checking manually is slow and easy to forget.

## The solution

reqit can link an OpenAPI spec to any collection. Once linked, every request you send in that collection gets validated against the spec automatically. You see a green badge when things match and a red badge when they do not.

## How to do it

### Step 1 — Get your spec URL

Your API probably serves its OpenAPI spec at one of these endpoints:

\`\`\`
http://localhost:3000/openapi.json
http://localhost:3000/swagger.json
http://localhost:3000/api-docs
http://localhost:3000/docs/openapi.json
\`\`\`

Open that URL in your browser. If you see JSON with \`"openapi"\` or \`"swagger"\` at the top, you found it.

### Step 2 — Link it in reqit

1. Right-click the collection you want to link
2. Click the three dots (⋮)
3. Click **Link OpenAPI Spec**
4. Paste your URL (e.g. \`http://localhost:3000/openapi.json\`)
5. Hit Enter

reqit downloads the spec, saves it to your workspace, and links it to the collection.

### Step 3 — Send a request

Pick any request in the collection and hit Send. Look at the status bar. You will see one of two things:

- **✓ Contract OK** — the response matches the spec
- **✗ 2 violations** — something does not match

Click the badge to see exactly what went wrong.

## What gets checked

reqit validates three things:

1. **Status code** — is it one of the codes the spec declares?
2. **Response body** — does the JSON match the schema the spec defines?
3. **Required fields** — are all required properties present?

If the spec says \`GET /users\` returns \`200\` with a \`name\` field, and your API returns \`200\` without \`name\`, reqit flags it.

## Updating the spec

If your API changes and the spec gets updated, just link it again with the new URL. reqit replaces the old spec with the new one.

## Unlinking

Right-click the collection → ⋮ → **Unlink Spec**. Validation stops.

## Why this matters

Without contract testing, you find out about breaking changes when your frontend crashes in production. With reqit, you find out in 3 seconds.

[reqit on GitHub](https://github.com/HalxDocs/reqit)`,
  },
  {
    slug: "what-is-reqit",
    title: "What is reqit? Everything you need to know",
    description: "reqit is a local-first, open-source API client that runs in under 400ms. No account. No cloud. No telemetry. Every feature explained with diagrams.",
    date: "2026-06-25",
    readTime: "18 min read",
    tags: ["overview", "features", "open-source", "api-client", "mcp", "agent-lens"],
    category: "Core Concepts",
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
    category: "Developer Experience",
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
    category: "Core Concepts",
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
];
