import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useToastStore, type ToastKind } from "@/app/stores/useToastStore";
import { cn } from "@/shared/lib/cn";

const STYLES: Record<ToastKind, { icon: typeof Info; bg: string; tint: string; bar: string }> = {
  info: { icon: Info, bg: "bg-cyan/15", tint: "text-cyan", bar: "bg-cyan" },
  success: { icon: CheckCircle2, bg: "bg-success/15", tint: "text-success", bar: "bg-success" },
  error: { icon: AlertCircle, bg: "bg-danger/15", tint: "text-danger", bar: "bg-danger" },
};

const DURATION: Record<ToastKind, number> = {
  info: 2500,
  success: 2500,
  error: 4500,
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: { id: string; kind: ToastKind; message: string };
  onDismiss: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const remainingRef = useRef(0);
  const startedAtRef = useRef(0);
  const { icon: Icon, bg, tint, bar } = STYLES[toast.kind];
  const duration = DURATION[toast.kind];

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  }, [onDismiss, toast.id]);

  const startTimer = useCallback((ms: number) => {
    startedAtRef.current = Date.now();
    remainingRef.current = ms;
    timerRef.current = setTimeout(dismiss, ms);
  }, [dismiss]);

  useEffect(() => {
    if (!paused) {
      startTimer(remainingRef.current || duration);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      remainingRef.current -= Date.now() - startedAtRef.current;
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [paused, startTimer, duration]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-2.5 bg-card border border-border rounded-lg shadow-xl shadow-black/30 pl-3 pr-2 py-2.5 min-w-[280px] max-w-[400px] overflow-hidden relative",
        exiting ? "animate-[toast-slide-out_0.2s_ease-in_forwards]" : "animate-[toast-slide-in_0.25s_ease-out]",
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={cn("w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 mt-[1px]", bg)}>
        <Icon size={12} className={tint} />
      </div>

      <span className="text-12 text-text leading-[18px] flex-1 break-words">{toast.message}</span>

      <button
        type="button"
        onClick={dismiss}
        className="text-subtext hover:text-text transition-colors p-0.5 rounded hover:bg-border shrink-0 self-start"
        aria-label="Dismiss"
      >
        <X size={11} />
      </button>

      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-border/50">
        <div
          className={cn("h-full rounded-full", bar)}
          style={{
            animation: exiting ? "none" : paused ? "none" : `toast-progress ${duration}ms linear forwards`,
            animationPlayState: paused ? "paused" : "running",
          }}
        />
      </div>
    </div>
  );
}

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {toasts.map((t) => (
          <span key={t.id}>{t.kind === "error" ? "Error: " : ""}{t.message}</span>
        ))}
      </div>
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </>
  );
}
