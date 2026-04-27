import { create } from "zustand";
import type {
  AuthType,
  BodyType,
  HttpMethod,
  KeyValue,
  RequestState,
} from "../types/request";
import { uid } from "../lib/id";

const emptyRow = (): KeyValue => ({ id: uid("kv"), key: "", value: "", enabled: true });

const defaultHeaderRow = (): KeyValue => ({
  id: uid("kv"),
  key: "Content-Type",
  value: "application/json",
  enabled: false,
});

const initialState: RequestState = {
  method: "GET",
  url: "",
  params: [emptyRow()],
  headers: [defaultHeaderRow(), emptyRow()],
  bodyType: "none",
  bodyRaw: "",
  bodyForm: [emptyRow()],
  authType: "none",
  authToken: "",
  authUser: "",
  authPass: "",
};

type RequestStore = RequestState & {
  setMethod: (m: HttpMethod) => void;
  setUrl: (url: string) => void;

  addParam: () => void;
  updateParam: (id: string, patch: Partial<KeyValue>) => void;
  removeParam: (id: string) => void;

  addHeader: () => void;
  updateHeader: (id: string, patch: Partial<KeyValue>) => void;
  removeHeader: (id: string) => void;

  setBodyType: (t: BodyType) => void;
  setBodyRaw: (s: string) => void;
  addBodyForm: () => void;
  updateBodyForm: (id: string, patch: Partial<KeyValue>) => void;
  removeBodyForm: (id: string) => void;

  setAuthType: (t: AuthType) => void;
  setAuthToken: (s: string) => void;
  setAuthUser: (s: string) => void;
  setAuthPass: (s: string) => void;

  reset: () => void;
  loadState: (s: RequestState) => void;
};

const patchRow = (rows: KeyValue[], id: string, patch: Partial<KeyValue>) =>
  rows.map((r) => (r.id === id ? { ...r, ...patch } : r));

export const useRequestStore = create<RequestStore>((set) => ({
  ...initialState,

  setMethod: (method) => set({ method }),
  setUrl: (url) => set({ url }),

  addParam: () => set((s) => ({ params: [...s.params, emptyRow()] })),
  updateParam: (id, patch) =>
    set((s) => ({ params: patchRow(s.params, id, patch) })),
  removeParam: (id) =>
    set((s) => {
      const next = s.params.filter((r) => r.id !== id);
      return { params: next.length ? next : [emptyRow()] };
    }),

  addHeader: () => set((s) => ({ headers: [...s.headers, emptyRow()] })),
  updateHeader: (id, patch) =>
    set((s) => ({ headers: patchRow(s.headers, id, patch) })),
  removeHeader: (id) =>
    set((s) => {
      const next = s.headers.filter((r) => r.id !== id);
      return { headers: next.length ? next : [emptyRow()] };
    }),

  setBodyType: (bodyType) => set({ bodyType }),
  setBodyRaw: (bodyRaw) => set({ bodyRaw }),
  addBodyForm: () => set((s) => ({ bodyForm: [...s.bodyForm, emptyRow()] })),
  updateBodyForm: (id, patch) =>
    set((s) => ({ bodyForm: patchRow(s.bodyForm, id, patch) })),
  removeBodyForm: (id) =>
    set((s) => {
      const next = s.bodyForm.filter((r) => r.id !== id);
      return { bodyForm: next.length ? next : [emptyRow()] };
    }),

  setAuthType: (authType) => set({ authType }),
  setAuthToken: (authToken) => set({ authToken }),
  setAuthUser: (authUser) => set({ authUser }),
  setAuthPass: (authPass) => set({ authPass }),

  reset: () =>
    set({
      method: "GET",
      url: "",
      params: [emptyRow()],
      headers: [defaultHeaderRow(), emptyRow()],
      bodyType: "none",
      bodyRaw: "",
      bodyForm: [emptyRow()],
      authType: "none",
      authToken: "",
      authUser: "",
      authPass: "",
    }),

  loadState: (s) => set({ ...s }),
}));
