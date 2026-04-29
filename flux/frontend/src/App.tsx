import { useEffect } from "react";
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
import { useSendRequest } from "./hooks/useSendRequest";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useResizablePanel } from "./hooks/useResizablePanel";
import { useTabSync } from "./hooks/useTabSync";
import { useCollectionStore } from "./stores/useCollectionStore";
import { useHistoryStore } from "./stores/useHistoryStore";
import { useEnvStore } from "./stores/useEnvStore";
import { useTabsStore } from "./stores/useTabsStore";
import { useProfileStore } from "./stores/useProfileStore";
import "./App.css";

export default function App() {
  const send = useSendRequest();
  const loadCollections = useCollectionStore((s) => s.load);
  const loadHistory = useHistoryStore((s) => s.load);
  const loadEnvs = useEnvStore((s) => s.load);
  const loadProfile = useProfileStore((s) => s.load);
  const hydrateTabs = useTabsStore((s) => s.hydrate);
  const { width, onResize } = useResizablePanel();

  useEffect(() => {
    hydrateTabs();
    void loadCollections();
    void loadHistory();
    void loadEnvs();
    void loadProfile();
  }, [hydrateTabs, loadCollections, loadHistory, loadEnvs, loadProfile]);

  useKeyboardShortcuts(send);
  useTabSync();

  return (
    <div className="h-screen w-screen flex bg-bg text-text">
      <Sidebar />
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
