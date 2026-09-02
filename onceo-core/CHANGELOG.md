# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-08

### Added

- Svix provider: HMAC-SHA256 over `svix-id.svix-timestamp.body`, tolerant of
  key rotation, with the `svix-id` used as the dedup key
- Bachs provider: HMAC-SHA256 over `timestamp.body`, covering the full
  documented event surface (checkouts, collections, subscriptions, invoices,
  payouts, refunds, disputes, conversions, customers, Connect events)
- Store namespacing for multi-tenant isolation: `NewMemoryStoreWithNamespace`
  and `redisstore.NewWithNamespace`
- Optional `onceo.HeaderDedupKeyer` interface; the Svix provider is now
  stateless and safe for concurrent reuse
- Fuzz tests for the OPay, Svix, and Bachs parsers (all six providers now
  fuzzed)
- CLI tests covering `verify`/`replay` argument handling and provider wiring

### Fixed

- CLI flag parsing: `onceo verify <file> --provider ...` (flags after the
  file) now works, matching the documented usage
- M-Pesa float amounts are routed through the decimal-string parser, fixing
  off-by-one rounding such as 0.10 becoming 10 minor units
- CI toolchain matrix aligned with `go.mod` (Go 1.25/1.26); Redis is
  provisioned so `store/redis` tests actually run
- `go.mod`/`go.sum` tidied (go-redis is a direct dependency); repository is
  gofmt-clean

## [Unreleased]

## [0.1.0] - 2026-07-08

### Added

- Core `Event` struct with `Status` enum and canonical schema
- `Provider[T]` generic interface with `Process()` pipeline
- Paystack adapter with HMAC-SHA512 signature verification
- Flutterwave adapter with Verif-Hash signature verification
- OPay adapter with HMAC-SHA512 signature verification
- M-Pesa (Daraja) adapter with STK/C2B callback parsing
- `Store` interface with `MemoryStore` implementation
- Sentinel errors: `ErrInvalidSignature`, `ErrDuplicateEvent`, `ErrUnknownProvider`, `ErrMalformedPayload`
- HMAC verification helpers in `verify.go` with constant-time comparison
- CLI: `onceo verify` and `onceo replay` commands
- Full test coverage with golden fixture payloads
- Fuzz tests for all provider parsers
- CI/CD: GitHub Actions workflows for CI, CodeQL, and release
- Documentation: architecture, adding-a-provider, security
