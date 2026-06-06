import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  CodeIcon,
  DatabaseIcon,
  FolderLibraryIcon,
  GitBranchIcon,
  GlobalIcon,
  LayersIcon,
  ShieldKeyIcon,
  ArrowDataTransferHorizontalIcon,
  ComputerTerminal01Icon,
  KeyboardIcon,
  Layers01Icon,
  GithubIcon,
  PlusSignIcon,
  Download02Icon,
  Book01Icon,
  ArrowLeft01Icon,
} from "@hugeicons/core-free-icons";
import { DOC_SECTIONS } from "../lib/docs";
import reqitLogo from "../assets/images/reqitloo.jpeg";

const GITHUB_URL = "https://github.com/HalxDocs/reqit";
const RELEASES_URL = "https://github.com/HalxDocs/reqit/releases/latest";
const PORTFOLIO_URL = "https://halxdocs.com";

const DL_BASE = "https://github.com/HalxDocs/reqit/releases/latest/download";
const DOWNLOAD_URLS: Record<string, string> = {
  windows: `${DL_BASE}/reqit-windows-amd64.exe`,
  mac: `${DL_BASE}/reqit-macos-universal.zip`,
  linux: `${DL_BASE}/reqit-linux-amd64`,
};

function getOS(): "windows" | "mac" | "linux" | "other" {
  const ua = navigator.userAgent;
  if (ua.includes("Win")) return "windows";
  if (ua.includes("Mac")) return "mac";
  if (ua.includes("Linux") || ua.includes("X11")) return "linux";
  return "other";
}

const OS_LABEL: Record<string, string> = {
  windows: "Download for Windows",
  mac: "Download for macOS",
  linux: "Download for Linux",
  other: "Download for Desktop",
};

function download() {
  const os = getOS();
  const url = DOWNLOAD_URLS[os] ?? RELEASES_URL;
  window.open(url, "_blank", "noopener,noreferrer");
}

function open(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function useGitHubStars(repo: string) {
  const [stars, setStars] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch_ = async () => {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: { Accept: "application/vnd.github.v3+json" },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { stargazers_count: number };
      setStars(data.stargazers_count);
    } catch {
      // network unavailable
    }
  };

  useEffect(() => {
    void fetch_();
    timer.current = setInterval(() => void fetch_(), 60_000);
    return () => { if (timer.current) clearInterval(timer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  return stars;
}

function fmtStars(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
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

function Kbd({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center h-[20px] px-1.5 bg-surface border border-border rounded text-[10px] font-mono text-subtext leading-none">
      {children}
    </span>
  );
}

function HomePage({ goToDocs }: { goToDocs: () => void }) {
  return (
    <>
      {/* Hero */}
      <section className="flex flex-col items-center text-center gap-5 sm:gap-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue/10 border border-blue/20 rounded-full text-[10px] text-blue font-semibold tracking-[0.12em] uppercase">
          Local-first · No account · No telemetry
        </div>

        <h1
          className="text-[38px] sm:text-48 font-bold text-text leading-[1.08] tracking-[-0.03em] max-w-[580px]"
          style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
        >
          The API client built for{" "}
          <span className="text-blue">speed</span>.
        </h1>

        <p className="text-13 sm:text-15 text-subtext max-w-[400px] sm:max-w-[460px] leading-relaxed">
          Fast, open, and beautifully minimal. Your collections live as plain JSON —
          commit them, sync them, share them however you like.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={download}
            className="flex items-center gap-3 h-[46px] px-7 text-14 font-bold text-white bg-blue hover:bg-blue-hover rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue/20"
          >
            <HugeiconsIcon icon={Download02Icon} size={16} color="currentColor" />
            <span>{OS_LABEL[getOS()]}</span>
          </button>
          <button
            type="button"
            onClick={() => open(GITHUB_URL)}
            className="flex items-center gap-2 h-[46px] px-5 text-13 text-subtext bg-card border border-border rounded-xl hover:border-blue/40 hover:text-text transition-all"
          >
            <HugeiconsIcon icon={GithubIcon} size={15} color="currentColor" />
            <span>View on GitHub</span>
          </button>
        </div>

        <p className="text-11 text-subtext/60">
          Available for Windows · macOS · Linux · Free &amp; open source
        </p>
      </section>

      {/* Support — prominent top section */}
      <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
        <div className="text-center sm:text-left shrink-0">
          <h2
            className="text-15 font-bold text-text"
            style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
          >
            Support reqit
          </h2>
          <p className="text-12 text-subtext mt-1">Choose your preferred platform</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full sm:w-auto">
          <a
            href="https://github.com/sponsors/HalxDocs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 h-[44px] px-5 text-13 font-bold text-white bg-blue hover:bg-blue-hover rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm shadow-blue/20 justify-center"
          >
            <HugeiconsIcon icon={GithubIcon} size={16} color="currentColor" />
            <span>GitHub Sponsors</span>
            <span className="text-11 font-normal opacity-70 bg-white/15 rounded-md px-2 py-0.5">International</span>
          </a>
          <a
            href="https://myhappr.xyz/halxdocs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 h-[44px] px-5 text-13 font-bold text-text bg-card border border-border hover:bg-surface rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
            <span>myhappr.xyz</span>
            <span className="text-11 font-normal opacity-70 bg-border/50 rounded-md px-2 py-0.5">Africa</span>
          </a>
        </div>
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
            Each workspace is just a folder. Drop it into Dropbox, OneDrive, or Google Drive
            and it syncs automatically. On your second device, open reqit → "Open folder" →
            pick the synced folder. Done. No login, no subscription, no data sent anywhere.
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
                {s.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
              </div>
              <span className="text-12 text-subtext">{s.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Download CTA */}
      <section className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center text-center gap-5">
        <h2
          className="text-22 font-bold text-text"
          style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
        >
          Ready to try reqit?
        </h2>
        <p className="text-13 text-subtext max-w-[380px] leading-relaxed">
          Free, open source, and always will be. No account needed — just download and run.
        </p>
        <button
          type="button"
          onClick={download}
          className="flex items-center gap-3 h-[46px] px-7 text-14 font-bold text-white bg-blue hover:bg-blue-hover rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue/20"
        >
          <HugeiconsIcon icon={Download02Icon} size={16} color="currentColor" />
          {OS_LABEL[getOS()]}
        </button>
        <p className="text-11 text-subtext/60">Windows · macOS · Linux</p>
      </section>
    </>
  );
}

function DocsPage({ goHome }: { goHome: () => void }) {
  return (
    <>
      {/* Docs header */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={goHome}
          className="flex items-center gap-1.5 h-[30px] px-2.5 text-12 text-subtext hover:text-text bg-card border border-border rounded-lg hover:border-blue/40 transition-all"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={13} color="currentColor" />
          <span>Back</span>
        </button>
      </div>

      {/* Documentation */}
      <section id="docs" className="flex flex-col gap-8 sm:gap-10 scroll-mt-20">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Book01Icon} size={18} color="#3B82F6" strokeWidth={1.5} />
            <h2
              className="text-22 sm:text-26 font-bold text-text tracking-tight"
              style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
            >
              Documentation
            </h2>
          </div>
          <p className="text-13 text-subtext max-w-[480px] leading-relaxed">
            Every feature in reqit — what it does, how it works, and why it's there.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {DOC_SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#docs-${s.id}`}
              className="inline-flex items-center gap-1.5 h-[26px] px-2.5 text-11 font-semibold rounded-full border border-border bg-card hover:border-blue/40 hover:text-text text-subtext transition-all"
            >
              {s.title}
            </a>
          ))}
        </div>

        {DOC_SECTIONS.map((section) => (
          <section key={section.id} id={`docs-${section.id}`} className="flex flex-col gap-5 scroll-mt-20">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {section.features.map((f) => (
                <div
                  key={f.name}
                  className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1.5 hover:border-blue/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-[6px] h-[6px] rounded-full bg-blue shrink-0" />
                    <span className="text-12 font-semibold text-text">{f.name}</span>
                  </div>
                  <p className="text-11 text-subtext leading-relaxed pl-[14px]">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        <footer className="flex flex-col items-center gap-2 pt-4 pb-4 border-t border-border">
          <p className="text-11 text-subtext text-center">
            Missing something?{" "}
            <button
              type="button"
              onClick={() => open("https://github.com/HalxDocs/reqit/issues")}
              className="text-blue hover:underline"
            >
              Open an issue on GitHub
            </button>
          </p>
        </footer>
      </section>
    </>
  );
}

export function WebApp() {
  const [page, setPage] = useState<"home" | "docs">("home");
  const stars = useGitHubStars("HalxDocs/reqit");

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur border-b border-border">
        <div className="max-w-[860px] mx-auto px-4 sm:px-6 h-[56px] flex items-center justify-between">
          <img src={reqitLogo} alt="reqit" className="h-[28px] sm:h-[32px] w-auto object-contain" />
          <div className="flex items-center gap-2">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 h-[30px] px-2.5 text-12 text-subtext bg-card border border-border rounded-lg hover:border-blue/40 hover:text-text transition-all"
            >
              <HugeiconsIcon icon={GithubIcon} size={13} color="currentColor" />
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#f0a500" stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span className="font-mono text-11 min-w-[22px] text-center tabular-nums">
                {stars === null ? "—" : fmtStars(stars)}
              </span>
            </a>
            <button
              type="button"
              onClick={() => setPage("docs")}
              className="flex items-center gap-1.5 h-[30px] px-2.5 text-12 text-subtext bg-card border border-border rounded-lg hover:border-blue/40 hover:text-text transition-all"
            >
              <HugeiconsIcon icon={Book01Icon} size={13} color="currentColor" />
              <span>Docs</span>
            </button>
            <button
              type="button"
              onClick={download}
              className="hidden sm:flex items-center gap-1.5 h-[32px] px-4 text-12 font-bold text-white bg-blue hover:bg-blue-hover rounded-lg transition-colors"
            >
              <HugeiconsIcon icon={Download02Icon} size={13} color="currentColor" />
              <span>Download</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[860px] mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-14 sm:gap-20">
        {page === "home" ? (
          <HomePage goToDocs={() => setPage("docs")} />
        ) : (
          <DocsPage goHome={() => setPage("home")} />
        )}

        {/* Footer */}
        <footer className="flex flex-col items-center gap-2 pb-6 pt-6">
          <div className="w-[32px] h-px bg-border" />
          <p className="text-11 text-subtext text-center">
            Built by{" "}
            <button
              type="button"
              onClick={() => open(PORTFOLIO_URL)}
              className="text-text font-semibold hover:text-blue transition-colors"
            >
              HalxDocs
            </button>
            {" "}·{" "}
            <button
              type="button"
              onClick={() => open(GITHUB_URL)}
              className="inline-flex items-center gap-1 hover:text-text transition-colors"
            >
              <HugeiconsIcon icon={GithubIcon} size={11} color="currentColor" />
              Open source
            </button>
            {" "}· Local-first
          </p>
        </footer>
      </main>
    </div>
  );
}
