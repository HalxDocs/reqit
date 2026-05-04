import { useState, useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  CodeIcon,
  DatabaseIcon,
  FolderLibraryIcon,
  FolderOpenIcon,
  GitBranchIcon,
  GlobalIcon,
  LayersIcon,
  PlusSignIcon,
  ArrowLeft01Icon,
  ShieldKeyIcon,
  ArrowDataTransferHorizontalIcon,
  ComputerTerminal01Icon,
  KeyboardIcon,
  Layers01Icon,
  GithubIcon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
import { useWorkspaceStore } from "../stores/useWorkspaceStore";
import { useTabsStore } from "../stores/useTabsStore";
import { CreateWorkspaceModal } from "../components/modals/CreateWorkspaceModal";
import { PickFolder } from "../../wailsjs/go/main/App";
import { toast } from "../stores/useToastStore";
import reqitLogo from "../assets/images/reqitloo.jpeg";
import type { workspaces } from "../../wailsjs/go/models";

const GITHUB_URL = "https://github.com/HalxDocs/flux";
const PORTFOLIO_URL = "https://halxdocs.com";

function openExternal(url: string) {
  try {
    BrowserOpenURL(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function useGitHubStars(repo: string) {
  const [stars, setStars] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStars = async () => {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: { Accept: "application/vnd.github.v3+json" },
      });
      if (!res.ok) return;
      const data = await res.json() as { stargazers_count: number };
      setStars(data.stargazers_count);
    } catch {
      // network unavailable — keep showing whatever we have
    }
  };

  useEffect(() => {
    void fetchStars();
    timerRef.current = setInterval(() => void fetchStars(), 60_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  return stars;
}

function fmtStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const STEPS = [
  {
    number: "01",
    icon: FolderLibraryIcon,
    title: "Create a workspace",
    desc: "Group API collections by project. Each workspace is a plain folder you own — no lock-in.",
  },
  {
    number: "02",
    icon: PlusSignIcon,
    title: "Build your collection",
    desc: "Import from Postman, paste a cURL, or craft requests from scratch with full auth support.",
  },
  {
    number: "03",
    icon: ArrowRight01Icon,
    title: "Send & inspect",
    desc: "Fire requests and get instant results with pretty-printed JSON, XML, and HTML.",
  },
];

const FEATURES = [
  { icon: DatabaseIcon, title: "Local-first", desc: "Plain JSON files on your machine. No cloud required." },
  { icon: ArrowDataTransferHorizontalIcon, title: "Cross-device sync", desc: "Drop the folder into Dropbox or Drive." },
  { icon: CodeIcon, title: "Code generation", desc: "Export as cURL, JavaScript fetch, or Python." },
  { icon: LayersIcon, title: "Postman import", desc: "Drop in a v2.1 collection instantly." },
  { icon: ShieldKeyIcon, title: "Auth support", desc: "Bearer, Basic, and API Key via env variables." },
  { icon: GlobalIcon, title: "Environments", desc: "{{VAR}} interpolation across every field." },
  { icon: GitBranchIcon, title: "Git-friendly", desc: "Readable JSON — commit your workspace to git." },
  { icon: ComputerTerminal01Icon, title: "No lock-in", desc: "Own your data. Export, move, or delete anytime." },
];

const SHORTCUTS = [
  { keys: ["Ctrl", "Enter"], desc: "Send request" },
  { keys: ["Ctrl", "S"], desc: "Save request" },
  { keys: ["Ctrl", "T"], desc: "New tab" },
  { keys: ["Ctrl", "W"], desc: "Close tab" },
  { keys: ["Ctrl", "E"], desc: "Focus URL bar" },
  { keys: ["Ctrl", "Shift", "I"], desc: "Import Postman collection" },
];

function fmtDate(iso: string): string {
  if (!iso) return "Never opened";
  try {
    const d = new Date(iso);
    const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diffDays === 0) return "Opened today";
    if (diffDays === 1) return "Opened yesterday";
    if (diffDays < 7) return `Opened ${diffDays} days ago`;
    return `Opened ${d.toLocaleDateString()}`;
  } catch {
    return "";
  }
}

function WorkspaceCard({
  ws,
  onOpen,
  busy,
}: {
  ws: workspaces.Info;
  onOpen: (id: string) => void;
  busy: boolean;
}) {
  const initials = ws.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      type="button"
      onClick={() => !busy && onOpen(ws.id)}
      disabled={busy}
      className="group text-left bg-card border border-border rounded-2xl overflow-hidden hover:border-blue/50 hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue disabled:opacity-60"
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: ws.color || "#3B82F6" }} />
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div
            className="w-[44px] h-[44px] rounded-xl flex items-center justify-center text-white text-14 font-bold shrink-0"
            style={{ backgroundColor: ws.color || "#3B82F6" }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="text-14 font-semibold text-text truncate leading-tight">{ws.name}</div>
            {ws.description && (
              <div className="text-12 text-subtext truncate mt-0.5">{ws.description}</div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-11 text-subtext">{fmtDate(ws.lastOpenedAt)}</span>
          <span
            className="flex items-center gap-1 text-11 font-semibold px-2 py-0.5 rounded-full transition-all group-hover:scale-105"
            style={{
              color: ws.color || "#3B82F6",
              backgroundColor: (ws.color || "#3B82F6") + "22",
            }}
          >
            Open
            <HugeiconsIcon icon={ArrowRight01Icon} size={10} color="currentColor" />
          </span>
        </div>
      </div>
    </button>
  );
}

type View = "landing" | "workspaces";

export function HomeScreen({ onEnter }: { onEnter: () => Promise<void> }) {
  const workspaceList = useWorkspaceStore((s) => s.workspaces);
  const switchWs = useWorkspaceStore((s) => s.switch);
  const openFromFolder = useWorkspaceStore((s) => s.openFromFolder);
  const resetTabs = useTabsStore((s) => s.resetTabs);
  const stars = useGitHubStars("HalxDocs/flux");

  const [view, setView] = useState<View>("landing");
  const [createOpen, setCreateOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const handleOpen = async (id: string) => {
    setSwitching(id);
    try {
      await switchWs(id);
      resetTabs();
      await onEnter();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open workspace");
      setSwitching(null);
    }
  };

  const handleOpenFolder = async () => {
    try {
      const dir = await PickFolder("Select workspace folder");
      if (!dir) return;
      const info = await openFromFolder(dir);
      await handleOpen(info.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open folder");
    }
  };

  return (
    <div className="h-screen w-screen bg-bg flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="h-[56px] px-4 sm:px-6 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          {view === "workspaces" && (
            <button
              type="button"
              onClick={() => setView("landing")}
              className="flex items-center gap-1.5 text-12 text-subtext hover:text-text transition-colors mr-1"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={14} color="currentColor" />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
          <img src={reqitLogo} alt="reqit" className="h-[28px] sm:h-[32px] w-auto object-contain" />
        </div>
        <div className="flex items-center gap-2">
          {/* GitHub stars */}
          <button
            type="button"
            onClick={() => openExternal(GITHUB_URL)}
            className="hidden sm:flex items-center gap-1.5 h-[30px] px-2.5 text-12 text-subtext bg-card border border-border rounded-lg hover:border-blue/40 hover:text-text transition-all"
            title="Star on GitHub"
          >
            <HugeiconsIcon icon={GithubIcon} size={13} color="currentColor" />
            <HugeiconsIcon icon={StarIcon} size={11} color="#f0a500" strokeWidth={2} />
            <span className="font-mono text-11 min-w-[24px] text-center">
              {stars === null ? "—" : fmtStars(stars)}
            </span>
          </button>
          <button
            type="button"
            onClick={handleOpenFolder}
            className="hidden sm:flex items-center gap-2 h-[32px] px-3 text-12 text-subtext bg-card border border-border rounded-lg hover:border-blue/40 hover:text-text transition-all"
          >
            <HugeiconsIcon icon={FolderOpenIcon} size={13} color="currentColor" />
            <span>Open folder</span>
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 h-[32px] px-3 sm:px-4 text-12 font-bold text-white bg-blue hover:bg-blue-hover rounded-lg transition-colors"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={13} color="currentColor" />
            <span className="hidden sm:inline">New workspace</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {view === "landing" ? (
          <LandingView
            onGoToWorkspaces={() => setView("workspaces")}
            stars={stars}
          />
        ) : (
          <WorkspacesView
            workspaces={workspaceList}
            switching={switching}
            onOpen={handleOpen}
            onCreate={() => setCreateOpen(true)}
          />
        )}
      </main>

      <CreateWorkspaceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onEnter={onEnter}
      />
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center h-[20px] px-1.5 bg-surface border border-border rounded text-[10px] font-mono text-subtext leading-none">
      {children}
    </span>
  );
}

function LandingView({
  onGoToWorkspaces,
  stars,
}: {
  onGoToWorkspaces: () => void;
  stars: number | null;
}) {
  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-12 sm:gap-16">

      {/* Hero */}
      <section className="flex flex-col items-center text-center gap-5 sm:gap-6">
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue/10 border border-blue/20 rounded-full text-[10px] text-blue font-semibold tracking-[0.12em] uppercase">
            Local-first · No account · No telemetry
          </div>
          {/* GitHub badge */}
          <button
            type="button"
            onClick={() => openExternal(GITHUB_URL)}
            className="sm:hidden inline-flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border rounded-full text-[10px] text-subtext hover:text-text hover:border-blue/40 transition-all"
          >
            <HugeiconsIcon icon={GithubIcon} size={11} color="currentColor" />
            <HugeiconsIcon icon={StarIcon} size={10} color="#f0a500" strokeWidth={2} />
            <span className="font-mono">{stars === null ? "—" : fmtStars(stars)}</span>
          </button>
        </div>

        <h1
          className="text-[38px] sm:text-48 font-bold text-text leading-[1.08] tracking-[-0.03em] max-w-[560px] sm:max-w-[620px]"
          style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
        >
          The API client built for{" "}
          <span className="text-blue">speed</span>.
        </h1>

        <p className="text-13 sm:text-15 text-subtext max-w-[380px] sm:max-w-[460px] leading-relaxed">
          Fast, open, and beautifully minimal. Your collections live as plain JSON —
          commit them, sync them, share them however you like.
        </p>

        <button
          type="button"
          onClick={onGoToWorkspaces}
          className="flex items-center gap-3 h-[44px] sm:h-[46px] px-6 sm:px-7 text-13 sm:text-14 font-bold text-white bg-blue hover:bg-blue-hover rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue/20"
        >
          <span>Open workspaces</span>
          <HugeiconsIcon icon={ArrowRight01Icon} size={16} color="currentColor" />
        </button>

        {/* Mobile download hint */}
        <p className="sm:hidden text-11 text-subtext/60 mt-1">
          Download reqit for the best experience on desktop
        </p>
      </section>

      {/* Steps */}
      <section className="flex flex-col gap-4 sm:gap-5">
        <p className="text-[10px] font-semibold text-subtext uppercase tracking-[0.14em] text-center">
          Get started in 30 seconds
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {STEPS.map((s) => (
            <div
              key={s.number}
              className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 hover:border-blue/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="w-[36px] h-[36px] rounded-xl bg-blue/10 flex items-center justify-center">
                  <HugeiconsIcon icon={s.icon} size={17} color="#3B82F6" strokeWidth={1.5} />
                </div>
                <span
                  className="text-22 font-bold tabular-nums"
                  style={{ color: "#2a2a2a", fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
                >
                  {s.number}
                </span>
              </div>
              <div>
                <div className="text-13 font-semibold text-text mb-1">{s.title}</div>
                <div className="text-12 text-subtext leading-relaxed">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="flex flex-col gap-4 sm:gap-5">
        <p className="text-[10px] font-semibold text-subtext uppercase tracking-[0.14em] text-center">
          Everything you need, nothing you don't
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2.5 hover:border-blue/30 transition-colors"
            >
              <HugeiconsIcon icon={f.icon} size={16} color="#3B82F6" strokeWidth={1.5} />
              <div>
                <div className="text-12 font-semibold text-text">{f.title}</div>
                <div className="text-11 text-subtext mt-0.5 leading-relaxed">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sync callout */}
      <section className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
        <div className="w-[40px] h-[40px] rounded-xl bg-teal/10 flex items-center justify-center shrink-0">
          <HugeiconsIcon icon={Layers01Icon} size={20} color="#06B6D4" strokeWidth={1.5} />
        </div>
        <div>
          <div className="text-13 font-semibold text-text mb-1">
            Sync to any device — no account needed
          </div>
          <div className="text-12 text-subtext leading-relaxed">
            Each workspace is just a folder. Drop it into Dropbox, OneDrive, or Google Drive and it
            syncs automatically. On your second device, open reqit → "Open folder" → pick the synced
            folder. Done. No login, no subscription, no data sent anywhere.
          </div>
        </div>
      </section>

      {/* Keyboard shortcuts */}
      <section className="flex flex-col gap-4 sm:gap-5">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={KeyboardIcon} size={14} color="#888888" strokeWidth={1.5} />
          <p className="text-[10px] font-semibold text-subtext uppercase tracking-[0.14em]">
            Keyboard shortcuts
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
          {SHORTCUTS.map((s) => (
            <div
              key={s.desc}
              className="flex items-center gap-3 py-2.5 border-b border-border/50"
            >
              <div className="flex items-center gap-1 shrink-0">
                {s.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </div>
              <span className="text-12 text-subtext">{s.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="flex flex-col items-center gap-2 pt-2 pb-4">
        <div className="w-[32px] h-px bg-border" />
        <p className="text-11 text-subtext text-center">
          Built by{" "}
          <button
            type="button"
            onClick={() => openExternal(PORTFOLIO_URL)}
            className="text-text font-semibold hover:text-blue transition-colors"
          >
            HalxDocs
          </button>
          {" "}·{" "}
          <button
            type="button"
            onClick={() => openExternal(GITHUB_URL)}
            className="inline-flex items-center gap-1 hover:text-text transition-colors"
          >
            <HugeiconsIcon icon={GithubIcon} size={11} color="currentColor" />
            Open source
          </button>
          {" "}· Local-first
        </p>
      </footer>
    </div>
  );
}

function WorkspacesView({
  workspaces: wsList,
  switching,
  onOpen,
  onCreate,
}: {
  workspaces: workspaces.Info[];
  switching: string | null;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-10">
      {wsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
          <div className="w-[64px] h-[64px] rounded-2xl bg-blue/10 flex items-center justify-center">
            <HugeiconsIcon icon={FolderLibraryIcon} size={32} color="#3B82F6" strokeWidth={1.5} />
          </div>
          <div>
            <div
              className="text-18 font-bold text-text"
              style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
            >
              No workspaces yet
            </div>
            <div className="text-13 text-subtext mt-1 max-w-[340px]">
              Create your first workspace to start organising your API collections.
            </div>
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-2 h-[40px] px-6 text-13 font-bold text-white bg-blue hover:bg-blue-hover rounded-xl transition-colors"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={15} color="currentColor" />
            Create workspace
          </button>
        </div>
      ) : (
        <>
          <h1
            className="text-22 font-bold text-text mb-6"
            style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
          >
            Your workspaces
          </h1>
          <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {wsList.map((ws) => (
              <div key={ws.id} className="relative">
                {switching === ws.id && (
                  <div className="absolute inset-0 z-10 bg-bg/70 rounded-2xl flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full border-2 border-blue border-t-transparent animate-spin" />
                  </div>
                )}
                <WorkspaceCard ws={ws} onOpen={onOpen} busy={switching !== null} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
