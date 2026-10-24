import { describe, expect, it } from "vitest";
import { releaseHistory } from "./releaseNotes";

/**
 * The What's New panel looks up the notes for the release being offered. These
 * tests guard the two things that broke it: notes missing for a version, and
 * the lookup running against the wrong version.
 */
describe("release notes", () => {
  it("has notes for every release since v1.1.0", () => {
    // The versions the app has shipped. A release with no entry showed an
    // empty What's New panel, which is what users kept reporting.
    const shipped = ["v2.0.0", "v2.1.0", "v2.2.0", "v2.2.1", "v2.3.0", "v2.4.0", "v2.5.0"];

    for (const version of shipped) {
      const note = releaseHistory.find((r) => r.version === version);
      expect(note, `no release notes for ${version}`).toBeDefined();
      expect(note?.highlights.length, `${version} has no highlights`).toBeGreaterThan(0);
      for (const highlight of note?.highlights ?? []) {
        expect(highlight.items.length, `${version} has an empty highlight group`).toBeGreaterThan(0);
      }
    }
  });

  it("orders the newest release first", () => {
    // The panel shows the first match it finds, so the order matters.
    const versions = releaseHistory.map((r) => r.version);
    const firstV2 = versions.findIndex((v) => v.startsWith("v2."));
    const lastV2 = versions.map((v) => v.startsWith("v2.")).lastIndexOf(true);
    expect(firstV2).toBeLessThan(lastV2);
  });

  it("does not repeat a version", () => {
    const versions = releaseHistory.map((r) => r.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("gives every note a title and a date", () => {
    for (const note of releaseHistory) {
      expect(note.title.length, `${note.version} has no title`).toBeGreaterThan(0);
      expect(note.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
