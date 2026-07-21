import { useMemo, useState, useCallback } from "react";
import { BookmarkPlus, Search, X, Camera, GitCompare, ChevronUp, ChevronDown } from "lucide-react";
import { useResponseStore } from "@/features/request/stores/useResponseStore";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { useUIStore, type ResponseTab } from "@/app/stores/useUIStore";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";
import { Tabs, type TabItem } from "@/shared/components/Tabs";
import { StatusBar } from "@/features/response/components/StatusBar";
import { BodyView } from "@/features/response/components/BodyView";
import { HeadersView } from "@/features/response/components/HeadersView";
import { CookiesView } from "@/features/response/components/CookiesView";
import { TimelineView } from "@/features/response/components/TimelineView";
import { LoadingState } from "@/features/response/components/LoadingState";
import { ErrorState } from "@/features/response/components/ErrorState";
import { AIDiagnosisPanel } from "@/features/ai/components/AIDiagnosisPanel";
import { useSendRequest } from "@/features/request/hooks/useSendRequest";
import { SecurityWarnings } from "@/features/response/components/SecurityWarnings";
import { PartyModeToggle, PartyModeEffects } from "@/features/response/components/PartyMode";
import { PerformanceChart } from "@/features/response/components/PerformanceChart";
import { useDiffStore, type ResponseSnapshot } from "@/features/response/stores/useDiffStore";
import { SaveCapturedResponse } from "../../../../wailsjs/go/main/App";
import { useToastStore } from "@/app/stores/useToastStore";
import { cn } from "@/shared/lib/cn";
import { Trash2 } from "lucide-react";

function DiffSnapshots({ method, url, response, snapshotKey }: {
  method: string;
  url: string;
  response: import("@/features/request/types/request").ResponseResult | null;
  snapshotKey: string;
}) {
  const snapshots = useDiffStore((s) => s.snapshots);
  const saveSnapshot = useDiffStore((s) => s.saveSnapshot);
  const removeSnapshot = useDiffStore((s) => s.removeSnapshot);
  const existing = snapshots[snapshotKey];
  const [open, setOpen] = useState(false);

  if (!response || !existing) return null;

  const currentSnap: import("@/features/response/stores/useDiffStore").ResponseSnapshot = {
    url, method,
    statusCode: response.statusCode,
    body: response.body,
    headers: response.headers,
    capturedAt: new Date().toISOString(),
  };

  const oldLines = (existing.body ?? "").split("\n");
  const newLines = (response.body ?? "").split("\n");
  const tooLarge = oldLines.length > 5000 || newLines.length > 5000;
  const diffs = tooLarge ? [] : lineDiff(oldLines, newLines);
  const adds = diffs.filter((d) => d.type === "added").length;
  const rems = diffs.filter((d) => d.type === "removed").length;

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-12 text-subtext hover:text-text bg-surface hover:bg-cardHover transition-colors"
      >
        <GitCompare size={12} />
        <span>Diff with snapshot</span>
        <span className="text-10 text-subtext/50 ml-1">+{adds}/-{rems}</span>
        <span className="ml-auto text-10 text-subtext/30">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="p-3 bg-bg">
          <div className="flex items-center gap-3 text-11 text-subtext mb-2 px-1">
            <span className="text-teal">+{adds}</span>
            <span className="text-danger">-{rems}</span>
            <span className="text-subtext/50">{existing.statusCode} → {response.statusCode}</span>
          </div>
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
          <button type="button" onClick={() => { removeSnapshot(snapshotKey); setOpen(false); }}
            className="mt-2 flex items-center gap-1 text-11 text-subtext/30 hover:text-danger transition-colors">
            <Trash2 size={10} /> Clear snapshot
          </button>
        </div>
      )}
    </div>
  );
}

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

export function ResponsePane() {
  const send = useSendRequest();
  const response = useResponseStore((s) => s.response);
  const isLoading = useResponseStore((s) => s.isLoading);
  const panelLayout = useUIStore((s) => s.panelLayout);
  const responseTab = useUIStore((s) => s.responseTab);
  const setResponseTab = useUIStore((s) => s.setResponseTab);
  const loadedRequestID = useUIStore((s) => s.loadedRequestID);
  const collections = useCollectionStore((s) => s.collections);
  const toast = useToastStore((s) => s.push);
  const [saving, setSaving] = useState(false);
  const method = useRequestStore((s) => s.method);
  const url = useRequestStore((s) => s.url);
  const snapshots = useDiffStore((s) => s.snapshots);
  const saveSnapshot = useDiffStore((s) => s.saveSnapshot);
  const removeSnapshot = useDiffStore((s) => s.removeSnapshot);
  const snapshotKey = `${method} ${url}`;
  const existingSnapshot = snapshots[snapshotKey];

  const cookieCount = (response?.cookies ?? []).length;
  const responseSearch = useUIStore((s) => s.responseSearch);
  const setResponseSearch = useUIStore((s) => s.setResponseSearch);
  const searchMatchIndex = useUIStore((s) => s.searchMatchIndex);
  const setSearchMatchIndex = useUIStore((s) => s.setSearchMatchIndex);

  const matchCount = useMemo(() => {
    if (!responseSearch || !response?.body) return 0;
    const body = response.body.toLowerCase();
    const q = responseSearch.toLowerCase();
    let count = 0;
    let idx = 0;
    while (idx < body.length) {
      const pos = body.indexOf(q, idx);
      if (pos === -1) break;
      count++;
      idx = pos + q.length;
    }
    return count;
  }, [responseSearch, response?.body]);

  const prevMatch = useCallback(() => {
    setSearchMatchIndex(searchMatchIndex <= 0 ? matchCount - 1 : searchMatchIndex - 1);
  }, [searchMatchIndex, matchCount, setSearchMatchIndex]);

  const nextMatch = useCallback(() => {
    setSearchMatchIndex(searchMatchIndex >= matchCount - 1 ? 0 : searchMatchIndex + 1);
  }, [searchMatchIndex, matchCount, setSearchMatchIndex]);

  const TABS: TabItem<ResponseTab>[] = useMemo(() => [
    { id: "body", label: "Body" },
    { id: "headers", label: "Headers" },
    { id: "cookies", label: cookieCount > 0 ? `Cookies (${cookieCount})` : "Cookies" },
    { id: "timeline", label: "Timeline" },
    { id: "performance", label: "Performance" },
  ], [cookieCount]);

  const currentDomain = useMemo(() => {
    if (!response) return undefined;
    try {
      const url = (response as { url?: string }).url ?? "";
      return url ? new URL(url).hostname : undefined;
    } catch { return undefined; }
  }, [response]);

  // Find the collection + request that the loaded request belongs to.
  const savedContext = useMemo(() => {
    if (!loadedRequestID) return null;
    for (const col of collections) {
      const req = col.requests.find((r) => r.id === loadedRequestID);
      if (req) return { colID: col.id, reqID: req.id };
    }
    return null;
  }, [loadedRequestID, collections]);

  const saveResponse = async () => {
    if (!response || !savedContext) return;
    setSaving(true);
    try {
      await SaveCapturedResponse(savedContext.colID, savedContext.reqID, {
        statusCode: response.statusCode,
        headers: response.headers,
        body: response.body,
        capturedAt: new Date().toISOString(),
      } as never);
      toast("success", "Response saved for mock replay");
    } catch (e) {
      toast("error", String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={panelLayout === "horizontal" ? "flex-1 self-stretch bg-bg flex flex-col min-w-0 min-h-0" : "flex-1 w-full min-h-0 bg-bg flex flex-col"}>
      <StatusBar />

      <SecurityWarnings />

      {!isLoading && response && !response.error && (
        <div className="flex items-center justify-between border-b border-border">
          <Tabs tabs={TABS} active={responseTab} onChange={setResponseTab} />
          <div className="flex items-center gap-1 mr-3">
            <PartyModeToggle />
            {existingSnapshot && (
              <button
                type="button"
                onClick={() => {
                  if (response) {
                    saveSnapshot(snapshotKey, {
                      url, method,
                      statusCode: response.statusCode,
                      body: response.body,
                      headers: response.headers,
                      capturedAt: new Date().toISOString(),
                    });
                  }
                }}
                className="flex items-center gap-1 text-11 text-subtext hover:text-text transition-colors"
                title="Save snapshot for diff"
              >
                <Camera size={10} />
              </button>
            )}
            {response && (
              <button
                type="button"
                onClick={() => {
                  saveSnapshot(snapshotKey, {
                    url, method,
                    statusCode: response.statusCode,
                    body: response.body,
                    headers: response.headers,
                    capturedAt: new Date().toISOString(),
                  });
                }}
                className="flex items-center gap-1 text-11 text-subtext/40 hover:text-text transition-colors"
                title="Save snapshot for diff"
              >
                <Camera size={10} />
              </button>
            )}
            {existingSnapshot && (
              <button
                type="button"
                onClick={() => removeSnapshot(snapshotKey)}
                className="flex items-center gap-1 text-11 text-subtext/30 hover:text-danger transition-colors"
                title="Remove snapshot"
              >
                <Trash2 size={9} />
              </button>
            )}
            {responseTab === "body" && (
              <div className="flex items-center gap-1 bg-surface border border-border rounded-sm px-2 h-[22px]">
                <Search size={10} className="text-subtext" />
                <input
                  type="text"
                  value={responseSearch}
                  onChange={(e) => setResponseSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (e.shiftKey) prevMatch();
                      else nextMatch();
                    }
                  }}
                  placeholder="Search body…"
                  spellCheck={false}
                  className="bg-transparent text-11 text-text outline-none w-[100px] placeholder:text-tertiary"
                />
                {responseSearch && (
                  <>
                    <button
                      type="button"
                      onClick={prevMatch}
                      disabled={matchCount === 0}
                      className="text-subtext hover:text-text disabled:opacity-30"
                      title="Previous match (Shift+Enter)"
                    >
                      <ChevronUp size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={nextMatch}
                      disabled={matchCount === 0}
                      className="text-subtext hover:text-text disabled:opacity-30"
                      title="Next match (Enter)"
                    >
                      <ChevronDown size={11} />
                    </button>
                    <span className="text-10 text-cyan font-mono tabular-nums min-w-[24px] text-center">
                      {matchCount > 0 ? `${searchMatchIndex + 1}/${matchCount}` : "0/0"}
                    </span>
                    <button type="button" onClick={() => setResponseSearch("")} className="text-subtext hover:text-text">
                      <X size={10} />
                    </button>
                  </>
                )}
              </div>
            )}
            {savedContext && (
              <button
                type="button"
                onClick={saveResponse}
                disabled={saving}
                className="flex items-center gap-1 text-11 text-subtext hover:text-text transition-colors disabled:opacity-50"
                title="Save response for mock server replay"
              >
                <BookmarkPlus size={11} />
                {saving ? "Saving…" : "Save for Mock"}
              </button>
            )}
          </div>
        </div>
      )}

      <div data-scope="responseTree" className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        {isLoading && <LoadingState />}

        {!isLoading && !response && (
          <div className="flex-1 flex items-center justify-center text-subtext text-12">
            Send a request to see the response.
          </div>
        )}

        {!isLoading && response && response.error && <ErrorState message={response.error} onRetry={send} />}

        {!isLoading && response && !response.error && responseTab === "body" && (
          <BodyView
            body={response.body}
            contentType={response.headers["Content-Type"] ?? response.headers["content-type"] ?? ""}
            bodyIsBase64={response.bodyIsBase64}
          />
        )}
        {!isLoading && response && !response.error && responseTab === "headers" && (
          <HeadersView headers={response.headers} />
        )}
        {responseTab === "cookies" && (
          <CookiesView currentDomain={currentDomain} />
        )}
        {!isLoading && response && !response.error && responseTab === "timeline" && (
          <TimelineView />
        )}
        {!isLoading && response && !response.error && responseTab === "performance" && (
          <PerformanceChart />
        )}
        <DiffSnapshots method={method} url={url} response={response} snapshotKey={snapshotKey} />
        <AIDiagnosisPanel />
      </div>

      <PartyModeEffects />
    </section>
  );
}
