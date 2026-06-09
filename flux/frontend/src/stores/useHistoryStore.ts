import { create } from "zustand";
import { ClearHistory, GetHistory } from "../../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../../wailsjs/runtime";
import type { models } from "../../wailsjs/go/models";

type HistoryStore = {
  entries: models.HistoryEntry[];
  loaded: boolean;

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

  load: async () => {
    const entries = await GetHistory();
    set({ entries, loaded: true });
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
