import { create } from "zustand";
import {
  AddRequestToCollection,
  CreateCollection,
  DeleteCollection,
  DeleteSavedRequest,
  GetCollections,
  RenameCollection,
  UpdateSavedRequest,
} from "../../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../../wailsjs/runtime";
import type { models } from "../../wailsjs/go/models";
import type { WirePayload } from "../lib/buildPayload";
import { useTabsStore } from "./useTabsStore";
import { toast } from "./useToastStore";

type CollectionStore = {
  collections: models.Collection[];
  expanded: Record<string, boolean>;
  loaded: boolean;
  lastExternalChange: number | null;

  load: (external?: boolean) => Promise<void>;
  toggleExpanded: (id: string) => void;
  cleanup: () => void;

  createCollection: (name: string) => Promise<models.Collection>;
  renameCollection: (id: string, name: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;

  addRequest: (
    collID: string,
    name: string,
    payload: WirePayload,
  ) => Promise<models.SavedRequest>;
  updateRequest: (reqID: string, name: string, payload: WirePayload) => Promise<void>;
  renameRequest: (reqID: string, name: string) => Promise<void>;
  deleteRequest: (reqID: string) => Promise<void>;
  duplicateRequest: (reqID: string) => Promise<void>;
};

const COLL_EVENT = "collections:changed";

function reconcileTabs(collections: models.Collection[]) {
  const savedIDs = new Set<string>();
  for (const c of collections) {
    for (const r of c.requests) savedIDs.add(r.id);
  }
  const tabs = useTabsStore.getState().tabs;
  for (const t of tabs) {
    if (t.savedRequestID && !savedIDs.has(t.savedRequestID)) {
      toast.info(`Request "${t.title}" was deleted externally — tab closed`);
      useTabsStore.getState().closeTab(t.id);
    }
  }
}

export const useCollectionStore = create<CollectionStore>((set, get) => {
  EventsOn(COLL_EVENT, () => {
    get().load(true);
  });

  return {
  collections: [],
  expanded: {},
  loaded: false,
  lastExternalChange: null,

  load: async (external = false) => {
    try {
      const collections = await GetCollections();
      const expanded: Record<string, boolean> = { ...get().expanded };
      for (const c of collections) {
        if (!(c.id in expanded)) expanded[c.id] = true;
      }
      set({ collections, expanded, loaded: true, lastExternalChange: external ? Date.now() : null });
      if (external) reconcileTabs(collections);
    } catch {
      set({ loaded: true });
    }
  },

  toggleExpanded: (id) =>
    set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),

  createCollection: async (name) => {
    const c = await CreateCollection(name);
    await get().load();
    return c;
  },

  renameCollection: async (id, name) => {
    await RenameCollection(id, name);
    await get().load();
  },

  deleteCollection: async (id) => {
    await DeleteCollection(id);
    await get().load();
  },

  addRequest: async (collID, name, payload) => {
    const r = await AddRequestToCollection(collID, name, payload as never);
    await get().load();
    return r;
  },

  updateRequest: async (reqID, name, payload) => {
    await UpdateSavedRequest(reqID, name, payload as never);
    await get().load();
  },

  renameRequest: async (reqID, name) => {
    const colls = get().collections;
    for (const c of colls) {
      const req = c.requests.find((r) => r.id === reqID);
      if (!req) continue;
      await UpdateSavedRequest(reqID, name, req.payload as never);
      await get().load();
      return;
    }
  },

  deleteRequest: async (reqID) => {
    await DeleteSavedRequest(reqID);
    await get().load();
  },

  duplicateRequest: async (reqID) => {
    const colls = get().collections;
    for (const c of colls) {
      const req = c.requests.find((r) => r.id === reqID);
      if (!req) continue;
      const wire: WirePayload = {
        method: req.payload.method,
        url: req.payload.url,
        headers: req.payload.headers ?? [],
        params: req.payload.params ?? [],
        bodyType: req.payload.bodyType,
        body: req.payload.body,
        bodyForm: req.payload.bodyForm ?? [],
        authType: req.payload.authType,
        authValue: req.payload.authValue,
        graphqlQuery: (req.payload as any).graphqlQuery ?? "",
        graphqlVariables: (req.payload as any).graphqlVariables ?? "",
        preScript: (req.payload as any).preScript ?? "",
        postScript: (req.payload as any).postScript ?? "",
      };
      await AddRequestToCollection(c.id, `${req.name} (copy)`, wire as never);
      await get().load();
      return;
    }
  },

  cleanup: () => {
    EventsOff(COLL_EVENT);
  },
  };
});
