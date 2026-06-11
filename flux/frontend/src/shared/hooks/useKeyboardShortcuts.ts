import { useEffect } from "react";
import { handleKeyEvent } from "@/shared/lib/commands";

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (handleKeyEvent(e)) return;
      // Passthrough — let native inputs handle their own keys.
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}
