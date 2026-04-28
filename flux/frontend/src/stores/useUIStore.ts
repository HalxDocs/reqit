import { create } from "zustand";

export type RequestTab = "params" | "headers" | "body" | "auth";
export type ResponseTab = "body" | "headers";

type UIStore = {
  requestTab: RequestTab;
  responseTab: ResponseTab;
  setRequestTab: (t: RequestTab) => void;
  setResponseTab: (t: ResponseTab) => void;

  saveModalOpen: boolean;
  openSaveModal: () => void;
  closeSaveModal: () => void;

  envModalOpen: boolean;
  openEnvModal: () => void;
  closeEnvModal: () => void;

  importModalOpen: boolean;
  openImportModal: () => void;
  closeImportModal: () => void;

  loadedRequestID: string | null;
  setLoadedRequestID: (id: string | null) => void;
};

export const useUIStore = create<UIStore>((set) => ({
  requestTab: "params",
  responseTab: "body",
  setRequestTab: (requestTab) => set({ requestTab }),
  setResponseTab: (responseTab) => set({ responseTab }),

  saveModalOpen: false,
  openSaveModal: () => set({ saveModalOpen: true }),
  closeSaveModal: () => set({ saveModalOpen: false }),

  envModalOpen: false,
  openEnvModal: () => set({ envModalOpen: true }),
  closeEnvModal: () => set({ envModalOpen: false }),

  importModalOpen: false,
  openImportModal: () => set({ importModalOpen: true }),
  closeImportModal: () => set({ importModalOpen: false }),

  loadedRequestID: null,
  setLoadedRequestID: (loadedRequestID) => set({ loadedRequestID }),
}));
