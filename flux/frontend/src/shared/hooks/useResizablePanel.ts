import { useCallback, useEffect, useState } from "react";

type Axis = "width" | "height";

const CONFIG: Record<Axis, { key: string; default: number; min: number }> = {
  width: { key: "flux:requestPanelWidth", default: 680, min: 360 },
  height: { key: "flux:requestPanelHeight", default: 360, min: 160 },
};
const MAX_RATIO = 0.7; // up to 70% of viewport

function readStored(axis: Axis): number {
  const { key, default: def, min } = CONFIG[axis];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return def;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= min ? n : def;
  } catch {
    return def;
  }
}

export function useResizablePanel(axis: Axis = "width") {
  const [size, setSize] = useState<number>(() => readStored(axis));

  useEffect(() => {
    setSize(readStored(axis));
  }, [axis]);

  useEffect(() => {
    try {
      localStorage.setItem(CONFIG[axis].key, String(size));
    } catch {
      // ignore quota errors
    }
  }, [axis, size]);

  const onResize = useCallback((delta: number) => {
    const { min } = CONFIG[axis];
    setSize((current) => {
      const viewport = axis === "width" ? window.innerWidth : window.innerHeight;
      const max = Math.max(min, viewport * MAX_RATIO);
      const next = current + delta;
      if (next < min) return min;
      if (next > max) return max;
      return next;
    });
  }, [axis]);

  return { size, onResize };
}
