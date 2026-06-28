import { create } from "zustand";
import {
  ConnectSocket,
  DisconnectSocket,
  GetSocketState,
  SendSocketMessage,
  ConnectSocketIO,
  DisconnectSocketIO,
  GetSocketIOState,
  SendSocketIOMessage,
  EmitSocketIOEvent,
} from "../../../../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../../../../wailsjs/runtime";
import type { models } from "../../../../wailsjs/go/models";

type SocketProtocol = "ws" | "sse" | "socketio";

type SocketStore = {
  status: string;
  protocol: SocketProtocol;
  url: string;
  messages: models.SocketMessage[];

  connect: (url: string, protocol: SocketProtocol, opts?: { cookies?: string; headers?: Record<string, string> }) => Promise<void>;
  disconnect: () => Promise<void>;
  send: (msg: string) => Promise<void>;
  emitEvent: (event: string, data: any) => Promise<void>;
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

    connect: async (url, protocol, opts) => {
      set({ status: "connecting", url, protocol, messages: [] });
      try {
        if (protocol === "socketio") {
          await ConnectSocketIO({
            url,
            cookies: opts?.cookies ?? "",
            headers: opts?.headers ?? {},
          } as models.SocketIOConnectRequest);
        } else {
          await ConnectSocket(url, protocol);
        }
        set({ status: "connected" });
      } catch (e) {
        set({ status: "error" });
        throw e;
      }
    },

    disconnect: async () => {
      try {
        const proto = get().protocol;
        if (proto === "socketio") {
          await DisconnectSocketIO();
        } else {
          await DisconnectSocket();
        }
      } catch {
        // ignore if already disconnected
      }
      set({ status: "disconnected" });
    },

    send: async (msg) => {
      try {
        const proto = get().protocol;
        if (proto === "socketio") {
          await SendSocketIOMessage(msg);
        } else {
          await SendSocketMessage(msg);
        }
      } catch {
        // ignore send failures
      }
    },

    emitEvent: async (event, data) => {
      try {
        if (get().protocol === "socketio") {
          await EmitSocketIOEvent(event, data);
        }
      } catch {
        // ignore
      }
    },

    refresh: async () => {
      try {
        const proto = get().protocol;
        let state: models.SocketState;
        if (proto === "socketio") {
          state = await GetSocketIOState();
        } else {
          state = await GetSocketState();
        }
        set({
          status: state.status,
          protocol: (state.protocol as SocketProtocol) || proto,
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
