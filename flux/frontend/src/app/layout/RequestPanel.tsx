import { useUIStore, type RequestTab } from "@/app/stores/useUIStore";
import { Tabs, type TabItem } from "@/shared/components/Tabs";
import { ParamsTab } from "@/features/request/components/ParamsTab";
import { HeadersTab } from "@/features/request/components/HeadersTab";
import { BodyTab } from "@/features/request/components/BodyTab";
import { AuthTab } from "@/features/request/components/AuthTab";
import { ScriptsPanel } from "@/features/scripts/components/ScriptsPanel";

const TABS: TabItem<RequestTab>[] = [
  { id: "params", label: "Params" },
  { id: "headers", label: "Headers" },
  { id: "body", label: "Body" },
  { id: "auth", label: "Auth" },
  { id: "scripts", label: "Scripts" },
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
        {requestTab === "scripts" && <ScriptsPanel />}
      </div>
    </section>
  );
}
