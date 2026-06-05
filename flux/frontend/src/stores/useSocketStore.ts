import { create } from "zustand";
import {
  ConnectSocket,
  DisconnectSocket,
  GetSocketState,
  SendSocketMessage,
} from "../../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../../wailsjs/runtime";
import type { models } from "../../wailsjs/go/models";

type SocketStore = {
  status: string;
  protocol: string;
  url: string;
  messages: models.SocketMessage[];

  connect: (url: string, protocol: string) => Promise<void>;
  disconnect: () => Promise<void>;
  send: (msg: string) => Promise<void>;
  refresh: () => Promise<void>;
};

export const useSocketStore = create<SocketStore>((set, get) => {
  // Wire Wails events on init
  EventsOn("socket:message", (msg: models.SocketMessage) => {
    set((s) => ({ messages: [...s.messages, msg] }));
  });
  EventsOn("socket:status", (status: string) => {
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
      await DisconnectSocket();
      set({ status: "disconnected" });
    },

    send: async (msg) => {
      await SendSocketMessage(msg);
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
  };
});
