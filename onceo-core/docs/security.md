# Security

## Signature Verification

All HMAC comparisons use `hmac.Equal` for constant-time comparison to prevent
timing side-channel attacks.

## Secret Handling

- Provider secret keys are never logged
- Signature headers are never included in log output
- Only pass/fail outcomes are logged

## Fuzz Testing

Every provider's `Parse()` function has a fuzz test that runs against
malformed and adversarial JSON input. Parsers must never panic.

## Disclosure

See [SECURITY.md](../SECURITY.md) for the responsible disclosure process.
