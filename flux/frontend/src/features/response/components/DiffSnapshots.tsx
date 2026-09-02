import { useState, useMemo } from "react";
import { GitCompare, Trash2, Columns2, List, History, ArrowLeftRight, Settings } from "lucide-react";
import { useDiffStore, type ResponseSnapshot } from "@/features/response/stores/useDiffStore";
import { useDiffIgnoreStore } from "@/features/response/stores/useDiffIgnoreStore";
import { useHistoryStore } from "@/features/history/stores/useHistoryStore";
import { filterIgnoredFields } from "@/features/response/lib/diffIgnore";
import { DiffIgnoreModal } from "@/features/response/components/DiffIgnoreModal";
import { cn } from "@/shared/lib/cn";

function lineDiff(oldLines: string[], newLines: string[]) {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const result: { type: "same" | "removed" | "added"; line: string }[] = [];
  let i = m, j = n;
  const rev: typeof result = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      rev.push({ type: "same", line: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rev.push({ type: "added", line: newLines[j - 1] });
      j--;
    } else {
      rev.push({ type: "removed", line: oldLines[i - 1] });
      i--;
    }
  }
  return rev.reverse();
}

function canonicalizeJSON(body: string): string {
  try {
    const obj = JSON.parse(body);
    return JSON.stringify(sortKeys(obj), null, 2);
  } catch {
    return body;
  }
}

function sortKeys(v: any): any {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v !== null && typeof v === "object") {
    const out: Record<string, any> = {};
    Object.keys(v).sort().forEach((k) => { out[k] = sortKeys(v[k]); });
    return out;
  }
  return v;
}

function headerDiff(oldH: Record<string, string> | undefined, newH: Record<string, string> | undefined, ignorePatterns: string[]) {
  const a = oldH || {};
  const b = newH || {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const diffs: { key: string; type: "same" | "added" | "removed" | "modified"; oldVal?: string; newVal?: string }[] = [];
  for (const k of Array.from(keys).sort()) {
    const av = a[k];
    const bv = b[k];
    const shouldIgnore = ignorePatterns.some((p) => k.toLowerCase() === p.toLowerCase());
    if (shouldIgnore) continue;
    if (av === undefined) diffs.push({ key: k, type: "added", newVal: bv });
    else if (bv === undefined) diffs.push({ key: k, type: "removed", oldVal: av });
    else if (av !== bv) diffs.push({ key: k, type: "modified", oldVal: av, newVal: bv });
    else diffs.push({ key: k, type: "same", oldVal: av, newVal: bv });
  }
  return diffs;
}

export function DiffSnapshots({ method, url, response, snapshotKey }: {
  method: string;
  url: string;
  response: import("@/features/request/types/request").ResponseResult | null;
  snapshotKey: string;
}) {
  const snapshots = useDiffStore((s) => s.snapshots);
  const saveSnapshot = useDiffStore((s) => s.saveSnapshot);
  const removeSnapshot = useDiffStore((s) => s.removeSnapshot);
  const historyEntries = useHistoryStore((s) => s.entries);

  const { getEffectivePatterns, getEffectiveHeaderPatterns } = useDiffIgnoreStore();
  const bodyIgnorePatterns = useMemo(() => getEffectivePatterns(snapshotKey), [getEffectivePatterns, snapshotKey]);
  const headerIgnorePatterns = useMemo(() => getEffectiveHeaderPatterns(), [getEffectiveHeaderPatterns]);

  const existing = snapshots[snapshotKey];
  const [open, setOpen] = useState(false);
  const [sideBySide, setSideBySide] = useState(false);
  const [compareMode, setCompareMode] = useState<"snapshot" | "history">("snapshot");
  const [historyId, setHistoryId] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);

  const historyCandidates = useMemo(() => {
    return historyEntries
      .filter((h) => h.payload.method === method && h.payload.url === url)
      .slice(0, 10);
  }, [historyEntries, method, url]);

  const historyEntry = historyCandidates.find((h) => h.id === historyId) || null;

  // Choose baseline: snapshot vs history
  const baseline: ResponseSnapshot | null = (() => {
    if (compareMode === "history" && historyEntry) {
      return {
        url: historyEntry.payload.url,
        method: historyEntry.payload.method,
        statusCode: historyEntry.response.statusCode,
        body: historyEntry.response.body,
        headers: historyEntry.response.headers,
        capturedAt: historyEntry.createdAt,
      };
    }
    return existing || null;
  })();

  if (!response || !baseline) {
    if (!response) return null;
    return (
      <div className="border-t border-border">
        <div className="flex items-center gap-2 px-3 py-2 text-12 text-subtext bg-surface">
          <button
            type="button"
            onClick={() => {
              const snap: ResponseSnapshot = { url, method, statusCode: response.statusCode, body: response.body, headers: response.headers, capturedAt: new Date().toISOString() };
              saveSnapshot(snapshotKey, snap);
            }}
            className="flex items-center gap-1 text-11 text-cyan hover:text-cyan-hover"
          >
            <History size={12} /> Save snapshot for diff
          </button>
          <span className="text-10 text-subtext/50">No baseline yet — save one to compare next run</span>
        </div>
      </div>
    );
  }

  const currentSnap: ResponseSnapshot = {
    url, method,
    statusCode: response.statusCode,
    body: response.body,
    headers: response.headers,
    capturedAt: new Date().toISOString(),
  };

  // Apply ignore patterns BEFORE canonicalization so ignored fields are removed first
  const oldBodyFiltered = filterIgnoredFields(baseline.body ?? "", bodyIgnorePatterns);
  const newBodyFiltered = filterIgnoredFields(response.body ?? "", bodyIgnorePatterns);
  const oldBodyCan = canonicalizeJSON(oldBodyFiltered);
  const newBodyCan = canonicalizeJSON(newBodyFiltered);
  const oldLines = oldBodyCan.split("\n");
  const newLines = newBodyCan.split("\n");
  const tooLarge = oldLines.length > 5000 || newLines.length > 5000;
  const diffs = tooLarge ? [] : lineDiff(oldLines, newLines);
  const adds = diffs.filter((d) => d.type === "added").length;
  const rems = diffs.filter((d) => d.type === "removed").length;

  // Header diff with ignore patterns
  const headerDiffs = headerDiff(baseline.headers, response.headers, headerIgnorePatterns);
  const headerChanges = headerDiffs.filter((h) => h.type !== "same");

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-12 text-subtext hover:text-text bg-surface hover:bg-cardHover transition-colors"
      >
        <GitCompare size={12} />
        <span>Diff with {compareMode === "history" ? "history" : "snapshot"}</span>
        <span className="text-10 text-subtext/50 ml-1">+{adds}/-{rems}</span>
        {headerChanges.length > 0 && <span className="text-10 text-amber-400 ml-1">{headerChanges.length} header changes</span>}
        <span className="text-10 text-subtext/50">{baseline.statusCode} → {response.statusCode}</span>
        <span className="ml-auto text-10 text-subtext/30">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="p-3 bg-bg">
          <div className="flex items-center gap-2 text-11 text-subtext mb-2 px-1 flex-wrap">
            <span className="text-teal">+{adds}</span>
            <span className="text-danger">-{rems}</span>
            <span className="text-subtext/50">{baseline.statusCode} → {response.statusCode}</span>
            {headerChanges.length > 0 && <span className="text-amber-400">{headerChanges.length} headers changed</span>}
            <div className="flex items-center gap-1 ml-2 border border-border rounded-md overflow-hidden">
              <button onClick={() => setCompareMode("snapshot")} className={cn("px-2 py-0.5 text-10", compareMode === "snapshot" ? "bg-cyan text-white" : "bg-surface text-subtext")}>Snapshot</button>
              <button onClick={() => setCompareMode("history")} className={cn("px-2 py-0.5 text-10", compareMode === "history" ? "bg-cyan text-white" : "bg-surface text-subtext")}>History</button>
            </div>
            {compareMode === "history" && historyCandidates.length > 0 && (
              <select value={historyId} onChange={(e) => setHistoryId(e.target.value)} className="h-[22px] px-1 text-10 bg-surface border border-border rounded text-text">
                <option value="">Pick a history entry…</option>
                {historyCandidates.map((h) => (
                  <option key={h.id} value={h.id}>{new Date(h.createdAt).toLocaleString()} — {h.response.statusCode} ({(h.response.body || "").length}B)</option>
                ))}
              </select>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setSideBySide(!sideBySide)}
              className="flex items-center gap-1 text-10 text-subtext hover:text-text transition-colors"
              title={sideBySide ? "Unified view" : "Side-by-side view"}
            >
              {sideBySide ? <List size={11} /> : <Columns2 size={11} />}
              {sideBySide ? "Unified" : "Side-by-side"}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1 text-10 text-subtext hover:text-text transition-colors p-1"
              title="Configure ignore patterns"
            >
              <Settings size={11} />
            </button>
          </div>

          {/* Header diff */}
          {headerChanges.length > 0 && (
            <div className="mb-3 rounded-md border border-border overflow-hidden">
              <div className="text-10 text-subtext px-2 py-1 bg-surface border-b border-border flex items-center gap-1"><ArrowLeftRight size={10} /> Headers</div>
              <div className="divide-y divide-border/30">
                {headerDiffs.filter((h) => h.type !== "same").map((h) => (
                  <div key={h.key} className={cn("flex text-11 font-mono px-2 py-1", h.type === "added" ? "bg-teal/5 text-teal" : h.type === "removed" ? "bg-danger/5 text-danger" : "bg-amber-500/5 text-amber-600")}>
                    <span className="w-[28%] shrink-0 font-semibold truncate">{h.key}</span>
                    <span className="flex-1 break-all">
                      {h.type === "added" && <span>+ {h.newVal}</span>}
                      {h.type === "removed" && <span>- {h.oldVal}</span>}
                      {h.type === "modified" && <span>{h.oldVal} → {h.newVal}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sideBySide ? (
            <div className="flex gap-2 font-mono text-12 leading-relaxed max-h-[400px] overflow-y-auto">
              <div className="flex-1 border border-border rounded-md overflow-hidden bg-card">
                <div className="text-10 text-subtext px-2 py-1 bg-surface border-b border-border">{compareMode === "history" ? "History" : "Snapshot"} • {new Date(baseline.capturedAt).toLocaleString()}</div>
                <div className="max-h-[380px] overflow-y-auto">
                  {oldLines.map((line, i) => {
                    const diff = diffs.find((d, di) => {
                      let idx = 0;
                      for (let k = 0; k < di; k++) { if (diffs[k].type !== "same") idx++; }
                      return idx === i && d.type === "removed";
                    });
                    return (
                      <div key={i} className={cn("px-2 py-[1px] whitespace-pre-wrap break-all", diff ? "bg-danger/10 text-danger" : "text-text")}>
                        {line || " "}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex-1 border border-border rounded-md overflow-hidden bg-card">
                <div className="text-10 text-subtext px-2 py-1 bg-surface border-b border-border">Current • {new Date(currentSnap.capturedAt).toLocaleString()}</div>
                <div className="max-h-[380px] overflow-y-auto">
                  {newLines.map((line, i) => {
                    const diff = diffs.find((d, di) => {
                      let idx = 0;
                      for (let k = 0; k < di; k++) { if (diffs[k].type !== "same") idx++; }
                      return idx === i && d.type === "added";
                    });
                    return (
                      <div key={i} className={cn("px-2 py-[1px] whitespace-pre-wrap break-all", diff ? "bg-teal/10 text-teal" : "text-text")}>
                        {line || " "}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-md overflow-hidden font-mono text-12 leading-relaxed max-h-[400px] overflow-y-auto">
              {diffs.map((d, i) => (
                <div key={i} className={cn(
                  "flex items-stretch border-b border-border/30 last:border-b-0",
                  d.type === "added" && "bg-teal/5",
                  d.type === "removed" && "bg-danger/5",
                )}>
                  <span className={cn(
                    "w-[28px] shrink-0 text-right pr-2 py-[1px] text-10 select-none border-r border-border/30",
                    d.type === "added" ? "text-teal border-teal/20" : d.type === "removed" ? "text-danger border-danger/20" : "text-subtext/30",
                  )}>{d.type === "added" ? "+" : d.type === "removed" ? "-" : " "}</span>
                  <span className={cn(
                    "px-2 py-[1px] whitespace-pre-wrap break-all flex-1",
                    d.type === "added" ? "text-teal" : d.type === "removed" ? "text-danger" : "text-text",
                  )}>{d.line || " "}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <button type="button" onClick={() => { removeSnapshot(snapshotKey); setOpen(false); }}
              className="flex items-center gap-1 text-11 text-subtext/30 hover:text-danger transition-colors">
              <Trash2 size={10} /> Clear snapshot
            </button>
          </div>
        </div>
      )}

      <DiffIgnoreModal open={showSettings} onClose={() => setShowSettings(false)} snapshotKey={snapshotKey} />
    </div>
  );
}