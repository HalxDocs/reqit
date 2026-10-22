import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, FolderLibraryIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { Trash2 } from "lucide-react";
import type { workspaces } from "../../../../wailsjs/go/models";

export function WorkspacesView({
  workspaces: wsList,
  switching,
  onOpen,
  onDelete,
  onCreate,
}: {
  workspaces: workspaces.Info[];
  switching: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-10">
      {wsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
          <div className="w-[64px] h-[64px] rounded-2xl bg-cyan/10 flex items-center justify-center">
            <HugeiconsIcon icon={FolderLibraryIcon} size={32} color="#3B82F6" strokeWidth={1.5} />
          </div>
          <div>
            <div
              className="text-18 font-bold text-text"
              style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
            >
              No workspaces yet
            </div>
            <div className="text-13 text-subtext mt-1 max-w-[340px]">
              Create your first workspace to start organising your API collections.
            </div>
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-2 h-[40px] px-6 text-13 font-bold text-white bg-cyan hover:bg-cyan-hover rounded-xl transition-colors"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={15} color="currentColor" />
            Create workspace
          </button>
        </div>
      ) : (
        <>
          <h1
            className="text-22 font-bold text-text mb-6"
            style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
          >
            Your workspaces
          </h1>
          <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {wsList.map((ws) => (
              <div key={ws.id} className="relative">
                {switching === ws.id && (
                  <div className="absolute inset-0 z-10 bg-bg/70 rounded-2xl flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full border-2 border-cyan border-t-transparent animate-spin" />
                  </div>
                )}
                <WorkspaceCard ws={ws} onOpen={onOpen} onDelete={onDelete} busy={switching !== null} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


function WorkspaceCard({
  ws,
  onOpen,
  onDelete,
  busy,
}: {
  ws: workspaces.Info;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  const initials = (ws.name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={() => !busy && onOpen(ws.id)}
        disabled={busy}
        className="w-full text-left bg-card border border-border rounded-2xl overflow-hidden hover:border-cyan/50 hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan disabled:opacity-60"
      >
        <div className="h-1.5 w-full" style={{ backgroundColor: ws.color || "#3B82F6" }} />
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div
              className="w-[44px] h-[44px] rounded-xl flex items-center justify-center text-white text-14 font-bold shrink-0"
              style={{ backgroundColor: ws.color || "#3B82F6" }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="text-14 font-semibold text-text truncate leading-tight">{ws.name}</div>
              {ws.description && (
                <div className="text-12 text-subtext truncate mt-0.5">{ws.description}</div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-11 text-subtext">{fmtDate(ws.lastOpenedAt)}</span>
            <span
              className="flex items-center gap-1 text-11 font-semibold px-2 py-0.5 rounded-full transition-all group-hover:scale-105"
              style={{
                color: ws.color || "#3B82F6",
                backgroundColor: (ws.color || "#3B82F6") + "22",
              }}
            >
              Open
              <HugeiconsIcon icon={ArrowRight01Icon} size={10} color="currentColor" />
            </span>
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(ws.id); }}
        className="absolute top-2 right-2 w-[28px] h-[28px] flex items-center justify-center rounded-lg bg-danger/90 text-white opacity-0 group-hover:opacity-100 hover:bg-danger transition-all duration-200"
        title="Delete workspace"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

type View = "landing" | "workspaces" | "docs" | "blog";

function fmtDate(iso: string): string {
  if (!iso) return "Never opened";
  try {
    const d = new Date(iso);
    const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diffDays === 0) return "Opened today";
    if (diffDays === 1) return "Opened yesterday";
    if (diffDays < 7) return `Opened ${diffDays} days ago`;
    return `Opened ${d.toLocaleDateString()}`;
  } catch {
    return "";
  }
}
