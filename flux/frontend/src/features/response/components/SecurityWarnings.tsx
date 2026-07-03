import { AlertTriangle, ShieldOff, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useResponseStore } from "@/features/request/stores/useResponseStore";
import { useState, useRef, useEffect } from "react";

export function SecurityWarnings() {
  const warnings = useResponseStore((s) => s.securityWarnings);
  const [dismissed, setDismissed] = useState(false);
  const prevLen = useRef(0);

  useEffect(() => {
    if (warnings.length !== prevLen.current) {
      prevLen.current = warnings.length;
      setDismissed(false);
    }
  }, [warnings]);

  if (warnings.length === 0 || dismissed) return null;

  const hasErrors = warnings.some((w) => w.level === "error");

  return (
    <div className={cn(
      "border-b px-3 py-2 space-y-1.5",
      hasErrors ? "border-red-800/40 bg-red-950/30" : "border-amber-800/40 bg-amber-950/30",
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {hasErrors ? (
            <ShieldOff size={12} className="text-red-400" />
          ) : (
            <AlertTriangle size={12} className="text-amber-400" />
          )}
          <span className="text-11 font-semibold uppercase tracking-wider text-subtext">
            Security ({warnings.length})
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-subtext hover:text-text transition-colors"
        >
          <X size={11} />
        </button>
      </div>
      {warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2 text-11">
          <span className={cn(
            "shrink-0 mt-px font-bold",
            w.level === "error" ? "text-red-400" : "text-amber-400",
          )}>
            {w.level === "error" ? "!" : "?"}
          </span>
          <div>
            <p className={cn(
              w.level === "error" ? "text-red-200" : "text-amber-200",
            )}>
              {w.message}
            </p>
            <p className="text-tertiary text-10 mt-0.5">{w.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
