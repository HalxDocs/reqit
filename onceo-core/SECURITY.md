# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in onceo-core, please report it privately.

**Do not disclose it publicly via GitHub Issues.**

Send details to security@onceo.dev. We will:

1. Acknowledge receipt within 48 hours.
2. Investigate and develop a fix.
3. Release a patch and disclose publicly after the fix is available.

## Scope

- Signature verification bypass
- Timing side-channels in HMAC comparison
- Secret key leakage via logs or error messages
- Panic/crash via malformed input

## Out of Scope

- Vulnerabilities in optional dependencies (Redis, Gin)
- Issues in applications using onceo-core
