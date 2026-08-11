import { create } from "zustand";
import {
  EventInspectorStart,
  EventInspectorStop,
  EventInspectorStatus,
  EventInspectorGetEvents,
  EventInspectorClear,
  EventInspectorDelete,
  EventInspectorSetSecret,
  EventInspectorHasSecret,
  EventInspectorReplay,
} from "../../../../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../../../../wailsjs/runtime";
import type { models } from "../../../../wailsjs/go/models";
import { toast } from "@/app/stores/useToastStore";

type EventInspectorStore = {
  running: boolean;
  port: number;
  count: number;
  hasSecret: boolean;
  events: models.EventRecord[];
  loading: boolean;

  refresh: () => Promise<void>;
  toggle: () => Promise<void>;
  setSecret: (secret: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  replay: (id: string, targetUrl: string, preserveSvix: boolean) => Promise<models.ResponseResult | null>;
  cleanup: () => void;
};

const CHANGED_EVENT = "eventinspector:changed";

export const useEventInspectorStore = create<EventInspectorStore>((set, get) => {
  EventsOn(CHANGED_EVENT, () => {
    void get().refresh();
  });

  return {
    running: false,
    port: 0,
    count: 0,
    hasSecret: false,
    events: [],
    loading: false,

    refresh: async () => {
      try {
        const st = await EventInspectorStatus();
        const events = await EventInspectorGetEvents();
        set({
          running: st.running,
          port: st.port,
          count: st.count,
          hasSecret: st.hasSecret,
          events,
        });
      } catch {
        // listener not ready — keep last state
      }
    },

    toggle: async () => {
      const { running } = get();
      try {
        if (running) {
          await EventInspectorStop();
        } else {
          const port = await EventInspectorStart();
          toast.success(`Webhook capture listening on 127.0.0.1:${port}`);
        }
        await get().refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to toggle capture");
      }
    },

    setSecret: async (secret) => {
      try {
        await EventInspectorSetSecret(secret.trim());
        await get().refresh();
        toast.success("Signing secret saved to the OS keychain");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save secret");
      }
    },

    remove: async (id) => {
      await EventInspectorDelete(id);
      set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
    },

    clear: async () => {
      await EventInspectorClear();
      set({ events: [], count: 0 });
    },

    replay: async (id, targetUrl, preserveSvix) => {
      try {
        const res = await EventInspectorReplay(id, targetUrl, preserveSvix);
        await get().refresh();
        return res;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Replay failed");
        return null;
      }
    },

    cleanup: () => {
      EventsOff(CHANGED_EVENT);
    },
  };
});
