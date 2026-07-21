import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { HTTP_METHODS, type HttpMethod } from "@/features/request/types/request";
import { MethodBadge } from "@/shared/components/MethodBadge";

export function MethodSelect({
  value,
  onChange,
}: {
  value: HttpMethod;
  onChange: (m: HttpMethod) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`HTTP method: ${value}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "flex items-center gap-2 h-[36px] px-3 rounded-md bg-card border border-border",
          "hover:border-cyan transition-colors",
          open && "border-cyan ring-2 ring-cyan",
        )}
      >
        <MethodBadge method={value} />
        <ChevronDown size={14} className="text-subtext" />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-1 z-20 min-w-[140px] bg-card border border-border rounded-md shadow-lg py-1"
        >
          {HTTP_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                onChange(m);
                setOpen(false);
              }}
              className={cn(
                "w-full px-3 py-2 flex items-center gap-2 text-left",
                "hover:bg-cardHover transition-colors",
                m === value && "bg-cardHover",
              )}
            >
              <MethodBadge method={m} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
