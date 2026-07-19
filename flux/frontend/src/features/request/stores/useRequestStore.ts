import { create } from "zustand";
import type {
  ApiKeyIn,
  AuthType,
  BodyType,
  ExtractRule,
  GraphQLSchema,
  HttpMethod,
  KeyValue,
  OAuth2Config,
  PreSetVar,
  RequestState,
} from "@/features/request/types/request";
import { uid } from "@/shared/lib/id";

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
  authUsername: "",
  authPassword: "",
  authKeyName: "X-API-Key",
  authKeyValue: "",
  authKeyIn: "header",
  preSetVars: [{ id: uid("sv"), key: "", value: "" }],
  extractRules: [{ id: uid("er"), type: "body_json", source: "", target: "" }],
  graphqlQuery: "",
  graphqlVariables: "",
  preScript: "",
  postScript: "",
  notes: "",
  oauth2Config: undefined,
  grpcService: "",
  grpcMethod: "",
  grpcBody: "",
  soapAction: "",
  soapVersion: "1.1",
  soapBody: "",
  mqttTopic: "",
  mqttPayload: "",
  mqttQoS: 0,
  clientCert: "",
  clientKey: "",
};

type RequestStore = RequestState & {
  graphqlSchema: GraphQLSchema | null;
  graphqlSchemaLoading: boolean;
  graphqlSchemaError: string;
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
  setAuthUsername: (s: string) => void;
  setAuthPassword: (s: string) => void;
  setAuthKeyName: (s: string) => void;
  setAuthKeyValue: (s: string) => void;
  setAuthKeyIn: (v: ApiKeyIn) => void;
  setOAuth2Config: (cfg: OAuth2Config) => void;

  addPreSetVar: () => void;
  updatePreSetVar: (id: string, patch: Partial<PreSetVar>) => void;
  removePreSetVar: (id: string) => void;

  addExtractRule: () => void;
  updateExtractRule: (id: string, patch: Partial<ExtractRule>) => void;
  removeExtractRule: (id: string) => void;

  setGraphqlQuery: (q: string) => void;
  setGraphqlVariables: (v: string) => void;
  setGraphqlSchema: (s: GraphQLSchema | null) => void;
  setGraphqlSchemaLoading: (v: boolean) => void;
  setGraphqlSchemaError: (e: string) => void;
  setPreScript: (s: string) => void;
  setPostScript: (s: string) => void;
  setNotes: (s: string) => void;

  setGrpcService: (s: string) => void;
  setGrpcMethod: (s: string) => void;
  setGrpcBody: (s: string) => void;

  setSoapAction: (s: string) => void;
  setSoapVersion: (s: string) => void;
  setSoapBody: (s: string) => void;

  setMqttTopic: (s: string) => void;
  setMqttPayload: (s: string) => void;
  setMqttQoS: (n: number) => void;

  setClientCert: (s: string) => void;
  setClientKey: (s: string) => void;

  reset: () => void;
  loadState: (s: RequestState) => void;
};

const patchRow = (rows: KeyValue[], id: string, patch: Partial<KeyValue>) =>
  rows.map((r) => (r.id === id ? { ...r, ...patch } : r));

export const useRequestStore = create<RequestStore>((set) => ({
  ...initialState,
  graphqlSchema: null,
  graphqlSchemaLoading: false,
  graphqlSchemaError: "",

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
  setAuthUsername: (authUsername) => set({ authUsername }),
  setAuthPassword: (authPassword) => set({ authPassword }),
  setAuthKeyName: (authKeyName) => set({ authKeyName }),
  setAuthKeyValue: (authKeyValue) => set({ authKeyValue }),
  setAuthKeyIn: (authKeyIn) => set({ authKeyIn }),
  setOAuth2Config: (oauth2Config) => set({ oauth2Config }),

  setGraphqlQuery: (graphqlQuery) => set({ graphqlQuery }),
  setGraphqlVariables: (graphqlVariables) => set({ graphqlVariables }),
  setGraphqlSchema: (graphqlSchema) => set({ graphqlSchema }),
  setGraphqlSchemaLoading: (graphqlSchemaLoading) => set({ graphqlSchemaLoading }),
  setGraphqlSchemaError: (graphqlSchemaError) => set({ graphqlSchemaError }),
  setPreScript: (preScript) => set({ preScript }),
  setPostScript: (postScript) => set({ postScript }),
  setNotes: (notes) => set({ notes }),

  setGrpcService: (grpcService) => set({ grpcService }),
  setGrpcMethod: (grpcMethod) => set({ grpcMethod }),
  setGrpcBody: (grpcBody) => set({ grpcBody }),

  setSoapAction: (soapAction) => set({ soapAction }),
  setSoapVersion: (soapVersion) => set({ soapVersion }),
  setSoapBody: (soapBody) => set({ soapBody }),

  setMqttTopic: (mqttTopic) => set({ mqttTopic }),
  setMqttPayload: (mqttPayload) => set({ mqttPayload }),
  setMqttQoS: (mqttQoS) => set({ mqttQoS }),

  setClientCert: (clientCert) => set({ clientCert }),
  setClientKey: (clientKey) => set({ clientKey }),

  addPreSetVar: () => set((s) => ({ preSetVars: [...s.preSetVars, { id: uid("sv"), key: "", value: "" }] })),
  updatePreSetVar: (id, patch) =>
    set((s) => ({ preSetVars: s.preSetVars.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
  removePreSetVar: (id) =>
    set((s) => {
      const next = s.preSetVars.filter((r) => r.id !== id);
      return { preSetVars: next.length ? next : [{ id: uid("sv"), key: "", value: "" }] };
    }),

  addExtractRule: () =>
    set((s) => ({ extractRules: [...s.extractRules, { id: uid("er"), type: "body_json", source: "", target: "" }] })),
  updateExtractRule: (id, patch) =>
    set((s) => ({ extractRules: s.extractRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
  removeExtractRule: (id) =>
    set((s) => {
      const next = s.extractRules.filter((r) => r.id !== id);
      return { extractRules: next.length ? next : [{ id: uid("er"), type: "body_json", source: "", target: "" }] };
    }),

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
      authUsername: "",
      authPassword: "",
      authKeyName: "X-API-Key",
      authKeyValue: "",
      authKeyIn: "header",
      preSetVars: [{ id: uid("sv"), key: "", value: "" }],
      extractRules: [{ id: uid("er"), type: "body_json", source: "", target: "" }],
      graphqlQuery: "",
      graphqlVariables: "",
      preScript: "",
      postScript: "",
      notes: "",
      oauth2Config: undefined,
      grpcService: "",
      grpcMethod: "",
      grpcBody: "",
      soapAction: "",
      soapVersion: "1.1",
      soapBody: "",
      mqttTopic: "",
      mqttPayload: "",
      mqttQoS: 0,
      clientCert: "",
      clientKey: "",
      graphqlSchema: null,
      graphqlSchemaLoading: false,
      graphqlSchemaError: "",
    }),

  loadState: (s) => set({ ...s }),
}));
