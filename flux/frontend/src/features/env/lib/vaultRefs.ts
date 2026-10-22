// A value in an environment that refers to a secret held in the configured
// vault, for example "{{VAULT_STRIPE_KEY}}".
//
// The whole value must be the reference. A reference embedded in a larger
// string is not treated as one, so a value that merely mentions "{{" is left
// alone.
const VAULT_REF = /^\{\{\s*VAULT_([A-Za-z0-9_.-]+)\s*\}\}$/;

/**
 * The name of the vault secret a value refers to, or null when the value is
 * not a vault reference.
 */
export function vaultRefName(value: string | undefined | null): string | null {
  if (!value) return null;
  const m = VAULT_REF.exec(value.trim());
  return m ? m[1] : null;
}

/** Whether a value refers to a vault secret. */
export function isVaultRef(value: string | undefined | null): boolean {
  return vaultRefName(value) !== null;
}

/** Whether any part of a text refers to a vault secret. */
export function containsVaultRef(text: string | undefined | null): boolean {
  if (!text) return false;
  return /\{\{\s*VAULT_[A-Za-z0-9_.-]+\s*\}\}/.test(text);
}
