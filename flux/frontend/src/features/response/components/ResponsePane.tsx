import { useMemo, useState } from "react";
import { BookmarkPlus, Search, X } from "lucide-react";
import { useResponseStore } from "@/features/request/stores/useResponseStore";
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
import { SecurityWarnings } from "@/features/response/components/SecurityWarnings";
import { SaveCapturedResponse } from "../../../../wailsjs/go/main/App";
import { useToastStore } from "@/app/stores/useToastStore";

export function ResponsePane() {
  const response = useResponseStore((s) => s.response);
  const isLoading = useResponseStore((s) => s.isLoading);
  const responseTab = useUIStore((s) => s.responseTab);
  const setResponseTab = useUIStore((s) => s.setResponseTab);
  const loadedRequestID = useUIStore((s) => s.loadedRequestID);
  const collections = useCollectionStore((s) => s.collections);
  const toast = useToastStore((s) => s.push);
  const [saving, setSaving] = useState(false);

  const cookieCount = (response?.cookies ?? []).length;
  const responseSearch = useUIStore((s) => s.responseSearch);
  const setResponseSearch = useUIStore((s) => s.setResponseSearch);

  const TABS: TabItem<ResponseTab>[] = useMemo(() => [
    { id: "body", label: "Body" },
    { id: "headers", label: "Headers" },
    { id: "cookies", label: cookieCount > 0 ? `Cookies (${cookieCount})` : "Cookies" },
    { id: "timeline", label: "Timeline" },
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
    <section className="flex-1 h-full bg-bg flex flex-col min-w-0">
      <StatusBar />

      <SecurityWarnings />

      {!isLoading && response && !response.error && (
        <div className="flex items-center justify-between border-b border-border">
          <Tabs tabs={TABS} active={responseTab} onChange={setResponseTab} />
          <div className="flex items-center gap-2 mr-3">
            {responseTab === "body" && (
              <div className="flex items-center gap-1 bg-surface border border-border rounded-sm px-2 h-[22px]">
                <Search size={10} className="text-subtext" />
                <input
                  type="text"
                  value={responseSearch}
                  onChange={(e) => setResponseSearch(e.target.value)}
                  placeholder="Search body…"
                  spellCheck={false}
                  className="bg-transparent text-11 text-text outline-none w-[120px] placeholder:text-tertiary"
                />
                {responseSearch && (
                  <button type="button" onClick={() => setResponseSearch("")} className="text-subtext hover:text-text">
                    <X size={10} />
                  </button>
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

      <div data-scope="responseTree" className="flex-1 min-h-0 flex flex-col">
        {isLoading && <LoadingState />}

        {!isLoading && !response && (
          <div className="flex-1 flex items-center justify-center text-subtext text-12">
            Send a request to see the response.
          </div>
        )}

        {!isLoading && response && response.error && <ErrorState message={response.error} />}

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
      </div>

      <AIDiagnosisPanel />
    </section>
  );
}
