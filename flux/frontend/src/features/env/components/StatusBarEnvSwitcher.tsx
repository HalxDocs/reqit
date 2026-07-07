import { useEffect, useRef, useState } from "react";
import { Globe, Settings2 } from "lucide-react";
import { useEnvStore } from "@/features/env/stores/useEnvStore";
import { useUIStore } from "@/app/stores/useUIStore";
import { cn } from "@/shared/lib/cn";

export function StatusBarEnvSwitcher() {
  const environments = useEnvStore((s) => s.environments);
  const activeID = useEnvStore((s) => s.activeID);
  const setActive = useEnvStore((s) => s.setActive);
  const openManage = useUIStore((s) => s.openEnvModal);

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

  const active = environments.find((e) => e.id === activeID);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 h-[22px] px-2 rounded-sm text-11 transition-colors",
          active
            ? "text-cyan hover:bg-cyan/10"
            : "text-subtext hover:text-text hover:bg-cardHover",
        )}
        title="Switch environment"
      >
        <Globe size={10} />
        <span className="max-w-[100px] truncate font-medium">
          {active ? active.name : "No env"}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-1 z-30 bg-card border border-border rounded-md shadow-lg py-1 min-w-[160px]">
          <button
            type="button"
            onClick={() => { setActive(""); setOpen(false); }}
            className={cn(
              "w-full px-3 py-1.5 text-left text-11 hover:bg-cardHover transition-colors",
              activeID === "" ? "text-cyan font-semibold" : "text-subtext",
            )}
          >
            No environment
          </button>
          {environments.map((env) => (
            <button
              key={env.id}
              type="button"
              onClick={() => { setActive(env.id); setOpen(false); }}
              className={cn(
                "w-full px-3 py-1.5 text-left text-11 hover:bg-cardHover transition-colors flex items-center justify-between",
                env.id === activeID ? "text-cyan font-semibold" : "text-text",
              )}
            >
              <span className="truncate">{env.name}</span>
              <span className="text-10 text-subtext font-mono ml-2 shrink-0">
                {(env.vars ?? []).filter((v) => v.enabled !== false && v.key).length}
              </span>
            </button>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <button
              type="button"
              onClick={() => { setOpen(false); openManage(); }}
              className="w-full px-3 py-1.5 text-left text-11 text-subtext hover:text-text hover:bg-cardHover transition-colors flex items-center gap-2"
            >
              <Settings2 size={10} />
              <span>Manage…</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
