import { PanelBottom, PanelRight } from "lucide-react";
import { useUIStore, type RequestTab } from "@/app/stores/useUIStore";
import { Tabs, type TabItem } from "@/shared/components/Tabs";
import { ParamsTab } from "@/features/request/components/ParamsTab";
import { HeadersTab } from "@/features/request/components/HeadersTab";
import { BodyTab } from "@/features/request/components/BodyTab";
import { AuthTab } from "@/features/request/components/AuthTab";
import { ScriptsPanel } from "@/features/scripts/components/ScriptsPanel";
import { NotesTab } from "@/features/request/components/NotesTab";

const TABS: TabItem<RequestTab>[] = [
  { id: "params", label: "Params" },
  { id: "headers", label: "Headers" },
  { id: "body", label: "Body" },
  { id: "auth", label: "Auth" },
  { id: "scripts", label: "Scripts" },
  { id: "notes", label: "Notes" },
];

export function RequestPanel({ width, height }: { width?: number; height?: number }) {
  const requestTab = useUIStore((s) => s.requestTab);
  const setRequestTab = useUIStore((s) => s.setRequestTab);
  const panelLayout = useUIStore((s) => s.panelLayout);
  const togglePanelLayout = useUIStore((s) => s.togglePanelLayout);

  return (
    <section
      style={height != null ? { height: `${height}px` } : { width: `${width}px` }}
      className={
        height != null
          ? "shrink-0 w-full bg-bg flex flex-col min-h-0"
          : "shrink-0 h-full bg-bg flex flex-col min-w-0"
      }
    >
      <div className="flex items-center justify-between border-b border-border bg-surface">
        <Tabs tabs={TABS} active={requestTab} onChange={setRequestTab} className="border-b-0" />
        <button
          type="button"
          onClick={togglePanelLayout}
          title={panelLayout === "horizontal" ? "Switch to stacked layout" : "Switch to side-by-side layout"}
          className="mr-2 shrink-0 p-1.5 rounded-sm text-subtext hover:text-text hover:bg-bg transition-colors"
        >
          {panelLayout === "horizontal" ? <PanelBottom size={14} /> : <PanelRight size={14} />}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {requestTab === "params" && <ParamsTab />}
        {requestTab === "headers" && <HeadersTab />}
        {requestTab === "body" && <BodyTab />}
        {requestTab === "auth" && <AuthTab />}
        {requestTab === "scripts" && <ScriptsPanel />}
        {requestTab === "notes" && <NotesTab />}
      </div>
    </section>
  );
}
