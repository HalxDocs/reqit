/*
Package onceo provides a thin, auditable reconciliation layer for payment webhooks.

It sits on top of payment providers (Paystack, Flutterwave, OPay, M-Pesa) and
answers one question reliably: exactly what happened with a payment, exactly once,
with a provable audit trail.

The core flow is:
 1. VerifySignature — per-provider signature scheme
 2. Parse — decode the provider-specific payload
 3. Normalize — map to the canonical Event schema
 4. Idempotency check — deduplicate by provider event ID
 5. Persist — save to a Store implementation

# Security

Not all providers offer the same level of cryptographic binding. Paystack and
OPay use HMAC-SHA512 over the request body. Flutterwave uses a static SHA256
hash of the shared secret — the Verif-Hash header is identical for every
webhook and does not include the body. M-Pesa uses a pre-shared callback
token verified via constant-time comparison.

Review each provider's VerifySignature documentation and the package-level
security warning in providers/flutterwave before choosing a provider for
production use.

Usage:

	import onceo "github.com/HalxDocs/onceo-core"

	// Use a provider adapter directly:
	headers := r.Header
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, MaxBodySize))
	if err != nil {
		// handle body read failure (log, return 500)
	}

	adapter, err := paystack.New(os.Getenv("PAYSTACK_SECRET_KEY"))
	if err != nil {
		// handle configuration error
	}
	event, err := onceo.Process(ctx, adapter, store, headers, body)
	if errors.Is(err, onceo.ErrInvalidSignature) {
		// handle bad signature
	}
*/
package onceo
