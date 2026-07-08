import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { BookOpen } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CodeIcon,
  GithubIcon,
  Download02Icon,
  Lightning,
  TestTubeIcon,
  TerminalIcon,
} from "@hugeicons/core-free-icons";
import { WebDocsPage } from "../features/docs/components/WebDocsPage";
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
  }, [repo]);
  return stars;
}

function fmtStars(n: number | null) {
  return n === null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function TerminalWindow({ children, title = "reqit", className }: { children: React.ReactNode; title?: string; className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-xl overflow-hidden shadow-2xl shadow-black/30 ${className ?? ""}`}>
      <div className="flex items-center gap-1.5 px-3 h-[30px] bg-card border-b border-border">
        <div className="w-[8px] h-[8px] rounded-full bg-danger/70" />
        <div className="w-[8px] h-[8px] rounded-full bg-warn/70" />
        <div className="w-[8px] h-[8px] rounded-full bg-teal/70" />
        <span className="ml-2 text-[9px] text-subtext/40 font-mono">{title}</span>
      </div>
      <div className="bg-card/60">{children}</div>
    </div>
  );
}

const M_COLORS: Record<string, string> = {
  GET: "text-get",
  POST: "text-cyan",
  PUT: "text-put",
  PATCH: "text-patch",
  DELETE: "text-del",
};

function LiveRequestMockup() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 3), 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <TerminalWindow title="reqit — send request" className="w-full max-w-[580px] mx-auto">
      <div className="p-4 sm:p-5 font-mono text-[11px] leading-relaxed space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-get font-bold bg-get/10 px-1.5 py-0.5 rounded text-[10px]">GET</span>
          <span className="text-text truncate">https://api.example.com/v2/users?limit=10</span>
        </div>
        <div className="flex items-center gap-3 text-10 text-subtext/60 border-b border-border pb-2">
          <span>Headers: 3</span>
          <span>Auth: Bearer ***</span>
        </div>
        {step === 0 && (
          <div className="flex items-center gap-2 text-subtext py-2">
            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" className="opacity-30" /><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeDashoffset="10" strokeLinecap="round" /></svg>
            Sending request...
          </div>
        )}
        {step === 1 && (
          <div className="text-teal font-semibold text-10">← 200 OK · 312ms · 2.4 KB</div>
        )}
        {step === 2 && (
          <>
            <div className="text-teal font-semibold text-10">← 200 OK · 312ms · 2.4 KB</div>
            <div className="bg-bg/80 rounded-lg p-3 text-10 overflow-x-auto">
              <pre className="text-subtext">{`{
  "users": [
    {
      "id": "usr_8f3a2",
      "name": "Jane Doe",
      "email": "jane@acme.dev",
      "role": "admin"
    },
    {
      "id": "usr_9b1c7",
      "name": "John Smith",
      "email": "john@acme.dev",
      "role": "editor"
    }
  ],
  "total": 2,
  "page": 1
}`}</pre>
            </div>
            <div className="flex gap-2 text-10 pt-1">
              <span className="text-get/80 bg-get/5 px-1.5 py-0.5 rounded">Headers</span>
              <span className="text-cyan/80 bg-cyan/5 px-1.5 py-0.5 rounded">Cookies</span>
              <span className="text-subtext/50">Timeline: 312ms</span>
            </div>
          </>
        )}
      </div>
    </TerminalWindow>
  );
}

function ComparisonTable() {
  const rows: [string, string, string][] = [
    ["Account required", "No", "Yes"],
    ["Collections", "Plain files in git", "Cloud-locked JSON blobs"],
    ["Telemetry", "Zero", "Constant"],
    ["Offline", "Full functionality", "Degraded"],
    ["Pricing", "Free core, open-core cloud", "Per-seat SaaS"],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-13 border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 pr-6 font-semibold text-text" />
            <th className="text-left py-3 pr-6 font-semibold text-cyan">reqit</th>
            <th className="text-left py-3 font-semibold text-subtext/60">Legacy tools</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, us, them]) => (
            <tr key={label} className="border-b border-border/50">
              <td className="py-3 pr-6 text-subtext whitespace-nowrap">{label}</td>
              <td className="py-3 pr-6">
                <span className="flex items-center gap-1.5 text-teal">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  {us}
                </span>
              </td>
              <td className="py-3 text-subtext/50">{them}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ children, lang = "" }: { children: string; lang?: string }) {
  return (
    <div className="bg-bg border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 h-[26px] bg-card border-b border-border text-[9px] text-subtext/40">
        <span>{lang}</span>
      </div>
      <pre className="p-3 text-[11px] font-mono text-text leading-relaxed overflow-x-auto whitespace-pre"><code>{children}</code></pre>
    </div>
  );
}

function FolderTree() {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 font-mono text-[11px] text-subtext leading-loose">
      <div className="text-cyan font-semibold mb-1">.reqit/</div>
      <div className="pl-4">├── collections/</div>
      <div className="pl-8">│   ├── <span className="text-text">auth-api</span>/</div>
      <div className="pl-10">│   │   ├── login.json</div>
      <div className="pl-10">│   │   └── refresh.json</div>
      <div className="pl-8">│   ├── <span className="text-text">payment-service</span>/</div>
      <div className="pl-10">│   │   ├── charge.json</div>
      <div className="pl-10">│   │   └── webhook.json</div>
      <div className="pl-8">│   └── <span className="text-text">users</span>/</div>
      <div className="pl-10">│       ├── create.json</div>
      <div className="pl-10">│       └── list.json</div>
      <div className="pl-4">├── environments/</div>
      <div className="pl-8">│   ├── dev.json</div>
      <div className="pl-8">│   └── prod.json</div>
      <div className="pl-4">└── .gitignore</div>
    </div>
  );
}

function GitDiffMockup() {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden font-mono text-[11px] leading-relaxed">
      <div className="flex items-center gap-2 px-3 h-[26px] bg-card border-b border-border text-[9px] text-subtext/40">
        <span className="text-cyan">git diff collections/users/create.json</span>
      </div>
      <div className="p-3">
        <div className="text-subtext/40">--- a/collections/users/create.json</div>
        <div className="text-subtext/40">+++ b/collections/users/create.json</div>
        <div className="text-subtext/40 mt-1">@@ -18,7 +18,9 @@</div>
        <div className="text-10">{'  "url": "https://api.example.com/v2/users",'}</div>
        <div className="text-10">{'  "method": "POST",'}</div>
        <div className="text-10">{'  "headers": {'}</div>
        <div className="text-10">{'    "Content-Type": "application/json",'}</div>
        <div className="text-success bg-success/5">+    "Authorization": "Bearer {{token}}",</div>
        <div className="text-success bg-success/5">+    "X-Idempotency-Key": "{{uuid}}",</div>
        <div className="text-10">{'  },'}</div>
        <div className="text-10">{'  "body": {'}</div>
        <div className="text-danger bg-danger/5">-    "email": "user@example.com",</div>
        <div className="text-success bg-success/5">+    "email": "{{email}}",</div>
        <div className="text-success bg-success/5">+    "role": "viewer",</div>
        <div className="text-10">{'  }'}</div>
      </div>
    </div>
  );
}

function TweetCard({ handle, name, text, likes, retweets, avatarColor }: { handle: string; name: string; text: string; likes: number; retweets: number; avatarColor: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-cyan/30 transition-all group hover:shadow-lg hover:shadow-cyan/5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-[36px] h-[36px] rounded-full ${avatarColor} flex items-center justify-center text-12 font-bold text-white shrink-0`}>
          {name.split(" ").map(w => w[0]).join("").slice(0, 2)}
        </div>
        <div className="min-w-0">
          <div className="text-13 font-semibold text-text truncate">{name}</div>
          <div className="text-11 text-subtext">{handle}</div>
        </div>
        <svg className="ml-auto shrink-0 text-cyan" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </div>
      <p className="text-13 text-text leading-relaxed mb-3">{text}</p>
      <div className="flex items-center gap-4 text-11 text-subtext/60">
        <span className="flex items-center gap-1">❤️ {likes}</span>
        <span className="flex items-center gap-1">🔁 {retweets}</span>
      </div>
    </div>
  );
}

function CollectionCard({ name, author, stars, tag }: { name: string; author: string; stars: number; tag: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-cyan/30 transition-all group hover:shadow-lg hover:shadow-cyan/5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-cyan uppercase tracking-wider bg-cyan/5 px-2 py-0.5 rounded-full border border-cyan/10">{tag}</span>
        <span className="text-11 text-subtext flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="#f0a500" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
          {stars}
        </span>
      </div>
      <div className="text-13 font-semibold text-text mb-1 group-hover:text-cyan transition-colors">{name}</div>
      <div className="text-11 text-subtext">by {author}</div>
      <div className="mt-2.5 flex items-center gap-1 text-[9px] text-subtext/50 border border-border/50 rounded-full px-2 py-0.5 w-fit">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        Deploy to custom domain
      </div>
    </div>
  );
}

function HomePage({ goToDocs, stars }: { goToDocs: () => void; stars: number | null }) {
  return (
    <>
      {/* Hero */}
      <section className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-5 flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan/10 border border-cyan/20 rounded-full text-[10px] text-cyan font-semibold tracking-[0.12em] uppercase">
            Local-first · No account · No telemetry
          </div>
          <h1
            className="text-[36px] sm:text-44 lg:text-52 font-bold text-text leading-[1.06] tracking-[-0.03em] max-w-[600px]"
            style={{ fontFamily: 'Syne, system-ui, sans-serif' }}
          >
            Your API client{" "}
            <span className="text-cyan">shouldn't need a login</span>.
          </h1>
          <p className="text-14 sm:text-16 text-subtext max-w-[480px] leading-relaxed">
            reqit is a local-first, account-free API client. Collections live as plain files in <code className="text-cyan text-13">.reqit/</code> — commit them, diff them, PR them like real code.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-1">
            <button
              type="button"
              onClick={download}
              className="flex items-center gap-3 h-[48px] px-7 text-14 font-bold text-white bg-cyan hover:bg-cyan-hover rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-cyan/20"
            >
              <HugeiconsIcon icon={Download02Icon} size={16} color="currentColor" />
              <span>Download for {getOS() === "windows" ? "Windows" : getOS() === "mac" ? "macOS" : "Linux"}</span>
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
          <div className="flex items-center gap-4 text-11 text-subtext/60">
            <span>Zero telemetry</span>
            <span className="w-[3px] h-[3px] rounded-full bg-subtext/30" />
            <span>No account</span>
            <span className="w-[3px] h-[3px] rounded-full bg-subtext/30" />
            <span>MIT-licensed core</span>
          </div>
        </div>
        <div className="flex-1 flex justify-center lg:justify-end w-full max-w-[500px] lg:max-w-none">
          <LiveRequestMockup />
        </div>
      </section>

      {/* Contrast strip */}
      <section>
        <div className="text-center mb-6">
          <p className="text-[10px] font-semibold text-cyan uppercase tracking-[0.14em] mb-2">The difference</p>
          <h2 className="text-22 sm:text-26 font-bold text-text" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>
            reqit vs the status quo
          </h2>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 sm:p-6 max-w-[680px] mx-auto">
          <ComparisonTable />
        </div>
      </section>

      {/* Feature grid — 6 cards */}
      <section>
        <div className="text-center mb-8">
          <p className="text-[10px] font-semibold text-cyan uppercase tracking-[0.14em] mb-2">Features</p>
          <h2 className="text-22 sm:text-26 font-bold text-text" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>
            What you get
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Collection Runner */}
          <div className="group bg-card border border-border rounded-xl p-4 hover:border-cyan/30 transition-all hover:shadow-lg hover:shadow-cyan/5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-[32px] h-[32px] rounded-lg bg-cyan/10 flex items-center justify-center"><TestTubeIcon size={14} color="#0891B2" /></div>
              <span className="text-13 font-semibold text-text">Collection Runner</span>
            </div>
            <div className="bg-bg/60 border border-border rounded-lg p-3 font-mono text-[10px] leading-relaxed space-y-1">
              <div className="flex items-center gap-2 text-subtext"><span className="text-teal">✓</span> GET /users <span className="ml-auto text-teal">200 · 142ms</span></div>
              <div className="flex items-center gap-2 text-subtext"><span className="text-teal">✓</span> POST /charge <span className="ml-auto text-teal">201 · 89ms</span></div>
              <div className="flex items-center gap-2 text-subtext"><span className="text-danger">✗</span> DELETE /order <span className="ml-auto text-danger">422 · 63ms</span></div>
              <div className="flex items-center gap-2 text-subtext"><span className="text-teal">✓</span> GET /invoices <span className="ml-auto text-teal">200 · 210ms</span></div>
              <div className="border-t border-border pt-1 mt-1 flex justify-between text-10">
                <span className="text-teal">11 passed</span>
                <span className="text-danger">1 failed</span>
                <span className="text-subtext/50">1.2s total</span>
              </div>
              <div className="bg-danger/10 border border-danger/20 rounded px-2 py-1 mt-1 text-danger text-[9px]">
                DELETE /order: expected status 200, got 422 — body.validation_error
              </div>
            </div>
          </div>

          {/* Mock Server */}
          <div className="group bg-card border border-border rounded-xl p-4 hover:border-cyan/30 transition-all hover:shadow-lg hover:shadow-cyan/5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-[32px] h-[32px] rounded-lg bg-cyan/10 flex items-center justify-center"><CodeIcon size={14} color="#0891B2" /></div>
              <span className="text-13 font-semibold text-text">Mock Server</span>
            </div>
            <div className="bg-bg/60 border border-border rounded-lg p-3 font-mono text-[10px] leading-relaxed space-y-1">
              <div className="flex items-center gap-2 text-subtext">
                <span className="text-teal">●</span>
                <span className="text-text">Mock running on</span>
                <span className="text-cyan">http://localhost:4321</span>
              </div>
              <div className="flex items-center gap-3 text-10 text-subtext/60 border-b border-border pb-1">
                <span>Delay: 200ms</span>
                <span>CORS: enabled</span>
              </div>
              <div className="flex items-center gap-2 text-subtext mt-1"><span className="text-get font-bold">GET</span> /api/users <span className="ml-auto text-teal">→ 200</span></div>
              <div className="flex items-center gap-2 text-subtext"><span className="text-cyan font-bold">POST</span> /api/charge <span className="ml-auto text-teal">→ 201</span></div>
            </div>
          </div>

          {/* mTLS / Client Certs */}
          <div className="group bg-card border border-border rounded-xl p-4 hover:border-cyan/30 transition-all hover:shadow-lg hover:shadow-cyan/5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-[32px] h-[32px] rounded-lg bg-cyan/10 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0891B2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <span className="text-13 font-semibold text-text">mTLS / Client Certs</span>
            </div>
            <div className="bg-bg/60 border border-border rounded-lg p-3 font-mono text-[10px] leading-relaxed space-y-1">
              <div className="flex items-center gap-2 text-teal">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Authenticated via client cert
              </div>
              <div className="text-subtext/60 pl-4 text-[9px] border-l border-border ml-[5px] mt-1 space-y-0.5">
                <div>Subject: CN=api.client.acme.dev</div>
                <div>Issuer: Acme Internal CA</div>
                <div>Expiry: 2027-03-15</div>
              </div>
            </div>
          </div>

          {/* BYOK AI Layer */}
          <div className="group bg-card border border-border rounded-xl p-4 hover:border-cyan/30 transition-all hover:shadow-lg hover:shadow-cyan/5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-[32px] h-[32px] rounded-lg bg-cyan/10 flex items-center justify-center"><Lightning size={14} color="#0891B2" /></div>
              <span className="text-13 font-semibold text-text">BYOK AI Layer</span>
            </div>
            <div className="bg-bg/60 border border-border rounded-lg p-3 font-mono text-[10px] leading-relaxed space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {["OpenAI", "Anthropic", "Gemini", "Groq", "Ollama"].map((m) => (
                  <span key={m} className={`px-1.5 py-0.5 rounded text-[9px] border ${m === "Anthropic" ? "bg-cyan/10 text-cyan border-cyan/20" : "text-subtext border-border"}`}>{m}</span>
                ))}
              </div>
              <div className="border-t border-border my-1.5" />
              <div className="text-subtext text-[9px]">
                <span className="text-cyan">AI:</span> This 422 suggests the <span className="text-text">amount</span> field expects cents, not dollars. Add <span className="text-text">* 100</span> to the value.
              </div>
            </div>
          </div>

          {/* MCP Server */}
          <div className="group bg-card border border-border rounded-xl p-4 hover:border-cyan/30 transition-all hover:shadow-lg hover:shadow-cyan/5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-[32px] h-[32px] rounded-lg bg-cyan/10 flex items-center justify-center"><TerminalIcon size={14} color="#0891B2" /></div>
              <span className="text-13 font-semibold text-text">MCP Server</span>
            </div>
            <div className="bg-bg/60 border border-border rounded-lg p-3 font-mono text-[10px] leading-relaxed">
              <div className="text-text">$ reqit mcp --port 4321</div>
              <div className="text-teal mt-1">✓ MCP server listening on port 4321</div>
              <div className="text-teal">✓ Transport: stdio + SSE</div>
              <div className="text-subtext/60 mt-1 text-[9px]">Connected: Claude Desktop · Cursor · Windsurf</div>
            </div>
          </div>

          {/* Agent Lens */}
          <div className="group bg-card border border-border rounded-xl p-4 hover:border-cyan/30 transition-all hover:shadow-lg hover:shadow-cyan/5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-[32px] h-[32px] rounded-lg bg-cyan/10 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0891B2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </div>
              <span className="text-13 font-semibold text-text">Agent Lens</span>
            </div>
            <div className="bg-bg/60 border border-border rounded-lg p-3 font-mono text-[10px] leading-relaxed">
              <div className="grid grid-cols-[1fr_60px_60px_60px] gap-1 text-[9px] text-subtext/60 border-b border-border pb-1 mb-1">
                <span>Variant</span><span className="text-center">Precision</span><span className="text-center">Recall</span><span className="text-center">Score</span>
              </div>
              {[["GPT-4o", "94%", "91%", "92%"], ["Claude 3.5", "96%", "93%", "95%"], ["Gemini 1.5", "88%", "85%", "86%"], ["Mistral", "82%", "79%", "80%"]].map(([m, p, r, s]) => (
                <div key={m} className="grid grid-cols-[1fr_60px_60px_60px] gap-1 text-[10px] py-0.5">
                  <span className="text-text">{m}</span><span className="text-center text-subtext">{p}</span><span className="text-center text-subtext">{r}</span><span className="text-center font-semibold" style={{color: parseFloat(s) >= 90 ? "#22c55e" : "#f59e0b"}}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Git-Native Workflow */}
      <section>
        <div className="text-center mb-6">
          <p className="text-[10px] font-semibold text-cyan uppercase tracking-[0.14em] mb-2">Git-native workflow</p>
          <h2 className="text-22 sm:text-26 font-bold text-text" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>
            Collections are files. Diffs are readable. Reviews are real.
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-[900px] mx-auto">
          <FolderTree />
          <GitDiffMockup />
        </div>
        <p className="text-12 text-subtext/60 text-center mt-3 max-w-[500px] mx-auto">
          Every request, environment, and collection is a plain file in <code className="text-cyan text-11">.reqit/</code>. Changes show up in <code className="text-cyan text-11">git diff</code> with meaningful line-level context. Review API changes in PRs like source code.
        </p>
      </section>

      {/* Collection Showcase */}
      <section>
        <div className="text-center mb-6">
          <p className="text-[10px] font-semibold text-cyan uppercase tracking-[0.14em] mb-2">Collection showcase</p>
          <h2 className="text-22 sm:text-26 font-bold text-text" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>
            Ready-to-use API collections
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-[800px] mx-auto">
          <CollectionCard name="Stripe Webhooks Starter" author="@halxdocs" stars={34} tag="Payments" />
          <CollectionCard name="Paystack Integration" author="@halxdocs" stars={28} tag="Payments" />
          <CollectionCard name="M-Pesa Sandbox" author="@halxdocs" stars={22} tag="Fintech" />
          <CollectionCard name="OpenAI API Collection" author="@halxdocs" stars={47} tag="AI" />
        </div>
      </section>

      {/* Import / Interop */}
      <section className="bg-card border border-border rounded-2xl p-6 sm:p-8">
        <div className="text-center mb-5">
          <p className="text-[10px] font-semibold text-cyan uppercase tracking-[0.14em] mb-2">Import from anywhere</p>
          <h2 className="text-18 sm:text-22 font-bold text-text" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>
            Bring your existing collections
          </h2>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
          {[
            { name: "Postman", icon: "📮" },
            { name: "Insomnia", icon: "🌙" },
            { name: "OpenAPI 3.0", icon: "📋" },
            { name: "cURL", icon: "🔗" },
            { name: "Hoppscotch", icon: "⚡" },
          ].map((t) => (
            <div key={t.name} className="flex items-center gap-2 px-3 py-2 bg-bg border border-border rounded-lg text-12 text-text">
              <span>{t.icon}</span>
              <span>{t.name}</span>
            </div>
          ))}
        </div>
        <CodeBlock lang="terminal">$ reqit import postman://my-workspace.json
  ✓ Imported 23 requests from Postman v2.1
  ✓ Transpiled 12 pm.* script references
  ✓ 2 environment templates created

$ reqit import curl -- "curl -X POST https://api.stripe.com/v1/charges -u sk_test_...:"
  ✓ Parsed cURL command
  ✓ Created request "POST /v1/charges"</CodeBlock>
      </section>

      {/* Social Proof */}
      <section>
        <div className="text-center mb-6">
          <h2 className="text-22 sm:text-26 font-bold text-text" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>
            What developers are saying
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-[900px] mx-auto">
          <TweetCard
            handle="@apidev_jane"
            name="Jane Cooper"
            text="Ditched Postman after 4 years. reqit's git-native collections alone are worth the switch. No more exporting JSON blobs to share with the team."
            likes={142}
            retweets={38}
            avatarColor="bg-violet-500"
          />
          <TweetCard
            handle="@backend_marc"
            name="Marc Thompson"
            text="The fact that reqit starts in under 400ms and has mTLS support out of the box is wild. This thing is legit."
            likes={98}
            retweets={22}
            avatarColor="bg-emerald-500"
          />
          <TweetCard
            handle="@devops_raj"
            name="Raj Patel"
            text="We ship our .reqit/ folder in our monorepo. CI runs the collection as a smoke test. No SaaS, no account, just git. Beautiful."
            likes={215}
            retweets={57}
            avatarColor="bg-amber-500"
          />
        </div>
      </section>

      {/* Final CTA Band */}
      <section className="relative overflow-hidden bg-gradient-to-br from-cyan/10 via-transparent to-transparent border border-cyan/20 rounded-2xl p-8 sm:p-12 flex flex-col items-center text-center gap-5">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan/10 blur-3xl rounded-full" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-cyan/5 blur-3xl rounded-full" />
        <h2 className="text-24 sm:text-28 font-bold text-text max-w-[500px]" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>
          Stop syncing your API client to the cloud.
        </h2>
        <p className="text-14 text-subtext max-w-[420px] leading-relaxed">
          No account. No telemetry. No per-seat pricing. Just a fast, native API client that respects your machine and your team's workflow.
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
            <span>Star us</span>
            <span className="flex items-center gap-1 text-11 text-amber-400">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#f0a500"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              {fmtStars(stars)}
            </span>
          </button>
        </div>
        <div className="flex items-center gap-4 text-11 text-subtext/60">
          <span>Windows</span>
          <span className="w-[3px] h-[3px] rounded-full bg-subtext/30" />
          <span>macOS</span>
          <span className="w-[3px] h-[3px] rounded-full bg-subtext/30" />
          <span>Linux</span>
          <span className="w-[3px] h-[3px] rounded-full bg-subtext/30" />
          <span>Free & open source</span>
        </div>
      </section>
    </>
  );
}

function DocsPage({ goHome, initialCategory, initialPage, onNavigate }: {
  goHome: () => void;
  initialCategory?: string;
  initialPage?: string;
  onNavigate?: (cat: string, pg: string) => void;
}) {
  return <WebDocsPage goHome={goHome} initialCategory={initialCategory} initialPage={initialPage} onNavigate={onNavigate} />;
}

const PAGES = [
  { id: "home" as const, label: "Home", icon: "⊞", path: "/" },
  { id: "blog" as const, label: "Blog", icon: "✎", path: "/blog" },
  { id: "docs" as const, label: "Documentation", icon: "⊡", path: "/documentation" },
];

function parsePage(): { page: "home" | "docs" | "blog" | "profile"; blogSlug?: string; profileUser?: string; docsCat?: string; docsPage?: string } {
  const p = window.location.pathname;
  const profileMatch = p.match(/^\/profile\/([a-z0-9][a-z0-9\-]*)$/);
  if (profileMatch) return { page: "profile", profileUser: profileMatch[1] };
  const blogMatch = p.match(/^\/blog\/(.+)$/);
  if (blogMatch) return { page: "blog", blogSlug: blogMatch[1] };
  if (p === "/blog" || p === "/blog/") return { page: "blog" };
  const docsMatch = p.match(/^\/documentation\/([a-z0-9\-]+)\/([a-z0-9\-]+)$/);
  if (docsMatch) return { page: "docs", docsCat: docsMatch[1], docsPage: docsMatch[2] };
  if (p === "/documentation" || p === "/documentation/") return { page: "docs" };
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
  const [docsCat, setDocsCat] = useState<string | undefined>(init.docsCat);
  const [docsPage, setDocsPage] = useState<string | undefined>(init.docsPage);
  const stars = useGitHubStars("HalxDocs/reqit");

  useEffect(() => {
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);

  const navigate = useCallback((to: "home" | "docs" | "blog" | "profile", slug?: string, user?: string, docsCatArg?: string, docsPageArg?: string) => {
    setBlogSlug(slug);
    setProfileUser(user);
    setDocsCat(docsCatArg);
    setDocsPage(docsPageArg);
    if (to === "home") {
      setPage("home");
      window.history.pushState({}, "", "/");
    } else if (to === "docs") {
      setPage("docs");
      window.history.pushState({}, "", docsCatArg && docsPageArg ? `/documentation/${docsCatArg}/${docsPageArg}` : "/documentation");
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
      setDocsCat(parsed.docsCat);
      setDocsPage(parsed.docsPage);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useLayoutEffect(() => { window.scrollTo(0, 0); }, [page, blogSlug, profileUser]);
  useLayoutEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    const slug = page === "blog" ? blogSlug : page === "profile" ? profileUser : undefined;
    applySEO(getSEO(page, slug));
  }, [page, blogSlug, profileUser]);

  const handleSelectPost = useCallback((slug: string) => navigate("blog", slug), [navigate]);
  const handleDocsNavigate = useCallback((cat: string, pg: string) => navigate("docs", undefined, undefined, cat, pg), [navigate]);

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur border-b border-border">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-[56px] flex items-center justify-between">
          <img src={reqitLogo} alt="reqit" className="h-[28px] sm:h-[32px] w-auto object-contain" />
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 h-[30px] px-2.5 text-12 text-subtext">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#f0a500" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              <span className="font-mono text-11 tabular-nums">{fmtStars(stars)}</span>
            </span>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 h-[30px] px-2.5 text-12 text-subtext bg-card border border-border rounded-lg hover:border-cyan/40 hover:text-text transition-all shrink-0"
            >
              <HugeiconsIcon icon={GithubIcon} size={13} color="currentColor" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
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
          <DocsPage goHome={() => navigate("home")} initialCategory={docsCat} initialPage={docsPage} onNavigate={handleDocsNavigate} />
        ) : page === "blog" ? (
          <BlogPage key={blogSlug || "listing"} initialSlug={blogSlug} onBack={() => navigate("home")} onSelectPost={handleSelectPost} scrollToTop={() => window.scrollTo(0, 0)} />
        ) : page === "profile" && profileUser ? (
          <PublicProfilePage key={profileUser} username={profileUser} onBack={() => navigate("home")} />
        ) : null}

        <footer className="flex flex-col items-center gap-2 pb-6 pt-6">
          <div className="w-[32px] h-px bg-border" />
          <div className="flex items-center gap-3 text-11 text-subtext flex-wrap justify-center">
            <span>Built by <button type="button" onClick={() => open(PORTFOLIO_URL)} className="text-text font-semibold hover:text-cyan transition-colors">HalxDocs</button></span>
            <span className="w-[3px] h-[3px] rounded-full bg-subtext/30" />
            <button type="button" onClick={() => open("https://reqit.dev/documentation")} className="hover:text-text transition-colors">Docs</button>
            <span className="w-[3px] h-[3px] rounded-full bg-subtext/30" />
            <button type="button" onClick={() => open(GITHUB_URL)} className="hover:text-text transition-colors">GitHub</button>
            <span className="w-[3px] h-[3px] rounded-full bg-subtext/30" />
            <button type="button" onClick={() => open("https://x.com/reqit_dev")} className="hover:text-text transition-colors">X (@reqit_dev)</button>
            <span className="w-[3px] h-[3px] rounded-full bg-subtext/30" />
            <button type="button" onClick={() => open("https://github.com/HalxDocs/reqit/blob/main/CHANGELOG.md")} className="hover:text-text transition-colors">Changelog</button>
            <span className="w-[3px] h-[3px] rounded-full bg-subtext/30" />
            <span className="text-teal">MIT License</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
