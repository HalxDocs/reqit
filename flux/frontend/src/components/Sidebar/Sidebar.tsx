import { Folder, Globe, History, Settings } from "lucide-react";

export function Sidebar() {
  return (
    <aside className="w-[240px] shrink-0 h-full bg-surface border-r border-border flex flex-col">
      <div className="h-[48px] px-4 flex items-center border-b border-border">
        <span className="font-extrabold text-20 text-violet tracking-tight">FLUX</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <SidebarSection icon={<Folder size={14} />} label="Collections" />
        <SidebarSection icon={<Globe size={14} />} label="Environments" />
        <SidebarSection icon={<History size={14} />} label="History" />
      </nav>

      <div className="border-t border-border h-[40px] px-3 flex items-center justify-between">
        <button className="flex items-center gap-2 text-subtext hover:text-text transition-colors">
          <Settings size={14} />
          <span className="text-12">Settings</span>
        </button>
      </div>
    </aside>
  );
}

function SidebarSection({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2 text-subtext text-11 font-semibold uppercase tracking-wider">
        {icon}
        <span>{label}</span>
      </div>
    </div>
  );
}
