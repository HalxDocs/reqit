import { describe, it, expect, beforeEach } from "vitest";
import { useResponseStore } from "./useResponseStore";

describe("useResponseStore", () => {
  beforeEach(() => {
    useResponseStore.setState({ response: null, isLoading: false, startedAt: null });
  });

  it("starts with no response", () => {
    expect(useResponseStore.getState().response).toBeNull();
    expect(useResponseStore.getState().isLoading).toBe(false);
  });

  it("setLoading sets loading and startedAt", () => {
    useResponseStore.getState().setLoading(true);
    const s = useResponseStore.getState();
    expect(s.isLoading).toBe(true);
    expect(s.startedAt).toBeTypeOf("number");
  });

  it("setResponse clears loading", () => {
    useResponseStore.getState().setLoading(true);
    useResponseStore.getState().setResponse({
      status: "200 OK",
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: '{"ok":true}',
      bodyIsBase64: false,
      timingMs: 150,
      sizeBytes: 13,
      error: "",
      cookies: [],
    });
    const s = useResponseStore.getState();
    expect(s.response?.statusCode).toBe(200);
    expect(s.isLoading).toBe(false);
  });

  it("clearResponse resets all fields", () => {
    useResponseStore.getState().setLoading(true);
    useResponseStore.getState().clearResponse();
    const s = useResponseStore.getState();
    expect(s.response).toBeNull();
    expect(s.isLoading).toBe(false);
    expect(s.startedAt).toBeNull();
  });
});
