import { useEffect, useState } from "react";
import { X, ArrowUpRight, Sparkles } from "lucide-react";
import { useUpdater } from "@/app/hooks/useUpdater";
import { GetVersion } from "../../../wailsjs/go/main/App";

export function ReleasePopup({ onWhatsNew }: { onWhatsNew: () => void }) {
  const { update, dismiss: dismissUpdate } = useUpdater();
  const [dismissed, setDismissed] = useState(false);
  const [currentVer, setCurrentVer] = useState("");

  useEffect(() => {
    GetVersion().then(setCurrentVer).catch(() => {});
  }, []);

  if (!update || dismissed || !currentVer) return null;

  const handleDismiss = () => {
    setDismissed(true);
    dismissUpdate();
    localStorage.setItem("release-popup-dismissed", update.version);
  };

  const handleWhatsNew = () => {
    setDismissed(true);
    onWhatsNew();
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[15vh] animate-[fade-in_0.2s_ease-out]">
        <div className="relative bg-card border border-border rounded-2xl shadow-2xl p-6 w-[400px] max-w-[90vw] animate-[pop-in_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)]">
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-3 right-3 w-[28px] h-[28px] flex items-center justify-center rounded-full bg-surface hover:bg-cardHover transition-colors text-subtext hover:text-text"
          >
            <X size={14} />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-[48px] h-[48px] rounded-full bg-cyan/10 flex items-center justify-center animate-bounce">
              <Sparkles size={22} className="text-cyan" />
            </div>
            <div>
              <h2 className="text-16 font-bold text-text">New Release!</h2>
              <p className="text-12 text-subtext">{update.version} is here</p>
            </div>
          </div>

          <p className="text-13 text-text/80 leading-relaxed mb-5">
            A new version of <span className="font-semibold text-cyan">reqit {update.version}</span> is
            ready. You&apos;re currently on <span className="font-mono text-11 text-subtext">{currentVer}</span>.
            Check out what&apos;s new below.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleWhatsNew}
              className="flex-1 h-[38px] flex items-center justify-center gap-2 bg-cyan hover:bg-cyan-hover text-white rounded-xl text-13 font-semibold transition-colors"
            >
              <Sparkles size={14} />
              See What&apos;s New
              <ArrowUpRight size={14} />
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="h-[38px] px-4 bg-surface hover:bg-cardHover text-subtext hover:text-text rounded-xl text-13 transition-colors border border-border"
            >
              Later
            </button>
          </div>

          {/* Arrow pointing to sidebar What's New */}
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-3 h-8 overflow-hidden hidden lg:block">
            <div className="w-full h-full bg-cyan rounded-r-md animate-pulse" />
          </div>
        </div>
      </div>
    </>
  );
}
