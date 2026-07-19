import { describe, expect, test } from "vitest";
import { toCurlShort, toCurlPowerShell, toGo, toJava } from "./codegen";
import type { WirePayload } from "@/features/request/lib/buildPayload";

function makePayload(overrides: Partial<WirePayload> = {}): WirePayload {
  return {
    method: "GET",
    url: "https://api.example.com/users",
    headers: [
      { key: "Authorization", value: "Bearer tok_123", enabled: true },
    ],
    params: [],
    bodyType: "none",
    body: "",
    bodyForm: [],
    authType: "bearer",
    authValue: "tok_123",
    graphqlQuery: "",
    graphqlVariables: "",
    preScript: "",
    postScript: "",
    notes: "",
    ...overrides,
  };
}

describe("toCurlShort", () => {
  test("GET request", () => {
    const code = toCurlShort(makePayload());
    expect(code).toContain("curl");
    expect(code).toContain("-H 'Authorization: Bearer tok_123'");
    expect(code).toContain("https://api.example.com/users");
    expect(code).not.toContain("-X GET");
  });

  test("POST with JSON body", () => {
    const code = toCurlShort(makePayload({
      method: "POST",
      bodyType: "json",
      body: '{"name":"test"}',
    }));
    expect(code).toContain("-X POST");
    expect(code).toContain("-d '");
    expect(code).toContain('{"name":"test"}');
  });

  test("includes query params", () => {
    const code = toCurlShort(makePayload({
      params: [
        { key: "limit", value: "10", enabled: true },
        { key: "offset", value: "0", enabled: true },
      ],
    }));
    expect(code).toContain("limit=10");
    expect(code).toContain("offset=0");
  });
});

describe("toCurlPowerShell", () => {
  test("GET request", () => {
    const code = toCurlPowerShell(makePayload());
    expect(code).toContain("Invoke-RestMethod");
    expect(code).toContain("$headers = @{");
    expect(code).toContain('"Authorization" = "Bearer tok_123"');
    expect(code).toContain("-Method GET");
  });

  test("POST with body", () => {
    const code = toCurlPowerShell(makePayload({
      method: "POST",
      bodyType: "json",
      body: '{"key":"val"}',
    }));
    expect(code).toContain("-Body");
    expect(code).toContain("-ContentType 'application/json'");
  });
});

describe("toGo", () => {
  test("GET request", () => {
    const code = toGo(makePayload());
    expect(code).toContain('"net/http"');
    expect(code).toContain('req.Header.Set("Authorization"');
    expect(code).toContain('"https://api.example.com/users"');
    expect(code).toContain("http.DefaultClient.Do(req)");
    expect(code).toContain("io.ReadAll(resp.Body)");
  });

  test("POST with JSON body", () => {
    const code = toGo(makePayload({
      method: "POST",
      bodyType: "json",
      body: '{"name":"Alice"}',
    }));
    expect(code).toContain('"POST"');
    expect(code).toContain("bytes.NewReader(body)");
    expect(code).toContain("encoding/json");
  });
});

describe("toJava", () => {
  test("GET request", () => {
    const code = toJava(makePayload());
    expect(code).toContain("HttpURLConnection");
    expect(code).toContain('conn.setRequestMethod("GET")');
    expect(code).toContain('conn.setRequestProperty("Authorization"');
    expect(code).toContain("conn.getResponseCode()");
    expect(code).toContain("conn.disconnect()");
  });

  test("POST with form body", () => {
    const code = toJava(makePayload({
      method: "POST",
      bodyType: "urlencoded",
      bodyForm: [
        { key: "user", value: "alice", enabled: true },
      ],
    }));
    expect(code).toContain("setDoOutput(true)");
    expect(code).toContain("getOutputStream()");
  });
});
