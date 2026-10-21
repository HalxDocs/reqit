// Provider-aware OAuth 2.0 callback timeouts.
//
// MFA-heavy providers need a longer window because the user may have to
// approve a push notification, enter a TOTP code, or select a passkey. Fast
// providers (GitHub, GitLab) use shorter timeouts so stale tabs fail fast.

// If the browser launcher succeeded but the app window never lost focus (the
// browser never took over), assume it silently didn't open and auto-switch to
// the paste-back fallback after this grace period.
export const NO_OPEN_GRACE_MS = 15_000;

const TIMEOUT_MFA_MS = 10 * 60 * 1000; // Google, Entra ID, Okta, Auth0
const TIMEOUT_DEFAULT_MS = 5 * 60 * 1000; // everything else
const TIMEOUT_FAST_MS = 3 * 60 * 1000; // GitHub, GitLab (no MFA redirect)

// Provider patterns that typically show MFA/consent screens.
const MFA_PROVIDER_PATTERNS = [
  /googleapis\.com/i,
  /microsoftonline\.com/i,
  /entra\.microsoft\.com/i,
  /login\.microsoftonline\.com/i,
  /okta\.com/i,
  /auth0\.com/i,
];

// Fast providers that never show MFA pages during the OAuth redirect.
const FAST_PROVIDER_PATTERNS = [/github\.com/i, /gitlab\.com/i];

/** Select the callback timeout for the current provider. */
export function providerTimeoutMs(authUrl: string, tokenUrl: string): number {
  const combined = authUrl + tokenUrl;
  if (FAST_PROVIDER_PATTERNS.some((p) => p.test(combined))) return TIMEOUT_FAST_MS;
  if (MFA_PROVIDER_PATTERNS.some((p) => p.test(combined))) return TIMEOUT_MFA_MS;
  return TIMEOUT_DEFAULT_MS;
}
