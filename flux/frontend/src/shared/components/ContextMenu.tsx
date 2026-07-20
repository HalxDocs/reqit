import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/cn";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  action: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

export function ContextMenu({
  open,
  x,
  y,
  items,
  onClose,
}: {
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (x + rect.width > vw) el.style.left = `${vw - rect.width - 4}px`;
    if (y + rect.height > vh) el.style.top = `${vh - rect.height - 4}px`;
  }, [open, x, y]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="fixed z-[9999] min-w-[160px] bg-surface border border-border rounded-lg shadow-xl py-1 animate-[fade-in_0.08s_ease-out]"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="my-1 border-t border-border" />
        ) : (
          <button
            key={i}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              item.action();
              onClose();
            }}
            className={cn(
              "w-full px-3 py-1.5 flex items-center gap-2 text-12 text-left transition-colors",
              item.disabled
                ? "text-subtext/40 cursor-not-allowed"
                : item.danger
                  ? "text-red-400 hover:bg-red-500/10"
                  : "text-text hover:bg-cardHover"
            )}
          >
            {item.icon && <span className="w-4 h-4 flex items-center justify-center shrink-0">{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        )
      )}
    </div>
  );
}
