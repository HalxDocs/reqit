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
import type { models } from "../../wailsjs/go/models";
import type { WirePayload } from "../lib/buildPayload";

type CollectionStore = {
  collections: models.Collection[];
  expanded: Record<string, boolean>;
  loaded: boolean;

  load: () => Promise<void>;
  toggleExpanded: (id: string) => void;

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

export const useCollectionStore = create<CollectionStore>((set, get) => ({
  collections: [],
  expanded: {},
  loaded: false,

  load: async () => {
    const collections = await GetCollections();
    const expanded: Record<string, boolean> = { ...get().expanded };
    for (const c of collections) {
      if (!(c.id in expanded)) expanded[c.id] = true;
    }
    set({ collections, expanded, loaded: true });
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
      };
      await AddRequestToCollection(c.id, `${req.name} (copy)`, wire as never);
      await get().load();
      return;
    }
  },
}));
