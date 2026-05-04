import { ChevronDown, Download, Folder, History as HistoryIcon, Settings, Terminal, User } from "lucide-react";
import fluxLogo from "../../assets/images/fluxloo.jpeg";
import { useWorkspaceStore } from "../../stores/useWorkspaceStore";
import { CollectionsTree } from "./CollectionsTree";
import { HistoryList } from "./HistoryList";
import { EnvSwitcher } from "./EnvSwitcher";
import { SearchBar } from "./SearchBar";
import { GitPanel } from "./GitPanel";
import { useUIStore } from "../../stores/useUIStore";
import { useProfileStore } from "../../stores/useProfileStore";

export function Sidebar({ onGoHome }: { onGoHome: () => void }) {
  const openImport = useUIStore((s) => s.openImportModal);
  const openPasteCurl = useUIStore((s) => s.openPasteCurlModal);
  const openSettings = useUIStore((s) => s.openSettingsModal);
  const profile = useProfileStore((s) => s.profile);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeID = useWorkspaceStore((s) => s.activeID);
  const activeWs = workspaces.find((w) => w.id === activeID);

  return (
    <aside className="w-[240px] shrink-0 h-full bg-surface border-r border-border flex flex-col">
      <button
        type="button"
        onClick={onGoHome}
        className="h-[48px] px-4 flex items-center gap-2 border-b border-border hover:bg-cardHover transition-colors text-left group"
        title="All workspaces"
      >
        <img src={fluxLogo} alt="Flux" className="h-[28px] w-auto object-contain shrink-0" />
        <span className="flex-1 text-12 font-semibold text-text truncate min-w-0">
          {activeWs?.name ?? "Workspace"}
        </span>
        <ChevronDown size={12} className="text-subtext shrink-0 group-hover:text-text transition-colors" />
      </button>

      <div className="px-3 py-2 border-b border-border flex flex-col gap-2">
        <EnvSwitcher />
        <SearchBar />
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <Section
          icon={<Folder size={12} />}
          label="Collections"
          action={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={openPasteCurl}
                className="text-subtext hover:text-blue transition-colors p-1 rounded-sm"
                aria-label="Paste cURL"
                title="Paste cURL command"
              >
                <Terminal size={12} />
              </button>
              <button
                type="button"
                onClick={openImport}
                className="text-subtext hover:text-blue transition-colors p-1 rounded-sm"
                aria-label="Import Postman collection"
                title="Import Postman v2.1 collection"
              >
                <Download size={12} />
              </button>
            </div>
          }
        >
          <CollectionsTree />
        </Section>

        <Section icon={<HistoryIcon size={12} />} label="History">
          <HistoryList />
        </Section>
      </nav>

      <GitPanel />

      <button
        type="button"
        onClick={openSettings}
        className="border-t border-border h-[44px] px-3 flex items-center gap-2 hover:bg-cardHover transition-colors text-left"
      >
        <div className="w-[24px] h-[24px] rounded-full bg-blue/15 flex items-center justify-center text-blue shrink-0">
          <User size={12} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-12 text-text truncate">
            {profile?.name?.trim() || "Set up profile"}
          </div>
          <div className="text-11 text-subtext truncate">
            {profile && profile.requestCount > 0
              ? `${profile.requestCount} request${profile.requestCount === 1 ? "" : "s"} sent`
              : "Welcome to Flux"}
          </div>
        </div>
        <Settings size={12} className="text-subtext shrink-0" />
      </button>
    </aside>
  );
}

function Section({
  icon,
  label,
  action,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="pb-3">
      <div className="px-3 py-2 flex items-center justify-between text-subtext text-11 font-semibold uppercase tracking-wider">
        <span className="flex items-center gap-2">
          {icon}
          <span>{label}</span>
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}
