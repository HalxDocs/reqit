// OAuth token expiry helpers.
//
// reqit stores token expiry as the Unix epoch in MILLISECONDS everywhere the
// renderer touches it, matching Date.now(). Older builds (and some legacy
// payloads) stored Unix SECONDS (~1.7e9); the ms epoch is ~1.7e12. Any value
// below the threshold is treated as seconds and normalized.

/** Values below this are Unix seconds, not milliseconds. */
export const MS_THRESHOLD = 1_000_000_000_000; // 1e12

/**
 * Normalizes a stored OAuth expiry to Unix milliseconds. Returns undefined for
 * falsy/zero values so callers can distinguish "no expiry" from an expired one.
 */
export function normalizeExpiry(expiresAt?: number): number | undefined {
  if (!expiresAt || expiresAt <= 0) return undefined;
  return expiresAt < MS_THRESHOLD ? expiresAt * 1000 : expiresAt;
}

/**
 * Seconds remaining until an ms-epoch expiry, clamped at 0. Returns 0 when no
 * expiry is set, which callers should treat as "unknown — don't auto-refresh".
 */
export function secondsUntil(expiresAtMs?: number, nowMs: number = Date.now()): number {
  if (!expiresAtMs) return 0;
  return Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));
}
