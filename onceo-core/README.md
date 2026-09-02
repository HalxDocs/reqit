# onceo-core

> **one clean payment event, every rail, exactly once.**

A thin, auditable reconciliation layer for payment webhooks from African payment providers. It sits on top of rails you already use — it never becomes a payment processor itself.

[![Go Reference](https://pkg.go.dev/badge/github.com/HalxDocs/onceo-core.svg)](https://pkg.go.dev/github.com/HalxDocs/onceo-core)
[![Go Report Card](https://goreportcard.com/badge/github.com/HalxDocs/onceo-core)](https://goreportcard.com/report/github.com/HalxDocs/onceo-core)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Supported Providers

| Provider | Body Integrity | Status |
|----------|---------------|--------|
| [Paystack](https://paystack.com) | HMAC-SHA512 over body | Shipped |
| [Flutterwave](https://flutterwave.com) | **None** — see warning below | Shipped |
| [OPay](https://opayweb.com) | HMAC-SHA512 over body | Shipped |
| [M-Pesa (Daraja)](https://developer.safaricom.co.ke) | Pre-shared callback token (constant-time cmp) | Shipped |
| [Svix](https://svix.com) | HMAC-SHA256 over `svix-id.svix-timestamp.body` | Shipped |
| [Bachs](https://bachs.io) | HMAC-SHA256 over `timestamp.body` (hex) | Shipped |

## Installation

```
go get github.com/HalxDocs/onceo-core
```

## Quick Start

```go
package main

import (
    "errors"
    "io"
    "net/http"
    "os"

    onceo "github.com/HalxDocs/onceo-core"
    "github.com/HalxDocs/onceo-core/providers/paystack"
)

func webhookHandler(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Bound the body before reading: onceo.Process rejects payloads over
    // MaxBodySize (1 MiB), but you must not hand it an unbounded blob first.
    body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, onceo.MaxBodySize))
    if err != nil {
        http.Error(w, "request body too large", http.StatusRequestEntityTooLarge)
        return
    }

    provider, _ := paystack.New(os.Getenv("PAYSTACK_SECRET_KEY"))
    store := onceo.NewMemoryStore() // or store/redis

    event, err := onceo.Process(ctx, provider, store, r.Header, body)
    if errors.Is(err, onceo.ErrInvalidSignature) {
        http.Error(w, "invalid signature", http.StatusForbidden)
        return
    }
    if errors.Is(err, onceo.ErrDuplicateEvent) {
        w.WriteHeader(http.StatusOK) // idempotent: already processed
        return
    }
    if err != nil {
        http.Error(w, "internal error", http.StatusInternalServerError)
        return
    }

    // event is the canonical, normalized payment event
    switch event.Status {
    case onceo.StatusSuccess:
        fulfillOrder(event.Reference, event.AmountMinor, event.Currency)
    case onceo.StatusFailed:
        markOrderFailed(event.Reference)
    }
    w.WriteHeader(http.StatusOK)
}
```

## API

### `onceo.Process(ctx, provider, store, headers, body) (*Event, error)`

The single entry point. Runs the full pipeline:

1. **Body size check** — rejects payloads over `MaxBodySize` (1 MiB)
2. **Provider validation** — verifies provider name is non-empty and valid
3. **Event ID length check** — rejects `ProviderEventID` > `MaxProviderEventIDLength` (256)
4. **Signature verification** — delegates to `provider.VerifySignature`
5. **Parse** — decodes provider-specific payload
6. **Normalize** — maps to canonical `Event` schema
7. **Idempotency check** — `store.SaveIfNew` (atomic, exactly-once)
8. **Return** — the saved `Event` with `ProcessedAt` set

### `Event`

```go
type Event struct {
    ID              string    // unique event ID (generated)
    Provider        string    // provider name
    ProviderEventID string    // provider's event ID (unique key for idempotency)
    Type            string    // event type (e.g. "charge.success")
    Status          Status    // success, failed, pending, reversed
    AmountMinor     int64     // amount in minor currency unit (e.g. kobo, cents)
    Currency        string    // ISO 4217 currency code
    Reference       string    // merchant reference
    RawPayload      []byte    // original raw body
    ReceivedAt      time.Time // when the webhook was received
    ProcessedAt     time.Time // when Process returned successfully
}
```

Status enum: `StatusPending` (0), `StatusSuccess` (1), `StatusFailed` (2), `StatusReversed` (3).

Supports JSON marshal/unmarshal (string-based, case-insensitive).

### Sentinel Errors

Use `errors.Is` to check:

| Error | Meaning |
|---|---|
| `ErrInvalidSignature` | Signature does not match |
| `ErrDuplicateEvent` | Event already processed (idempotent hit) |
| `ErrUnknownProvider` | Provider name not recognized |
| `ErrMalformedPayload` | Body cannot be parsed for event ID |
| `ErrMissingHeader` | Required signature header missing |
| `ErrDuplicateHeader` | Header appears more than once |
| `ErrEventParseFailed` | Provider event ID is empty or unparseable |
| `ErrStoreFailed` | Store backend returned an error |

### `Store` Interface

```go
type Store interface {
    SaveIfNew(ctx context.Context, e Event) (created bool, err error)
}
```

**Contract:** atomic, exactly-one semantics. Two concurrent calls for the same event must never both return `created=true`.

#### Built-in: `onceo.NewMemoryStore()`

Unbounded in-memory store, safe for concurrent use. It **never evicts**, so exactly-once semantics hold for the process lifetime. **Not recommended for production** — events are lost on restart. `onceo.NewMemoryStoreWithMax(n)` caps memory but SILENTLY BREAKS exactly-once: at capacity the oldest key is evicted and can later be re-processed as a duplicate.

#### Redis: `store/redis`

Production-grade store backed by Redis `SETNX`. Requires `github.com/redis/go-redis/v9`.

```go
import (
    "github.com/redis/go-redis/v9"
    redisstore "github.com/HalxDocs/onceo-core/store/redis"
)

client := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
store := redisstore.New(client)                       // default 7-day TTL
store, err := redisstore.NewWithNamespace(client, tenantID) // isolate tenants
```

#### Namespacing (multi-tenant isolation)

Both built-in stores key dedup entries on `provider + ":" + providerEventID`. If a single store is shared across accounts/tenants, two tenants can collide when their providers emit identical event IDs — one tenant's event would be silently dropped as a "duplicate."

Use `onceo.NewMemoryStoreWithNamespace(ns)` or `redisstore.NewWithNamespace(client, ns)` with a per-account namespace to keep every tenant's events isolated. Namespaces must not contain `:` or `\` (validation rejects them).

### `Provider[T]` Interface

```go
type Provider[T any] interface {
    Name() string
    BodyBound() bool
    VerifySignature(headers http.Header, body []byte) error
    ParsePayload(body []byte) (T, error)
    Normalize(payload T) (Event, error)
}
```

- `BodyBound()`: if true, the signature covers the request body (Paystack, OPay). If false (Flutterwave), callers should be aware there is no application-level body integrity.
- Each provider uses Go generics to define its own parsed payload type.

## Providers

### Paystack

```go
import "github.com/HalxDocs/onceo-core/providers/paystack"

provider, err := paystack.New("sk_test_...")
```

- **Signature:** HMAC-SHA512 of raw body, sent in `X-Paystack-Signature` header
- **Body integrity:** Yes (`BodyBound() = true`)
- **Parsed type:** `paystack.Payload`

### Flutterwave

```go
import "github.com/HalxDocs/onceo-core/providers/flutterwave"

provider, err := flutterwave.New("FLWSECK_TEST-...")
```

> **WARNING:** Flutterwave's `Verif-Hash` header is a static SHA-256 hash of the webhook secret hash (`secret_hash` in the dashboard). It does **not** include the request body. `BodyBound()` returns `false`. Any attacker who captures one valid `Verif-Hash` can forge arbitrary webhook payloads until the secret hash is rotated. There is **no application-level body integrity** — protection relies entirely on TLS.
>
> If you must use Flutterwave webhooks: (1) serve the endpoint exclusively over TLS, (2) additionally validate the source IP against Flutterwave's published ranges before processing, (3) rotate the webhook secret hash regularly, (4) confirm every event's `id`/`tx_ref` against a server-side record before crediting funds, and (5) treat this provider as untrusted relative to HMAC-bound providers (Paystack, OPay).

- **Signature:** Static SHA-256 hash (`Verif-Hash` header)
- **Body integrity:** No (`BodyBound() = false`)
- **Parsed type:** `flutterwave.Payload`

### OPay

```go
import "github.com/HalxDocs/onceo-core/providers/opay"

provider, err := opay.New("OPAY_MERCHANT_ID", "OPAY_SECRET_KEY")
```

- **Signature:** HMAC-SHA512 of raw body, sent in `Authorization` header. Supports optional fallback `Opay-Signature` header for backward compatibility.
- **Body integrity:** Yes (`BodyBound() = true`)
- **Parsed type:** `opay.Payload`

### M-Pesa (Daraja)

```go
import "github.com/HalxDocs/onceo-core/providers/mpesa"

provider, err := mpesa.New("callback-token")
```

- **Signature:** Pre-shared callback token, verified via `subtle.ConstantTimeCompare`
- **Body integrity:** Yes (`BodyBound() = true`)
- **Parsed type:** `mpesa.STKCallbackPayload`
- **Only STK Push callbacks** are currently supported

### Svix

[Svix](https://svix.com) is the standard webhook delivery layer used by platforms such as Flexprice. It signs every delivery with HMAC-SHA256 over `{svix-id}.{svix-timestamp}.{raw-body}` and sends the signature in the `svix-signature` header.

```go
import "github.com/HalxDocs/onceo-core/providers/svix"

provider, err := svix.New("whsec_...")
```

- **Signature:** HMAC-SHA256 of `svix-id.svix-timestamp.body`, base64-encoded in `svix-signature` (`v1,<signature>`), verified via `subtle.ConstantTimeCompare`
- **Timestamp replay window:** default 5 minutes, configurable with `svix.WithTolerance(duration)`
- **Body integrity:** Yes (`BodyBound() = true`)
- **Parsed type:** `svix.WebhookPayload`
- The event `Type` is resolved from the standard envelope `type` field, falling back to `event_type` (including a nested `data.event_type`). The `svix-id` is used as the dedup key.
- **Concurrency:** the provider is **stateless and safe for concurrent reuse** — the verified `svix-id` is surfaced to `Process` via the optional `onceo.HeaderDedupKeyer` interface, never stored on the provider.

### Bachs

[Bachs](https://bachs.io) delivers signed webhook envelopes (`id`, `type`, `data`) for payments, payouts, refunds, invoices, and more. It signs each delivery with HMAC-SHA256 over `{timestamp}.{raw-body}` and sends the hex digest in the `X-Bachs-Signature` header, with the Unix timestamp in `X-Bachs-Timestamp`.

```go
import "github.com/HalxDocs/onceo-core/providers/bachs"

provider, err := bachs.New("whsec_...")
```

- **Signature:** HMAC-SHA256 of `timestamp.body` (hex), verified via `subtle.ConstantTimeCompare`
- **Timestamp replay window:** default 5 minutes, configurable with `bachs.WithTolerance(duration)`
- **Body integrity:** Yes (`BodyBound() = true`)
- **Parsed type:** `bachs.WebhookPayload`
- The event envelope `id` is used as the dedup key.
- **Event coverage:** every documented event family normalizes without error — checkouts (`checkout.completed`, `checkout.expired`), collections (`collection.succeeded`, `collection.failed`, `collection.underpaid`), subscriptions (`customer.subscription.*`), invoices (`invoice.created`, `invoice.paid`, `invoice.payment_failed`), payouts, refunds, disputes, conversions, customers, and Connect events (`account.updated`, `capability.updated`, `transfer.created`).
- **Status mapping:** `checkout.completed`, `collection.succeeded`, `conversion.completed`, `invoice.paid`, and `payout.paid` → `success`; `collection.failed`, `conversion.failed`, `invoice.payment_failed`, `payout.failed`, and `refund.failed` → `failed`; `refund.paid` → `reversed`; everything else (including `checkout.expired`, `collection.underpaid`, and `dispute.*`) → `pending`.
- **Amount parsing:** money is parsed at 2-decimal precision into `AmountMinor`, with the source field chosen per event family: `amount` for collections, checkouts, payouts, disputes, transfers, and subscriptions; `amount_paid` (what actually arrived) for invoices and underpaid collections; `refunded_amount` (falling back to `requested_amount`) for refunds; and `to_amount` in `to_currency` for conversions. Bachs does not include a currency on refund events, so those normalize with an empty `Currency`.
- **Connect events:** envelopes from connected accounts carry a top-level `account` field, exposed on `bachs.WebhookPayload.Account`.
- Unknown event types normalize to `StatusPending` rather than erroring, so the provider remains forward-compatible with new Bachs event types.

## CLI Tool

Install the `onceo` CLI to verify webhook payloads locally:

```
go install github.com/HalxDocs/onceo-core/cmd/onceo@latest
```

```bash
# Verify a Paystack payload
onceo verify --provider=paystack --secret=sk_test_... charge_success.json

# Verify a Flutterwave payload
onceo verify --provider=flutterwave --secret=FLWSECK_TEST-... transfer_event.json
```

The CLI runs the full `Process` pipeline and prints the normalized `Event` as JSON. Use the `noop` secret (`--secret=noop`) to skip signature verification for inspection.

## Security

### Constant-time comparisons

All signature and token comparisons use `crypto/hmac.Equal`, `crypto/subtble.ConstantTimeCompare`, or `crypto/subtle.ConstantTimeEq`. No early-exit comparison paths.

### Body size enforcement

Payloads over `MaxBodySize` (1 MiB) are rejected early, before any signature or parsing work.

### Provider event ID constraints

`ProviderEventID` is limited to `MaxProviderEventIDLength` (256 characters) to prevent database indexing issues and memory exhaustion attacks.

### Idempotency key escaping

MemoryStore and RedisStore escape `:` and `\` characters in provider names and event IDs to prevent key delimiter collisions.

## Audit History

The library has been audited across 6 rounds of findings (critical → low):

- Body size enforcement added
- Provider BodyBound() flag for bodyless signatures
- Amount fields changed to `int64` for 32-bit safety
- Idempotency keys properly escaped
- Signature error wrapping fixed
- Duplicate/malformed header handling hardened
- Redis store input validation added
- Consistent timestamp snapshots

## License

MIT — see [LICENSE](LICENSE).
