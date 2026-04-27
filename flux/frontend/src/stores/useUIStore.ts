import { create } from "zustand";

export type RequestTab = "params" | "headers" | "body" | "auth";
export type ResponseTab = "body" | "headers";

type UIStore = {
  requestTab: RequestTab;
  responseTab: ResponseTab;
  setRequestTab: (t: RequestTab) => void;
  setResponseTab: (t: ResponseTab) => void;
};

export const useUIStore = create<UIStore>((set) => ({
  requestTab: "params",
  responseTab: "body",
  setRequestTab: (requestTab) => set({ requestTab }),
  setResponseTab: (responseTab) => set({ responseTab }),
}));
