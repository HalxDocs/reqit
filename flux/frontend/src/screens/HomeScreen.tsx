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
  Book01Icon,
  EyeIcon,
  CookieIcon,
  ContractsIcon,
  FileCodeIcon,
  ServerStack01Icon,
  Download01Icon,
  Clock01Icon,
  Search01Icon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
import { useWorkspaceStore } from "../stores/useWorkspaceStore";
import { useTabsStore } from "../stores/useTabsStore";
import { CreateWorkspaceModal } from "../components/modals/CreateWorkspaceModal";
import { PickFolder } from "../../wailsjs/go/main/App";
import { toast } from "../stores/useToastStore";
import reqitLogo from "../assets/images/reqitloo.jpeg";
import type { workspaces } from "../../wailsjs/go/models";

const GITHUB_URL = "https://github.com/HalxDocs/reqit";
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

const DOC_SECTIONS = [
  {
    id: "workspaces",
    icon: FolderLibraryIcon,
    color: "#3B82F6",
    title: "Workspaces",
    subtitle: "Project-level organisation",
    features: [
      { name: "Create a workspace", desc: "Start a new workspace with a name, accent colour, and optional description. Each workspace is a plain folder on your disk — no database, no cloud." },
      { name: "Open from folder", desc: "Already have an API folder? Point reqit at it. Collection data lives in a .flux/ subdirectory inside the folder you pick." },
      { name: "Switch workspaces", desc: "Jump between projects instantly from the home screen. Each workspace remembers its own open tabs, active environment, and cookie jar." },
      { name: "Cloud sync (no account)", desc: "Drop the workspace folder into Dropbox, OneDrive, or Google Drive. On any other device, open reqit → Open folder → pick the synced directory. Done." },
    ],
  },
  {
    id: "collections",
    icon: LayersIcon,
    color: "#8B5CF6",
    title: "Collections",
    subtitle: "Organise and share requests",
    features: [
      { name: "Create & rename", desc: "Group requests into named collections. Click the pencil icon on any collection or request to rename it inline without leaving the sidebar." },
      { name: "Duplicate requests", desc: "Copy any saved request with one click. Useful for creating variants (e.g. auth vs. no-auth) without starting from scratch." },
      { name: "Delete", desc: "Remove a request or an entire collection with a confirmation prompt. Deletions are permanent — back up important work with the export feature." },
      { name: "Export as JSON", desc: "Export any collection as a portable .flux.json file. Share it with teammates or import it into another reqit workspace." },
    ],
  },
  {
    id: "request-builder",
    icon: ArrowDataTransferHorizontalIcon,
    color: "#06B6D4",
    title: "Request Builder",
    subtitle: "Compose any HTTP request",
    features: [
      { name: "HTTP methods", desc: "Full support for GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS. Select the method from the dropdown left of the URL bar." },
      { name: "URL bar", desc: "Type or paste any URL. {{VARIABLES}} are resolved live. Press Ctrl+Enter to send immediately without touching the mouse." },
      { name: "Query params", desc: "Add, remove, and toggle query parameters in a table. Disabled rows are excluded from the request without deleting them." },
      { name: "Headers", desc: "Set any request header with name/value pairs. Toggle headers on/off individually. Common headers like Content-Type are pre-suggested." },
      { name: "Body", desc: "Send JSON (syntax-highlighted editor), form-urlencoded, multipart/form-data, or raw text. The JSON editor auto-formats on paste." },
      { name: "URL preview", desc: "A live preview bar shows the fully expanded URL — with all query params appended and variables resolved — before you send." },
    ],
  },
  {
    id: "environments",
    icon: GlobalIcon,
    color: "#10B981",
    title: "Environments & Variables",
    subtitle: "Switch configs without editing requests",
    features: [
      { name: "Create environments", desc: "Define key/value pairs (e.g. base_url = https://api.prod.com). Create as many environments as you need: Dev, Staging, Production, etc." },
      { name: "{{VAR}} interpolation", desc: "Any {{VARIABLE}} in URLs, headers, body, or query params is automatically replaced with the active environment's value before the request is sent." },
      { name: "Env switcher", desc: "Switch the active environment from the sidebar dropdown in one click. All open tabs immediately reflect the new values." },
      { name: "Secrets-safe", desc: "Store tokens and API keys in environment variables rather than hardcoding them. Share collection files without exposing credentials." },
    ],
  },
  {
    id: "auth",
    icon: ShieldKeyIcon,
    color: "#F59E0B",
    title: "Authentication",
    subtitle: "Auth flows handled for you",
    features: [
      { name: "Bearer token", desc: "Adds Authorization: Bearer <token> automatically. Reference environment variables (e.g. {{ACCESS_TOKEN}}) so you never paste tokens into request files." },
      { name: "Basic auth", desc: "Enter a username and password — reqit Base64-encodes them and sends Authorization: Basic ... on every request." },
      { name: "API key", desc: "Attach an API key to any header name you specify (e.g. X-API-Key). Supports environment variable references." },
    ],
  },
  {
    id: "response",
    icon: EyeIcon,
    color: "#3B82F6",
    title: "Response Viewer",
    subtitle: "Inspect what came back",
    features: [
      { name: "Status bar", desc: "Instant display of HTTP status code with colour coding (green 2xx, yellow 3xx, red 4xx/5xx), response time in ms, and payload size." },
      { name: "Body viewer", desc: "Syntax-highlighted JSON, XML, and HTML with pretty-printing and collapsible nodes. Switch to raw view for plain text responses." },
      { name: "Headers", desc: "All response headers in a clean table. Useful for inspecting cache-control, content-type, rate-limit, and CORS headers." },
      { name: "Cookies tab", desc: "See every cookie set by the response — name, value, domain, path, expiry, HttpOnly, and Secure flags — in a readable table." },
      { name: "One-click copy", desc: "Copy the entire response body to the clipboard with a single button click, no selection needed." },
      { name: "Save for Mock", desc: "Click Save for Mock to capture the live response. The mock server will replay it for that route from that point on." },
    ],
  },
  {
    id: "cookies",
    icon: CookieIcon,
    color: "#F97316",
    title: "Cookie Jar",
    subtitle: "Automatic session handling",
    features: [
      { name: "Auto-capture", desc: "Every Set-Cookie header in a response is stored automatically in the workspace's cookie jar — no configuration required." },
      { name: "Auto-replay", desc: "Stored cookies are sent on subsequent requests to matching domains, just like a real browser. Login once and keep testing authenticated routes." },
      { name: "Persistent across restarts", desc: "The cookie jar is saved as a JSON file in your workspace so sessions survive app restarts." },
      { name: "Inspect cookies", desc: "Open the Cookies tab on any response to see exactly which cookies are set and what their attributes are." },
    ],
  },
  {
    id: "contract-testing",
    icon: ContractsIcon,
    color: "#10B981",
    title: "Contract Testing",
    subtitle: "Validate responses against your OpenAPI spec",
    features: [
      { name: "Link an OpenAPI spec", desc: "In the collection ⋮ menu → Link OpenAPI Spec. Pick any .yaml, .yml, or .json spec file from within your workspace folder." },
      { name: "Auto-validation", desc: "After every request in that collection, reqit validates the response — status code, response body JSON schema, and headers — against the linked spec." },
      { name: "Contract badge", desc: "A green ✓ Contract OK badge or a red ✗ N violations badge appears in the status bar. You always know at a glance whether the API matches its contract." },
      { name: "Violation details", desc: "Click the badge to expand a panel listing each violation: layer (status / body / header), field path, and a human-readable error message." },
      { name: "Change or unlink", desc: "Switch to a different spec version or remove the link entirely from the collection ⋮ menu at any time." },
    ],
  },
  {
    id: "mock-server",
    icon: ServerStack01Icon,
    color: "#8B5CF6",
    title: "Local Mock Server",
    subtitle: "Serve fake APIs without a backend",
    features: [
      { name: "One-click start", desc: "Click Start in the Mock panel (toolbar) to launch a real HTTP server on localhost:4321 inside the reqit process. No external tools needed." },
      { name: "Saved response replay", desc: "After saving a response with Save for Mock, the mock server replays that exact body, status, and headers for matching requests." },
      { name: "Route parameter matching", desc: "Paths like /users/:id automatically match /users/123, /users/456, etc. — you don't need to register every ID explicitly." },
      { name: "Delay simulation", desc: "Add a delay (ms) to any route to test loading states, spinners, and timeout handling in your frontend." },
      { name: "Status override", desc: "Override the status code for any route independently from the saved body — force a 500 to test error states." },
      { name: "CORS enabled", desc: "The mock server includes permissive CORS headers so any browser-based frontend can call localhost:4321 without proxy configuration." },
    ],
  },
  {
    id: "codegen",
    icon: CodeIcon,
    color: "#06B6D4",
    title: "Code Generation",
    subtitle: "Copy-paste ready snippets",
    features: [
      { name: "cURL", desc: "Export any request as a ready-to-paste curl command with all headers, auth, query params, and body included." },
      { name: "JavaScript (fetch)", desc: "Generate a fetch() call with async/await, all headers set, and the body JSON-stringified." },
      { name: "Python (requests)", desc: "Generate a requests.get/post/...() snippet with headers dict and body — paste straight into a script or notebook." },
    ],
  },
  {
    id: "import",
    icon: Download01Icon,
    color: "#F59E0B",
    title: "Import",
    subtitle: "Bring your existing work in",
    features: [
      { name: "Postman v2.1", desc: "Import any Postman collection JSON (v2.1 format). All requests, folders, headers, auth, and bodies are preserved and placed into a new collection." },
      { name: "Paste cURL", desc: "Paste any curl command (including -H headers, -d body, and --user auth) and reqit parses it into a fully configured request tab instantly." },
    ],
  },
  {
    id: "git",
    icon: GitBranchIcon,
    color: "#EC4899",
    title: "Git & Collaboration",
    subtitle: "Version-control your API layer",
    features: [
      { name: "Plain JSON format", desc: "All collections are human-readable JSON files — no binary blobs, no proprietary encoding. Diff them in any git client." },
      { name: "Commit alongside code", desc: "Workspace folders can live inside your project repo. Track API changes alongside the code that implements them." },
      { name: "Git panel", desc: "View the current git status of your workspace directory from the sidebar Git tab without switching to a terminal." },
      { name: "Team collaboration", desc: "Branch workspaces like you branch code. Teammates can make API changes in a PR and you can review the JSON diff alongside the code diff." },
    ],
  },
  {
    id: "history",
    icon: Clock01Icon,
    color: "#6366F1",
    title: "Request History",
    subtitle: "Never lose a request you sent",
    features: [
      { name: "Auto-logged", desc: "Every request you send is automatically added to a history list in the sidebar — no manual saving required." },
      { name: "One-click replay", desc: "Click any history entry to open it in a new tab with the method, URL, headers, and body fully restored." },
    ],
  },
  {
    id: "search",
    icon: Search01Icon,
    color: "#3B82F6",
    title: "Search & Filter",
    subtitle: "Find anything fast",
    features: [
      { name: "Sidebar filter", desc: "Type in the search bar above the collections tree to instantly filter by collection name or request name." },
      { name: "Live results", desc: "Results narrow as you type — no need to press Enter. Collections with no matching requests are hidden automatically." },
    ],
  },
  {
    id: "updates",
    icon: Refresh01Icon,
    color: "#10B981",
    title: "Auto-updates",
    subtitle: "Always on the latest version",
    features: [
      { name: "Startup check", desc: "reqit silently checks the GitHub releases API each time it starts. The check is non-blocking and fails gracefully when offline." },
      { name: "Update banner", desc: "If a newer version is found, a dismissible banner appears at the top of the app showing the new version number and a direct download link." },
      { name: "No forced updates", desc: "The banner is informational only. Dismiss it and carry on — reqit never auto-downloads or auto-installs without your action." },
    ],
  },
  {
    id: "shortcuts",
    icon: KeyboardIcon,
    color: "#8B5CF6",
    title: "Keyboard Shortcuts",
    subtitle: "Stay in flow",
    features: [
      { name: "Ctrl + Enter", desc: "Send the current request immediately, no matter which field is focused." },
      { name: "Ctrl + S", desc: "Save the current request. Opens the Save dialog if the request hasn't been saved yet." },
      { name: "Ctrl + T", desc: "Open a new blank request tab." },
      { name: "Ctrl + W", desc: "Close the current tab." },
      { name: "Ctrl + E", desc: "Focus the URL bar and select all text — ready to type a new URL." },
      { name: "Ctrl + Shift + I", desc: "Open the Postman import dialog directly." },
    ],
  },
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

type View = "landing" | "workspaces" | "docs";

export function HomeScreen({ onEnter }: { onEnter: () => Promise<void> }) {
  const workspaceList = useWorkspaceStore((s) => s.workspaces);
  const switchWs = useWorkspaceStore((s) => s.switch);
  const openFromFolder = useWorkspaceStore((s) => s.openFromFolder);
  const resetTabs = useTabsStore((s) => s.resetTabs);
  const stars = useGitHubStars("HalxDocs/reqit");

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
          {(view === "workspaces" || view === "docs") && (
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
            onClick={() => setView("docs")}
            className="hidden sm:flex items-center gap-2 h-[32px] px-3 text-12 text-subtext bg-card border border-border rounded-lg hover:border-blue/40 hover:text-text transition-all"
          >
            <HugeiconsIcon icon={Book01Icon} size={13} color="currentColor" />
            <span>Docs</span>
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
        {view === "landing" && (
          <LandingView
            onGoToWorkspaces={() => setView("workspaces")}
            onGoDocs={() => setView("docs")}
            stars={stars}
          />
        )}
        {view === "workspaces" && (
          <WorkspacesView
            workspaces={workspaceList}
            switching={switching}
            onOpen={handleOpen}
            onCreate={() => setCreateOpen(true)}
          />
        )}
        {view === "docs" && <DocsView />}
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
  onGoDocs,
  stars,
}: {
  onGoToWorkspaces: () => void;
  onGoDocs: () => void;
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

        <div className="flex items-center gap-3 flex-wrap justify-center">
          <button
            type="button"
            onClick={onGoToWorkspaces}
            className="flex items-center gap-3 h-[44px] sm:h-[46px] px-6 sm:px-7 text-13 sm:text-14 font-bold text-white bg-blue hover:bg-blue-hover rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue/20"
          >
            <span>Open workspaces</span>
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} color="currentColor" />
          </button>
          <button
            type="button"
            onClick={onGoDocs}
            className="flex items-center gap-2 h-[44px] sm:h-[46px] px-5 text-13 sm:text-14 font-semibold text-subtext hover:text-text bg-card border border-border hover:border-blue/40 rounded-xl transition-all"
          >
            <HugeiconsIcon icon={Book01Icon} size={15} color="currentColor" />
            <span>View all features</span>
          </button>
        </div>

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

function DocsView() {
  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-12">
      {/* Page header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Book01Icon} size={18} color="#3B82F6" strokeWidth={1.5} />
          <h1
            className="text-26 sm:text-30 font-bold text-text tracking-tight"
            style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
          >
            Documentation
          </h1>
        </div>
        <p className="text-13 text-subtext max-w-[480px] leading-relaxed">
          Every feature in reqit — what it does, how it works, and why it's there.
        </p>
      </div>

      {/* Quick-nav pills */}
      <div className="flex flex-wrap gap-2">
        {DOC_SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="inline-flex items-center gap-1.5 h-[26px] px-2.5 text-11 font-semibold rounded-full border border-border bg-card hover:border-blue/40 hover:text-text text-subtext transition-all"
            style={{ scrollBehavior: "smooth" }}
          >
            <HugeiconsIcon icon={s.icon} size={11} color={s.color} strokeWidth={1.5} />
            {s.title}
          </a>
        ))}
      </div>

      {/* Sections */}
      {DOC_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="flex flex-col gap-5">
          {/* Section heading */}
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <div
              className="w-[34px] h-[34px] rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: section.color + "18" }}
            >
              <HugeiconsIcon icon={section.icon} size={16} color={section.color} strokeWidth={1.5} />
            </div>
            <div>
              <div
                className="text-15 font-bold text-text leading-tight"
                style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
              >
                {section.title}
              </div>
              <div className="text-11 text-subtext mt-0.5">{section.subtitle}</div>
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {section.features.map((f) => (
              <div
                key={f.name}
                className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1.5 hover:border-blue/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-[6px] h-[6px] rounded-full shrink-0"
                    style={{ backgroundColor: section.color }}
                  />
                  <span className="text-12 font-semibold text-text">{f.name}</span>
                </div>
                <p className="text-11 text-subtext leading-relaxed pl-[14px]">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Footer */}
      <footer className="flex flex-col items-center gap-2 pt-4 pb-4 border-t border-border">
        <p className="text-11 text-subtext text-center">
          Missing something?{" "}
          <button
            type="button"
            onClick={() => openExternal("https://github.com/HalxDocs/reqit/issues")}
            className="text-blue hover:underline"
          >
            Open an issue on GitHub
          </button>
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
