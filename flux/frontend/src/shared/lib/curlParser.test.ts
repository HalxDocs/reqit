import { describe, expect, it } from "vitest";
import { looksLikeCurl, parseCurl } from "./curlParser";

describe("looksLikeCurl", () => {
  it("detects a cURL command with an http URL", () => {
    expect(looksLikeCurl("curl https://api.example.com/users")).toBe(true);
    expect(looksLikeCurl("  curl -X POST 'https://api.example.com'")).toBe(true);
    expect(looksLikeCurl("CURL 'http://example.com'")).toBe(true);
  });

  it("rejects anything that is not a cURL command", () => {
    expect(looksLikeCurl("https://api.example.com")).toBe(false);
    expect(looksLikeCurl("curling https://example.com")).toBe(false);
    expect(looksLikeCurl("curl")).toBe(false);
    expect(looksLikeCurl("")).toBe(false);
    expect(looksLikeCurl("wget https://example.com")).toBe(false);
  });

  it("requires an http URL", () => {
    expect(looksLikeCurl("curl ftp://example.com/file")).toBe(false);
  });
});

describe("parseCurl", () => {
  describe("quoting", () => {
    it("keeps escaped quotes inside a JSON body intact", () => {
      // The reported bug: a single-quoted shell string is literal, so the
      // escaped quotes inside the JSON must survive untouched.
      const result = parseCurl(
        `curl 'https://api.example.com/messages' -H 'Content-Type: application/json' --data-raw '{"text":"he said \\"hi\\""}'`,
      );

      expect(result.bodyType).toBe("json");
      expect(result.bodyRaw).toBe('{"text":"he said \\"hi\\""}');
      // The body must still be valid JSON.
      expect(() => JSON.parse(result.bodyRaw)).not.toThrow();
      expect(JSON.parse(result.bodyRaw)).toEqual({ text: 'he said "hi"' });
    });

    it("keeps backslash sequences inside a single-quoted body intact", () => {
      const result = parseCurl(`curl 'https://x.test' -d '{"path":"C:\\\\Users\\\\x"}'`);
      expect(result.bodyRaw).toBe('{"path":"C:\\\\Users\\\\x"}');
      expect(() => JSON.parse(result.bodyRaw)).not.toThrow();
    });

    it("keeps a literal backslash in a single-quoted body", () => {
      // The shell string is '{"re":"\\d+"}' — valid JSON with an escaped
      // backslash. Single quotes are literal, so it must survive untouched.
      const result = parseCurl(`curl 'https://x.test' -d '{"re":"\\\\d+"}'`);
      expect(result.bodyRaw).toBe('{"re":"\\\\d+"}');
      expect(() => JSON.parse(result.bodyRaw)).not.toThrow();
    });

    it("preserves a body that is not valid JSON verbatim", () => {
      // The contract is that the parser never rewrites the user's bytes. This
      // body is not valid JSON, and that is the user's problem, not ours.
      const result = parseCurl(`curl 'https://x.test' -d '{"re":"\\d+"}'`);
      expect(result.bodyRaw).toBe('{"re":"\\d+"}');
    });

    it("unescapes double-quoted bodies the way a shell does", () => {
      const result = parseCurl(`curl "https://x.test" -d "{\\"a\\":\\"b\\"}"`);
      expect(result.bodyRaw).toBe('{"a":"b"}');
    });

    it("keeps a backslash that is not a valid double-quote escape", () => {
      // \d is not an escape in a POSIX double-quoted string.
      const result = parseCurl(`curl "https://x.test" -d "{\\"re\\":\\"\\d+\\"}"`);
      expect(result.bodyRaw).toBe('{"re":"\\d+"}');
    });

    it("joins adjacent quoted segments into one argument", () => {
      // No whitespace between the segments — in POSIX, whitespace separates
      // arguments, so these two quoted runs form a single argument.
      const result = parseCurl(`curl 'https://x.test/''api'`);
      expect(result.url).toBe("https://x.test/api");
    });

    it("handles an embedded single quote", () => {
      // 'it'\''s' is the POSIX way of writing it's
      const result = parseCurl(`curl 'https://x.test' -d '{"t":"it'\\''s"}'`);
      expect(result.bodyRaw).toBe('{"t":"it\'s"}');
    });
  });

  describe("request shape", () => {
    it("parses method, url and headers", () => {
      const result = parseCurl(
        `curl -X POST 'https://api.example.com/users?x=1' -H 'Content-Type: application/json' -H 'X-Trace: abc'`,
      );

      expect(result.method).toBe("POST");
      expect(result.url).toBe("https://api.example.com/users?x=1");
      expect(result.headers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: "Content-Type", value: "application/json" }),
          expect.objectContaining({ key: "X-Trace", value: "abc" }),
        ]),
      );
    });

    it("infers POST when a body is present and no method was given", () => {
      const result = parseCurl(`curl 'https://x.test' -d '{"a":1}'`);
      expect(result.method).toBe("POST");
    });

    it("keeps an explicit method over the inferred one", () => {
      const result = parseCurl(`curl -X PUT 'https://x.test' -d '{"a":1}'`);
      expect(result.method).toBe("PUT");
    });

    it("parses a bearer token into auth", () => {
      const result = parseCurl(`curl 'https://x.test' -H 'Authorization: Bearer abc123'`);
      expect(result.authType).toBe("bearer");
      expect(result.authToken).toBe("abc123");
    });

    it("parses basic auth from -u into user and password", () => {
      const result = parseCurl(`curl 'https://x.test' -u alice:s3cret`);
      expect(result.authType).toBe("basic");
      expect(result.authUser).toBe("alice");
      expect(result.authPass).toBe("s3cret");
    });

    it("parses a form-encoded body into bodyForm", () => {
      const result = parseCurl(`curl 'https://x.test' -d 'a=1&b=two'`);
      expect(result.bodyType).toBe("urlencoded");
      expect(result.bodyForm).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: "a", value: "1" }),
          expect.objectContaining({ key: "b", value: "two" }),
        ]),
      );
    });

    it("parses -F into a multipart body", () => {
      const result = parseCurl(`curl 'https://x.test' -F 'file=@/tmp/a.txt'`);
      expect(result.bodyType).toBe("form");
      expect(result.bodyForm).toEqual(
        expect.arrayContaining([expect.objectContaining({ key: "file", value: "@/tmp/a.txt" })]),
      );
    });

    it("supports backslash line continuations", () => {
      const result = parseCurl(
        "curl 'https://api.example.com/users' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"name\":\"alice\"}'",
      );
      expect(result.url).toBe("https://api.example.com/users");
      expect(result.method).toBe("POST");
      expect(result.bodyRaw).toBe('{"name":"alice"}');
      expect(result.headers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: "Content-Type", value: "application/json" }),
        ]),
      );
    });

    it("reads the url from --url", () => {
      const result = parseCurl(`curl --url 'https://x.test/from-flag'`);
      expect(result.url).toBe("https://x.test/from-flag");
    });

    it("skips boolean flags it does not model", () => {
      const result = parseCurl(`curl -k -L --compressed 'https://x.test'`);
      expect(result.url).toBe("https://x.test");
    });
  });

  describe("errors", () => {
    it("rejects empty input", () => {
      expect(() => parseCurl("")).toThrow();
      expect(() => parseCurl("   ")).toThrow();
    });

    it("rejects a command with no URL", () => {
      expect(() => parseCurl("curl -X POST")).toThrow(/URL/i);
    });
  });
});
