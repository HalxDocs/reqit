import { describe, it, expect, beforeEach, vi } from "vitest";
import { useTabsStore, deriveTitle } from "./useTabsStore";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { useResponseStore } from "@/features/request/stores/useResponseStore";

describe("deriveTitle", () => {
  it("returns fallback if provided", () => {
    expect(deriveTitle({ url: "https://foo.com" } as any, "Custom")).toBe("Custom");
  });

  it("returns 'Untitled' for empty url", () => {
    expect(deriveTitle({ url: "" } as any)).toBe("Untitled");
  });

  it("returns host for root path", () => {
    expect(deriveTitle({ url: "https://example.com" } as any)).toBe("example.com");
  });

  it("returns host+path for non-root path", () => {
    expect(deriveTitle({ url: "https://example.com/api/v1" } as any)).toBe("example.com/api/v1");
  });

  it("truncates long urls that fail URL parsing", () => {
    const long = "http://".repeat(10);
    const result = deriveTitle({ url: long } as any);
    expect(result).not.toBe(long);
    expect(result.length).toBeLessThan(long.length);
  });

  it("returns short non-protocol url as-is", () => {
    expect(deriveTitle({ url: "localhost:3000" } as any)).toBe("localhost:3000");
  });
});

describe("useTabsStore", () => {
  beforeEach(() => {
    useRequestStore.setState(useRequestStore.getInitialState());
    useResponseStore.setState(useResponseStore.getInitialState());
    useTabsStore.setState(useTabsStore.getInitialState());
    localStorage.clear();
  });

  it("starts with one tab and correct defaults", () => {
    const s = useTabsStore.getState();
    expect(s.tabs.length).toBe(1);
    expect(s.tabs[0].title).toBe("Untitled");
    expect(s.tabs[0].pinned).toBe(false);
    expect(s.tabs[0].dirty).toBe(false);
    expect(s.tabs[0].savedRequestID).toBeNull();
    expect(s.tabs[0].request.method).toBe("GET");
    expect(s.tabs[0].request.url).toBe("");
    expect(s.activeID).toBe(s.tabs[0].id);
  });

  it("newTab creates a tab and sets it active", () => {
    const prevID = useTabsStore.getState().activeID;
    const t = useTabsStore.getState().newTab();
    const s = useTabsStore.getState();
    expect(s.tabs.length).toBe(2);
    expect(s.activeID).toBe(t.id);
    expect(s.activeID).not.toBe(prevID);
    expect(t.title).toBe("Untitled");
  });

  it("newTab accepts overrides", () => {
    const t = useTabsStore.getState().newTab({ title: "My Tab", pinned: true });
    expect(t.title).toBe("My Tab");
    expect(t.pinned).toBe(true);
  });

  it("setActive switches to another tab", () => {
    const t1 = useTabsStore.getState().tabs[0];
    const t2 = useTabsStore.getState().newTab();
    useTabsStore.getState().setActive(t1.id);
    expect(useTabsStore.getState().activeID).toBe(t1.id);
    useTabsStore.getState().setActive(t2.id);
    expect(useTabsStore.getState().activeID).toBe(t2.id);
  });

  it("setActive is a no-op for the already active tab", () => {
    const id = useTabsStore.getState().activeID;
    const spy = vi.fn();
    useTabsStore.subscribe(spy);
    useTabsStore.getState().setActive(id);
    expect(spy).not.toHaveBeenCalled();
  });

  it("closeTab removes a tab and activates neighbor", () => {
    const t1 = useTabsStore.getState().tabs[0];
    const t2 = useTabsStore.getState().newTab();
    expect(useTabsStore.getState().activeID).toBe(t2.id);
    useTabsStore.getState().closeTab(t2.id);
    const s = useTabsStore.getState();
    expect(s.tabs.length).toBe(1);
    expect(s.tabs[0].id).toBe(t1.id);
    expect(s.activeID).toBe(t1.id);
  });

  it("closeTab on last tab empties tabs and resets request store", () => {
    useRequestStore.getState().setUrl("https://example.com");
    useTabsStore.getState().closeTab(useTabsStore.getState().tabs[0].id);
    const s = useTabsStore.getState();
    expect(s.tabs.length).toBe(0);
    expect(s.activeID).toBe("");
    expect(useRequestStore.getState().url).toBe("");
  });

  it("togglePin toggles the pinned state", () => {
    const id = useTabsStore.getState().tabs[0].id;
    expect(useTabsStore.getState().tabs[0].pinned).toBe(false);
    useTabsStore.getState().togglePin(id);
    expect(useTabsStore.getState().tabs[0].pinned).toBe(true);
    useTabsStore.getState().togglePin(id);
    expect(useTabsStore.getState().tabs[0].pinned).toBe(false);
  });

  it("resetTabs restores a single fresh tab", () => {
    useTabsStore.getState().newTab();
    useTabsStore.getState().newTab();
    expect(useTabsStore.getState().tabs.length).toBe(3);
    useTabsStore.getState().resetTabs();
    const s = useTabsStore.getState();
    expect(s.tabs.length).toBe(1);
    expect(s.tabs[0].title).toBe("Untitled");
  });

  it("persist writes to localStorage on mutations", () => {
    const t = useTabsStore.getState().newTab();
    const raw = localStorage.getItem("flux:tabs");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.tabs.length).toBe(2);
    expect(parsed.activeID).toBe(t.id);
  });

  it("hydrate restores from localStorage", () => {
    const t = useTabsStore.getState().tabs[0];
    const snapshot = {
      tabs: [{ ...t, title: "Restored Tab" }],
      activeID: t.id,
    };
    localStorage.setItem("flux:tabs", JSON.stringify(snapshot));
    useTabsStore.setState(useTabsStore.getInitialState());
    useTabsStore.getState().hydrate();
    const s = useTabsStore.getState();
    expect(s.tabs.length).toBe(1);
    expect(s.tabs[0].title).toBe("Restored Tab");
  });

  it("moveTab reorders tabs", () => {
    const t1 = useTabsStore.getState().tabs[0];
    const t2 = useTabsStore.getState().newTab();
    const t3 = useTabsStore.getState().newTab();
    const ids = useTabsStore.getState().tabs.map((t) => t.id);
    expect(ids).toEqual([t1.id, t2.id, t3.id]);
    useTabsStore.getState().moveTab(t3.id, 0);
    const reordered = useTabsStore.getState().tabs.map((t) => t.id);
    expect(reordered).toEqual([t3.id, t1.id, t2.id]);
  });

  it("updateActiveTitle updates title from request url", () => {
    useRequestStore.getState().setUrl("https://api.example.com/users");
    useTabsStore.getState().updateActiveTitle();
    const active = useTabsStore.getState().tabs.find(
      (t) => t.id === useTabsStore.getState().activeID,
    );
    expect(active?.title).toBe("api.example.com/users");
  });

  it("markActiveSaved sets savedRequestID and clears dirty", () => {
    const id = useTabsStore.getState().tabs[0].id;
    useTabsStore.setState({
      tabs: useTabsStore.getState().tabs.map((t) =>
        t.id === id ? { ...t, dirty: true } : t,
      ),
    });
    useTabsStore.getState().markActiveSaved("saved-123", "My API");
    const tab = useTabsStore.getState().tabs.find((t) => t.id === id);
    expect(tab?.savedRequestID).toBe("saved-123");
    expect(tab?.title).toBe("My API");
    expect(tab?.dirty).toBe(false);
  });
});
