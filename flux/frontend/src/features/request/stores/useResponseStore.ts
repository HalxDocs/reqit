import { create } from "zustand";
import type { ResponseResult } from "@/features/request/types/request";
import type { SecurityWarning } from "@/features/request/lib/securityCheck";

export interface SSEStreamEvent {
  event?: string;
  id?: string;
  data?: string;
}

type ResponseStore = {
  response: ResponseResult | null;
  isLoading: boolean;
  startedAt: number | null;
  securityWarnings: SecurityWarning[];
  streaming: boolean;
  streamEvents: SSEStreamEvent[];

  setResponse: (r: ResponseResult) => void;
  setLoading: (loading: boolean) => void;
  clearResponse: () => void;
  setSecurityWarnings: (w: SecurityWarning[]) => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamEvent: (ev: SSEStreamEvent) => void;
};

export const useResponseStore = create<ResponseStore>((set, get) => ({
  response: null,
  isLoading: false,
  startedAt: null,
  securityWarnings: [],
  streaming: false,
  streamEvents: [],

  setResponse: (response) => set({ response, isLoading: false, startedAt: null, streaming: false, streamEvents: [] }),
  setLoading: (isLoading) =>
    set({ isLoading, startedAt: isLoading ? Date.now() : null }),
  clearResponse: () => set({ response: null, isLoading: false, startedAt: null, securityWarnings: [], streaming: false, streamEvents: [] }),
  setSecurityWarnings: (securityWarnings) => set({ securityWarnings }),
  setStreaming: (streaming) => set({ streaming }),
  appendStreamEvent: (ev) => {
    const state = get();
    const events = [...state.streamEvents, ev];
    // Grow the live body as events arrive so the Body view updates in real time.
    const prev = state.response;
    const nextBody = (prev?.body ?? "") + (ev.data ?? "") + "\n";
    set({
      streamEvents: events,
      response: prev
        ? { ...prev, body: nextBody, sizeBytes: (prev.sizeBytes ?? 0) + (ev.data?.length ?? 0) + 1 }
        : {
            status: "200 Streaming",
            statusCode: 200,
            headers: { "Content-Type": "text/event-stream" },
            body: nextBody,
            bodyIsBase64: false,
            timingMs: 0,
            sizeBytes: (ev.data?.length ?? 0) + 1,
            error: "",
            cookies: [],
          },
    });
  },
}));
