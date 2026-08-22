import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { KeyValue, AuthType, ApiKeyIn, OAuth2Config } from "@/features/request/types/request";

export interface HeaderPreset {
  id: string;
  name: string;
  headers: { key: string; value: string; enabled: boolean }[];
}

export interface AuthPreset {
  id: string;
  name: string;
  authType: AuthType;
  authToken?: string;
  authUser?: string;
  authPass?: string;
  authKeyName?: string;
  authKeyValue?: string;
  authKeyIn?: ApiKeyIn;
  oauth2Config?: OAuth2Config;
  authUsername?: string;
  authPassword?: string;
}

interface PresetStore {
  headerPresets: HeaderPreset[];
  authPresets: AuthPreset[];
  saveHeaderPreset: (name: string, headers: KeyValue[]) => void;
  deleteHeaderPreset: (id: string) => void;
  saveAuthPreset: (name: string, auth: { authType: AuthType; authToken: string; authUser: string; authPass: string; authKeyName: string; authKeyValue: string; authKeyIn: ApiKeyIn; oauth2Config?: OAuth2Config; authUsername?: string; authPassword?: string }) => void;
  deleteAuthPreset: (id: string) => void;
}

let presetCounter = 0;
const nextPresetId = () => `preset_${++presetCounter}_${Date.now().toString(36)}`;

/**
 * Presets are persisted to localStorage, so they must never carry live OAuth
 * secrets. Access/refresh tokens and client secrets live in the OS keychain
 * (referenced by tokenRef); a preset stores configuration only. Applying a
 * preset fills the form — the user authorizes fresh.
 */
export function sanitizeOAuth2Config(cfg?: OAuth2Config): OAuth2Config | undefined {
  if (!cfg) return undefined;
  return { ...cfg, clientSecret: "", accessToken: undefined, refreshToken: undefined };
}

export const usePresetStore = create<PresetStore>()(
  persist(
    (set) => ({
      headerPresets: [],
      authPresets: [],

      saveHeaderPreset: (name, headers) =>
        set((s) => ({
          headerPresets: [
            ...s.headerPresets,
            { id: nextPresetId(), name, headers: headers.filter((h) => h.key).map((h) => ({ key: h.key, value: h.value, enabled: h.enabled })) },
          ],
        })),

      deleteHeaderPreset: (id) =>
        set((s) => ({ headerPresets: s.headerPresets.filter((p) => p.id !== id) })),

      saveAuthPreset: (name, auth) =>
        set((s) => ({
          authPresets: [
            ...s.authPresets,
            {
              id: nextPresetId(),
              name,
              authType: auth.authType,
              authToken: auth.authToken,
              authUser: auth.authUser,
              authPass: auth.authPass,
              authKeyName: auth.authKeyName,
              authKeyValue: auth.authKeyValue,
              authKeyIn: auth.authKeyIn,
              // Never persist live tokens/client secrets — config only.
              oauth2Config: sanitizeOAuth2Config(auth.oauth2Config),
              authUsername: auth.authUsername,
              authPassword: auth.authPassword,
            },
          ],
        })),

      deleteAuthPreset: (id) =>
        set((s) => ({ authPresets: s.authPresets.filter((p) => p.id !== id) })),
    }),
    {
      name: "reqit:presets",
      // Sanitize anything already persisted by older builds (which stored the
      // full oauth2Config incl. secrets) so the leak is removed on load too.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PresetStore>;
        const authPresets = (p.authPresets ?? []).map((preset) => ({
          ...preset,
          oauth2Config: sanitizeOAuth2Config(preset.oauth2Config),
        }));
        return { ...current, ...p, authPresets };
      },
    },
  ),
);
