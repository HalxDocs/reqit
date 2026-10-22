import { useCallback, useMemo, useRef, useState } from "react";
import type { models } from "../../../../wailsjs/go/models";
import type { HttpMethod } from "@/features/request/types/request";

/** Row heights used by the virtualised collection tree. */
export const COLL_H = 32;
export const REQ_H = 28;
export const EMPTY_H = 28;
const OVERSCAN = 10;

/** One rendered row of the collection tree. */
export type TreeRow =
  | { type: "coll"; id: string; coll: models.Collection; requests: models.SavedRequest[]; hasSpec: boolean; isOpen: boolean }
  | { type: "folder"; id: string; collID: string; name: string; depth: number; isOpen: boolean; childCount: number }
  | { type: "req"; id: string; collID: string; req: models.SavedRequest; method: HttpMethod; depth: number }
  | { type: "empty" };

/** Index of the first row whose offset is greater than `t`. */
function search(offsets: number[], t: number): number {
  let lo = 0,
    hi = offsets.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (offsets[m] <= t) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/**
 * Windowing for the collection tree.
 *
 * The tree can hold thousands of rows, so only the visible slice is rendered.
 * The hook owns the scroll position and reports the slice to render, plus the
 * spacer heights that keep the scrollbar the right length.
 */
export function useTreeVirtualization(rows: TreeRow[]) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerH, setContainerH] = useState(400);

  const { totalH, offsets } = useMemo(() => {
    const o: number[] = [];
    let acc = 0;
    for (const row of rows) {
      o.push(acc);
      if (row.type === "coll") acc += COLL_H;
      else if (row.type === "folder") acc += COLL_H;
      else acc += REQ_H;
    }
    return { totalH: acc, offsets: o };
  }, [rows]);

  const { startIdx, endIdx } = useMemo(() => {
    if (rows.length === 0) return { startIdx: 0, endIdx: 0 };
    const s = search(offsets, scrollTop - OVERSCAN * REQ_H);
    const e = search(offsets, scrollTop + containerH + OVERSCAN * REQ_H);
    return { startIdx: Math.max(0, s - 1), endIdx: Math.min(rows.length, e + 1) };
  }, [offsets, scrollTop, containerH]);

  const visibleRows = rows.slice(startIdx, endIdx);
  const topPad = offsets[startIdx] || 0;
  const bottomPad =
    totalH -
    (offsets[endIdx - 1] || 0) -
    (rows[endIdx - 1]?.type === "coll" || rows[endIdx - 1]?.type === "folder" ? COLL_H : REQ_H);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop);
  }, []);

  return {
    scrollRef,
    visibleRows,
    topPad,
    bottomPad,
    totalH,
    handleScroll,
    setContainerH,
  };
}
