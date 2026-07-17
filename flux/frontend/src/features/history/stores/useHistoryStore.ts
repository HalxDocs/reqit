import { create } from "zustand";
import { ClearHistory, GetHistory } from "../../../../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../../../../wailsjs/runtime";
import type { models } from "../../../../wailsjs/go/models";
import { toast } from "@/app/stores/useToastStore";

type HistoryStore = {
  entries: models.HistoryEntry[];
  loaded: boolean;
  loadError: string | null;

  load: () => Promise<void>;
  clear: () => Promise<void>;
  cleanup: () => void;
};

const HIST_EVENT = "history:changed";

export const useHistoryStore = create<HistoryStore>((set, get) => {
  EventsOn(HIST_EVENT, () => {
    get().load();
  });

  return {
  entries: [],
  loaded: false,
  loadError: null,

  load: async () => {
    try {
      const entries = await GetHistory();
      set({ entries, loaded: true, loadError: null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load history";
      toast.error(msg);
      set({ loaded: true, loadError: msg });
    }
  },

  clear: async () => {
    await ClearHistory();
    set({ entries: [] });
  },

  cleanup: () => {
    EventsOff(HIST_EVENT);
  },
  };
});
