import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { TabBar } from "./components/Tabs/TabBar";
import { UrlBar } from "./components/RequestPanel/UrlBar";
import { UrlPreview } from "./components/RequestPanel/UrlPreview";
import { RequestPanel } from "./components/RequestPanel/RequestPanel";
import { ResponsePane } from "./components/ResponsePane/ResponsePane";
import { Splitter } from "./components/shared/Splitter";
import { SaveRequestModal } from "./components/modals/SaveRequestModal";
import { EnvironmentsModal } from "./components/modals/EnvironmentsModal";
import { ImportPostmanModal } from "./components/modals/ImportPostmanModal";
import { CodeGenModal } from "./components/modals/CodeGenModal";
import { SettingsModal } from "./components/modals/SettingsModal";
import { WelcomeModal } from "./components/modals/WelcomeModal";
import { PasteCurlModal } from "./components/modals/PasteCurlModal";
import { TeamModal } from "./components/modals/TeamModal";
import { ToastHost } from "./components/shared/ToastHost";
import { HomeScreen } from "./screens/HomeScreen";
import { useSendRequest } from "./hooks/useSendRequest";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useResizablePanel } from "./hooks/useResizablePanel";
import { useTabSync } from "./hooks/useTabSync";
import { useCollectionStore } from "./stores/useCollectionStore";
import { useHistoryStore } from "./stores/useHistoryStore";
import { useEnvStore } from "./stores/useEnvStore";
import { useTabsStore } from "./stores/useTabsStore";
import { useProfileStore } from "./stores/useProfileStore";
import { useWorkspaceStore } from "./stores/useWorkspaceStore";
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
    void (async () => {
      await Promise.all([loadWorkspaces(), loadProfile()]);
    })();
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
        <div className="w-6 h-6 rounded-full border-2 border-blue border-t-transparent animate-spin" />
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

  useKeyboardShortcuts(send);
  useTabSync();

  return (
    <div className="h-screen w-screen flex bg-bg text-text">
      {/* Mobile: show a "use desktop" message instead of the full app UI */}
      <div className="md:hidden fixed inset-0 z-50 bg-bg flex flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="w-[64px] h-[64px] rounded-2xl bg-blue/10 flex items-center justify-center">
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
          className="flex items-center gap-2 h-[38px] px-5 text-13 font-semibold text-blue bg-blue/10 border border-blue/20 rounded-xl hover:bg-blue/15 transition-colors"
        >
          ← Back to home
        </button>
      </div>
      <Sidebar onGoHome={onGoHome} />
      <div className="flex-1 flex flex-col min-w-0">
        <TabBar />
        <UrlBar onSend={send} />
        <UrlPreview />
        <div className="flex-1 flex min-h-0">
          <RequestPanel width={width} />
          <Splitter onResize={onResize} />
          <ResponsePane />
        </div>
      </div>
      <SaveRequestModal />
      <EnvironmentsModal />
      <ImportPostmanModal />
      <CodeGenModal />
      <SettingsModal />
      <WelcomeModal />
      <PasteCurlModal />
      <TeamModal />
      <ToastHost />
    </div>
  );
}
