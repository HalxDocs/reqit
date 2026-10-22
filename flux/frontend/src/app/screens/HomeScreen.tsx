import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  CodeIcon,
  DatabaseIcon,
  FolderLibraryIcon,
  FolderOpenIcon,
  GitBranchIcon,
  GlobalIcon,
  LayersIcon,
  PlusSignIcon,
  ArrowLeft01Icon,
  ShieldKeyIcon,
  ArrowDataTransferHorizontalIcon,
  ComputerTerminal01Icon,
  KeyboardIcon,
  Layers01Icon,
  GithubIcon,
  StarIcon,
  Book01Icon,
  EyeIcon,
  CookieIcon,
  ContractsIcon,
  FileCodeIcon,
  ServerStack01Icon,
  Download01Icon,
  Clock01Icon,
  Search01Icon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons";
import { BookOpen, Trash2 } from "lucide-react";
import { showConfirm } from "@/shared/components/ConfirmModal";
import { useGitHubStars, fmtStars } from "@/shared/hooks/useGitHubStars";
import { GITHUB_URL, PORTFOLIO_URL, openExternal } from "@/shared/lib/links";

type HomeView = "landing" | "workspaces" | "docs" | "blog";
import { LandingView } from "@/app/screens/home/LandingView";
import { DocsView } from "@/app/screens/home/DocsView";
import { WorkspacesView } from "@/app/screens/home/WorkspacesView";
import { BlogPage } from "@/features/blog/components/BlogPanel";
import { BrowserOpenURL } from "../../../wailsjs/runtime/runtime";
import { useWorkspaceStore } from "@/features/workspace/stores/useWorkspaceStore";

import { CreateWorkspaceModal } from "@/features/workspace/components/CreateWorkspaceModal";
import { PickFolder } from "../../../wailsjs/go/main/App";
import { toast } from "@/app/stores/useToastStore";
import reqitLogo from "../../assets/images/reqitlogo.jpeg";
import type { workspaces } from "../../../wailsjs/go/models";





export function HomeScreen({ onEnter }: { onEnter: () => Promise<void> }) {
  const workspaceList = useWorkspaceStore((s) => s.workspaces);
  const switchWs = useWorkspaceStore((s) => s.switch);
  const removeWs = useWorkspaceStore((s) => s.remove);
  const openFromFolder = useWorkspaceStore((s) => s.openFromFolder);
  const stars = useGitHubStars("HalxDocs/reqit");

  const [view, setView] = useState<HomeView>("landing");
  const [createOpen, setCreateOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const mainRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [view]);

  // Also scroll to top on initial mount
  useLayoutEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const ws = workspaceList.find((w) => w.id === id);
    if (!ws) return;
    if (!(await showConfirm({ title: "Delete workspace", message: `Delete workspace "${ws.name}"? The folder on disk will not be removed.`, variant: "danger" }))) return;
    try {
      await removeWs(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete workspace");
    }
  }, [workspaceList, removeWs]);

  const handleOpen = async (id: string) => {
    setSwitching(id);
    try {
      await switchWs(id);
      await onEnter();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open workspace");
      setSwitching(null);
    }
  };

  const handleOpenFolder = async () => {
    try {
      const dir = await PickFolder("Select workspace folder");
      if (!dir) return;
      const info = await openFromFolder(dir);
      await handleOpen(info.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open folder");
    }
  };

  return (
    <div className="h-screen w-screen bg-bg flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="h-[56px] px-4 sm:px-6 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          {(view === "workspaces" || view === "docs" || view === "blog") && (
            <button
              type="button"
              onClick={() => setView("landing")}
              className="flex items-center gap-1.5 text-12 text-subtext hover:text-text transition-colors mr-1"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={14} color="currentColor" />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
          <img src={reqitLogo} alt="reqit" className="h-[28px] sm:h-[32px] w-auto object-contain" />
        </div>
        <div className="flex items-center gap-2">
          {/* GitHub stars */}
          <button
            type="button"
            onClick={() => openExternal(GITHUB_URL)}
            className="hidden sm:flex items-center gap-1.5 h-[30px] px-2.5 text-12 text-subtext bg-card border border-border rounded-lg hover:border-cyan/40 hover:text-text transition-all"
            title="Star on GitHub"
          >
            <HugeiconsIcon icon={GithubIcon} size={13} color="currentColor" />
            <HugeiconsIcon icon={StarIcon} size={11} color="#f0a500" strokeWidth={2} />
            <span className="font-mono text-11 min-w-[24px] text-center">
              {fmtStars(stars)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setView("blog")}
            className="hidden sm:flex items-center gap-2 h-[32px] px-3 text-12 text-subtext bg-card border border-border rounded-lg hover:border-cyan/40 hover:text-text transition-all"
          >
            <BookOpen size={13} />
            <span>Blog</span>
          </button>
          <button
            type="button"
            onClick={() => setView("docs")}
            className="hidden sm:flex items-center gap-2 h-[32px] px-3 text-12 text-subtext bg-card border border-border rounded-lg hover:border-cyan/40 hover:text-text transition-all"
          >
            <HugeiconsIcon icon={Book01Icon} size={13} color="currentColor" />
            <span>Docs</span>
          </button>
          <button
            type="button"
            onClick={handleOpenFolder}
            className="hidden sm:flex items-center gap-2 h-[32px] px-3 text-12 text-subtext bg-card border border-border rounded-lg hover:border-cyan/40 hover:text-text transition-all"
          >
            <HugeiconsIcon icon={FolderOpenIcon} size={13} color="currentColor" />
            <span>Open folder</span>
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 h-[32px] px-3 sm:px-4 text-12 font-bold text-white bg-cyan hover:bg-cyan-hover rounded-lg transition-colors"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={13} color="currentColor" />
            <span className="hidden sm:inline">New workspace</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto" ref={mainRef as React.RefObject<HTMLDivElement>}>
        {view === "landing" ? (
          <LandingView
            onGoToWorkspaces={() => setView("workspaces")}
            onGoDocs={() => setView("docs")}
            stars={stars}
          />
        ) : view === "workspaces" ? (
          <WorkspacesView
            workspaces={workspaceList}
            switching={switching}
            onOpen={handleOpen}
            onDelete={handleDelete}
            onCreate={() => setCreateOpen(true)}
          />
        ) : view === "docs" ? (
          <DocsView />
        ) : view === "blog" ? (
          <BlogPage onBack={() => setView("landing")} scrollToTop={() => mainRef.current?.scrollTo(0, 0)} />
        ) : null}
      </main>

      <CreateWorkspaceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onEnter={onEnter}
      />
    </div>
  );
}
