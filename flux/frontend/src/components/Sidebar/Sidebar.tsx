import { Download, Folder, Globe, History as HistoryIcon, Settings } from "lucide-react";
import { CollectionsTree } from "./CollectionsTree";
import { HistoryList } from "./HistoryList";
import { EnvSwitcher } from "./EnvSwitcher";
import { useUIStore } from "../../stores/useUIStore";

export function Sidebar() {
  const openImport = useUIStore((s) => s.openImportModal);

  return (
    <aside className="w-[240px] shrink-0 h-full bg-surface border-r border-border flex flex-col">
      <div className="h-[48px] px-4 flex items-center justify-between border-b border-border">
        <span className="font-extrabold text-20 text-violet tracking-tight">FLUX</span>
      </div>

      <div className="px-3 py-2 border-b border-border">
        <EnvSwitcher />
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <Section
          icon={<Folder size={12} />}
          label="Collections"
          action={
            <button
              type="button"
              onClick={openImport}
              className="text-subtext hover:text-violet transition-colors p-1 rounded-sm"
              aria-label="Import Postman collection"
              title="Import Postman v2.1 collection"
            >
              <Download size={12} />
            </button>
          }
        >
          <CollectionsTree />
        </Section>

        <Section icon={<Globe size={12} />} label="Environments">
          <ManageEnvsButton />
        </Section>

        <Section icon={<HistoryIcon size={12} />} label="History">
          <HistoryList />
        </Section>
      </nav>

      <div className="border-t border-border h-[40px] px-3 flex items-center">
        <button
          type="button"
          className="flex items-center gap-2 text-subtext hover:text-text transition-colors"
        >
          <Settings size={14} />
          <span className="text-12">Settings</span>
        </button>
      </div>
    </aside>
  );
}

function ManageEnvsButton() {
  const open = useUIStore((s) => s.openEnvModal);
  return (
    <button
      type="button"
      onClick={open}
      className="w-full text-left px-3 py-1.5 text-12 text-subtext hover:text-text hover:bg-cardHover transition-colors"
    >
      Manage environments…
    </button>
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
