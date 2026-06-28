import { useEffect, useState } from "react";
import { ArrowLeftRight, Book, ChevronDown, ChevronRight, Download, FileCode2, FileEdit, Folder, GitPullRequest, History as HistoryIcon, Moon, Rocket, Settings, Shield, Sun, Terminal, User, Users, Radio, Webhook, Code2, Server, ScanEye } from "lucide-react";
import reqitLogo from "../../assets/images/reqitlogo.jpeg";
import { useWorkspaceStore } from "@/features/workspace/stores/useWorkspaceStore";
import { cn } from "@/shared/lib/cn";
import { CollectionsTree } from "@/features/collections/components/CollectionsTree";
import { HistoryList } from "@/features/history/components/HistoryList";
import { EnvSwitcher } from "@/features/env/components/EnvSwitcher";
import { SearchBar } from "@/features/collections/components/SearchBar";
import { useUIStore } from "@/app/stores/useUIStore";
import { useProfileStore } from "@/app/stores/useProfileStore";
import { useThemeStore } from "@/shared/lib/useTheme";
import { GetGitStatus } from "../../../wailsjs/go/main/App";

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full h-[30px] px-3 flex items-center gap-2.5 rounded-lg text-12 transition-all",
        active
          ? "bg-cyan/10 text-cyan font-semibold"
          : "text-subtext hover:text-text hover:bg-cardHover",
      )}
    >
      {icon}
      <span>{label}</span>
      {active && <span className="ml-auto text-10 text-cyan/60">active</span>}
    </button>
  );
}

function CollapsibleSection({
  label,
  defaultOpen,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-[26px] px-3 flex items-center gap-1.5 text-11 font-semibold uppercase tracking-wider text-subtext/60 hover:text-subtext transition-colors"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span>{label}</span>
      </button>
      {open && <div className="flex flex-col gap-px mt-0.5 mb-1">{children}</div>}
    </div>
  );
}

export function Sidebar({ onGoHome }: { onGoHome: () => void }) {
  const openImport = useUIStore((s) => s.openImportModal);
  const openPasteCurl = useUIStore((s) => s.openPasteCurlModal);
  const openSettings = useUIStore((s) => s.openSettingsModal);
  const openTeam = useUIStore((s) => s.openTeamModal);
  const openDevProfile = useUIStore((s) => s.openDevProfileModal);
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);
  const profile = useProfileStore((s) => s.profile);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeID = useWorkspaceStore((s) => s.activeID);
  const activeWs = workspaces.find((w) => w.id === activeID);

  const [hasChanges, setHasChanges] = useState(false);
  const theme = useThemeStore((s) => s.resolved);
  const toggleTheme = useThemeStore((s) => s.toggle);
  useEffect(() => {
    GetGitStatus().then((s: { hasChanges: boolean }) => setHasChanges(s.hasChanges)).catch(() => {});
  }, []);

  return (
    <aside data-scope="sidebar" className="w-[240px] shrink-0 h-full bg-surface border-r border-border flex flex-col">
      <button
        type="button"
        onClick={onGoHome}
        className="h-[48px] px-4 flex items-center gap-2 border-b border-border hover:bg-cardHover transition-colors text-left group"
        title="All workspaces"
      >
        <img src={reqitLogo} alt="reqit" className="h-[28px] w-auto object-contain shrink-0" />
        <span className="flex-1 text-12 font-semibold text-text truncate min-w-0">
          {activeWs?.name ?? "Workspace"}
        </span>
        <ChevronDown size={12} className="text-subtext shrink-0 group-hover:text-text transition-colors" />
      </button>

      <div className="px-3 py-2 border-b border-border flex flex-col gap-2">
        <EnvSwitcher />
        <SearchBar />
      </div>

      {/* ===== COLLECTIONS + HISTORY (PRIME REAL ESTATE) ===== */}
      <nav className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        <Section
          icon={<Folder size={12} />}
          label="Collections"
          action={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={openPasteCurl}
                className="text-subtext hover:text-cyan transition-colors p-1 rounded-sm"
                aria-label="Paste cURL"
                title="Paste cURL command"
              >
                <Terminal size={12} />
              </button>
              <button
                type="button"
                onClick={openImport}
                className="text-subtext hover:text-cyan transition-colors p-1 rounded-sm"
                aria-label="Import Postman collection"
                title="Import Postman v2.1 collection"
              >
                <Download size={12} />
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { PickFile, ImportOpenAPI } = await import("../../../wailsjs/go/main/App");
                  const path = await PickFile("Select OpenAPI spec", "*.yaml;*.yml;*.json");
                  if (!path) return;
                  const { toast } = await import("@/app/stores/useToastStore");
                  try {
                    const result = await ImportOpenAPI(path);
                    toast.success(`Imported ${result.endpoints} endpoints from "${result.specTitle}"`);
                  } catch (e) {
                    toast.error(String(e));
                  }
                }}
                className="text-subtext hover:text-cyan transition-colors p-1 rounded-sm"
                aria-label="Import OpenAPI spec"
                title="Import OpenAPI spec as collections"
              >
                <FileCode2 size={12} />
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

      {/* ===== FIXED TOOLS (ALWAYS VISIBLE) ===== */}
      <div className="border-t border-border shrink-0 max-h-[40vh] overflow-y-auto">
        <CollapsibleSection label="Tools" defaultOpen={false}>
          <NavItem
            icon={<Radio size={13} />}
            label="WebSocket / SSE"
            active={view === "socket"}
            onClick={() => setView(view === "socket" ? "http" : "socket")}
          />
          <NavItem
            icon={<Code2 size={13} />}
            label="GraphQL"
            active={view === "graphql"}
            onClick={() => setView(view === "graphql" ? "http" : "graphql")}
          />
          <NavItem
            icon={<Server size={13} />}
            label="gRPC"
            active={view === "grpc"}
            onClick={() => setView(view === "grpc" ? "http" : "grpc")}
          />
          <NavItem
            icon={<FileEdit size={13} />}
            label="API Designer"
            active={view === "spec"}
            onClick={() => setView(view === "spec" ? "http" : "spec")}
          />
          <NavItem
            icon={<Book size={13} />}
            label="API Reference"
            active={view === "docs"}
            onClick={() => setView(view === "docs" ? "http" : "docs")}
          />
          <NavItem
            icon={<GitPullRequest size={13} />}
            label="Git & PR Preview"
            active={view === "pr"}
            onClick={() => setView(view === "pr" ? "http" : "pr")}
          />
          <NavItem
            icon={<Webhook size={13} />}
            label="Interceptor"
            active={view === "interceptor"}
            onClick={() => setView(view === "interceptor" ? "http" : "interceptor")}
          />
          <NavItem
            icon={<Shield size={13} />}
            label="Security"
            active={view === "security"}
            onClick={() => setView(view === "security" ? "http" : "security")}
          />
          <NavItem
            icon={<Download size={13} />}
            label="Integrations"
            active={view === "integrations"}
            onClick={() => setView(view === "integrations" ? "http" : "integrations")}
          />
          <NavItem
            icon={<ArrowLeftRight size={13} />}
            label="Migration"
            active={view === "migration"}
            onClick={() => setView(view === "migration" ? "http" : "migration")}
          />
          <NavItem
            icon={<ScanEye size={13} />}
            label="Agent Lens"
            active={view === "agentlens"}
            onClick={() => setView(view === "agentlens" ? "http" : "agentlens")}
          />
          <NavItem
            icon={<Rocket size={13} />}
            label="Growth"
            active={view === "growth"}
            onClick={() => setView(view === "growth" ? "http" : "growth")}
          />
        </CollapsibleSection>
      </div>

      {/* ===== STICKY BOTTOM: TEAM + PROFILE + SETTINGS ===== */}
      <div className="border-t border-border shrink-0">
        <button
          type="button"
          onClick={openTeam}
          className="w-full h-[36px] px-3 flex items-center gap-2 hover:bg-cardHover transition-colors text-left group"
          title="Team — invite members, sync, commit"
        >
          <div className="w-[22px] h-[22px] rounded-full bg-cyan/15 flex items-center justify-center text-cyan shrink-0 relative">
            <Users size={11} />
            {hasChanges && (
              <span className="absolute -top-0.5 -right-0.5 w-[6px] h-[6px] rounded-full bg-amber-400 border border-surface" />
            )}
          </div>
          <span className="text-12 text-subtext group-hover:text-text transition-colors">Team</span>
          <span className="ml-auto text-10 text-subtext/50 group-hover:text-subtext transition-colors">Invite · Sync</span>
        </button>

        <button
          type="button"
          onClick={openDevProfile}
          className="w-full h-[36px] px-3 flex items-center gap-2 hover:bg-cardHover transition-colors text-left group"
          title="Dev Profile — your public developer profile"
        >
          <div className="w-[22px] h-[22px] rounded-full bg-purple-500/15 flex items-center justify-center text-purple-400 shrink-0">
            <Code2 size={11} />
          </div>
          <span className="text-12 text-subtext group-hover:text-text transition-colors">Dev Profile</span>
          <span className="ml-auto text-10 text-subtext/50 group-hover:text-subtext transition-colors">Public URL</span>
        </button>

        <button
          type="button"
          onClick={openSettings}
          className="w-full h-[40px] px-3 flex items-center gap-2 hover:bg-cardHover transition-colors text-left"
        >
          <div className="w-[22px] h-[22px] rounded-full bg-cyan/15 flex items-center justify-center text-cyan shrink-0">
            <User size={11} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-12 text-text truncate">
              {profile?.name?.trim() || "Set up profile"}
            </div>
            <div className="text-11 text-subtext truncate">
              {profile && profile.requestCount > 0
                ? `${profile.requestCount} request${profile.requestCount === 1 ? "" : "s"} sent`
                : "Welcome to reqit"}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center w-[20px] h-[20px] text-subtext hover:text-text transition-colors shrink-0 mr-1"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
          </button>
          <Settings size={12} className="text-subtext shrink-0" />
        </button>
      </div>
    </aside>
  );
}

function Section({
  icon,
  label,
  action,
  children,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`pb-2 ${className ?? ""}`.trim()}>
      <div className="px-3 py-1.5 flex items-center justify-between text-subtext text-11 font-semibold uppercase tracking-wider">
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
