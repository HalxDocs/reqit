import { useMemo, useState } from "react";
import { BookmarkPlus } from "lucide-react";
import { useResponseStore } from "../../stores/useResponseStore";
import { useUIStore, type ResponseTab } from "../../stores/useUIStore";
import { useCollectionStore } from "../../stores/useCollectionStore";
import { Tabs, type TabItem } from "../shared/Tabs";
import { StatusBar } from "./StatusBar";
import { BodyView } from "./BodyView";
import { HeadersView } from "./HeadersView";
import { CookiesView } from "./CookiesView";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";
import { SaveCapturedResponse } from "../../../wailsjs/go/main/App";
import { useToastStore } from "../../stores/useToastStore";

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

  const TABS: TabItem<ResponseTab>[] = useMemo(() => [
    { id: "body", label: "Body" },
    { id: "headers", label: "Headers" },
    { id: "cookies", label: cookieCount > 0 ? `Cookies (${cookieCount})` : "Cookies" },
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

      {!isLoading && response && !response.error && (
        <div className="flex items-center justify-between border-b border-border">
          <Tabs tabs={TABS} active={responseTab} onChange={setResponseTab} />
          {savedContext && (
            <button
              type="button"
              onClick={saveResponse}
              disabled={saving}
              className="flex items-center gap-1 mr-3 text-11 text-subtext hover:text-text transition-colors disabled:opacity-50"
              title="Save response for mock server replay"
            >
              <BookmarkPlus size={11} />
              {saving ? "Saving…" : "Save for Mock"}
            </button>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
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
          />
        )}
        {!isLoading && response && !response.error && responseTab === "headers" && (
          <HeadersView headers={response.headers} />
        )}
        {responseTab === "cookies" && (
          <CookiesView currentDomain={currentDomain} />
        )}
      </div>
    </section>
  );
}
