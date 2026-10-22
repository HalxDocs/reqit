import { describe, it, expect } from "vitest";
import { vaultRefName, isVaultRef, containsVaultRef } from "./vaultRefs";

describe("vaultRefs", () => {
  it("recognises a whole-value vault reference", () => {
    expect(vaultRefName("{{VAULT_STRIPE_KEY}}")).toBe("STRIPE_KEY");
    expect(vaultRefName("{{ VAULT_STRIPE_KEY }}")).toBe("STRIPE_KEY");
    expect(vaultRefName("  {{VAULT_STRIPE_KEY}}  ")).toBe("STRIPE_KEY");
  });

  it("does not treat other values as references", () => {
    expect(vaultRefName("sk_live_REAL")).toBeNull();
    expect(vaultRefName("{{host}}")).toBeNull();
    expect(vaultRefName("{{VAULT_}}")).toBeNull();
    expect(vaultRefName("")).toBeNull();
    expect(vaultRefName(undefined)).toBeNull();
    expect(vaultRefName(null)).toBeNull();
  });

  it("does not treat an embedded reference as a whole-value one", () => {
    // A value that merely mentions a reference is not a reference, so it is
    // never fetched from the vault.
    expect(vaultRefName("Bearer {{VAULT_TOKEN}}")).toBeNull();
    expect(isVaultRef("Bearer {{VAULT_TOKEN}}")).toBe(false);
  });

  it("detects a reference anywhere in a text", () => {
    expect(containsVaultRef("Bearer {{VAULT_TOKEN}}")).toBe(true);
    expect(containsVaultRef("{{VAULT_TOKEN}}")).toBe(true);
    expect(containsVaultRef("nothing here")).toBe(false);
    expect(containsVaultRef("")).toBe(false);
  });

  it("allows dots and dashes in a secret name", () => {
    expect(vaultRefName("{{VAULT_my-secret_1}}")).toBe("my-secret_1");
  });
});
