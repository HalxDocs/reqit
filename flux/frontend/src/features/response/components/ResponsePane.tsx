import { useMemo, useState, useCallback } from "react";
import { BookmarkPlus, Search, X, Camera, ChevronUp, ChevronDown } from "lucide-react";
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
import { useDiffStore } from "@/features/response/stores/useDiffStore";
import { SaveCapturedResponse } from "../../../../wailsjs/go/main/App";
import { useToastStore } from "@/app/stores/useToastStore";
import { Trash2 } from "lucide-react";
import { DiffSnapshots } from "@/features/response/components/DiffSnapshots";

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
            contentType={response.headers?.["Content-Type"] ?? response.headers?.["content-type"] ?? ""}
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
