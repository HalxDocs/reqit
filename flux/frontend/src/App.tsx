import { useEffect, useState } from "react";
import { Sidebar } from "@/app/layout/Sidebar";
import { TabBar } from "@/features/tabs/components/TabBar";
import { UrlBar } from "@/features/request/components/UrlBar";
import { UrlPreview } from "@/features/request/components/UrlPreview";
import { RequestPanel } from "@/app/layout/RequestPanel";
import { ResponsePane } from "@/features/response/components/ResponsePane";
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
import { useTabsStore } from "@/features/tabs/stores/useTabsStore";
import { useProfileStore } from "@/app/stores/useProfileStore";
import { useWorkspaceStore } from "@/features/workspace/stores/useWorkspaceStore";
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

  useKeyboardShortcuts(send);
  useTabSync();

  return (
    <div className="h-screen w-screen flex bg-bg text-text">
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
