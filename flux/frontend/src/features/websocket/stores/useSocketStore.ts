import { create } from "zustand";
import {
  ConnectSocket,
  DisconnectSocket,
  GetSocketState,
  SendSocketMessage,
} from "../../../../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../../../../wailsjs/runtime";
import type { models } from "../../../../wailsjs/go/models";

type SocketStore = {
  status: string;
  protocol: string;
  url: string;
  messages: models.SocketMessage[];

  connect: (url: string, protocol: string) => Promise<void>;
  disconnect: () => Promise<void>;
  send: (msg: string) => Promise<void>;
  refresh: () => Promise<void>;
  cleanup: () => void;
};

const MSG_EVENT = "socket:message";
const STATUS_EVENT = "socket:status";

const MAX_MESSAGES = 1000;

export const useSocketStore = create<SocketStore>((set, get) => {
  EventsOn(MSG_EVENT, (msg: models.SocketMessage) => {
    set((s) => {
      const next = [...s.messages, msg];
      return { messages: next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next };
    });
  });
  EventsOn(STATUS_EVENT, (status: string) => {
    set({ status });
  });

  return {
    status: "disconnected",
    protocol: "ws",
    url: "",
    messages: [],

    connect: async (url, protocol) => {
      set({ status: "connecting", url, protocol, messages: [] });
      try {
        await ConnectSocket(url, protocol);
        set({ status: "connected" });
      } catch (e) {
        set({ status: "error" });
        throw e;
      }
    },

    disconnect: async () => {
      try {
        await DisconnectSocket();
      } catch {
        // ignore if already disconnected
      }
      set({ status: "disconnected" });
    },

    send: async (msg) => {
      try {
        await SendSocketMessage(msg);
      } catch {
        // ignore send failures
      }
    },

    refresh: async () => {
      try {
        const state = await GetSocketState();
        set({
          status: state.status,
          protocol: state.protocol,
          url: state.url,
          messages: state.messages ?? [],
        });
      } catch {
        // not connected
      }
    },

    cleanup: () => {
      EventsOff(MSG_EVENT);
      EventsOff(STATUS_EVENT);
    },
  };
});
