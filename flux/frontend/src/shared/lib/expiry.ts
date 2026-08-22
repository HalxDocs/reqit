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

export type ExpiryState = "no_expiry" | "expired" | "expiring_soon" | "valid";

/**
 * Classifies an expiry timestamp into a display state.
 * - no_expiry: provider never sent expires_in (e.g. GitHub — never expires)
 * - expired:  has an expiry and it is past or within skew
 * - expiring_soon: has an expiry and will expire within 60s
 * - valid: has an expiry and is healthy
 */
export function getExpiryState(
  expiresAtMs?: number,
  nowMs: number = Date.now(),
): ExpiryState {
  const normalized = normalizeExpiry(expiresAtMs);
  if (normalized == null) return "no_expiry";
  const secs = secondsUntil(normalized, nowMs);
  if (secs === 0) return "expired";
  if (secs < 60) return "expiring_soon";
  return "valid";
}

/** Human-readable duration for an expiry, e.g. "2m 05s" or "3h 12m". */
export function formatExpiry(expiresAtMs?: number, nowMs: number = Date.now()): string {
  const normalized = normalizeExpiry(expiresAtMs);
  if (normalized == null) return "No expiry";
  const secs = secondsUntil(normalized, nowMs);
  if (secs === 0) return "Expired";
  if (secs < 60) return `Expires in ${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (secs < 3600) return `Expires in ${m}m ${String(s).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `Expires in ${h}h ${String(remM).padStart(2, "0")}m`;
}
