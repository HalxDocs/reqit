import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Filter, Heart, Search, Star, Trash2, X } from "lucide-react";
import { toast } from "@/app/stores/useToastStore";
import { useHistoryStore } from "@/features/history/stores/useHistoryStore";
import { useUIStore } from "@/app/stores/useUIStore";
import { useTabsStore, deriveTitle } from "@/features/tabs/stores/useTabsStore";
import { decodePayload } from "@/shared/lib/loadPayload";
import { MethodBadge } from "@/shared/components/MethodBadge";
import { statusColor } from "@/shared/lib/format";
import { cn } from "@/shared/lib/cn";
import type { HttpMethod } from "@/features/request/types/request";
import { DeleteHistoryEntry, UpdateHistoryEntry } from "../../../../wailsjs/go/main/App";

type StatusCategory = "2xx" | "3xx" | "4xx" | "5xx" | "err";
type DateRange = "all" | "today" | "yesterday" | "week" | "month" | "older";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
const STATUS_CATS: { key: StatusCategory; label: string }[] = [
  { key: "2xx", label: "2xx" },
  { key: "3xx", label: "3xx" },
  { key: "4xx", label: "4xx" },
  { key: "5xx", label: "5xx" },
  { key: "err", label: "Error" },
];
const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "older", label: "Older" },
];

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - dDay.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "This Week";
  if (diffDays <= 30) return "This Month";
  return "Older";
}

function matchesDateRange(dateStr: string, range: DateRange): boolean {
  if (range === "all") return true;
  return getDateLabel(dateStr) === range;
}

function matchesStatusCat(code: number, cats: StatusCategory[]): boolean {
  if (!cats.length) return true;
  for (const c of cats) {
    if (c === "err" && code === 0) return true;
    const s = Math.floor(code / 100);
    if (c === "2xx" && s === 2) return true;
    if (c === "3xx" && s === 3) return true;
    if (c === "4xx" && s === 4) return true;
    if (c === "5xx" && s === 5) return true;
  }
  return false;
}

export function HistoryList() {
  const allEntries = useHistoryStore((s) => s.entries);
  const clear = useHistoryStore((s) => s.clear);
  const reload = useHistoryStore((s) => s.load);
  const newTab = useTabsStore((s) => s.newTab);
  const setLoadedRequestID = useUIStore((s) => s.setLoadedRequestID);
  const sidebarFilter = useUIStore((s) => s.sidebarFilter);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const [showFavorites, setShowFavorites] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [methods, setMethods] = useState<string[]>([]);
  const [statusCats, setStatusCats] = useState<StatusCategory[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>("all");

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const activeFilterCount =
    (methods.length ? 1 : 0) +
    (statusCats.length ? 1 : 0) +
    (dateRange !== "all" ? 1 : 0) +
    (showFavorites ? 1 : 0);

  const entries = useMemo(() => {
    let e = allEntries;
    if (showFavorites) e = e.filter((en) => en.favorite);

    const q = (sidebarFilter || debouncedSearch).trim().toLowerCase();
    if (q) {
      e = e.filter(
        (en) =>
          en.payload.url.toLowerCase().includes(q) ||
          en.payload.method.toLowerCase().includes(q) ||
          String(en.response?.statusCode || "").includes(q) ||
          (en.tags || []).some((t) => t.toLowerCase().includes(q)),
      );
    }

    if (methods.length) {
      e = e.filter((en) => methods.includes(en.payload.method.toUpperCase()));
    }

    if (statusCats.length) {
      e = e.filter((en) => matchesStatusCat(en.response?.statusCode ?? 0, statusCats));
    }

    if (dateRange !== "all") {
      e = e.filter((en) => matchesDateRange(en.createdAt, dateRange));
    }

    return e;
  }, [allEntries, sidebarFilter, debouncedSearch, showFavorites, methods, statusCats, dateRange]);

  const groupedEntries = useMemo(() => {
    const groups: { label: string; entries: typeof allEntries }[] = [];
    if (dateRange !== "all") {
      groups.push({ label: "", entries });
      return groups;
    }
    const order = ["Today", "Yesterday", "This Week", "This Month", "Older"];
    const map: Record<string, typeof allEntries> = {};
    for (const e of entries) {
      const label = getDateLabel(e.createdAt);
      if (!map[label]) map[label] = [];
      map[label].push(e);
    }
    for (const label of order) {
      if (map[label]?.length) groups.push({ label, entries: map[label] });
    }
    return groups;
  }, [entries, dateRange]);

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
      toast.success(current ? "Removed from favourites" : "Added to favourites");
    } catch {}
  };

  const toggleMethod = (m: string) => {
    setMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const toggleStatusCat = (c: StatusCategory) => {
    setStatusCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const clearFilters = () => {
    setMethods([]);
    setStatusCats([]);
    setDateRange("all");
    setShowFavorites(false);
    setSearch("");
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
      {/* Toolbar */}
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
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "p-1 rounded-sm transition-colors relative",
              showFilters || activeFilterCount > 0 ? "text-cyan" : "text-subtext hover:text-text",
            )}
            title="Toggle filters"
          >
            <Filter size={12} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-[10px] h-[10px] flex items-center justify-center bg-cyan text-white text-[7px] font-bold rounded-full">
                {activeFilterCount}
              </span>
            )}
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

      {/* Expanded filter panel */}
      {showFilters && (
        <div className="mx-3 mb-2 p-2 bg-card border border-border rounded-sm space-y-2">
          {/* Method filter */}
          <div>
            <div className="text-9 text-subtext mb-1 uppercase tracking-wider">Method</div>
            <div className="flex flex-wrap gap-1">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMethod(m)}
                  className={cn(
                    "px-1.5 h-[18px] text-9 rounded-sm border transition-colors",
                    methods.includes(m)
                      ? "bg-cyan/20 border-cyan text-cyan"
                      : "border-border text-subtext hover:text-text hover:border-text",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {/* Status category filter */}
          <div>
            <div className="text-9 text-subtext mb-1 uppercase tracking-wider">Status</div>
            <div className="flex gap-2">
              {STATUS_CATS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleStatusCat(key)}
                  className={cn(
                    "px-1.5 h-[18px] text-9 rounded-sm border transition-colors",
                    statusCats.includes(key)
                      ? "bg-cyan/20 border-cyan text-cyan"
                      : "border-border text-subtext hover:text-text hover:border-text",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Date range filter */}
          <div>
            <div className="text-9 text-subtext mb-1 uppercase tracking-wider">Date</div>
            <div className="flex gap-1">
              {DATE_RANGES.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDateRange(key)}
                  className={cn(
                    "px-1.5 h-[18px] text-9 rounded-sm border transition-colors",
                    dateRange === key
                      ? "bg-cyan/20 border-cyan text-cyan"
                      : "border-border text-subtext hover:text-text hover:border-text",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Clear all filters */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-9 text-danger hover:text-danger-hover transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Export buttons */}
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

      {/* Active filter chips */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="px-3 pb-1 flex flex-wrap gap-1">
          {methods.length > 0 && (
            <button
              type="button"
              onClick={() => setMethods([])}
              className="flex items-center gap-0.5 px-1 h-[16px] text-9 bg-cyan/20 border border-cyan/40 text-cyan rounded-sm"
            >
              {methods.join(", ")} <X size={8} />
            </button>
          )}
          {statusCats.length > 0 && (
            <button
              type="button"
              onClick={() => setStatusCats([])}
              className="flex items-center gap-0.5 px-1 h-[16px] text-9 bg-cyan/20 border border-cyan/40 text-cyan rounded-sm"
            >
              {statusCats.join(", ")} <X size={8} />
            </button>
          )}
          {dateRange !== "all" && (
            <button
              type="button"
              onClick={() => setDateRange("all")}
              className="flex items-center gap-0.5 px-1 h-[16px] text-9 bg-cyan/20 border border-cyan/40 text-cyan rounded-sm"
            >
              {DATE_RANGES.find((d) => d.key === dateRange)?.label} <X size={8} />
            </button>
          )}
          {showFavorites && (
            <button
              type="button"
              onClick={() => setShowFavorites(false)}
              className="flex items-center gap-0.5 px-1 h-[16px] text-9 bg-cyan/20 border border-cyan/40 text-cyan rounded-sm"
            >
              Favorites <X size={8} />
            </button>
          )}
        </div>
      )}

      {/* Entry list */}
      {entries.length === 0 ? (
        <div className="px-3 py-2 text-11 text-subtext italic">
          {allEntries.length === 0 ? "No history yet." : "No matches."}
        </div>
      ) : (
        <div className="flex flex-col">
          {groupedEntries.map((group) => (
            <div key={group.label}>
              {group.label && (
                <div className="sticky top-0 z-10 px-3 py-1 text-9 text-tertiary uppercase tracking-wider bg-sidebar/90 backdrop-blur-sm">
                  {group.label} ({group.entries.length})
                </div>
              )}
              {group.entries.slice(0, 100).map((e) => {
                const code = e.response?.statusCode || 0;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => handleLoad(e.payload)}
                    className="text-left px-3 py-1.5 flex items-center gap-1 hover:bg-cardHover transition-colors group w-full"
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
              })}
            </div>
          ))}
        </div>
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
