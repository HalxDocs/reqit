# Architecture

onceo-core is a thin reconciliation layer for payment webhooks. It processes
incoming webhooks through a fixed pipeline:

```
Provider webhook
    |
    v
[1] VerifySignature -- per-provider HMAC, constant-time comparison
    |
    v
[2] Parse -- decode provider-specific payload into typed struct
    |
    v
[3] Normalize -- map to canonical Event schema
    |
    v
[4] Idempotency check + persist -- Store.SaveIfNew (atomic, exactly-once)
```

Providers whose dedup key lives in a request header (Svix's `svix-id`) can
implement the optional `onceo.HeaderDedupKeyer` interface; `Process` derives
the canonical `ProviderEventID` from the verified headers instead of storing
per-request state on the provider.

## Design Decisions

- **Generics (`Provider[T]`)**: Each provider defines its own parsed payload
  type. The `Process()` function is generic over T, so type safety is preserved
  through the entire pipeline.

- **Interfaces at extension points**: `Store` is an interface. The core ships
  `MemoryStore` for testing and local development; the production Redis
  implementation lives in `store/redis`.

- **No global state**: Everything is explicitly constructed. No init() hooks,
  no package-level variables.

- **Sentinel errors**: `ErrInvalidSignature`, `ErrDuplicateEvent`,
  `ErrUnknownProvider`, etc. are `errors.Is`-friendly.

## Provider Adapters

Each provider lives in its own package under `providers/`. A provider adapter
must:

1. Implement `Provider[T]` with `Name()`, `VerifySignature()`, `Parse()`, `Normalize()`
2. Include golden fixture payloads in `testdata/`
3. Provide table-driven tests and a fuzz test for `Parse()`
