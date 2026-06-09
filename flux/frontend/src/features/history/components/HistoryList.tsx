import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { useHistoryStore } from "@/features/history/stores/useHistoryStore";
import { useUIStore } from "@/app/stores/useUIStore";
import { useTabsStore, deriveTitle } from "@/features/tabs/stores/useTabsStore";
import { decodePayload } from "@/shared/lib/loadPayload";
import { MethodBadge } from "@/shared/components/MethodBadge";
import { statusColor } from "@/shared/lib/format";
import { cn } from "@/shared/lib/cn";
import type { HttpMethod } from "@/features/request/types/request";

export function HistoryList() {
  const allEntries = useHistoryStore((s) => s.entries);
  const clear = useHistoryStore((s) => s.clear);
  const newTab = useTabsStore((s) => s.newTab);
  const setLoadedRequestID = useUIStore((s) => s.setLoadedRequestID);
  const filter = useUIStore((s) => s.sidebarFilter);

  const entries = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allEntries;
    return allEntries.filter(
      (e) =>
        e.payload.url.toLowerCase().includes(q) ||
        e.payload.method.toLowerCase().includes(q),
    );
  }, [allEntries, filter]);

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

  return (
    <div className="flex flex-col">
      <div className="px-3 pb-1 flex items-center justify-between">
        <button
          type="button"
          onClick={async () => {
            if (entries.length && confirm("Clear all history?")) { try { await clear(); } catch {} }
          }}
          disabled={!entries.length}
          className="text-subtext hover:text-danger disabled:opacity-30 transition-colors p-1 rounded-sm"
          aria-label="Clear history"
          title="Clear history"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="px-3 py-2 text-11 text-subtext italic">No history yet.</div>
      ) : (
        entries.map((e) => {
          const code = e.response?.statusCode || 0;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => handleLoad(e.payload)}
              className="text-left px-3 py-1.5 flex items-center gap-2 hover:bg-cardHover transition-colors"
            >
              <MethodBadge method={(e.payload.method as HttpMethod) || "GET"} />
              <span className="flex-1 text-12 text-text truncate font-mono">
                {shortUrl(e.payload.url)}
              </span>
              <span className={cn("text-11 font-mono font-bold", statusColor(code))}>
                {code || "—"}
              </span>
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
