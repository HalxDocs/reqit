import { AlertCircle, CheckCircle2, Info, X, type LucideIcon } from "lucide-react";
import { useToastStore, type ToastKind } from "../../stores/useToastStore";
import { cn } from "../../lib/cn";

const STYLES: Record<ToastKind, { icon: LucideIcon; ring: string; tint: string }> = {
  info: { icon: Info, ring: "border-blue/40", tint: "text-blue" },
  success: { icon: CheckCircle2, ring: "border-teal/40", tint: "text-teal" },
  error: { icon: AlertCircle, ring: "border-danger/40", tint: "text-danger" },
};

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const { icon: Icon, ring, tint } = STYLES[t.kind];
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto bg-card border rounded-md shadow-lg pl-3 pr-2 py-2 flex items-center gap-2 min-w-[240px] max-w-[420px]",
              ring,
            )}
          >
            <Icon size={14} className={cn("shrink-0", tint)} />
            <span className="text-12 text-text flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-subtext hover:text-text transition-colors p-1 rounded-sm"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
