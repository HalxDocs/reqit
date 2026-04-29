import { create } from "zustand";
import type { RequestState, ResponseResult } from "../types/request";
import { uid } from "../lib/id";
import { useRequestStore } from "./useRequestStore";
import { useResponseStore } from "./useResponseStore";

export interface Tab {
  id: string;
  title: string;
  // savedRequestID links the tab to a persisted SavedRequest so subsequent
  // saves can update in place rather than always creating new entries.
  savedRequestID: string | null;
  request: RequestState;
  response: ResponseResult | null;
  dirty: boolean;
}

const STORAGE_KEY = "flux:tabs";

const emptyRequest = (): RequestState => ({
  method: "GET",
  url: "",
  params: [{ id: uid("kv"), key: "", value: "", enabled: true }],
  headers: [
    { id: uid("kv"), key: "Content-Type", value: "application/json", enabled: false },
    { id: uid("kv"), key: "", value: "", enabled: true },
  ],
  bodyType: "none",
  bodyRaw: "",
  bodyForm: [{ id: uid("kv"), key: "", value: "", enabled: true }],
  authType: "none",
  authToken: "",
  authUser: "",
  authPass: "",
  authKeyName: "X-API-Key",
  authKeyValue: "",
  authKeyIn: "header",
});

const newTab = (overrides: Partial<Tab> = {}): Tab => ({
  id: uid("tab"),
  title: "Untitled",
  savedRequestID: null,
  request: emptyRequest(),
  response: null,
  dirty: false,
  ...overrides,
});

const pickRequestState = (): RequestState => {
  const s = useRequestStore.getState();
  return {
    method: s.method,
    url: s.url,
    params: s.params,
    headers: s.headers,
    bodyType: s.bodyType,
    bodyRaw: s.bodyRaw,
    bodyForm: s.bodyForm,
    authType: s.authType,
    authToken: s.authToken,
    authUser: s.authUser,
    authPass: s.authPass,
    authKeyName: s.authKeyName,
    authKeyValue: s.authKeyValue,
    authKeyIn: s.authKeyIn,
  };
};

export function deriveTitle(state: RequestState, fallback?: string): string {
  if (fallback) return fallback;
  const url = state.url.trim();
  if (!url) return "Untitled";
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    return parsed.pathname === "/" ? parsed.host : `${parsed.host}${parsed.pathname}`;
  } catch {
    return url.length > 32 ? `${url.slice(0, 32)}…` : url;
  }
}

type TabsStore = {
  tabs: Tab[];
  activeID: string;

  hydrate: () => void;
  newTab: (overrides?: Partial<Tab>) => Tab;
  setActive: (id: string) => void;
  closeTab: (id: string) => void;
  updateActiveTitle: () => void;
  syncFromActiveStores: () => void;
  markActiveSaved: (savedRequestID: string, title: string) => void;
  refreshTitleFromUrl: () => void;
  resetTabs: () => void;
};

function persist(state: { tabs: Tab[]; activeID: string }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota
  }
}

function readPersisted(): { tabs: Tab[]; activeID: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.tabs) || parsed.tabs.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

const initial = newTab({ title: "Untitled" });

export const useTabsStore = create<TabsStore>((set, get) => ({
  tabs: [initial],
  activeID: initial.id,

  hydrate: () => {
    const stored = readPersisted();
    if (!stored) {
      // Use the in-memory initial; push it to active stores.
      const t = get().tabs[0];
      useRequestStore.getState().loadState(t.request);
      useResponseStore.setState({ response: t.response, isLoading: false, startedAt: null });
      return;
    }
    set({ tabs: stored.tabs, activeID: stored.activeID });
    const active = stored.tabs.find((t) => t.id === stored.activeID) ?? stored.tabs[0];
    useRequestStore.getState().loadState(active.request);
    useResponseStore.setState({
      response: active.response,
      isLoading: false,
      startedAt: null,
    });
  },

  newTab: (overrides) => {
    // Save outgoing tab snapshot first so we don't lose unsaved edits.
    get().syncFromActiveStores();

    const t = newTab(overrides);
    const tabs = [...get().tabs, t];
    set({ tabs, activeID: t.id });
    persist({ tabs, activeID: t.id });

    useRequestStore.getState().loadState(t.request);
    useResponseStore.setState({ response: t.response, isLoading: false, startedAt: null });
    return t;
  },

  setActive: (id) => {
    if (id === get().activeID) return;
    get().syncFromActiveStores();

    const next = get().tabs.find((t) => t.id === id);
    if (!next) return;
    set({ activeID: id });
    persist({ tabs: get().tabs, activeID: id });

    useRequestStore.getState().loadState(next.request);
    useResponseStore.setState({
      response: next.response,
      isLoading: false,
      startedAt: null,
    });
  },

  closeTab: (id) => {
    const tabs = get().tabs;
    if (tabs.length === 1) {
      // Don't close the last tab — reset it to a fresh state instead.
      const replacement = newTab();
      set({ tabs: [replacement], activeID: replacement.id });
      persist({ tabs: [replacement], activeID: replacement.id });
      useRequestStore.getState().loadState(replacement.request);
      useResponseStore.setState({ response: null, isLoading: false, startedAt: null });
      return;
    }
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const next = tabs.filter((t) => t.id !== id);
    let activeID = get().activeID;
    if (activeID === id) {
      const neighbor = next[idx] ?? next[idx - 1] ?? next[0];
      activeID = neighbor.id;
      useRequestStore.getState().loadState(neighbor.request);
      useResponseStore.setState({
        response: neighbor.response,
        isLoading: false,
        startedAt: null,
      });
    }
    set({ tabs: next, activeID });
    persist({ tabs: next, activeID });
  },

  updateActiveTitle: () => {
    const state = pickRequestState();
    const title = deriveTitle(state);
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === s.activeID && !t.savedRequestID ? { ...t, title } : t,
      ),
    }));
  },

  syncFromActiveStores: () => {
    const reqState = pickRequestState();
    const response = useResponseStore.getState().response;
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === s.activeID
          ? {
              ...t,
              request: reqState,
              response,
              title: t.savedRequestID ? t.title : deriveTitle(reqState, t.title === "Untitled" ? undefined : undefined),
              dirty: t.savedRequestID ? true : t.dirty,
            }
          : t,
      ),
    }));
    persist({ tabs: get().tabs, activeID: get().activeID });
  },

  markActiveSaved: (savedRequestID, title) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === s.activeID
          ? { ...t, savedRequestID, title, dirty: false }
          : t,
      ),
    }));
    persist({ tabs: get().tabs, activeID: get().activeID });
  },

  refreshTitleFromUrl: () => {
    const reqState = pickRequestState();
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === s.activeID && !t.savedRequestID
          ? { ...t, title: deriveTitle(reqState) }
          : t,
      ),
    }));
  },

  resetTabs: () => {
    const fresh = newTab();
    localStorage.removeItem(STORAGE_KEY);
    set({ tabs: [fresh], activeID: fresh.id });
    useRequestStore.getState().reset();
  },
}));
