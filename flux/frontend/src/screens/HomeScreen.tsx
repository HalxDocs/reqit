import { useState } from "react";
import { FolderOpen, Plus } from "lucide-react";
import { useWorkspaceStore } from "../stores/useWorkspaceStore";
import { useCollectionStore } from "../stores/useCollectionStore";
import { useHistoryStore } from "../stores/useHistoryStore";
import { useEnvStore } from "../stores/useEnvStore";
import { useTabsStore } from "../stores/useTabsStore";
import { CreateWorkspaceModal } from "../components/modals/CreateWorkspaceModal";
import { PickFolder } from "../../wailsjs/go/main/App";
import { toast } from "../stores/useToastStore";
import fluxLogo from "../assets/images/fluxloo.jpeg";
import type { workspaces } from "../../wailsjs/go/models";

function fmtDate(iso: string): string {
  if (!iso) return "Never";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

function WorkspaceCard({
  ws,
  onOpen,
}: {
  ws: workspaces.Info;
  onOpen: (id: string) => void;
}) {
  const initials = ws.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      type="button"
      onClick={() => onOpen(ws.id)}
      className="group text-left bg-card border border-border rounded-xl overflow-hidden hover:border-blue/40 hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue"
    >
      {/* Color bar */}
      <div className="h-[6px] w-full" style={{ backgroundColor: ws.color || "#3B82F6" }} />

      <div className="p-5 flex flex-col gap-3">
        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          <div
            className="w-[40px] h-[40px] rounded-lg flex items-center justify-center text-white text-13 font-bold shrink-0"
            style={{ backgroundColor: ws.color || "#3B82F6" }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-14 font-semibold text-text truncate">{ws.name}</div>
            {ws.description && (
              <div className="text-12 text-subtext truncate">{ws.description}</div>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between text-11 text-subtext">
          <span>Last opened {fmtDate(ws.lastOpenedAt)}</span>
          <span
            className="px-2 py-0.5 rounded-full text-10 font-semibold text-white"
            style={{ backgroundColor: (ws.color || "#3B82F6") + "33" }}
          >
            <span style={{ color: ws.color || "#3B82F6" }}>Open</span>
          </span>
        </div>
      </div>
    </button>
  );
}

export function HomeScreen() {
  const workspaceList = useWorkspaceStore((s) => s.workspaces);
  const switchWs = useWorkspaceStore((s) => s.switch);
  const openFromFolder = useWorkspaceStore((s) => s.openFromFolder);
  const loadCollections = useCollectionStore((s) => s.load);
  const loadHistory = useHistoryStore((s) => s.load);
  const loadEnvs = useEnvStore((s) => s.load);
  const resetTabs = useTabsStore((s) => s.resetTabs);

  const [createOpen, setCreateOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const handleOpen = async (id: string) => {
    setSwitching(id);
    try {
      await switchWs(id);
      resetTabs();
      await Promise.all([loadCollections(), loadHistory(), loadEnvs()]);
    } finally {
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
    <div className="h-screen w-screen bg-bg flex flex-col">
      {/* Top bar */}
      <div className="h-[56px] px-6 flex items-center justify-between border-b border-border shrink-0">
        <img src={fluxLogo} alt="Flux" className="h-[28px] w-auto object-contain" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenFolder}
            className="flex items-center gap-2 h-[32px] px-3 text-12 text-subtext hover:text-text bg-card border border-border rounded-md hover:border-blue/40 transition-colors"
          >
            <FolderOpen size={13} />
            <span>Open folder</span>
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 h-[32px] px-4 text-12 font-bold text-white bg-blue hover:bg-blue-hover rounded-md transition-colors"
          >
            <Plus size={13} />
            <span>New workspace</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        {workspaceList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="text-24 font-bold text-text">Welcome to Flux</div>
            <p className="text-14 text-subtext max-w-[400px]">
              Workspaces keep your collections, environments, and history organised.
              Each workspace lives in its own folder — point it at Dropbox or OneDrive
              and it syncs to any device automatically, no account needed.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 h-[40px] px-6 text-14 font-bold text-white bg-blue hover:bg-blue-hover rounded-lg transition-colors"
            >
              <Plus size={16} />
              <span>Create your first workspace</span>
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-20 font-bold text-text mb-6">Workspaces</h1>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {workspaceList.map((ws) => (
                <div key={ws.id} className="relative">
                  {switching === ws.id && (
                    <div className="absolute inset-0 z-10 bg-bg/60 rounded-xl flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full border-2 border-blue border-t-transparent animate-spin" />
                    </div>
                  )}
                  <WorkspaceCard ws={ws} onOpen={handleOpen} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
