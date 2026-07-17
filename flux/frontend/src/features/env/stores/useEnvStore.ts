import { create } from "zustand";
import {
  CreateEnvironment,
  DeleteEnvironment,
  GetEnvironments,
  SetActiveEnvironment,
  UpdateEnvironment,
} from "../../../../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../../../../wailsjs/runtime";
import type { models } from "../../../../wailsjs/go/models";
import { toast } from "@/app/stores/useToastStore";

type EnvStore = {
  environments: models.Environment[];
  activeID: string;
  loaded: boolean;
  loadError: string | null;

  load: () => Promise<void>;
  setActive: (id: string) => Promise<void>;
  cleanup: () => void;

  create: (name: string) => Promise<models.Environment>;
  update: (id: string, name: string, vars: models.EnvVar[]) => Promise<void>;
  remove: (id: string) => Promise<void>;

  resolve: (text: string, extraVars?: Map<string, string>) => string;
  unresolved: (text: string) => string[];
};

const VAR_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;
const ENV_EVENT = "environments:changed";

export const useEnvStore = create<EnvStore>((set, get) => {
  EventsOn(ENV_EVENT, () => {
    toast.info("Environments changed externally — reloading");
    get().load();
  });

  return {
  environments: [],
  activeID: "",
  loaded: false,
  loadError: null,

  load: async () => {
    try {
      const snap = await GetEnvironments();
      set({
        environments: snap.environments ?? [],
        activeID: snap.active ?? "",
        loaded: true,
        loadError: null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load environments";
      toast.error(msg);
      set({ loaded: true, loadError: msg });
    }
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

  resolve: (text, extraVars?: Map<string, string>) => {
    if (!text) return text;
    const map = activeMap(get().environments, get().activeID);
    const merged = extraVars ? new Map([...map, ...extraVars]) : map;
    return text.replace(VAR_PATTERN, (full, name: string) => {
      const v = merged.get(name);
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

  cleanup: () => {
    EventsOff(ENV_EVENT);
  },
  };
});

export function collectionVarMap(vars: models.EnvVar[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const v of vars ?? []) {
    if (v.enabled !== false && v.key) out.set(v.key, v.value ?? "");
  }
  return out;
}

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
