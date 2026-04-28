import { create } from "zustand";
import {
  CreateEnvironment,
  DeleteEnvironment,
  GetEnvironments,
  SetActiveEnvironment,
  UpdateEnvironment,
} from "../../wailsjs/go/main/App";
import type { models } from "../../wailsjs/go/models";

type EnvStore = {
  environments: models.Environment[];
  activeID: string;
  loaded: boolean;

  load: () => Promise<void>;
  setActive: (id: string) => Promise<void>;

  create: (name: string) => Promise<models.Environment>;
  update: (id: string, name: string, vars: models.EnvVar[]) => Promise<void>;
  remove: (id: string) => Promise<void>;

  resolve: (text: string) => string;
  unresolved: (text: string) => string[];
};

const VAR_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

export const useEnvStore = create<EnvStore>((set, get) => ({
  environments: [],
  activeID: "",
  loaded: false,

  load: async () => {
    const snap = await GetEnvironments();
    set({
      environments: snap.environments ?? [],
      activeID: snap.active ?? "",
      loaded: true,
    });
  },

  setActive: async (id) => {
    await SetActiveEnvironment(id);
    set({ activeID: id });
  },

  create: async (name) => {
    const env = await CreateEnvironment(name);
    await get().load();
    return env;
  },

  update: async (id, name, vars) => {
    await UpdateEnvironment(id, name, vars as never);
    await get().load();
  },

  remove: async (id) => {
    await DeleteEnvironment(id);
    await get().load();
  },

  resolve: (text) => {
    if (!text) return text;
    const map = activeMap(get().environments, get().activeID);
    return text.replace(VAR_PATTERN, (full, name: string) => {
      const v = map.get(name);
      return v === undefined ? full : v;
    });
  },

  unresolved: (text) => {
    if (!text) return [];
    const map = activeMap(get().environments, get().activeID);
    const out: string[] = [];
    for (const m of text.matchAll(VAR_PATTERN)) {
      const name = m[1];
      if (!map.has(name) && !out.includes(name)) out.push(name);
    }
    return out;
  },
}));

function activeMap(envs: models.Environment[], activeID: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!activeID) return out;
  const env = envs.find((e) => e.id === activeID);
  if (!env) return out;
  for (const v of env.vars ?? []) {
    if (v.enabled !== false && v.key) out.set(v.key, v.value ?? "");
  }
  return out;
}
