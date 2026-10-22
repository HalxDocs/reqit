import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copy text to the clipboard and report a brief "copied" state.
 *
 * The clipboard is not available in every context, so a failure is silent
 * rather than an error the user cannot act on.
 */
export function useCopyToClipboard(resetAfterMs = 1500) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = useCallback(
    async (text: string) => {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setCopied(false);
          timerRef.current = undefined;
        }, resetAfterMs);
      } catch {
        // The clipboard may be unavailable; fail silently.
      }
    },
    [resetAfterMs],
  );

  return { copied, copy };
}
