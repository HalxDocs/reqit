import { create } from "zustand";
import { GetAISettings, SaveAISettings, DiagnoseWithAI, GenerateAssertions } from "../../../../wailsjs/go/main/App";
import type { models } from "../../../../wailsjs/go/models";

type AIStore = {
  enabled: boolean;
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  loaded: boolean;
  load: () => Promise<void>;
  save: (provider: string, apiKey: string, baseUrl: string, model: string) => Promise<void>;
  diagnose: (payload: models.RequestPayload, response: models.ResponseResult) => Promise<string>;
  generateAssertions: (payload: models.RequestPayload, response: models.ResponseResult) => Promise<string>;
};

export const useAIStore = create<AIStore>((set, get) => ({
  enabled: false,
  provider: "openai",
  apiKey: "",
  baseUrl: "",
  model: "",
  loaded: false,

  load: async () => {
    try {
      const s = await GetAISettings();
      set({
        enabled: s.enabled,
        provider: s.provider || "openai",
        apiKey: s.apiKey || "",
        baseUrl: s.baseUrl || "",
        model: s.model || "",
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },

  save: async (provider, apiKey, baseUrl, model) => {
    await SaveAISettings(provider, apiKey, baseUrl, model);
    set({ enabled: true, provider, apiKey, baseUrl, model });
  },

  diagnose: async (payload, response) => {
    return await DiagnoseWithAI(payload, response);
  },

  generateAssertions: async (payload, response) => {
    return await GenerateAssertions(payload, response);
  },
}));
