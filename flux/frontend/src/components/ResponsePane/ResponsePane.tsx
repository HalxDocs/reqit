import { useResponseStore } from "../../stores/useResponseStore";
import { useUIStore, type ResponseTab } from "../../stores/useUIStore";
import { Tabs, type TabItem } from "../shared/Tabs";
import { StatusBar } from "./StatusBar";
import { BodyView } from "./BodyView";
import { HeadersView } from "./HeadersView";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";

const TABS: TabItem<ResponseTab>[] = [
  { id: "body", label: "Body" },
  { id: "headers", label: "Headers" },
];

export function ResponsePane() {
  const response = useResponseStore((s) => s.response);
  const isLoading = useResponseStore((s) => s.isLoading);
  const responseTab = useUIStore((s) => s.responseTab);
  const setResponseTab = useUIStore((s) => s.setResponseTab);

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
      </div>
    </section>
  );
}
