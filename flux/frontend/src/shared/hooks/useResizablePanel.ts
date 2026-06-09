import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "flux:requestPanelWidth";
const DEFAULT_WIDTH = 680;
const MIN_WIDTH = 360;
const MAX_WIDTH_RATIO = 0.7; // up to 70% of viewport

function readStored(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDTH;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= MIN_WIDTH ? n : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

export function useResizablePanel() {
  const [width, setWidth] = useState<number>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(width));
    } catch {
      // ignore quota errors
    }
  }, [width]);

  const onResize = useCallback((delta: number) => {
    setWidth((current) => {
      const max = Math.max(MIN_WIDTH, window.innerWidth * MAX_WIDTH_RATIO);
      const next = current + delta;
      if (next < MIN_WIDTH) return MIN_WIDTH;
      if (next > max) return max;
      return next;
    });
  }, []);

  return { width, onResize };
}
