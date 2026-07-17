import { create } from "zustand";
import { GetProfile, UpdateProfile, AppDataDir } from "../../../wailsjs/go/main/App";
import type { profile } from "../../../wailsjs/go/models";
import { toast } from "@/app/stores/useToastStore";

type ProfileStore = {
  profile: profile.Profile | null;
  loaded: boolean;
  loadError: string | null;
  appDataDir: string;

  load: () => Promise<void>;
  update: (name: string, email: string) => Promise<void>;
};

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profile: null,
  loaded: false,
  loadError: null,
  appDataDir: "",

  load: async () => {
    try {
      const [p, dir] = await Promise.all([GetProfile(), AppDataDir().catch(() => "")]);
      set({ profile: p, loaded: true, loadError: null, appDataDir: dir });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load profile";
      toast.error(msg);
      set({ loaded: true, loadError: msg });
    }
  },

  update: async (name, email) => {
    await UpdateProfile(name, email);
    await get().load();
  },
}));
