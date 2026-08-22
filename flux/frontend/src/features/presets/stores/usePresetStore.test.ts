import { beforeEach, describe, expect, it } from "vitest";
import { sanitizeOAuth2Config, usePresetStore } from "./usePresetStore";

const liveConfig = {
  authUrl: "https://a.example/authorize",
  tokenUrl: "https://a.example/token",
  deviceUrl: "",
  clientId: "client-1",
  clientSecret: "super-secret",
  scopes: "repo user",
  redirectUri: "http://127.0.0.1:7317/callback",
  usePkce: true,
  tokenRef: "tok_abc",
  accessToken: "at-live-123",
  refreshToken: "rt-live-456",
  expiresAt: 1_700_000_000_000,
};

describe("sanitizeOAuth2Config", () => {
  it("strips live secrets and keeps config + tokenRef", () => {
    const out = sanitizeOAuth2Config(liveConfig)!;
    expect(out.clientSecret).toBe("");
    expect(out.accessToken).toBeUndefined();
    expect(out.refreshToken).toBeUndefined();
    expect(out.clientId).toBe("client-1");
    expect(out.tokenRef).toBe("tok_abc");
    expect(out.tokenUrl).toBe("https://a.example/token");
    expect(out.usePkce).toBe(true);
  });

  it("returns undefined for undefined input", () => {
    expect(sanitizeOAuth2Config(undefined)).toBeUndefined();
  });
});

describe("usePresetStore persistence", () => {
  beforeEach(() => {
    usePresetStore.setState({ authPresets: [] });
    localStorage.clear();
  });

  it("never writes OAuth secrets to the store state", () => {
    usePresetStore.getState().saveAuthPreset("oauth preset", {
      authType: "oauth2",
      authToken: "",
      authUser: "",
      authPass: "",
      authKeyName: "",
      authKeyValue: "",
      authKeyIn: "header",
      oauth2Config: liveConfig,
    });

    const preset = usePresetStore.getState().authPresets[0];
    expect(preset.oauth2Config?.accessToken).toBeUndefined();
    expect(preset.oauth2Config?.refreshToken).toBeUndefined();
    expect(preset.oauth2Config?.clientSecret).toBe("");
    expect(preset.oauth2Config?.clientId).toBe("client-1");
  });

  it("never writes OAuth secrets to localStorage", () => {
    usePresetStore.getState().saveAuthPreset("oauth preset", {
      authType: "oauth2",
      authToken: "",
      authUser: "",
      authPass: "",
      authKeyName: "",
      authKeyValue: "",
      authKeyIn: "header",
      oauth2Config: liveConfig,
    });

    const raw = localStorage.getItem("reqit:presets") ?? "";
    for (const secret of ["at-live-123", "rt-live-456", "super-secret"]) {
      expect(raw).not.toContain(secret);
    }
    expect(raw).toContain("tok_abc");
  });
});
