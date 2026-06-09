import { useEffect } from "react";
import { useResponseStore } from "@/features/request/stores/useResponseStore";
import { useTabsStore } from "@/features/tabs/stores/useTabsStore";
import { useUIStore } from "@/app/stores/useUIStore";

const isEditableTarget = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
};

export function useKeyboardShortcuts(onSend: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === "Enter") {
        e.preventDefault();
        if (!useResponseStore.getState().isLoading) onSend();
        return;
      }

      const k = e.key.toLowerCase();

      if (k === "s") {
        e.preventDefault();
        useUIStore.getState().openSaveModal();
        return;
      }

      // Ctrl/Cmd+T or Ctrl/Cmd+N — new tab. Don't fight the OS "new window"
      // when the user is mid-typing.
      if (k === "t" || (k === "n" && !isEditableTarget(e.target))) {
        e.preventDefault();
        useTabsStore.getState().newTab();
        document.getElementById("flux-url-bar")?.focus();
        return;
      }

      // Ctrl/Cmd+W — close active tab.
      if (k === "w") {
        e.preventDefault();
        const { activeID } = useTabsStore.getState();
        useTabsStore.getState().closeTab(activeID);
        return;
      }

      if (k === "e") {
        e.preventDefault();
        const el = document.getElementById("flux-url-bar") as HTMLInputElement | null;
        el?.focus();
        el?.select();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onSend]);
}
