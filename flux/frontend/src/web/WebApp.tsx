import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { BookOpen } from "lucide-react";
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
import { DOC_CATEGORIES, type DocCategory, type DocPage } from "../shared/lib/docs";
import { BlogPage } from "../features/blog/components/BlogPanel";
import { PublicProfilePage } from "../features/profile/components/PublicProfilePage";
import { getSEO, applySEO } from "../shared/lib/seo";
import reqitLogo from "../assets/images/reqitlogo.jpeg";

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
  { src: "/script.png", alt: "reqit script sandbox" },
  { src: "/graphql.png", alt: "reqit GraphQL editor" },
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
            className={`w-[7px] h-[7px] rounded-full transition-all ${i === idx ? "bg-cyan w-[18px]" : "bg-border hover:bg-subtext/50"}`}
          />
        ))}
      </div>
      <div className="absolute -inset-4 bg-cyan/10 blur-3xl -z-10 rounded-full" />
    </div>
  );
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

const DEMO_URL = "https://jsonplaceholder.typicode.com/todos/1";

function ApiPlayground() {
  const [method, setMethod] = useState<"GET" | "POST" | "PUT" | "PATCH" | "DELETE">("GET");
  const [url, setUrl] = useState(DEMO_URL);
  const [sending, setSending] = useState(false);
  const [res, setRes] = useState<{ status: number; statusText: string; time: number; headers: Record<string, string>; body: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  async function send() {
    const t0 = performance.now();
    setSending(true);
    setErr(null);
    setRes(null);
    try {
      const r = await fetch(url, { method });
      const t1 = performance.now();
      const headers: Record<string, string> = {};
      r.headers.forEach((v, k) => { headers[k] = v; });
      const body = r.headers.get("content-type")?.includes("json")
        ? JSON.stringify(await r.json(), null, 2)
        : await r.text();
      setRes({ status: r.status, statusText: r.statusText, time: Math.round(t1 - t0), headers, body });
    } catch (e) {
      setErr(e instanceof TypeError ? "CORS blocked or unreachable — try the desktop app for unrestricted access." : String(e));
    }
    setSending(false);
  }

  const methodColors: Record<string, string> = {
    GET: "text-get border-get/30 bg-get/5",
    POST: "text-cyan border-cyan/30 bg-cyan/5",
    PUT: "text-put border-put/30 bg-put/5",
    PATCH: "text-patch border-patch/30 bg-patch/5",
    DELETE: "text-del border-del/30 bg-del/5",
  };

  return (
    <div className="max-w-[780px] mx-auto">
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-xl shadow-black/20">
        {/* Title bar */}
        <div className="flex items-center gap-1.5 px-3 h-[28px] bg-card border-b border-border">
          <div className="w-[7px] h-[7px] rounded-full bg-danger/70" />
          <div className="w-[7px] h-[7px] rounded-full bg-warn/70" />
          <div className="w-[7px] h-[7px] rounded-full bg-teal/70" />
          <span className="ml-2 text-[9px] text-subtext/50 font-mono">reqit playground</span>
        </div>

        {/* Input row */}
        <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-2">
          {/* Method dropdown */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              className={`h-[38px] px-3 text-11 font-bold font-mono rounded-lg border transition-all ${methodColors[method]} flex items-center gap-1.5`}
            >
              {method}
              <svg className={`w-3 h-3 transition-transform ${showPicker ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {showPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowPicker(false)} />
                <div className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-lg overflow-hidden shadow-xl min-w-[110px]">
                  {METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setMethod(m); setShowPicker(false); }}
                      className={`block w-full text-left px-3 py-[7px] text-11 font-mono font-bold hover:bg-surface transition-colors ${m === method ? "bg-surface" : ""} ${methodColors[m].split(" ")[0]}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* URL input */}
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="https://api.example.com/endpoint"
            className="flex-1 h-[38px] px-3 bg-bg border border-border rounded-lg text-12 text-text font-mono placeholder:text-subtext/30 outline-none focus:border-cyan/50 transition-colors min-w-0"
          />

          {/* Send button */}
          <button
            type="button"
            onClick={send}
            disabled={sending || !url.trim()}
            className="h-[38px] shrink-0 px-4 sm:px-5 text-12 font-bold text-white bg-cyan hover:bg-cyan-hover rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
          >
            {sending ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" className="opacity-30" /><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeDashoffset="10" strokeLinecap="round" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            )}
            <span className="hidden sm:inline">{sending ? "Sending..." : "Send"}</span>
          </button>
        </div>

        {/* Response */}
        {(res || err || sending) && (
          <div className="border-t border-border">
            {sending && (
              <div className="p-6 flex items-center justify-center gap-2 text-12 text-subtext">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" className="opacity-30" /><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeDashoffset="10" strokeLinecap="round" /></svg>
                Sending request...
              </div>
            )}

            {err && (
              <div className="p-4 text-12 text-danger font-mono leading-relaxed break-all">{err}</div>
            )}

            {res && !sending && (
              <>
                {/* Status bar */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-card border-b border-border">
                  <span className={`text-11 font-bold font-mono ${res.status < 300 ? "text-teal" : res.status < 500 ? "text-warn" : "text-danger"}`}>
                    {res.status} {res.statusText}
                  </span>
                  <span className="text-10 text-subtext/50 font-mono">{res.time}ms</span>
                  <span className="text-10 text-subtext/30 hidden sm:block">·</span>
                  <span className="text-10 text-subtext/50 font-mono hidden sm:inline">{(res.body.length / 1024).toFixed(1)} KB</span>
                </div>

                {/* Headers toggle */}
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-[6px] w-full text-10 text-subtext/60 hover:text-subtext bg-bg/50 border-b border-border transition-colors text-left"
                >
                  <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  Response headers ({Object.keys(res.headers).length})
                </button>
                {expanded && (
                  <div className="px-3 sm:px-4 py-2 bg-bg/30 border-b border-border max-h-[160px] overflow-y-auto text-10 font-mono text-subtext/60 space-y-0.5">
                    {Object.entries(res.headers).map(([k, v]) => (
                      <div key={k}><span className="text-subtext/80">{k}:</span> {v}</div>
                    ))}
                  </div>
                )}

                {/* Body */}
                <div className="max-h-[320px] sm:max-h-[420px] overflow-auto">
                  <pre className="p-3 sm:p-4 text-11 sm:text-12 font-mono text-text leading-relaxed whitespace-pre-wrap break-all">{res.body}</pre>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-10 text-subtext/40 text-center mt-2">
        Some APIs block browser CORS. The {" "}
        <button type="button" onClick={download} className="text-cyan hover:underline">desktop app</button>
        {" "}handles this transparently.
      </p>
    </div>
  );
}

function HomePage({ goToDocs, stars }: { goToDocs: () => void; stars: number | null }) {
  return (
    <>
      {/* Hero — full width, centered */}
      <section className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-5 flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan/10 border border-cyan/20 rounded-full text-[10px] text-cyan font-semibold tracking-[0.12em] uppercase">
            Local-first · No account · No telemetry
          </div>
          <h1
            className="text-[36px] sm:text-44 lg:text-52 font-bold text-text leading-[1.06] tracking-[-0.03em] max-w-[600px]"
            style={{ fontFamily: 'Syne, system-ui, sans-serif' }}
          >
            A native desktop app for{" "}
            <span className="text-cyan">testing APIs</span>.
          </h1>
          <p className="text-14 sm:text-16 text-subtext max-w-[440px] leading-relaxed">
            A lighter, faster alternative to Postman and Insomnia. No Electron, no cloud account, 
            no telemetry. Send requests, view responses, manage collections — all offline, all yours.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-1">
            <button
              type="button"
              onClick={download}
              className="flex items-center gap-3 h-[48px] px-7 text-14 font-bold text-white bg-cyan hover:bg-cyan-hover rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-cyan/20"
            >
              <HugeiconsIcon icon={Download02Icon} size={16} color="currentColor" />
              <span>{OS_LABEL[getOS()]}</span>
            </button>
            <button
              type="button"
              onClick={() => open(GITHUB_URL)}
              className="flex items-center gap-2 h-[48px] px-5 text-13 text-subtext bg-card border border-border rounded-xl hover:border-cyan/40 hover:text-text transition-all"
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
      <section className="bg-gradient-to-r from-cyan/5 to-transparent border border-cyan/10 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
        <span className="text-13 font-semibold text-text shrink-0">Support the project</span>
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <a
            href="https://github.com/sponsors/HalxDocs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 h-[36px] px-4 text-12 font-bold text-white bg-cyan hover:bg-cyan-hover rounded-lg transition-all hover:scale-[1.02] justify-center"
          >
            <HugeiconsIcon icon={GithubIcon} size={14} color="currentColor" />
            GitHub Sponsors
            <span className="text-11 font-normal opacity-70 bg-white/15 rounded px-1.5 py-0.5">International</span>
          </a>
          <a
            href="https://myhappr.com/halxdocs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 h-[36px] px-4 text-12 font-bold text-text bg-card border border-border hover:bg-surface rounded-lg transition-all hover:scale-[1.02] justify-center"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
            myhappr.com
            <span className="text-11 font-normal opacity-70 bg-border/50 rounded px-1.5 py-0.5">Africa</span>
          </a>
        </div>
      </section>

      {/* Live API Playground */}
      <section>
        <div className="text-center mb-6">
          <p className="text-[10px] font-semibold text-cyan uppercase tracking-[0.14em] mb-2">Try it live</p>
          <h2
            className="text-22 sm:text-26 font-bold text-text"
            style={{ fontFamily: 'Syne, system-ui, sans-serif' }}
          >
            Send a real request, right here
          </h2>
          <p className="text-13 text-subtext mt-2 max-w-[480px] mx-auto leading-relaxed">
            No download needed. No account. Just paste a URL and hit send.
          </p>
        </div>
        <ApiPlayground />
      </section>

      {/* Features */}
      <section>
        <div className="text-center mb-8">
          <p className="text-[10px] font-semibold text-cyan uppercase tracking-[0.14em] mb-2">Features</p>
          <h2
            className="text-22 sm:text-26 font-bold text-text"
            style={{ fontFamily: 'Syne, system-ui, sans-serif' }}
          >
            Everything an API client should be
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group bg-card border border-border rounded-xl p-4 flex items-start gap-3 hover:border-cyan/30 hover:bg-cardHover transition-all"
            >
              <div className="w-[36px] h-[36px] rounded-lg bg-cyan/10 flex items-center justify-center shrink-0 group-hover:bg-cyan/20 transition-colors">
                <HugeiconsIcon icon={f.icon} size={16} color="#0891B2" strokeWidth={1.5} />
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
          <p className="text-[10px] font-semibold text-cyan uppercase tracking-[0.14em] mb-2">Gallery</p>
          <h2
            className="text-22 sm:text-26 font-bold text-text"
            style={{ fontFamily: 'Syne, system-ui, sans-serif' }}
          >
            See it in action
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SCREENSHOTS.map((s) => (
            <div
              key={s.src}
              className="bg-surface border border-border rounded-xl overflow-hidden hover:border-cyan/30 transition-all group"
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
          style={{ fontFamily: 'Syne, system-ui, sans-serif' }}
        >
          Get started in seconds
        </h2>
        <p className="text-13 text-subtext max-w-[400px] leading-relaxed">
          No signup, no account, no data collection. Just download and run.
        </p>
        <button
          type="button"
          onClick={download}
          className="flex items-center gap-3 h-[48px] px-7 text-14 font-bold text-white bg-cyan hover:bg-cyan-hover rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-cyan/20"
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

function CategorySection({ category }: { category: DocCategory }) {
  return (
    <section id={`docs-${category.id}`} className="flex flex-col gap-6 scroll-mt-20">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div>
          <div
            className="text-15 font-bold text-text leading-tight"
            style={{ fontFamily: 'Syne, system-ui, sans-serif' }}
          >
            {category.title}
          </div>
        </div>
      </div>
      {category.pages.map((page) => (
        <div key={page.id} id={`docs-${category.id}-${page.id}`} className="flex flex-col gap-3 scroll-mt-20">
          <div>
            <div className="text-14 font-semibold text-text">{page.title}</div>
            {page.subtitle && <div className="text-11 text-subtext mt-0.5">{page.subtitle}</div>}
          </div>
          <div className="flex flex-col gap-4">
            {page.content.map((c, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                {c.heading && <div className="text-12 font-semibold text-text">{c.heading}</div>}
                <p className="text-12 text-subtext leading-relaxed">{c.body}</p>
                {c.code && (
                  <pre className="bg-card border border-border rounded-lg p-3 text-12 font-mono text-text overflow-x-auto whitespace-pre-wrap">
                    {c.code}
                  </pre>
                )}
                {c.resources && c.resources.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {c.resources.map((r) => (
                      <a
                        key={r.url}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-11 text-cyan bg-cyan/5 border border-cyan/20 rounded-lg hover:bg-cyan/10 transition-colors"
                      >
                        {r.title}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function DocsPage({ goHome }: { goHome: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={goHome}
        className="flex items-center gap-1.5 h-[30px] px-2.5 text-12 text-subtext hover:text-text bg-card border border-border rounded-lg hover:border-cyan/40 transition-all self-start"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={13} color="currentColor" />
        <span>Back to home</span>
      </button>

      <section id="docs" className="flex flex-col gap-8 sm:gap-10 scroll-mt-20">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Book01Icon} size={18} color="#0891B2" strokeWidth={1.5} />
            <h2
              className="text-22 sm:text-26 font-bold text-text tracking-tight"
              style={{ fontFamily: 'Syne, system-ui, sans-serif' }}
            >
              Documentation
            </h2>
          </div>
          <p className="text-13 text-subtext max-w-[480px] leading-relaxed">
            Every feature in reqit — what it does, how it works, and why it's there.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {DOC_CATEGORIES.map((c) => (
            <a
              key={c.id}
              href={`#docs-${c.id}`}
              className="inline-flex items-center gap-1.5 h-[26px] px-2.5 text-11 font-semibold rounded-full border border-border bg-card hover:border-cyan/40 hover:text-text text-subtext transition-all"
            >
              {c.title}
            </a>
          ))}
        </div>

        {DOC_CATEGORIES.map((category) => (
          <CategorySection key={category.id} category={category} />
        ))}

        <footer className="flex flex-col items-center gap-2 pt-4 pb-4 border-t border-border">
          <p className="text-11 text-subtext text-center">
            Missing something?{" "}
            <button
              type="button"
              onClick={() => open("https://github.com/HalxDocs/reqit/issues")}
              className="text-cyan hover:underline"
            >
              Open an issue on GitHub
            </button>
          </p>
        </footer>
      </section>
    </>
  );
}

const PAGES = [
  { id: "home" as const, label: "Home", icon: "⊞", path: "/" },
  { id: "blog" as const, label: "Blog", icon: "✎", path: "/blog" },
  { id: "docs" as const, label: "Documentation", icon: "⊡", path: "/documentation" },
];

function parsePage(): { page: "home" | "docs" | "blog" | "profile"; blogSlug?: string; profileUser?: string } {
  const p = window.location.pathname;
  // /profile/:username (legacy)
  const profileMatch = p.match(/^\/profile\/([a-z0-9][a-z0-9\-]*)$/);
  if (profileMatch) return { page: "profile", profileUser: profileMatch[1] };
  // /blog/:slug
  const blogMatch = p.match(/^\/blog\/(.+)$/);
  if (blogMatch) return { page: "blog", blogSlug: blogMatch[1] };
  if (p === "/blog" || p === "/blog/") return { page: "blog" };
  if (p === "/documentation" || p === "/documentation/") return { page: "docs" };
  // /:username (direct profile URL)
  const directMatch = p.match(/^\/([a-z0-9][a-z0-9\-]*)$/);
  if (directMatch) {
    const slug = directMatch[1];
    if (slug !== "blog" && slug !== "documentation" && slug !== "api") {
      return { page: "profile", profileUser: slug };
    }
  }
  return { page: "home" };
}

export function WebApp() {
  const init = parsePage();
  const [page, setPage] = useState<"home" | "docs" | "blog" | "profile">(init.page);
  const [blogSlug, setBlogSlug] = useState<string | undefined>(init.blogSlug);
  const [profileUser, setProfileUser] = useState<string | undefined>(init.profileUser);
  const stars = useGitHubStars("HalxDocs/reqit");

  // Prevent browser scroll restoration so every navigation starts at top
  useEffect(() => {
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);

  const navigate = useCallback((to: "home" | "docs" | "blog" | "profile", slug?: string, user?: string) => {
    setBlogSlug(slug);
    setProfileUser(user);
    if (to === "home") {
      setPage("home");
      window.history.pushState({}, "", "/");
    } else if (to === "docs") {
      setPage("docs");
      window.history.pushState({}, "", "/documentation");
    } else if (to === "blog" && slug) {
      setPage("blog");
      window.history.pushState({}, "", `/blog/${slug}`);
    } else if (to === "profile" && user) {
      setPage("profile");
      window.history.pushState({}, "", `/${user}`);
    } else {
      setPage("blog");
      window.history.pushState({}, "", "/blog");
    }
  }, []);

  useEffect(() => {
    const onPop = () => {
      const parsed = parsePage();
      setPage(parsed.page);
      setBlogSlug(parsed.blogSlug);
      setProfileUser(parsed.profileUser);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [page, blogSlug, profileUser]);

  // Also scroll to top on initial mount (handles direct URL navigation like /blog/slug)
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Update SEO meta tags on every navigation
  useEffect(() => {
    const slug = page === "blog" ? blogSlug : page === "profile" ? profileUser : undefined;
    applySEO(getSEO(page, slug));
  }, [page, blogSlug, profileUser]);

  const handleSelectPost = useCallback((slug: string) => {
    navigate("blog", slug);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur border-b border-border">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-[56px] flex items-center justify-between">
          <img src={reqitLogo} alt="reqit" className="h-[28px] sm:h-[32px] w-auto object-contain" />
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 h-[30px] px-2.5 text-12 text-subtext bg-card border border-border rounded-lg hover:border-cyan/40 hover:text-text transition-all shrink-0"
          >
            <HugeiconsIcon icon={GithubIcon} size={13} color="currentColor" />
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#f0a500" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            <span className="font-mono text-11 min-w-[22px] text-center tabular-nums">
              {stars === null ? "—" : fmtStars(stars)}
            </span>
          </a>
        </div>
      </header>

      <div className="sticky top-[56px] z-30 bg-bg border-b border-border">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-[46px] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(p.id)}
              className={`shrink-0 flex items-center gap-1.5 h-[30px] px-3 text-12 font-semibold rounded-full border transition-all ${
                (page === p.id) && (p.id !== "blog" || !blogSlug)
                  ? "bg-cyan/10 text-cyan border-cyan/30"
                  : "text-subtext border-border hover:border-cyan/30 hover:text-text"
              }`}
            >
              <span className="text-[10px]">{p.icon}</span>
              <span>{p.label}</span>
            </button>
          ))}
          <div className="flex-1 min-w-[8px]" />
          <button
            type="button"
            onClick={download}
            className="shrink-0 flex items-center gap-1.5 h-[30px] px-3.5 text-12 font-bold text-white bg-cyan hover:bg-cyan-hover rounded-full transition-all"
          >
            <HugeiconsIcon icon={Download02Icon} size={12} color="currentColor" />
            <span>Download</span>
          </button>
        </div>
      </div>

      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12 sm:py-20 flex flex-col gap-16 sm:gap-24">
        {page === "home" ? (
          <HomePage goToDocs={() => navigate("docs")} stars={stars} />
        ) : page === "docs" ? (
          <DocsPage goHome={() => navigate("home")} />
        ) : page === "blog" ? (
          <BlogPage key={blogSlug || "listing"} initialSlug={blogSlug} onBack={() => navigate("home")} onSelectPost={handleSelectPost} scrollToTop={() => window.scrollTo(0, 0)} />
        ) : page === "profile" && profileUser ? (
          <PublicProfilePage key={profileUser} username={profileUser} onBack={() => navigate("home")} />
        ) : null}

        <footer className="flex flex-col items-center gap-2 pb-6 pt-6">
          <div className="w-[32px] h-px bg-border" />
          <p className="text-11 text-subtext text-center">
            Built by{" "}
            <button type="button" onClick={() => open(PORTFOLIO_URL)} className="text-text font-semibold hover:text-cyan transition-colors">HalxDocs</button>
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
