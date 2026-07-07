import { create } from "zustand";

export type RequestTab = "params" | "headers" | "body" | "auth" | "scripts";
export type ResponseTab = "body" | "headers" | "cookies" | "timeline";

export type WorkspaceView = "http" | "socket" | "sse" | "scheduler" | "docs" | "spec" | "interceptor" | "integrations" | "pr" | "security" | "migration" | "growth" | "graphql" | "grpc" | "agentlens" | "plugins";

type UIStore = {
  requestTab: RequestTab;
  responseTab: ResponseTab;
  setRequestTab: (t: RequestTab) => void;
  setResponseTab: (t: ResponseTab) => void;

  view: WorkspaceView;
  setView: (v: WorkspaceView) => void;

  saveModalOpen: boolean;
  openSaveModal: () => void;
  closeSaveModal: () => void;

  envModalOpen: boolean;
  openEnvModal: () => void;
  closeEnvModal: () => void;

  importModalOpen: boolean;
  openImportModal: () => void;
  closeImportModal: () => void;

  codeGenModalOpen: boolean;
  openCodeGenModal: () => void;
  closeCodeGenModal: () => void;

  settingsModalOpen: boolean;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;

  welcomeModalOpen: boolean;
  openWelcomeModal: () => void;
  closeWelcomeModal: () => void;

  pasteCurlModalOpen: boolean;
  openPasteCurlModal: () => void;
  closePasteCurlModal: () => void;

  teamModalOpen: boolean;
  openTeamModal: () => void;
  closeTeamModal: () => void;

  devProfileModalOpen: boolean;
  openDevProfileModal: () => void;
  closeDevProfileModal: () => void;

  loadedRequestID: string | null;
  setLoadedRequestID: (id: string | null) => void;

  sidebarFilter: string;
  setSidebarFilter: (q: string) => void;

  runnerCollID: string | null;
  openRunner: (collID: string) => void;
  closeRunner: () => void;

  responseSearch: string;
  setResponseSearch: (q: string) => void;

  responseBodyView: "pretty" | "raw" | "hex" | "tree";
  setResponseBodyView: (v: "pretty" | "raw" | "hex" | "tree") => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  shortcutsModalOpen: boolean;
  openShortcutsModal: () => void;
  closeShortcutsModal: () => void;
};

export const useUIStore = create<UIStore>((set) => ({
  requestTab: "params",
  responseTab: "body",
  setRequestTab: (requestTab) => set({ requestTab }),
  setResponseTab: (responseTab) => set({ responseTab }),

  view: "http",
  setView: (view) => set({ view }),

  saveModalOpen: false,
  openSaveModal: () => set({ saveModalOpen: true }),
  closeSaveModal: () => set({ saveModalOpen: false }),

  envModalOpen: false,
  openEnvModal: () => set({ envModalOpen: true }),
  closeEnvModal: () => set({ envModalOpen: false }),

  importModalOpen: false,
  openImportModal: () => set({ importModalOpen: true }),
  closeImportModal: () => set({ importModalOpen: false }),

  codeGenModalOpen: false,
  openCodeGenModal: () => set({ codeGenModalOpen: true }),
  closeCodeGenModal: () => set({ codeGenModalOpen: false }),

  settingsModalOpen: false,
  openSettingsModal: () => set({ settingsModalOpen: true }),
  closeSettingsModal: () => set({ settingsModalOpen: false }),

  welcomeModalOpen: false,
  openWelcomeModal: () => set({ welcomeModalOpen: true }),
  closeWelcomeModal: () => set({ welcomeModalOpen: false }),

  pasteCurlModalOpen: false,
  openPasteCurlModal: () => set({ pasteCurlModalOpen: true }),
  closePasteCurlModal: () => set({ pasteCurlModalOpen: false }),

  teamModalOpen: false,
  openTeamModal: () => set({ teamModalOpen: true }),
  closeTeamModal: () => set({ teamModalOpen: false }),

  devProfileModalOpen: false,
  openDevProfileModal: () => set({ devProfileModalOpen: true }),
  closeDevProfileModal: () => set({ devProfileModalOpen: false }),

  loadedRequestID: null,
  setLoadedRequestID: (loadedRequestID) => set({ loadedRequestID }),

  sidebarFilter: "",
  setSidebarFilter: (sidebarFilter) => set({ sidebarFilter }),

  runnerCollID: null,
  openRunner: (runnerCollID) => set({ runnerCollID }),
  closeRunner: () => set({ runnerCollID: null }),

  responseSearch: "",
  setResponseSearch: (responseSearch) => set({ responseSearch }),

  responseBodyView: "pretty",
  setResponseBodyView: (responseBodyView) => set({ responseBodyView }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  shortcutsModalOpen: false,
  openShortcutsModal: () => set({ shortcutsModalOpen: true }),
  closeShortcutsModal: () => set({ shortcutsModalOpen: false }),
}));
