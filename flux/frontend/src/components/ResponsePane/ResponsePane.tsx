import { useMemo } from "react";
import { useResponseStore } from "../../stores/useResponseStore";
import { useUIStore, type ResponseTab } from "../../stores/useUIStore";
import { Tabs, type TabItem } from "../shared/Tabs";
import { StatusBar } from "./StatusBar";
import { BodyView } from "./BodyView";
import { HeadersView } from "./HeadersView";
import { CookiesView } from "./CookiesView";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";

export function ResponsePane() {
  const response = useResponseStore((s) => s.response);
  const isLoading = useResponseStore((s) => s.isLoading);
  const responseTab = useUIStore((s) => s.responseTab);
  const setResponseTab = useUIStore((s) => s.setResponseTab);

  const cookieCount = (response?.cookies ?? []).length;

  const TABS: TabItem<ResponseTab>[] = useMemo(() => [
    { id: "body", label: "Body" },
    { id: "headers", label: "Headers" },
    { id: "cookies", label: cookieCount > 0 ? `Cookies (${cookieCount})` : "Cookies" },
  ], [cookieCount]);

  // Extract hostname from the last response for domain highlighting.
  const currentDomain = useMemo(() => {
    if (!response) return undefined;
    try {
      const url = (response as { url?: string }).url ?? "";
      return url ? new URL(url).hostname : undefined;
    } catch { return undefined; }
  }, [response]);

  return (
    <section className="flex-1 h-full bg-bg flex flex-col min-w-0">
      <StatusBar />

      {!isLoading && response && !response.error && (
        <Tabs tabs={TABS} active={responseTab} onChange={setResponseTab} />
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
