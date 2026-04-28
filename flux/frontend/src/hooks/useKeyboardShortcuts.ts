import { useEffect } from "react";
import { useRequestStore } from "../stores/useRequestStore";
import { useResponseStore } from "../stores/useResponseStore";
import { useUIStore } from "../stores/useUIStore";

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

      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        useUIStore.getState().openSaveModal();
        return;
      }

      if (e.key.toLowerCase() === "n") {
        // Don't fight the native "new window" when an input is focused with
        // text selected — only intercept when the user is not actively editing.
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        useRequestStore.getState().reset();
        useUIStore.getState().setLoadedRequestID(null);
        useResponseStore.getState().clearResponse();
        useUIStore.getState().setRequestTab("params");
        document.getElementById("flux-url-bar")?.focus();
        return;
      }

      if (e.key.toLowerCase() === "e") {
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
