import { describe, it, expect, beforeEach } from "vitest";
import { useRequestStore } from "./useRequestStore";

describe("useRequestStore", () => {
  beforeEach(() => {
    useRequestStore.setState(useRequestStore.getInitialState());
  });

  it("starts with GET method and empty URL", () => {
    const s = useRequestStore.getState();
    expect(s.method).toBe("GET");
    expect(s.url).toBe("");
  });

  it("setMethod updates method", () => {
    useRequestStore.getState().setMethod("POST");
    expect(useRequestStore.getState().method).toBe("POST");
  });

  it("setUrl updates URL", () => {
    useRequestStore.getState().setUrl("https://example.com");
    expect(useRequestStore.getState().url).toBe("https://example.com");
  });

  it("setBodyType updates body type", () => {
    useRequestStore.getState().setBodyType("json");
    expect(useRequestStore.getState().bodyType).toBe("json");
  });

  it("setBodyRaw updates raw body", () => {
    useRequestStore.getState().setBodyRaw('{"key":"value"}');
    expect(useRequestStore.getState().bodyRaw).toBe('{"key":"value"}');
  });

  it("addParam adds a row", () => {
    const before = useRequestStore.getState().params.length;
    useRequestStore.getState().addParam();
    expect(useRequestStore.getState().params.length).toBe(before + 1);
  });

  it("updateParam patches a row", () => {
    const params = useRequestStore.getState().params;
    const id = params[0].id;
    useRequestStore.getState().updateParam(id, { key: "foo", value: "bar" });
    const row = useRequestStore.getState().params.find((r) => r.id === id);
    expect(row?.key).toBe("foo");
    expect(row?.value).toBe("bar");
  });

  it("removeParam deletes a row and keeps at least one", () => {
    const params = useRequestStore.getState().params;
    const id = params[0].id;
    useRequestStore.getState().removeParam(id);
    expect(useRequestStore.getState().params.length).toBe(1);
  });

  it("addHeader adds a row", () => {
    const before = useRequestStore.getState().headers.length;
    useRequestStore.getState().addHeader();
    expect(useRequestStore.getState().headers.length).toBe(before + 1);
  });

  it("removeHeader keeps at least one row", () => {
    const state = useRequestStore.getState();
    // remove all headers
    state.headers.forEach((h) => state.removeHeader(h.id));
    expect(useRequestStore.getState().headers.length).toBe(1);
  });

  it("setAuthType updates auth type", () => {
    useRequestStore.getState().setAuthType("bearer");
    expect(useRequestStore.getState().authType).toBe("bearer");
  });

  it("setAuthToken updates token", () => {
    useRequestStore.getState().setAuthToken("tok-123");
    expect(useRequestStore.getState().authToken).toBe("tok-123");
  });

  it("reset restores initial state", () => {
    const state = useRequestStore.getState();
    state.setMethod("DELETE");
    state.setUrl("https://reset-test.com");
    state.setBodyType("graphql");
    state.reset();
    const s = useRequestStore.getState();
    expect(s.method).toBe("GET");
    expect(s.url).toBe("");
    expect(s.bodyType).toBe("none");
  });

  it("loadState replaces full state", () => {
    useRequestStore.getState().loadState({
      method: "PUT",
      url: "https://loaded.com",
      params: [],
      headers: [],
      bodyType: "none",
      bodyRaw: "",
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
    });
    const s = useRequestStore.getState();
    expect(s.method).toBe("PUT");
    expect(s.url).toBe("https://loaded.com");
  });

  it("setGraphqlQuery updates query", () => {
    useRequestStore.getState().setGraphqlQuery("{ user { id } }");
    expect(useRequestStore.getState().graphqlQuery).toBe("{ user { id } }");
  });

  it("addBodyForm adds a form row", () => {
    const before = useRequestStore.getState().bodyForm.length;
    useRequestStore.getState().addBodyForm();
    expect(useRequestStore.getState().bodyForm.length).toBe(before + 1);
  });

  it("updateBodyForm patches a form row", () => {
    const id = useRequestStore.getState().bodyForm[0].id;
    useRequestStore.getState().updateBodyForm(id, { value: "form-value" });
    expect(useRequestStore.getState().bodyForm[0].value).toBe("form-value");
  });
});
