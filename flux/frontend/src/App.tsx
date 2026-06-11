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
import { PasteCurlModal } from "@/shared/components/PasteCurlModal";
import { TeamModal } from "@/features/git/components/TeamModal";
import { RunnerModal } from "@/features/collections/components/RunnerModal";
import { SocketPanel } from "@/features/websocket/components/SocketPanel";
import { ToastHost } from "@/shared/components/ToastHost";
import { UpdateBanner } from "@/shared/components/UpdateBanner";
import { MockPanel } from "@/features/mock/components/MockPanel";
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

  useEffect(() => {
    if (!wsLoaded) return;
    if (!activeWorkspaceID) {
      setScreen("home");
    } else {
      // Existing active workspace on startup — go straight in.
      hydrateTabs();
      void Promise.all([loadCollections(), loadHistory(), loadEnvs()]).then(() =>
        setScreen("app"),
      );
    }
  // Only run when the initial load resolves, not on every store change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsLoaded]);

  const enterApp = async () => {
    hydrateTabs();
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
      { id: "cmd.palette", label: "Show Command Palette", category: "General", defaultKeys: ["meta+k", "ctrl+k"], action: () => setCmdPaletteOpen(true) },
      { id: "request.send", label: "Send Request", category: "Request", defaultKeys: ["meta+enter", "ctrl+enter"], action: () => { if (!useResponseStore.getState().isLoading) send(); } },
      { id: "request.save", label: "Save Request", category: "Request", defaultKeys: ["meta+s", "ctrl+s"], action: () => openSaveModal() },
      { id: "tab.new", label: "New Tab", category: "Tabs", defaultKeys: ["meta+t", "ctrl+t"], action: () => { newTab(); document.getElementById("flux-url-bar")?.focus(); } },
      { id: "tab.close", label: "Close Tab", category: "Tabs", defaultKeys: ["meta+w", "ctrl+w"], action: () => closeTab(activeID) },
      { id: "url.focus", label: "Focus URL Bar", category: "Request", defaultKeys: ["meta+e", "ctrl+e"], action: () => { const el = document.getElementById("flux-url-bar") as HTMLInputElement | null; el?.focus(); el?.select(); } },
      { id: "import.curl", label: "Import cURL", category: "Import", defaultKeys: ["meta+shift+i", "ctrl+shift+i"], action: () => openPasteCurl() },
      { id: "import.postman", label: "Import Postman", category: "Import", defaultKeys: [], action: () => openImport() },
      { id: "codegen", label: "Generate Code", category: "Request", defaultKeys: [], action: () => openCodeGen() },
      { id: "settings", label: "Open Settings", category: "General", defaultKeys: ["meta+,", "ctrl+,"], action: () => openSettings() },
      { id: "theme.toggle", label: "Toggle Theme", category: "General", defaultKeys: [], action: () => toggleTheme() },
      { id: "edit.undo", label: "Undo", category: "Edit", defaultKeys: ["meta+z", "ctrl+z"], action: () => undo() },
      { id: "edit.redo", label: "Redo", category: "Edit", defaultKeys: ["meta+shift+z", "ctrl+shift+z"], action: () => redo() },
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
      ) : (
      <div className="flex-1 flex flex-col min-w-0">
        <UpdateBanner />
        <TabBar />
        <UrlBar onSend={send} />
        <div className="flex items-center px-3 py-1 border-b border-border relative">
          <MockPanel />
        </div>
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
