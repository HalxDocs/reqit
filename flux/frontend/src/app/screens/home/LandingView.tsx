import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Book01Icon, GithubIcon, KeyboardIcon, Layers01Icon, StarIcon } from "@hugeicons/core-free-icons";
import { fmtStars } from "@/shared/hooks/useGitHubStars";
import { GITHUB_URL, PORTFOLIO_URL, openExternal } from "@/shared/lib/links";
import { STEPS, FEATURES, SHORTCUTS } from "@/app/screens/home/homeContent";

export function LandingView({
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
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan/10 border border-cyan/20 rounded-full text-[10px] text-cyan font-semibold tracking-[0.12em] uppercase">
            Local-first · No account · No telemetry
          </div>
          {/* GitHub badge */}
          <button
            type="button"
            onClick={() => openExternal(GITHUB_URL)}
            className="sm:hidden inline-flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border rounded-full text-[10px] text-subtext hover:text-text hover:border-cyan/40 transition-all"
          >
            <HugeiconsIcon icon={GithubIcon} size={11} color="currentColor" />
            <HugeiconsIcon icon={StarIcon} size={10} color="#f0a500" strokeWidth={2} />
            <span className="font-mono">{fmtStars(stars)}</span>
          </button>
        </div>

        <h1
          className="text-[38px] sm:text-48 font-bold text-text leading-[1.08] tracking-[-0.03em] max-w-[560px] sm:max-w-[620px]"
          style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
        >
          The API client built for{" "}
          <span className="text-cyan">speed</span>.
        </h1>

        <p className="text-13 sm:text-15 text-subtext max-w-[380px] sm:max-w-[460px] leading-relaxed">
          Fast, open, and beautifully minimal. Your collections live as plain JSON —
          commit them, sync them, share them however you like.
        </p>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          <button
            type="button"
            onClick={onGoToWorkspaces}
            className="flex items-center gap-3 h-[44px] sm:h-[46px] px-6 sm:px-7 text-13 sm:text-14 font-bold text-white bg-cyan hover:bg-cyan-hover rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue/20"
          >
            <span>Open workspaces</span>
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} color="currentColor" />
          </button>
          <button
            type="button"
            onClick={onGoDocs}
            className="flex items-center gap-2 h-[44px] sm:h-[46px] px-5 text-13 sm:text-14 font-semibold text-subtext hover:text-text bg-card border border-border hover:border-cyan/40 rounded-xl transition-all"
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
              className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 hover:border-cyan/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="w-[36px] h-[36px] rounded-xl bg-cyan/10 flex items-center justify-center">
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
              className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2.5 hover:border-cyan/30 transition-colors"
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
        <div className="w-[40px] h-[40px] rounded-xl bg-cyan/10 flex items-center justify-center shrink-0">
          <HugeiconsIcon icon={Layers01Icon} size={20} color="#0891B2" strokeWidth={1.5} />
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
            className="text-text font-semibold hover:text-cyan transition-colors"
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



/** A keyboard shortcut key badge. */
function Kbd({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center h-[20px] px-1.5 bg-surface border border-border rounded text-[10px] font-mono text-subtext leading-none">
      {children}
    </span>
  );
}
