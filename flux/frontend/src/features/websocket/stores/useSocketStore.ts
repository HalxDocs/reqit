import { create } from "zustand";
import {
  ConnectSocket,
  DisconnectSocket,
  GetSocketState,
  SendSocketMessage,
  SendSocketBinary,
  SetSocketAutoReconnect,
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

  connect: (url: string, protocol: SocketProtocol, opts?: { cookies?: string; headers?: Record<string, string>; autoReconnect?: boolean; tls?: models.GRPCTLSConfig }) => Promise<void>;
  disconnect: () => Promise<void>;
  send: (msg: string, binary?: boolean) => Promise<void>;
  emitEvent: (event: string, data: any) => Promise<void>;
  refresh: () => Promise<void>;
  cleanup: () => void;
};

const MSG_EVENT = "socket:message";
const STATUS_EVENT = "socket:status";

const MAX_MESSAGES = 1000;

// Registered once per store lifetime (module scope), not inside create() so
// hot reloads / tests don't stack duplicate listeners.
let listenersBound = false;

export const useSocketStore = create<SocketStore>((set, get) => {
  if (!listenersBound) {
    listenersBound = true;
    EventsOn(MSG_EVENT, (msg: models.SocketMessage) => {
      set((s) => {
        const next = [...s.messages, msg];
        return { messages: next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next };
      });
    });
    EventsOn(STATUS_EVENT, (status: string) => {
      set({ status });
    });
  }

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
          if (protocol === "sse") {
            await SetSocketAutoReconnect(opts?.autoReconnect ?? true);
          }
          await ConnectSocket(url, protocol, opts?.headers ?? {}, (opts?.tls ?? {}) as models.GRPCTLSConfig);
        }
        // Do not assume "connected" optimistically — the backend emits
        // socket:status once the read loop is actually up. Pull real state.
        await get().refresh();
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

    send: async (msg, binary) => {
      try {
        const proto = get().protocol;
        if (proto === "socketio") {
          await SendSocketIOMessage(msg);
        } else if (binary) {
          await SendSocketBinary(msg);
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
      listenersBound = false;
    },
  };
});
