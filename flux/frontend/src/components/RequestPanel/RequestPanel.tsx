import { useUIStore, type RequestTab } from "../../stores/useUIStore";
import { Tabs, type TabItem } from "../shared/Tabs";
import { ParamsTab } from "./tabs/ParamsTab";
import { HeadersTab } from "./tabs/HeadersTab";
import { BodyTab } from "./tabs/BodyTab";
import { AuthTab } from "./tabs/AuthTab";

const TABS: TabItem<RequestTab>[] = [
  { id: "params", label: "Params" },
  { id: "headers", label: "Headers" },
  { id: "body", label: "Body" },
  { id: "auth", label: "Auth" },
];

export function RequestPanel({ width }: { width: number }) {
  const requestTab = useUIStore((s) => s.requestTab);
  const setRequestTab = useUIStore((s) => s.setRequestTab);

  return (
    <section
      style={{ width: `${width}px` }}
      className="shrink-0 h-full bg-bg flex flex-col min-w-0"
    >
      <Tabs tabs={TABS} active={requestTab} onChange={setRequestTab} />
      <div className="flex-1 overflow-y-auto">
        {requestTab === "params" && <ParamsTab />}
        {requestTab === "headers" && <HeadersTab />}
        {requestTab === "body" && <BodyTab />}
        {requestTab === "auth" && <AuthTab />}
      </div>
    </section>
  );
}
