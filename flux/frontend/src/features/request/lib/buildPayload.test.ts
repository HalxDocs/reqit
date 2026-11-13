import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildOrigin, buildPayload } from "./buildPayload";
import { useEnvStore } from "@/features/env/stores/useEnvStore";
import type { RequestState } from "@/features/request/types/request";

vi.mock("../../../../wailsjs/go/main/App", () => ({
  GetEnvironments: vi.fn(),
  CreateEnvironment: vi.fn(),
  UpdateEnvironment: vi.fn(),
  DeleteEnvironment: vi.fn(),
  SetActiveEnvironment: vi.fn(),
}));

const SECRET = "sk_live_MUST_NOT_APPEAR_IN_ORIGIN";

const request: RequestState = {
  method: "POST",
  url: "https://api.example.com/{{VERSION}}/users?token={{TOKEN}}&q={{MISSING}}",
  params: [{ id: "p1", key: "page", value: "2", enabled: true }],
  headers: [
    { id: "h1", key: "Authorization", value: "Bearer {{TOKEN}}", enabled: true },
    { id: "h2", key: "X-Trace", value: "{{TRACE}}", enabled: true },
    { id: "h3", key: "X-Vault", value: "{{VAULT_STRIPE}}", enabled: true },
  ],
  bodyType: "json",
  bodyRaw: `{"apiKey":"{{API_KEY}}"}`,
  bodyForm: [],
  authType: "none",
  authToken: "",
  authUser: "",
  authPass: "",
  authKeyName: "",
  authKeyValue: "",
  authKeyIn: "header",
  preSetVars: [],
  extractRules: [],
  graphqlQuery: "",
  graphqlVariables: "",
  preScript: "",
  postScript: "",
  notes: "",
  timeout: 0,
};

beforeEach(() => {
  useEnvStore.setState({
    activeID: "env-1",
    environments: [
      {
        id: "env-1",
        name: "Dev",
        vars: [
          { key: "VERSION", value: "v1", enabled: true },
          { key: "TOKEN", value: SECRET, enabled: true },
          { key: "API_KEY", value: SECRET, enabled: true },
          { key: "VAULT_STRIPE", value: "{{VAULT_STRIPE}}", enabled: true },
          { key: "DISABLED", value: "nope", enabled: false },
        ],
      },
    ] as never,
  });
});

describe("buildOrigin", () => {
  it("keeps the request as written and labels every variable's source", () => {
    const origin = buildOrigin(request, new Map([["TRACE", "trace-1"]]));

    expect(origin.url).toBe(request.url);
    expect(origin.headers[0].value).toBe("Bearer {{TOKEN}}");
    expect(origin.body).toBe(`{"apiKey":"{{API_KEY}}"}`);
    expect(origin.varSources).toEqual({
      VERSION: "environment",
      TOKEN: "environment",
      MISSING: "unresolved",
      TRACE: "collection",
      VAULT_STRIPE: "vault",
      API_KEY: "environment",
    });
  });

  it("never carries a resolved value, while the payload does", () => {
    const origin = buildOrigin(request, new Map([["TRACE", "trace-1"]]));
    const payload = buildPayload(request, new Map([["TRACE", "trace-1"]]));

    expect(JSON.stringify(origin)).not.toContain(SECRET);
    expect(origin.url).toContain("{{TOKEN}}");
    expect(origin.body).toContain("{{API_KEY}}");

    // The wire payload is the opposite: it carries the values.
    expect(payload.url).toContain(SECRET);
    expect(payload.body).toContain(SECRET);
  });

  it("does not label a disabled environment variable as resolved", () => {
    const state: RequestState = { ...request, url: "https://api.example.com/{{DISABLED}}" };
    const origin = buildOrigin(state, undefined);
    expect(origin.varSources?.DISABLED).toBe("unresolved");
  });
});
