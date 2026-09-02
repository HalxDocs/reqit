import { describe, it, expect } from "vitest";
import { filterIgnoredFields, matchPath, removePaths } from "@/features/response/lib/diffIgnore";

describe("diffIgnore", () => {
  describe("matchPath", () => {
    it("matches exact pattern", () => {
      expect(matchPath("timestamp", "timestamp")).toBe(true);
      expect(matchPath("requestId", "requestId")).toBe(true);
      expect(matchPath("timestamp", "requestId")).toBe(false);
    });

    it("matches glob patterns", () => {
      expect(matchPath("timestamp", "*timestamp")).toBe(true);
      expect(matchPath("meta.timestamp", "*.timestamp")).toBe(true);
      expect(matchPath("requestId", "*Id")).toBe(true);
      expect(matchPath("traceId", "*Id")).toBe(true);
      expect(matchPath("meta.timestamp", "meta.*")).toBe(true);
      expect(matchPath("meta.requestId", "meta.*")).toBe(true);
      expect(matchPath("data.0.id", "data.*.id")).toBe(true);
      expect(matchPath("data.1.id", "data.*.id")).toBe(true);
      expect(matchPath("other.field", "data.*.id")).toBe(false);
    });

    it("handles special regex characters in pattern", () => {
      expect(matchPath("field.name", "field.name")).toBe(true);
      expect(matchPath("fieldXname", "field.name")).toBe(false);
    });
  });

  describe("removePaths", () => {
    it("removes exact key matches", () => {
      const obj = { timestamp: "123", data: "keep", requestId: "456" };
      const result = removePaths(obj, ["timestamp", "requestId"]);
      expect(result).toEqual({ data: "keep" });
    });

    it("removes glob matches", () => {
      const obj = { timestamp: "123", createdAt: "456", data: "keep", traceId: "789" };
      const result = removePaths(obj, ["*timestamp", "*At", "*Id"]);
      expect(result).toEqual({ data: "keep" });
    });

    it("recursively removes from nested objects", () => {
      const obj = {
        meta: { timestamp: "123", requestId: "456", keep: "me" },
        data: { items: [{ id: 1, timestamp: "789" }, { id: 2 }] },
        keep: "top",
      };
      const result = removePaths(obj, ["timestamp", "requestId", "id"]);
      expect(result).toEqual({
        meta: { keep: "me" },
        data: { items: [{}, {}] },
        keep: "top",
      });
    });

    it("handles arrays", () => {
      const obj = {
        items: [
          { timestamp: "1", keep: "a" },
          { timestamp: "2", keep: "b" },
        ],
      };
      const result = removePaths(obj, ["timestamp"]);
      expect(result).toEqual({
        items: [{ keep: "a" }, { keep: "b" }],
      });
    });

    it("handles null and primitives", () => {
      expect(removePaths(null, ["timestamp"])).toBeNull();
      expect(removePaths("string", ["timestamp"])).toBe("string");
      expect(removePaths(123, ["timestamp"])).toBe(123);
      expect(removePaths(undefined, ["timestamp"])).toBeUndefined();
    });
  });

  describe("filterIgnoredFields", () => {
    it("filters JSON with exact patterns", () => {
      const json = '{"timestamp": "123", "data": "keep", "requestId": "456"}';
      const result = filterIgnoredFields(json, ["timestamp", "requestId"]);
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({ data: "keep" });
    });

    it("filters JSON with glob patterns", () => {
      const json = '{"timestamp": "123", "createdAt": "456", "data": "keep", "traceId": "789"}';
      const result = filterIgnoredFields(json, ["*timestamp", "*At", "*Id"]);
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({ data: "keep" });
    });

    it("filters nested objects recursively", () => {
      const json = JSON.stringify({
        meta: { timestamp: "123", requestId: "456", keep: "me" },
        data: { items: [{ id: 1, timestamp: "789" }, { id: 2 }] },
        keep: "top",
      });
      const result = filterIgnoredFields(json, ["timestamp", "requestId", "id"]);
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({
        meta: { keep: "me" },
        data: { items: [{}, {}] },
        keep: "top",
      });
    });

    it("returns original string for invalid JSON", () => {
      const json = "not valid json";
      const result = filterIgnoredFields(json, ["timestamp"]);
      expect(result).toBe("not valid json");
    });

    it("returns original string when no patterns", () => {
      const json = '{"timestamp": "123", "data": "keep"}';
      const result = filterIgnoredFields(json, []);
      expect(result).toBe(json);
    });

    it("preserves formatting with null/2 indent", () => {
      const json = '{"timestamp": "123", "data": "keep"}';
      const result = filterIgnoredFields(json, ["timestamp"]);
      expect(result).toContain('"data": "keep"');
      expect(result).not.toContain("timestamp");
    });
  });
});