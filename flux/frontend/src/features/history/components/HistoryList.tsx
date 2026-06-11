import { useMemo, useState } from "react";
import { Download, Heart, Search, Star, Trash2, X } from "lucide-react";
import { useHistoryStore } from "@/features/history/stores/useHistoryStore";
import { useUIStore } from "@/app/stores/useUIStore";
import { useTabsStore, deriveTitle } from "@/features/tabs/stores/useTabsStore";
import { decodePayload } from "@/shared/lib/loadPayload";
import { MethodBadge } from "@/shared/components/MethodBadge";
import { statusColor } from "@/shared/lib/format";
import { cn } from "@/shared/lib/cn";
import type { HttpMethod } from "@/features/request/types/request";
import { DeleteHistoryEntry, UpdateHistoryEntry } from "../../../../wailsjs/go/main/App";

export function HistoryList() {
  const allEntries = useHistoryStore((s) => s.entries);
  const clear = useHistoryStore((s) => s.clear);
  const reload = useHistoryStore((s) => s.load);
  const newTab = useTabsStore((s) => s.newTab);
  const setLoadedRequestID = useUIStore((s) => s.setLoadedRequestID);
  const filter = useUIStore((s) => s.sidebarFilter);
  const [search, setSearch] = useState("");
  const [showFavorites, setShowFavorites] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const entries = useMemo(() => {
    let e = allEntries;
    if (showFavorites) e = e.filter((en) => en.favorite);
    const q = (filter || search).trim().toLowerCase();
    if (q) {
      e = e.filter(
        (en) =>
          en.payload.url.toLowerCase().includes(q) ||
          en.payload.method.toLowerCase().includes(q) ||
          String(en.response?.statusCode || "").includes(q) ||
          (en.tags || []).some((t) => t.toLowerCase().includes(q)),
      );
    }
    return e;
  }, [allEntries, filter, search, showFavorites]);

  const handleLoad = (payload: { url: string; method: string }) => {
    const decoded = decodePayload(payload);
    newTab({
      title: deriveTitle(decoded),
      savedRequestID: null,
      request: decoded,
      response: null,
      dirty: false,
    });
    setLoadedRequestID(null);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await DeleteHistoryEntry(id);
      await reload();
    } catch {}
  };

  const handleToggleFav = async (id: string, current: boolean | undefined, ev: React.MouseEvent) => {
    ev.stopPropagation();
    try {
      await UpdateHistoryEntry(id, { favorite: !current });
      await reload();
    } catch {}
  };

  const handleExport = () => {
    const data = JSON.stringify(entries, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reqit-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  };

  const handleExportCSV = () => {
    const header = "Method,URL,Status,Timing,Date,Tags,Favorite\n";
    const rows = entries.map((e) =>
      [
        e.payload.method,
        `"${e.payload.url}"`,
        e.response?.statusCode ?? "",
        e.response?.timingMs ?? "",
        e.createdAt ? new Date(e.createdAt).toLocaleString() : "",
        (e.tags || []).join(";"),
        e.favorite ? "Yes" : "",
      ].join(","),
    );
    const csv = header + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reqit-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  };

  return (
    <div className="flex flex-col">
      <div className="px-3 pb-1 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowFavorites(!showFavorites)}
            className={cn(
              "p-1 rounded-sm transition-colors",
              showFavorites ? "text-cyan" : "text-subtext hover:text-text",
            )}
            title={showFavorites ? "Show all" : "Favorites only"}
          >
            <Star size={12} />
          </button>
          <button
            type="button"
            onClick={() => setShowExport(!showExport)}
            className="text-subtext hover:text-text transition-colors p-1 rounded-sm"
            title="Export history"
          >
            <Download size={12} />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 bg-card border border-border rounded-sm px-2 h-[20px]">
            <Search size={9} className="text-subtext" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter…"
              spellCheck={false}
              className="bg-transparent text-10 text-text outline-none w-[70px] placeholder:text-tertiary"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-subtext hover:text-text">
                <X size={8} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={async () => {
              if (entries.length && confirm("Clear all history?")) {
                try { await clear(); } catch {}
              }
            }}
            disabled={!entries.length}
            className="text-subtext hover:text-danger disabled:opacity-30 transition-colors p-1 rounded-sm"
            aria-label="Clear history"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {showExport && (
        <div className="mx-3 mb-2 flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex-1 h-[24px] text-10 bg-cyan text-white rounded-sm hover:bg-cyan-hover transition-colors"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex-1 h-[24px] text-10 bg-card text-subtext hover:text-text border border-border rounded-sm transition-colors"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setShowExport(false)}
            className="text-subtext hover:text-text"
          >
            <X size={10} />
          </button>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="px-3 py-2 text-11 text-subtext italic">
          {showFavorites ? "No favorites yet." : "No history yet."}
        </div>
      ) : (
        entries.slice(0, 100).map((e) => {
          const code = e.response?.statusCode || 0;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => handleLoad(e.payload)}
              className="text-left px-3 py-1.5 flex items-center gap-1 hover:bg-cardHover transition-colors group"
            >
              <button
                type="button"
                onClick={(ev) => handleToggleFav(e.id, e.favorite, ev)}
                className={cn(
                  "shrink-0 transition-colors",
                  e.favorite ? "text-amber-400" : "text-transparent group-hover:text-subtext",
                )}
              >
                <Heart size={10} fill={e.favorite ? "currentColor" : "none"} />
              </button>
              <MethodBadge method={(e.payload.method as HttpMethod) || "GET"} />
              <span className="flex-1 text-12 text-text truncate font-mono">
                {shortUrl(e.payload.url)}
              </span>
              <span className={cn("text-11 font-mono font-bold", statusColor(code))}>
                {code || "—"}
              </span>
              <button
                type="button"
                onClick={(ev) => handleDelete(e.id, ev)}
                className="text-transparent group-hover:text-subtext hover:text-danger transition-colors shrink-0"
              >
                <Trash2 size={10} />
              </button>
            </button>
          );
        })
      )}
    </div>
  );
}

function shortUrl(url: string): string {
  if (!url) return "(empty)";
  try {
    const u = new URL(url.includes("://") ? url : `https://${url}`);
    return u.pathname === "/" ? u.host : u.host + u.pathname;
  } catch {
    return url;
  }
}
