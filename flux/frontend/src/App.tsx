import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { TabBar } from "./components/Tabs/TabBar";
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

export default function App() {
  const loadWorkspaces = useWorkspaceStore((s) => s.load);
  const activeWorkspaceID = useWorkspaceStore((s) => s.activeID);
  const wsLoaded = useWorkspaceStore((s) => s.loaded);

  const loadCollections = useCollectionStore((s) => s.load);
  const loadHistory = useHistoryStore((s) => s.load);
  const loadEnvs = useEnvStore((s) => s.load);
  const loadProfile = useProfileStore((s) => s.load);
  const hydrateTabs = useTabsStore((s) => s.hydrate);

  // showHome: true = home screen, false = workspace app.
  // Start hidden until we know whether a workspace is active.
  const [showHome, setShowHome] = useState(false);

  useEffect(() => {
    void (async () => {
      await Promise.all([loadWorkspaces(), loadProfile()]);
    })();
  }, [loadWorkspaces, loadProfile]);

  // Once workspace status is known, decide which screen to show.
  useEffect(() => {
    if (!wsLoaded) return;
    if (!activeWorkspaceID) {
      setShowHome(true);
    } else {
      setShowHome(false);
      hydrateTabs();
      void loadCollections();
      void loadHistory();
      void loadEnvs();
    }
  }, [wsLoaded, activeWorkspaceID, hydrateTabs, loadCollections, loadHistory, loadEnvs]);

  if (!wsLoaded) {
    return (
      <div className="h-screen w-screen bg-bg flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-blue border-t-transparent animate-spin" />
      </div>
    );
  }

  if (showHome) {
    return (
      <>
        <HomeScreen />
        <ToastHost />
      </>
    );
  }

  return <WorkspaceApp onGoHome={() => setShowHome(true)} />;
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
        <div className="flex-1 flex min-h-0">
          <RequestPanel onSend={send} width={width} />
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
