import { create } from "zustand";
import { GetProfile, UpdateProfile, AppDataDir } from "../../../wailsjs/go/main/App";
import type { profile } from "../../../wailsjs/go/models";

type ProfileStore = {
  profile: profile.Profile | null;
  loaded: boolean;
  appDataDir: string;

  load: () => Promise<void>;
  update: (name: string, email: string) => Promise<void>;
};

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profile: null,
  loaded: false,
  appDataDir: "",

  load: async () => {
    const [p, dir] = await Promise.all([GetProfile(), AppDataDir().catch(() => "")]);
    set({ profile: p, loaded: true, appDataDir: dir });
  },

  update: async (name, email) => {
    await UpdateProfile(name, email);
    await get().load();
  },
}));
