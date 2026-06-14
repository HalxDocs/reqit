# Changelog

## Unreleased

### Markdown API Documentation Export

Export any collection to a clean Markdown API documentation file with a single click. The modal lets you toggle headers, body, examples, and timestamp — plus set a base URL prefix. Written to `{CollectionName}_api_docs.md` in your workspace.

### Virtual Scrolling for Large Collections

Collections with thousands of requests no longer lag. The tree flattens to rows, binary-searches scroll offsets, and renders only the visible slice with absolute positioning via ResizeObserver.

### Drag-and-Drop Reordering

Reorder collections and requests by dragging them around. Visual cyan drop-lines show exactly where the item will land. Requests can also be moved between collections via drop.

### Batch Select / Move / Delete

Toggle selection mode to pick multiple requests at once with checkboxes. Move them to any other collection in one action, or delete them all at once. Includes Select All / Deselect All.

### Concurrent Request Limit

RunnerConfig now has a `MaxConcurrent` field (default 5). Controls the semaphore size when running collection requests in parallel. Exposed as `RunCollectionWithConcurrency` in Wails.

### Test Suite ↔ Collection Runner Integration

Test suites can now be executed directly — the "Run" button collects group requests from collections, wraps them with assertions, calls the runner, and displays pass/fail/timing results inline.

### CI/CD Pipeline Generation

Generate GitHub Actions workflow or GitLab CI YAML for any collection. Includes runner filename input. Exported to your workspace as `.github/workflows/{name}.yml` or `.gitlab-ci.yml`.

### Auto-Generated TypeScript Types

`wails generate module` re-runs automatically so all new Go types (`ExportMarkdownOpts`, `MaxConcurrent`, etc.) are reflected in TypeScript without manual model updates.

### Bug Fixes

- Fixed null reference on `LoadTestResult` in RunnerModal
- Fixed type assertions in TestSuitePanel
