import { describe, expect, it } from "vitest";
import { MS_THRESHOLD, normalizeExpiry, secondsUntil } from "./expiry";

describe("normalizeExpiry", () => {
  it("keeps millisecond values as-is", () => {
    const ms = 1_700_000_000_000;
    expect(normalizeExpiry(ms)).toBe(ms);
  });

  it("converts legacy second values to milliseconds", () => {
    expect(normalizeExpiry(1_700_000_000)).toBe(1_700_000_000_000);
  });

  it("returns undefined for missing, zero, and negative values", () => {
    expect(normalizeExpiry(undefined)).toBeUndefined();
    expect(normalizeExpiry(0)).toBeUndefined();
    expect(normalizeExpiry(-5)).toBeUndefined();
  });

  it("treats the threshold boundary correctly", () => {
    // Just below the threshold → seconds.
    expect(normalizeExpiry(MS_THRESHOLD - 1)).toBe((MS_THRESHOLD - 1) * 1000);
    // At and above the threshold → already ms.
    expect(normalizeExpiry(MS_THRESHOLD)).toBe(MS_THRESHOLD);
    expect(normalizeExpiry(MS_THRESHOLD + 1)).toBe(MS_THRESHOLD + 1);
  });
});

describe("secondsUntil", () => {
  const now = 1_700_000_000_000;

  it("computes remaining seconds from an ms expiry", () => {
    expect(secondsUntil(now + 3_600_000, now)).toBe(3600);
  });

  it("clamps at zero for expired tokens", () => {
    expect(secondsUntil(now - 1, now)).toBe(0);
    expect(secondsUntil(now, now)).toBe(0);
  });

  it("returns 0 when no expiry is set", () => {
    expect(secondsUntil(undefined, now)).toBe(0);
    expect(secondsUntil(0, now)).toBe(0);
  });

  it("defaults to the current time", () => {
    // A far-future expiry always yields a large positive countdown.
    expect(secondsUntil(Date.now() + 86_400_000)).toBeGreaterThan(0);
  });
});
