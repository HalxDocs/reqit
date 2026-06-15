# Why we store API collections as plain JSON files

Every API client I have used stores collections in a database. Postman stores them in a cloud DB. Insomnia stores them in a local DB. Bruno stores them as files.

Reqit stores them as plain JSON files in a `.reqit/` directory inside your project. This decision drives everything else in the product.

## The problem with databases

When collections live in a database, you lose five things developers should not have to give up:

- **Diff.** You cannot run `git diff` on a database entry. When a co-worker changes a request URL, you see "collection updated" with no detail about what changed.
- **Branch.** Feature branches should have their own API collections. With a DB, you need a separate workspace or you overwrite each other.
- **Review.** Pull requests should show API changes alongside code changes. A database silo means context-switching to a browser tab.
- **History.** If someone deletes a collection in a cloud workspace, it is gone. With files in Git, you have the full commit history.
- **Sync.** Cloud sync requires an account, a subscription, and trust that the provider does not read your collections.

## How reqit does it

When you create a collection in reqit, it writes a JSON file to disk:

```json
{
  "schema": "reqit/collection/v1",
  "name": "auth-api",
  "requests": [
    {
      "name": "POST /login",
      "payload": {
        "method": "POST",
        "url": "https://api.example.com/auth/login",
        "headers": [
          { "key": "Content-Type", "value": "application/json" }
        ],
        "bodyType": "json",
        "body": "{\"email\":\"{{USERNAME}}\",\"password\":\"{{PASSWORD}}\"}"
      }
    }
  ]
}
```

This file is human-readable, machine-parseable, and small enough to commit without thinking.

The directory structure looks like this:

```text
.reqit/
  collections/
    auth-api/
      login.json
      refresh.json
    payment-service/
      charge.json
  environments/
    dev.json
    staging.json
```

Each request is its own file. Each collection is a directory. Environments are separate files. Everything is plain JSON.

## What this enables

**Pull requests show API changes.** When a developer changes a request URL or adds a header, the diff is visible right in the PR alongside the Go or TypeScript changes. Reviewers see exactly what endpoints changed and how.

**Feature branches carry their own collections.** The `feature/new-payment-flow` branch has the new payment endpoints. Merge the branch, merge the collections. No separate workspace management.

**No vendor lock-in.** The files are JSON. Open them in any editor. Parse them with any tool. Write a script to convert them to OpenAPI. Nothing is hidden in a binary format.

**History is free.** Git already tracks every change. Who changed what, when, and why. Roll back a collection to any point in time with `git checkout`.

## The trade-off

Storing collections as files means concurrent edits are not auto-merged. Two developers editing the same request at the same time get a merge conflict, just like code. This is a feature: it means you resolve conflicts explicitly instead of silently losing one person's changes.

Reqit is free, open source, and stores nothing but JSON files. If you want to try it: [github.com/HalxDocs/reqit](https://github.com/HalxDocs/reqit)
