# Adding a New Provider

This guide walks through adding a new payment rail adapter to onceo-core.

## Step 1: Create the package

```
mkdir -p providers/<name>/testdata
```

## Step 2: Define the payload types

Create `providers/<name>/<name>.go`:

```go
package <name>

type WebhookPayload struct {
    Event string          `json:"event"`
    Data  json.RawMessage `json:"data"`
}
```

## Step 3: Implement Provider[T]

```go
type Provider struct {
    SecretKey string
}

func (p *Provider) Name() string { return "<name>" }

func (p *Provider) VerifySignature(headers http.Header, body []byte) error {
    // Extract signature header, verify with HMAC
}

func (p *Provider) Parse(body []byte) (WebhookPayload, error) {
    // Unmarshal JSON, validate required fields
}

func (p *Provider) Normalize(raw WebhookPayload) (onceo.Event, error) {
    // Map raw payload to canonical Event
}
```

## Step 4: Add golden fixtures

Save real (sanitised) webhook payloads in `testdata/`:

- `charge_success.json`
- `charge_failed.json`

## Step 5: Write tests

- Table-driven tests for `VerifySignature` (valid, missing header, wrong secret, tampered body)
- Table-driven tests for `Parse` (valid payloads, malformed JSON, empty body)
- Tests for `Normalize` covering every event type
- A full-process test using `onceo.Process`
- A fuzz test for `Parse`

## Step 6: Wire into the CLI

Add the provider to `cmd/onceo/verify.go` in the `newProvider()` function.
