import { useEffect } from "react";
import { handleKeyEvent, setActiveScope, type CommandScope } from "@/shared/lib/commands";
import { useTabsStore } from "@/features/tabs/stores/useTabsStore";

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

      // Meta/Ctrl + N (1-9) → jump to tab
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9) {
          e.preventDefault();
          e.stopPropagation();
          const { tabs, setActive } = useTabsStore.getState();
          if (tabs[num - 1]) setActive(tabs[num - 1].id);
          return;
        }
      }

      if (handleKeyEvent(e)) return;
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}
