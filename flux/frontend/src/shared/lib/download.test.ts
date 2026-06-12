import { describe, it, expect } from "vitest";
import { safeFilename } from "./download";

describe("safeFilename", () => {
  it("replaces unsafe characters with hyphens", () => {
    expect(safeFilename("hello world")).toBe("hello-world");
  });

  it("removes leading/trailing hyphens", () => {
    expect(safeFilename("--test--")).toBe("test");
  });

  it("collapses multiple hyphens", () => {
    expect(safeFilename("a---b")).toBe("a-b");
  });

  it("truncates to 64 chars", () => {
    const long = "a".repeat(100);
    expect(safeFilename(long).length).toBe(64);
  });

  it("falls back to 'export' for empty result", () => {
    expect(safeFilename("---")).toBe("export");
  });

  it("preserves dots and underscores", () => {
    expect(safeFilename("my.file_v2")).toBe("my.file_v2");
  });
});
