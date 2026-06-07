import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CodeIcon,
  DatabaseIcon,
  GitBranchIcon,
  GlobalIcon,
  ShieldKeyIcon,
  ArrowDataTransferHorizontalIcon,
  ComputerTerminal01Icon,
  GithubIcon,
  Download02Icon,
  Book01Icon,
  ArrowLeft01Icon,
  Lightning,
  PuzzleIcon,
  TestTubeIcon,
  PowerSocketIcon,
  TerminalIcon,
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
    } catch { /* ignore */ }
  };
  useEffect(() => {
    void fetch_();
    timer.current = setInterval(() => void fetch_(), 60_000);
    return () => { if (timer.current) clearInterval(timer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);
  return stars;
}

function fmtStars(n: number | null) {
  return n === null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

const FEATURES = [
  { icon: Lightning, title: "Lightning fast", desc: "Native Go backend — no Electron, no bloat. Requests fire instantly." },
  { icon: DatabaseIcon, title: "Local-first", desc: "Your collections are plain JSON files you own. No cloud, no lock-in." },
  { icon: ShieldKeyIcon, title: "Auth & env vars", desc: "Bearer, Basic, API Key — with {{VAR}} interpolation across every field." },
  { icon: GlobalIcon, title: "WebSocket & SSE", desc: "Test real-time APIs with a built-in WebSocket client and SSE support." },
  { icon: TestTubeIcon, title: "Collection runner", desc: "Run all requests with pass/fail assertions. Parallel or sequential." },
  { icon: CodeIcon, title: "Code generation", desc: "Export as cURL, fetch, Python. Import from Postman or cURL." },
  { icon: PuzzleIcon, title: "Scripting", desc: "Pre-set variables and post-response extraction. Chain data between requests." },
  { icon: TerminalIcon, title: "CLI mode", desc: "Run collections in CI/CD pipelines: reqit run collection --env prod" },
  { icon: GitBranchIcon, title: "Git-friendly", desc: "Readable JSON diffs. Commit your workspace alongside your code." },
  { icon: ComputerTerminal01Icon, title: "Mock server", desc: "One-click local mock server with delay simulation and CORS enabled." },
  { icon: ArrowDataTransferHorizontalIcon, title: "Cross-device sync", desc: "Drop the folder in Dropbox — open on any machine. No account needed." },
  { icon: PowerSocketIcon, title: "OpenAPI export", desc: "Export any collection as OpenAPI 3.0.3 spec or preview as Swagger UI." },
];

const SCREENSHOTS = [
  { src: "/screenshot-main.png", alt: "reqit main interface" },
  { src: "/screenshot-collections.png", alt: "reqit collections view" },
  { src: "/screenshot-socket.png", alt: "reqit WebSocket client" },
];

function AppMockup() {
  const [idx, setIdx] = useState(0);
  const len = SCREENSHOTS.length;

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % len), 4000);
    return () => clearInterval(t);
  }, [len]);

  return (
    <div className="relative w-full max-w-[640px] mx-auto">
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-2xl shadow-black/30">
        <div className="flex items-center gap-1.5 px-3 h-[32px] bg-card border-b border-border">
          <div className="w-[8px] h-[8px] rounded-full bg-danger/70" />
          <div className="w-[8px] h-[8px] rounded-full bg-warn/70" />
          <div className="w-[8px] h-[8px] rounded-full bg-teal/70" />
          <div className="ml-3 text-[10px] text-subtext/50 font-mono">reqit — API Client</div>
        </div>
        <div className="relative bg-bg">
          {SCREENSHOTS.map((s, i) => (
            <img
              key={s.src}
              src={s.src}
              alt={s.alt}
              className={`w-full h-auto block transition-opacity duration-700 ${i === idx ? "opacity-100" : "opacity-0 absolute inset-0"}`}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 mt-3">
        {SCREENSHOTS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            className={`w-[7px] h-[7px] rounded-full transition-all ${i === idx ? "bg-blue w-[18px]" : "bg-border hover:bg-subtext/50"}`}
          />
        ))}
      </div>
      <div className="absolute -inset-4 bg-blue/10 blur-3xl -z-10 rounded-full" />
    </div>
  );
}

function HomePage({ goToDocs, stars }: { goToDocs: () => void; stars: number | null }) {
  return (
    <>
      {/* Hero — full width, centered */}
      <section className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-5 flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue/10 border border-blue/20 rounded-full text-[10px] text-blue font-semibold tracking-[0.12em] uppercase">
            Local-first · No account · No telemetry
          </div>
          <h1
            className="text-[36px] sm:text-44 lg:text-52 font-bold text-text leading-[1.06] tracking-[-0.03em] max-w-[600px]"
            style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
          >
            A native desktop app for{" "}
            <span className="text-blue">testing APIs</span>.
          </h1>
          <p className="text-14 sm:text-16 text-subtext max-w-[440px] leading-relaxed">
            A lighter, faster alternative to Postman and Insomnia. No Electron, no cloud account, 
            no telemetry. Send requests, view responses, manage collections — all offline, all yours.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-1">
            <button
              type="button"
              onClick={download}
              className="flex items-center gap-3 h-[48px] px-7 text-14 font-bold text-white bg-blue hover:bg-blue-hover rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue/20"
            >
              <HugeiconsIcon icon={Download02Icon} size={16} color="currentColor" />
              <span>{OS_LABEL[getOS()]}</span>
            </button>
            <button
              type="button"
              onClick={() => open(GITHUB_URL)}
              className="flex items-center gap-2 h-[48px] px-5 text-13 text-subtext bg-card border border-border rounded-xl hover:border-blue/40 hover:text-text transition-all"
            >
              <HugeiconsIcon icon={GithubIcon} size={16} color="currentColor" />
              <span>View on GitHub</span>
            </button>
          </div>
          <p className="text-11 text-subtext/60">Windows · macOS · Linux · Free &amp; open source</p>
        </div>
        <div className="flex-1 flex justify-center lg:justify-end w-full max-w-[500px] lg:max-w-none">
          <AppMockup />
        </div>
      </section>

      {/* Social proof row */}
      <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-center">
        <div className="flex items-center gap-2 text-12 text-subtext">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#f0a500" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
          <span className="tabular-nums font-semibold text-text">{fmtStars(stars)}</span>
          <span>GitHub stars</span>
        </div>
        <div className="text-12 text-subtext/40 hidden sm:block">·</div>
        <div className="text-12 text-subtext">Built with Go + Wails</div>
        <div className="text-12 text-subtext/40 hidden sm:block">·</div>
        <div className="text-12 text-subtext">MIT licensed</div>
      </div>

      {/* Support card */}
      <section className="bg-gradient-to-r from-blue/5 to-transparent border border-blue/10 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
        <span className="text-13 font-semibold text-text shrink-0">Support the project</span>
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <a
            href="https://github.com/sponsors/HalxDocs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 h-[36px] px-4 text-12 font-bold text-white bg-blue hover:bg-blue-hover rounded-lg transition-all hover:scale-[1.02] justify-center"
          >
            <HugeiconsIcon icon={GithubIcon} size={14} color="currentColor" />
            GitHub Sponsors
            <span className="text-11 font-normal opacity-70 bg-white/15 rounded px-1.5 py-0.5">International</span>
          </a>
          <a
            href="https://myhappr.xyz/halxdocs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 h-[36px] px-4 text-12 font-bold text-text bg-card border border-border hover:bg-surface rounded-lg transition-all hover:scale-[1.02] justify-center"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
            myhappr.xyz
            <span className="text-11 font-normal opacity-70 bg-border/50 rounded px-1.5 py-0.5">Africa</span>
          </a>
        </div>
      </section>

      {/* Features */}
      <section>
        <div className="text-center mb-8">
          <p className="text-[10px] font-semibold text-blue uppercase tracking-[0.14em] mb-2">Features</p>
          <h2
            className="text-22 sm:text-26 font-bold text-text"
            style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
          >
            Everything an API client should be
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group bg-card border border-border rounded-xl p-4 flex items-start gap-3 hover:border-blue/30 hover:bg-cardHover transition-all"
            >
              <div className="w-[36px] h-[36px] rounded-lg bg-blue/10 flex items-center justify-center shrink-0 group-hover:bg-blue/20 transition-colors">
                <HugeiconsIcon icon={f.icon} size={16} color="#3B82F6" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <div className="text-13 font-semibold text-text mb-0.5">{f.title}</div>
                <div className="text-11 text-subtext leading-relaxed">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Screenshot gallery */}
      <section>
        <div className="text-center mb-6">
          <p className="text-[10px] font-semibold text-blue uppercase tracking-[0.14em] mb-2">Gallery</p>
          <h2
            className="text-22 sm:text-26 font-bold text-text"
            style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
          >
            See it in action
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SCREENSHOTS.map((s) => (
            <div
              key={s.src}
              className="bg-surface border border-border rounded-xl overflow-hidden hover:border-blue/30 transition-all group"
            >
              <img src={s.src} alt={s.alt} className="w-full h-auto block group-hover:scale-[1.02] transition-transform duration-500" />
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-card border border-border rounded-2xl p-8 sm:p-10 flex flex-col items-center text-center gap-5">
        <h2
          className="text-22 font-bold text-text"
          style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
        >
          Get started in seconds
        </h2>
        <p className="text-13 text-subtext max-w-[400px] leading-relaxed">
          No signup, no account, no data collection. Just download and run.
        </p>
        <button
          type="button"
          onClick={download}
          className="flex items-center gap-3 h-[48px] px-7 text-14 font-bold text-white bg-blue hover:bg-blue-hover rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue/20"
        >
          <HugeiconsIcon icon={Download02Icon} size={16} color="currentColor" />
          {OS_LABEL[getOS()]}
        </button>
        <div className="flex items-center gap-4 text-11 text-subtext/60">
          <span>Windows</span>
          <span className="text-subtext/30">·</span>
          <span>macOS</span>
          <span className="text-subtext/30">·</span>
          <span>Linux</span>
        </div>
      </section>
    </>
  );
}

function DocsPage({ goHome }: { goHome: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={goHome}
        className="flex items-center gap-1.5 h-[30px] px-2.5 text-12 text-subtext hover:text-text bg-card border border-border rounded-lg hover:border-blue/40 transition-all self-start"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={13} color="currentColor" />
        <span>Back to home</span>
      </button>

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
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur border-b border-border">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-[56px] flex items-center justify-between">
          <img src={reqitLogo} alt="reqit" className="h-[28px] sm:h-[32px] w-auto object-contain" />
          <div className="flex items-center gap-2">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 h-[30px] px-2.5 text-12 text-subtext bg-card border border-border rounded-lg hover:border-blue/40 hover:text-text transition-all"
            >
              <HugeiconsIcon icon={GithubIcon} size={13} color="currentColor" />
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#f0a500" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              <span className="font-mono text-11 min-w-[22px] text-center tabular-nums">
                {stars === null ? "—" : fmtStars(stars)}
              </span>
            </a>
            <button
              type="button"
              onClick={() => setPage("docs")}
              className="hidden sm:flex items-center gap-1.5 h-[30px] px-2.5 text-12 text-subtext bg-card border border-border rounded-lg hover:border-blue/40 hover:text-text transition-all"
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

      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12 sm:py-20 flex flex-col gap-16 sm:gap-24">
        {page === "home" ? <HomePage goToDocs={() => setPage("docs")} stars={stars} /> : <DocsPage goHome={() => setPage("home")} />}

        <footer className="flex flex-col items-center gap-2 pb-6 pt-6">
          <div className="w-[32px] h-px bg-border" />
          <p className="text-11 text-subtext text-center">
            Built by{" "}
            <button type="button" onClick={() => open(PORTFOLIO_URL)} className="text-text font-semibold hover:text-blue transition-colors">HalxDocs</button>
            {" "}·{" "}
            <button type="button" onClick={() => open(GITHUB_URL)} className="inline-flex items-center gap-1 hover:text-text transition-colors">
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
