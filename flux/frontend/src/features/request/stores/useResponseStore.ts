import { create } from "zustand";
import type { ResponseResult } from "@/features/request/types/request";
import type { SecurityWarning } from "@/features/request/lib/securityCheck";

type ResponseStore = {
  response: ResponseResult | null;
  isLoading: boolean;
  startedAt: number | null;
  securityWarnings: SecurityWarning[];

  setResponse: (r: ResponseResult) => void;
  setLoading: (loading: boolean) => void;
  clearResponse: () => void;
  setSecurityWarnings: (w: SecurityWarning[]) => void;
};

export const useResponseStore = create<ResponseStore>((set) => ({
  response: null,
  isLoading: false,
  startedAt: null,
  securityWarnings: [],

  setResponse: (response) => set({ response, isLoading: false, startedAt: null }),
  setLoading: (isLoading) =>
    set({ isLoading, startedAt: isLoading ? Date.now() : null }),
  clearResponse: () => set({ response: null, isLoading: false, startedAt: null, securityWarnings: [] }),
  setSecurityWarnings: (securityWarnings) => set({ securityWarnings }),
}));
