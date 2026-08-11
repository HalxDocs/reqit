import { create } from "zustand";
import { GetSocketSessions, DeleteSocketSession, ClearSocketSessions } from "../../../../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../../../../wailsjs/runtime";
import type { models } from "../../../../wailsjs/go/models";
import { toast } from "@/app/stores/useToastStore";

type SocketHistoryStore = {
  sessions: models.SocketSession[];
  loaded: boolean;

  load: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  cleanup: () => void;
};

const HIST_EVENT = "sockhistory:changed";

export const useSocketHistoryStore = create<SocketHistoryStore>((set) => {
  EventsOn(HIST_EVENT, () => {
    GetSocketSessions()
      .then((sessions) => set({ sessions, loaded: true }))
      .catch(() => {});
  });

  return {
    sessions: [],
    loaded: false,

    load: async () => {
      try {
        const sessions = await GetSocketSessions();
        set({ sessions, loaded: true });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load socket history");
        set({ loaded: true });
      }
    },

    remove: async (id) => {
      await DeleteSocketSession(id);
      set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) }));
    },

    clear: async () => {
      await ClearSocketSessions();
      set({ sessions: [] });
    },

    cleanup: () => {
      EventsOff(HIST_EVENT);
    },
  };
});
