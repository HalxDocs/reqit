import { create } from "zustand";

export type RequestTab = "params" | "headers" | "body" | "auth" | "scripts" | "notes";
export type ResponseTab = "body" | "headers" | "cookies" | "timeline" | "performance";

export type WorkspaceView = "http" | "socket" | "sse" | "scheduler" | "docs" | "spec" | "interceptor" | "integrations" | "pr" | "security" | "migration" | "growth" | "graphql" | "grpc" | "agentlens" | "plugins" | "loadtest" | "testsuites" | "mockpanel";

export type PanelLayout = "horizontal" | "vertical";

const LAYOUT_KEY = "flux:panelLayout";
function readStoredLayout(): PanelLayout {
  try {
    const v = localStorage.getItem(LAYOUT_KEY);
    return v === "vertical" ? "vertical" : "horizontal";
  } catch {
    return "horizontal";
  }
}

type UIStore = {
  requestTab: RequestTab;
  responseTab: ResponseTab;
  setRequestTab: (t: RequestTab) => void;
  setResponseTab: (t: ResponseTab) => void;

  panelLayout: PanelLayout;
  togglePanelLayout: () => void;

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
  searchMatchIndex: number;
  setSearchMatchIndex: (i: number) => void;

  responseBodyView: "pretty" | "raw" | "hex" | "tree";
  setResponseBodyView: (v: "pretty" | "raw" | "hex" | "tree") => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  shortcutsModalOpen: boolean;
  openShortcutsModal: () => void;
  closeShortcutsModal: () => void;

  loadTestModalOpen: boolean;
  openLoadTestModal: () => void;
  closeLoadTestModal: () => void;

  testSuitesModalOpen: boolean;
  openTestSuitesModal: () => void;
  closeTestSuitesModal: () => void;

  envCompareModalOpen: boolean;
  openEnvCompareModal: () => void;
  closeEnvCompareModal: () => void;
};

export const useUIStore = create<UIStore>((set, get) => ({
  requestTab: "params",
  responseTab: "body",
  setRequestTab: (requestTab) => set({ requestTab }),
  setResponseTab: (responseTab) => set({ responseTab }),

  panelLayout: readStoredLayout(),
  togglePanelLayout: () => set((s) => {
    const panelLayout: PanelLayout = s.panelLayout === "horizontal" ? "vertical" : "horizontal";
    try { localStorage.setItem(LAYOUT_KEY, panelLayout); } catch {}
    return { panelLayout };
  }),

  view: "http",
  setView: (view) => set({ view }),

  saveModalOpen: false,
  openSaveModal: () => {
    if (get().saveModalOpen) return;
    set({ saveModalOpen: true });
  },
  closeSaveModal: () => set({ saveModalOpen: false }),

  envModalOpen: false,
  openEnvModal: () => {
    if (get().envModalOpen) return;
    set({ envModalOpen: true });
  },
  closeEnvModal: () => set({ envModalOpen: false }),

  importModalOpen: false,
  openImportModal: () => {
    if (get().importModalOpen) return;
    set({ importModalOpen: true });
  },
  closeImportModal: () => set({ importModalOpen: false }),

  codeGenModalOpen: false,
  openCodeGenModal: () => {
    if (get().codeGenModalOpen) return;
    set({ codeGenModalOpen: true });
  },
  closeCodeGenModal: () => set({ codeGenModalOpen: false }),

  settingsModalOpen: false,
  openSettingsModal: () => {
    if (get().settingsModalOpen) return;
    set({ settingsModalOpen: true });
  },
  closeSettingsModal: () => set({ settingsModalOpen: false }),

  welcomeModalOpen: false,
  openWelcomeModal: () => {
    if (get().welcomeModalOpen) return;
    set({ welcomeModalOpen: true });
  },
  closeWelcomeModal: () => set({ welcomeModalOpen: false }),

  pasteCurlModalOpen: false,
  openPasteCurlModal: () => {
    if (get().pasteCurlModalOpen) return;
    set({ pasteCurlModalOpen: true });
  },
  closePasteCurlModal: () => set({ pasteCurlModalOpen: false }),

  teamModalOpen: false,
  openTeamModal: () => {
    if (get().teamModalOpen) return;
    set({ teamModalOpen: true });
  },
  closeTeamModal: () => set({ teamModalOpen: false }),

  devProfileModalOpen: false,
  openDevProfileModal: () => {
    if (get().devProfileModalOpen) return;
    set({ devProfileModalOpen: true });
  },
  closeDevProfileModal: () => set({ devProfileModalOpen: false }),

  loadedRequestID: null,
  setLoadedRequestID: (loadedRequestID) => set({ loadedRequestID }),

  sidebarFilter: "",
  setSidebarFilter: (sidebarFilter) => set({ sidebarFilter }),

  runnerCollID: null,
  openRunner: (runnerCollID) => set({ runnerCollID }),
  closeRunner: () => set({ runnerCollID: null }),

  responseSearch: "",
  setResponseSearch: (responseSearch) => set({ responseSearch, searchMatchIndex: 0 }),
  searchMatchIndex: 0,
  setSearchMatchIndex: (searchMatchIndex) => set({ searchMatchIndex }),

  responseBodyView: "pretty",
  setResponseBodyView: (responseBodyView) => set({ responseBodyView }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  shortcutsModalOpen: false,
  openShortcutsModal: () => {
    if (get().shortcutsModalOpen) return;
    set({ shortcutsModalOpen: true });
  },
  closeShortcutsModal: () => set({ shortcutsModalOpen: false }),

  loadTestModalOpen: false,
  openLoadTestModal: () => {
    if (get().loadTestModalOpen) return;
    set({ loadTestModalOpen: true });
  },
  closeLoadTestModal: () => set({ loadTestModalOpen: false }),

  testSuitesModalOpen: false,
  openTestSuitesModal: () => {
    if (get().testSuitesModalOpen) return;
    set({ testSuitesModalOpen: true });
  },
  closeTestSuitesModal: () => set({ testSuitesModalOpen: false }),

  envCompareModalOpen: false,
  openEnvCompareModal: () => {
    if (get().envCompareModalOpen) return;
    set({ envCompareModalOpen: true });
  },
  closeEnvCompareModal: () => set({ envCompareModalOpen: false }),
}));
