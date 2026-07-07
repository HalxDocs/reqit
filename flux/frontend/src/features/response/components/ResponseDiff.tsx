import { useMemo, useState } from "react";
import { Camera, GitCompare, Trash2 } from "lucide-react";
import { useResponseStore } from "@/features/request/stores/useResponseStore";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { useDiffStore, type ResponseSnapshot } from "@/features/response/stores/useDiffStore";
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

function DiffView({ a, b }: { a: ResponseSnapshot; b: ResponseSnapshot }) {
  const oldLines = (a.body ?? "").split("\n");
  const newLines = (b.body ?? "").split("\n");
  const diffs = useMemo(() => lineDiff(oldLines, newLines), [oldLines, newLines]);

  const adds = diffs.filter((d) => d.type === "added").length;
  const rems = diffs.filter((d) => d.type === "removed").length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-11 text-subtext px-1">
        <span className="text-teal">+{adds}</span>
        <span className="text-danger">-{rems}</span>
        <span className="text-subtext/50">
          {a.statusCode} → {b.statusCode}
        </span>
        <span className="text-subtext/30 ml-auto text-10">
          {new Date(a.capturedAt).toLocaleTimeString()} vs {new Date(b.capturedAt).toLocaleTimeString()}
        </span>
      </div>
      <div className="bg-bg border border-border rounded-md overflow-hidden font-mono text-12 leading-relaxed max-h-[400px] overflow-y-auto">
        {diffs.map((d, i) => (
          <div
            key={i}
            className={cn(
              "flex items-stretch border-b border-border/30 last:border-b-0",
              d.type === "added" && "bg-teal/5",
              d.type === "removed" && "bg-danger/5",
            )}
          >
            <span className={cn(
              "w-[28px] shrink-0 text-right pr-2 py-[1px] text-10 select-none border-r border-border/30",
              d.type === "added" ? "text-teal border-teal/20" : d.type === "removed" ? "text-danger border-danger/20" : "text-subtext/30",
            )}>
              {d.type === "added" ? "+" : d.type === "removed" ? "-" : " "}
            </span>
            <span className={cn(
              "px-2 py-[1px] whitespace-pre-wrap break-all flex-1",
              d.type === "added" ? "text-teal" : d.type === "removed" ? "text-danger" : "text-text",
            )}>
              {d.line || " "}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DiffControls() {
  const response = useResponseStore((s) => s.response);
  const method = useRequestStore((s) => s.method);
  const url = useRequestStore((s) => s.url);
  const snapshots = useDiffStore((s) => s.snapshots);
  const saveSnapshot = useDiffStore((s) => s.saveSnapshot);
  const removeSnapshot = useDiffStore((s) => s.removeSnapshot);
  const [showDiff, setShowDiff] = useState(false);

  const snapshotKey = `${method} ${url}`;
  const existing = snapshots[snapshotKey];

  if (!response) return null;

  const handleSave = () => {
    saveSnapshot(snapshotKey, {
      url,
      method,
      statusCode: response.statusCode,
      body: response.body,
      headers: response.headers,
      capturedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleSave}
        className="flex items-center gap-1 text-11 text-subtext hover:text-text transition-colors"
        title="Save response snapshot for diff"
      >
        <Camera size={11} />
      </button>
      {existing && (
        <button
          type="button"
          onClick={() => setShowDiff(!showDiff)}
          className={cn(
            "flex items-center gap-1 text-11 transition-colors",
            showDiff ? "text-cyan" : "text-subtext hover:text-text",
          )}
          title="Compare with saved snapshot"
        >
          <GitCompare size={11} />
        </button>
      )}
      {existing && (
        <button
          type="button"
          onClick={() => removeSnapshot(snapshotKey)}
          className="flex items-center gap-1 text-11 text-subtext/30 hover:text-danger transition-colors"
          title="Remove snapshot"
        >
          <Trash2 size={10} />
        </button>
      )}
      {showDiff && existing && (
        <DiffView a={existing} b={{
          url,
          method,
          statusCode: response.statusCode,
          body: response.body,
          headers: response.headers,
          capturedAt: new Date().toISOString(),
        }} />
      )}
    </div>
  );
}

export function DiffPanel() {
  const response = useResponseStore((s) => s.response);
  const method = useRequestStore((s) => s.method);
  const url = useRequestStore((s) => s.url);
  const snapshots = useDiffStore((s) => s.snapshots);
  const removeSnapshot = useDiffStore((s) => s.removeSnapshot);

  const snapshotKey = `${method} ${url}`;
  const existing = snapshots[snapshotKey];
  const [open, setOpen] = useState(false);

  if (!response || !existing) return null;

  const currentSnap: ResponseSnapshot = {
    url, method,
    statusCode: response.statusCode,
    body: response.body,
    headers: response.headers,
    capturedAt: new Date().toISOString(),
  };

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-12 text-subtext hover:text-text bg-surface hover:bg-cardHover transition-colors"
      >
        <GitCompare size={12} />
        <span>Diff with saved snapshot</span>
        <span className="ml-auto text-10 text-subtext/50">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="p-3 bg-bg">
          <DiffView a={existing} b={currentSnap} />
          <button
            type="button"
            onClick={() => { removeSnapshot(snapshotKey); setOpen(false); }}
            className="mt-2 flex items-center gap-1 text-11 text-subtext/30 hover:text-danger transition-colors"
          >
            <Trash2 size={10} />
            Clear snapshot
          </button>
        </div>
      )}
    </div>
  );
}
