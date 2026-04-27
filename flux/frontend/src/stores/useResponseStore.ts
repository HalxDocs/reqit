import { create } from "zustand";
import type { ResponseResult } from "../types/request";

type ResponseStore = {
  response: ResponseResult | null;
  isLoading: boolean;
  startedAt: number | null;

  setResponse: (r: ResponseResult) => void;
  setLoading: (loading: boolean) => void;
  clearResponse: () => void;
};

export const useResponseStore = create<ResponseStore>((set) => ({
  response: null,
  isLoading: false,
  startedAt: null,

  setResponse: (response) => set({ response, isLoading: false, startedAt: null }),
  setLoading: (isLoading) =>
    set({ isLoading, startedAt: isLoading ? Date.now() : null }),
  clearResponse: () => set({ response: null, isLoading: false, startedAt: null }),
}));
