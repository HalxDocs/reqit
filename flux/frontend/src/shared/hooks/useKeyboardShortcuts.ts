import { useEffect } from "react";
import { handleKeyEvent, setActiveScope, type CommandScope } from "@/shared/lib/commands";

function detectScope(): CommandScope {
  const el = document.activeElement;
  if (!el) return "global";

  const target = el as HTMLElement;

  if (target.closest("[data-scope='responseTree']")) return "responseTree";
  if (target.closest("[data-scope='sidebar']")) return "sidebar";
  if (target.closest("[data-scope='envEditor']")) return "envEditor";

  return "global";
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const scope = detectScope();
      setActiveScope(scope);
      if (handleKeyEvent(e)) return;
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}
