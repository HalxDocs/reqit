import { useUIStore, type RequestTab } from "../../stores/useUIStore";
import { Tabs, type TabItem } from "../shared/Tabs";
import { UrlBar } from "./UrlBar";
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

export function RequestPanel({ onSend }: { onSend?: () => void }) {
  const requestTab = useUIStore((s) => s.requestTab);
  const setRequestTab = useUIStore((s) => s.setRequestTab);

  return (
    <section className="w-[420px] shrink-0 h-full bg-bg border-r border-border flex flex-col">
      <UrlBar onSend={onSend} />
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
