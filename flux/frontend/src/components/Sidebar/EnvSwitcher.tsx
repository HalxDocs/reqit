import { useEffect, useRef, useState } from "react";
import { ChevronDown, Globe, Settings2 } from "lucide-react";
import { useEnvStore } from "../../stores/useEnvStore";
import { useUIStore } from "../../stores/useUIStore";
import { cn } from "../../lib/cn";

export function EnvSwitcher() {
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
          "w-full flex items-center justify-between gap-2 h-[28px] px-2 rounded-md border transition-colors",
          active
            ? "bg-violet/10 border-violet/40 text-violet"
            : "bg-surface border-border text-subtext hover:text-text",
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Globe size={12} />
          <span className="text-12 font-semibold truncate">
            {active ? active.name : "No environment"}
          </span>
        </span>
        <ChevronDown size={12} className="shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-card border border-border rounded-md shadow-lg py-1">
          <button
            type="button"
            onClick={() => {
              setActive("");
              setOpen(false);
            }}
            className={cn(
              "w-full px-3 py-1.5 text-left text-12 hover:bg-cardHover transition-colors",
              activeID === "" ? "text-violet font-semibold" : "text-subtext",
            )}
          >
            No environment
          </button>
          {environments.map((env) => (
            <button
              key={env.id}
              type="button"
              onClick={() => {
                setActive(env.id);
                setOpen(false);
              }}
              className={cn(
                "w-full px-3 py-1.5 text-left text-12 hover:bg-cardHover transition-colors flex items-center justify-between",
                env.id === activeID ? "text-violet font-semibold" : "text-text",
              )}
            >
              <span className="truncate">{env.name}</span>
              <span className="text-11 text-subtext font-mono ml-2 shrink-0">
                {(env.vars ?? []).filter((v) => v.enabled !== false && v.key).length} vars
              </span>
            </button>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openManage();
              }}
              className="w-full px-3 py-1.5 text-left text-12 text-subtext hover:text-text hover:bg-cardHover transition-colors flex items-center gap-2"
            >
              <Settings2 size={12} />
              <span>Manage environments…</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
