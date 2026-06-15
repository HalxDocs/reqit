# I imported my entire Postman workspace into reqit in 30 seconds

Every time I open Postman on my work laptop it takes 8 seconds to load, asks me to log in, and reminds me I've used 3 of 5 free team collections. My team had 47 collections spread across 6 workspace accounts. We were paying $12/month per person for something that should be a file on disk.

I spent an afternoon migrating everything to reqit. The import took 30 seconds. The whole team switched in a day.

## The problem with Postman imports

Most API clients make you re-import collections one by one. Export from Postman as v2.1 JSON, find the file, drag it into the new tool, repeat 47 times.

Reqit does it in one step: you point it at your exported collection file and it imports every request, folder structure, header, auth method, and body. No per-request mapping. No lost auth tokens.

Here is how it works.

## Step-by-step

1. Open Postman, select your workspace, and export as **Collection v2.1** (File > Export). This gives you a single `.json` file with every request in that workspace.
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

- Postman scripts (`pm.*` pre-request and test scripts) are imported as comments for manual review — the syntax is similar but not identical to reqit's scripting API
- Postman environment files import separately through the environment manager
- Postman examples are stored but not auto-linked to mock routes

## The result

Our team went from 6 Postman workspace accounts to a single Git repository. Collections live in `.reqit/collections/` and version with the code. New team members clone the repo and have every API endpoint ready to test.

Reqit is free, open source, and stores nothing but JSON files. If you want to try it: [github.com/HalxDocs/reqit](https://github.com/HalxDocs/reqit)
