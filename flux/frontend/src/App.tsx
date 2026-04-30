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
      <ToastHost />
    </div>
  );
}
