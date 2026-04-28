import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { RequestPanel } from "./components/RequestPanel/RequestPanel";
import { ResponsePane } from "./components/ResponsePane/ResponsePane";
import { SaveRequestModal } from "./components/modals/SaveRequestModal";
import { EnvironmentsModal } from "./components/modals/EnvironmentsModal";
import { ImportPostmanModal } from "./components/modals/ImportPostmanModal";
import { useSendRequest } from "./hooks/useSendRequest";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useCollectionStore } from "./stores/useCollectionStore";
import { useHistoryStore } from "./stores/useHistoryStore";
import { useEnvStore } from "./stores/useEnvStore";
import "./App.css";

export default function App() {
  const send = useSendRequest();
  const loadCollections = useCollectionStore((s) => s.load);
  const loadHistory = useHistoryStore((s) => s.load);
  const loadEnvs = useEnvStore((s) => s.load);

  useEffect(() => {
    void loadCollections();
    void loadHistory();
    void loadEnvs();
  }, [loadCollections, loadHistory, loadEnvs]);

  useKeyboardShortcuts(send);

  return (
    <div className="h-screen w-screen flex bg-bg text-text">
      <Sidebar />
      <RequestPanel onSend={send} />
      <ResponsePane />
      <SaveRequestModal />
      <EnvironmentsModal />
      <ImportPostmanModal />
    </div>
  );
}
