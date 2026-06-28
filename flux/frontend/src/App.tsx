import { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/app/layout/Sidebar";
import { TabBar } from "@/features/tabs/components/TabBar";
import { UrlBar } from "@/features/request/components/UrlBar";
import { UrlPreview } from "@/features/request/components/UrlPreview";
import { RequestPanel } from "@/app/layout/RequestPanel";
import { ResponsePane } from "@/features/response/components/ResponsePane";
import { CommandPalette } from "@/shared/components/CommandPalette";
import { Splitter } from "@/shared/components/Splitter";
import { SaveRequestModal } from "@/features/collections/components/SaveRequestModal";
import { EnvironmentsModal } from "@/features/env/components/EnvironmentsModal";
import { ImportPostmanModal } from "@/shared/components/ImportPostmanModal";
import { CodeGenModal } from "@/features/request/components/CodeGenModal";
import { SettingsModal } from "@/app/components/SettingsModal";
import { WelcomeModal } from "@/app/components/WelcomeModal";
import { DocsPanel } from "@/features/docs/components/DocsPanel";
import { SpecEditor } from "@/features/spec/components/SpecEditor";
import { IntegrationsPanel } from "@/features/integrations/components/IntegrationsPanel";
import { InterceptorPanel } from "@/features/interceptor/components/InterceptorPanel";
import { PRPreviewPanel } from "@/features/pr/components/PRPreviewPanel";
import { MigrationPanel } from "@/features/migration/components/MigrationPanel";
import { SecurityPanel } from "@/features/security/components/SecurityPanel";
import { GrowthPanel } from "@/features/growth/components/GrowthPanel";
import { GraphQLPanel } from "@/features/graphql/components/GraphQLPanel";
import { GRPCPanel } from "@/features/grpc/components/GRPCPanel";
import { AgentLensPanel } from "@/features/agentlens/components/AgentLensPanel";

import { PasteCurlModal } from "@/shared/components/PasteCurlModal";
import { TeamModal } from "@/features/git/components/TeamModal";
import { RunnerModal } from "@/features/collections/components/RunnerModal";
import { DevProfileModal } from "@/features/profile/components/DevProfilePanel";
import { SocketPanel } from "@/features/websocket/components/SocketPanel";
import { ToastHost } from "@/shared/components/ToastHost";
import { UpdateBanner } from "@/shared/components/UpdateBanner";
import { HomeScreen } from "@/app/screens/HomeScreen";
import { useSendRequest } from "@/features/request/hooks/useSendRequest";
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts";
import { useResizablePanel } from "@/shared/hooks/useResizablePanel";
import { useTabSync } from "@/features/collections/hooks/useTabSync";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";
import { useHistoryStore } from "@/features/history/stores/useHistoryStore";
import { useEnvStore } from "@/features/env/stores/useEnvStore";
import { useUIStore } from "@/app/stores/useUIStore";
import { useResponseStore } from "@/features/request/stores/useResponseStore";
import { useTabsStore } from "@/features/tabs/stores/useTabsStore";
import { useProfileStore } from "@/app/stores/useProfileStore";
import { useUndoRedo } from "@/shared/lib/useUndoRedo";
import { useWorkspaceStore } from "@/features/workspace/stores/useWorkspaceStore";
import { registerCommands } from "@/shared/lib/commands";
import { useThemeStore } from "@/shared/lib/useTheme";
import "./App.css";

type Screen = "loading" | "home" | "app";

export default function App() {
  const loadWorkspaces = useWorkspaceStore((s) => s.load);
  const activeWorkspaceID = useWorkspaceStore((s) => s.activeID);
  const wsLoaded = useWorkspaceStore((s) => s.loaded);
  const loadProfile = useProfileStore((s) => s.load);
  const loadCollections = useCollectionStore((s) => s.load);
  const loadHistory = useHistoryStore((s) => s.load);
  const loadEnvs = useEnvStore((s) => s.load);
  const hydrateTabs = useTabsStore((s) => s.hydrate);

  const [screen, setScreen] = useState<Screen>("loading");

  useEffect(() => {
    Promise.all([loadWorkspaces(), loadProfile()]).catch(() => {});
  }, [loadWorkspaces, loadProfile]);

  const resetTabs = useTabsStore((s) => s.resetTabs);
  const clearResponse = useResponseStore((s) => s.clearResponse);

  useEffect(() => {
    if (!wsLoaded) return;
    if (!activeWorkspaceID) {
      setScreen("home");
    } else {
      // Existing active workspace on startup — go straight in.
      hydrateTabs();
      void Promise.all([loadCollections(), loadHistory(), loadEnvs()])
        .then(() => setScreen("app"))
        .catch(() => setScreen("app"));
    }
  // Only run when the initial load resolves, not on every store change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsLoaded]);

  const enterApp = async () => {
    resetTabs();
    clearResponse();
    await Promise.all([loadCollections(), loadHistory(), loadEnvs()]);
    setScreen("app");
  };

  if (screen === "loading") {
    return (
      <div className="h-screen w-screen bg-bg flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-cyan border-t-transparent animate-spin" />
      </div>
    );
  }

  if (screen === "home") {
    return (
      <>
        <HomeScreen onEnter={enterApp} />
        <ToastHost />
      </>
    );
  }

  return <WorkspaceApp onGoHome={() => setScreen("home")} />;
}

function WorkspaceApp({ onGoHome }: { onGoHome: () => void }) {
  const send = useSendRequest();
  const { width, onResize } = useResizablePanel();
  const runnerCollID = useUIStore((s) => s.runnerCollID);
  const closeRunner = useUIStore((s) => s.closeRunner);
  const view = useUIStore((s) => s.view);
  const collections = useCollectionStore((s) => s.collections);
  const runnerColl = runnerCollID ? collections.find((c) => c.id === runnerCollID) : null;
  const openSaveModal = useUIStore((s) => s.openSaveModal);
  const openImport = useUIStore((s) => s.openImportModal);
  const openPasteCurl = useUIStore((s) => s.openPasteCurlModal);
  const openSettings = useUIStore((s) => s.openSettingsModal);
  const devProfileOpen = useUIStore((s) => s.devProfileModalOpen);
  const closeDevProfile = useUIStore((s) => s.closeDevProfileModal);
  const openCodeGen = useUIStore((s) => s.openCodeGenModal);
  const newTab = useTabsStore((s) => s.newTab);
  const closeTab = useTabsStore((s) => s.closeTab);
  const activeID = useTabsStore((s) => s.activeID);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const { undo, redo } = useUndoRedo();

  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);

  const commandsInited = useRef(false);
  useEffect(() => {
    if (commandsInited.current) return;
    commandsInited.current = true;
    registerCommands([
      { id: "cmd.palette", label: "Show Command Palette", category: "General", scope: "global", defaultKeys: ["meta+k", "ctrl+k"], action: () => setCmdPaletteOpen(true) },
      { id: "request.send", label: "Send Request", category: "Request", scope: "global", defaultKeys: ["meta+enter", "ctrl+enter"], action: () => { if (!useResponseStore.getState().isLoading) send(); } },
      { id: "request.save", label: "Save Request", category: "Request", scope: "global", defaultKeys: ["meta+s", "ctrl+s"], action: () => openSaveModal() },
      { id: "request.duplicate", label: "Duplicate Request", category: "Request", scope: "global", defaultKeys: ["meta+shift+d", "ctrl+shift+d"], action: () => {} },
      { id: "request.delete", label: "Delete Request", category: "Request", scope: "global", defaultKeys: ["delete"], action: () => {} },
      { id: "tab.new", label: "New Tab", category: "Tabs", scope: "global", defaultKeys: ["meta+t", "ctrl+t"], action: () => { newTab(); document.getElementById("flux-url-bar")?.focus(); } },
      { id: "tab.close", label: "Close Tab", category: "Tabs", scope: "global", defaultKeys: ["meta+w", "ctrl+w"], action: () => closeTab(activeID) },
      { id: "tab.switch", label: "Switch to Next Tab", category: "Tabs", scope: "global", defaultKeys: ["meta+tab", "ctrl+tab"], action: () => {} },
      { id: "tab.jump", label: "Jump to Tab N", category: "Tabs", scope: "global", defaultKeys: [], action: () => {} },
      { id: "url.focus", label: "Focus URL Bar", category: "Request", scope: "global", defaultKeys: ["meta+l", "ctrl+l"], action: () => { const el = document.getElementById("flux-url-bar") as HTMLInputElement | null; el?.focus(); el?.select(); } },
      { id: "sidebar.toggle", label: "Toggle Sidebar", category: "General", scope: "global", defaultKeys: ["meta+b", "ctrl+b"], action: () => {} },
      { id: "import.curl", label: "Import cURL", category: "Import", scope: "global", defaultKeys: ["meta+shift+i", "ctrl+shift+i"], action: () => openPasteCurl() },
      { id: "import.postman", label: "Import Postman", category: "Import", scope: "global", defaultKeys: [], action: () => openImport() },
      { id: "codegen", label: "Generate Code", category: "Request", scope: "global", defaultKeys: [], action: () => openCodeGen() },
      { id: "env.editor", label: "Open Environment Editor", category: "General", scope: "global", defaultKeys: ["meta+e", "ctrl+e"], action: () => {} },
      { id: "settings", label: "Open Settings", category: "General", scope: "global", defaultKeys: ["meta+,", "ctrl+,"], action: () => openSettings() },
      { id: "theme.toggle", label: "Toggle Theme", category: "General", scope: "global", defaultKeys: [], action: () => toggleTheme() },
      { id: "shortcuts.toggle", label: "Toggle Shortcuts Overlay", category: "General", scope: "global", defaultKeys: ["meta+/", "ctrl+/"], action: () => {} },
      { id: "edit.undo", label: "Undo", category: "Edit", scope: "global", defaultKeys: ["meta+z", "ctrl+z"], action: () => undo() },
      { id: "edit.redo", label: "Redo", category: "Edit", scope: "global", defaultKeys: ["meta+shift+z", "ctrl+shift+z"], action: () => redo() },
      { id: "collection.run", label: "Run Collection", category: "Collection", scope: "global", defaultKeys: ["meta+r", "ctrl+r"], action: () => {} },

      { id: "tree.expand", label: "Expand Node", category: "Response", scope: "responseTree", defaultKeys: ["arrowright"], action: () => {} },
      { id: "tree.collapse", label: "Collapse Node", category: "Response", scope: "responseTree", defaultKeys: ["arrowleft"], action: () => {} },
      { id: "tree.expandAll", label: "Expand All", category: "Response", scope: "responseTree", defaultKeys: ["meta+arrowdown", "ctrl+arrowdown"], action: () => {} },
      { id: "tree.collapseAll", label: "Collapse All", category: "Response", scope: "responseTree", defaultKeys: ["meta+arrowup", "ctrl+arrowup"], action: () => {} },
      { id: "tree.copy", label: "Copy Node Value", category: "Response", scope: "responseTree", defaultKeys: ["meta+c", "ctrl+c"], action: () => {} },
      { id: "response.toggle", label: "Toggle Raw/Pretty/Tree", category: "Response", scope: "global", defaultKeys: ["meta+shift+r", "ctrl+shift+r"], action: () => {} },

      { id: "sidebar.moveUp", label: "Move Up", category: "Sidebar", scope: "sidebar", defaultKeys: ["arrowup", "k"], action: () => {} },
      { id: "sidebar.moveDown", label: "Move Down", category: "Sidebar", scope: "sidebar", defaultKeys: ["arrowdown", "j"], action: () => {} },
      { id: "sidebar.open", label: "Open / Enter", category: "Sidebar", scope: "sidebar", defaultKeys: ["enter"], action: () => {} },
      { id: "sidebar.rename", label: "Rename", category: "Sidebar", scope: "sidebar", defaultKeys: ["f2", "enter"], action: () => {} },
      { id: "sidebar.delete", label: "Delete", category: "Sidebar", scope: "sidebar", defaultKeys: ["delete", "backspace"], action: () => {} },
      { id: "sidebar.newRequest", label: "New Request", category: "Sidebar", scope: "sidebar", defaultKeys: ["n"], action: () => {} },
      { id: "sidebar.newFolder", label: "New Folder", category: "Sidebar", scope: "sidebar", defaultKeys: ["shift+n"], action: () => {} },
      { id: "sidebar.search", label: "Search", category: "Sidebar", scope: "sidebar", defaultKeys: ["/"], action: () => {} },
      { id: "sidebar.collapse", label: "Collapse Folder", category: "Sidebar", scope: "sidebar", defaultKeys: ["arrowleft"], action: () => {} },
      { id: "sidebar.expand", label: "Expand Folder", category: "Sidebar", scope: "sidebar", defaultKeys: ["arrowright"], action: () => {} },

      { id: "env.save", label: "Save Environment", category: "Environment", scope: "envEditor", defaultKeys: ["meta+s", "ctrl+s"], action: () => {} },
      { id: "env.cancel", label: "Cancel / Close", category: "Environment", scope: "envEditor", defaultKeys: ["escape"], action: () => {} },
      { id: "env.nextField", label: "Next Field", category: "Environment", scope: "envEditor", defaultKeys: ["tab"], action: () => {} },
      { id: "env.prevField", label: "Previous Field", category: "Environment", scope: "envEditor", defaultKeys: ["shift+tab"], action: () => {} },
      { id: "env.addVar", label: "Add Variable", category: "Environment", scope: "envEditor", defaultKeys: ["meta+enter", "ctrl+enter"], action: () => {} },
      { id: "env.deleteVar", label: "Delete Variable", category: "Environment", scope: "envEditor", defaultKeys: ["meta+backspace", "ctrl+backspace"], action: () => {} },
    ]);
  }, [send, openSaveModal, newTab, closeTab, activeID, openPasteCurl, openImport, openCodeGen, openSettings, toggleTheme, undo, redo]);

  useKeyboardShortcuts();
  useTabSync();

  return (
    <div className="h-screen w-screen flex bg-bg text-text">
      <CommandPalette open={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} />
      {/* Mobile: show a "use desktop" message instead of the full app UI */}
      <div className="md:hidden fixed inset-0 z-50 bg-bg flex flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="w-[64px] h-[64px] rounded-2xl bg-cyan/10 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
        </div>
        <div>
          <div className="text-16 font-bold text-text" style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}>
            reqit works best on desktop
          </div>
          <div className="text-13 text-subtext mt-2 max-w-[300px] leading-relaxed">
            The full API client is designed for desktop. Open reqit on your computer for the complete experience.
          </div>
        </div>
        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center gap-2 h-[38px] px-5 text-13 font-semibold text-cyan bg-cyan/10 border border-cyan/20 rounded-xl hover:bg-cyan/15 transition-colors"
        >
          ← Back to home
        </button>
      </div>
      <Sidebar onGoHome={onGoHome} />
      {view === "socket" ? (
        <SocketPanel />
      ) : view === "docs" ? (
        <DocsPanel />
      ) : view === "spec" ? (
        <SpecEditor />
      ) : view === "integrations" ? (
        <IntegrationsPanel />
      ) : view === "interceptor" ? (
        <InterceptorPanel />
      ) : view === "pr" ? (
        <PRPreviewPanel />
      ) : view === "security" ? (
        <SecurityPanel />
      ) : view === "migration" ? (
        <MigrationPanel />
      ) : view === "agentlens" ? (
        <AgentLensPanel />
      ) : view === "growth" ? (
        <GrowthPanel />
      ) : view === "graphql" ? (
        <GraphQLPanel />
      ) : view === "grpc" ? (
        <GRPCPanel />
      ) : (
      <div className="flex-1 flex flex-col min-w-0">
        <TabBar />
        <UrlBar onSend={send} />
        <UpdateBanner />
        <UrlPreview />
        <div className="flex-1 flex min-h-0">
          <RequestPanel width={width} />
          <Splitter onResize={onResize} />
          <ResponsePane />
        </div>
      </div>
      )}
      <SaveRequestModal />
      <EnvironmentsModal />
      <ImportPostmanModal />
      <CodeGenModal />
      <SettingsModal />
      <WelcomeModal />
      <PasteCurlModal />
      <TeamModal />
      <DevProfileModal open={devProfileOpen} onClose={closeDevProfile} />
      {runnerColl && (
        <RunnerModal
          open={true}
          onClose={closeRunner}
          collection={runnerColl}
        />
      )}
      <ToastHost />
    </div>
  );
}
