import { create } from "zustand";
import { GetProxyConfig, SetProxyConfig } from "../../../wailsjs/go/main/App";

export interface ProxyConfig {
  enabled: boolean;
  url: string;
  username: string;
  password: string;
}

type ProxyStore = {
  config: ProxyConfig;
  loading: boolean;
  load: () => Promise<void>;
  save: (cfg: ProxyConfig) => Promise<void>;
};

export const useProxyStore = create<ProxyStore>((set, get) => ({
  config: { enabled: false, url: "", username: "", password: "" },
  loading: false,
  load: async () => {
    set({ loading: true });
    try {
      const raw = await GetProxyConfig();
      const config: ProxyConfig = JSON.parse(raw);
      set({ config });
    } catch { /* ignore */ } finally {
      set({ loading: false });
    }
  },
  save: async (cfg: ProxyConfig) => {
    await SetProxyConfig(JSON.stringify(cfg));
    set({ config: cfg });
  },
}));
