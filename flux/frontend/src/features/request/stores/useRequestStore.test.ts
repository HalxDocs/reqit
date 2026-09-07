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

  it("switching to POST enables the default Content-Type header", () => {
    const before = useRequestStore.getState().headers.find((h) => h.key === "Content-Type");
    expect(before?.enabled).toBe(false);
    useRequestStore.getState().setMethod("POST");
    const row = useRequestStore.getState().headers.find((h) => h.key === "Content-Type");
    expect(row?.enabled).toBe(true);
    expect(row?.value).toBe("application/json");
  });

  it("switching to PUT/PATCH enables Content-Type, GET leaves it alone", () => {
    useRequestStore.getState().setMethod("PUT");
    expect(useRequestStore.getState().headers.find((h) => h.key === "Content-Type")?.enabled).toBe(true);

    useRequestStore.setState(useRequestStore.getInitialState());
    useRequestStore.getState().setMethod("PATCH");
    expect(useRequestStore.getState().headers.find((h) => h.key === "Content-Type")?.enabled).toBe(true);

    useRequestStore.setState(useRequestStore.getInitialState());
    useRequestStore.getState().setMethod("GET");
    expect(useRequestStore.getState().headers.find((h) => h.key === "Content-Type")?.enabled).toBe(false);

    useRequestStore.getState().setMethod("DELETE");
    expect(useRequestStore.getState().headers.find((h) => h.key === "Content-Type")?.enabled).toBe(false);
  });

  it("setMethod never overwrites a user-set Content-Type value", () => {
    const s = useRequestStore.getState();
    const id = s.headers.find((h) => h.key === "Content-Type")!.id;
    s.updateHeader(id, { value: "text/xml", enabled: true });
    s.setMethod("POST");
    const row = useRequestStore.getState().headers.find((h) => h.key === "Content-Type");
    expect(row?.value).toBe("text/xml");
    expect(row?.enabled).toBe(true);
  });

  it("setMethod re-adds Content-Type if the row was deleted", () => {
    const s = useRequestStore.getState();
    s.headers.filter((h) => h.key === "Content-Type").forEach((h) => s.removeHeader(h.id));
    expect(useRequestStore.getState().headers.some((h) => h.key.toLowerCase() === "content-type")).toBe(false);
    s.setMethod("POST");
    const rows = useRequestStore.getState().headers.filter((h) => h.key.toLowerCase() === "content-type");
    expect(rows.length).toBe(1);
    expect(rows[0].enabled).toBe(true);
    expect(rows[0].value).toBe("application/json");
  });

  it("setMethod to POST twice does not duplicate Content-Type", () => {
    const s = useRequestStore.getState();
    s.setMethod("POST");
    s.setMethod("POST");
    const rows = useRequestStore.getState().headers.filter((h) => h.key.toLowerCase() === "content-type");
    expect(rows.length).toBe(1);
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
