import { useEffect, useRef, useState, useCallback } from "react";
import { useEnvStore } from "@/features/env/stores/useEnvStore";
import type { models } from "../../../wailsjs/go/models";

interface VarInfo {
  key: string;
  value: string;
}

export function VariableAutocomplete() {
  const envs = useEnvStore((s) => s.environments);
  const activeID = useEnvStore((s) => s.activeID);
  const [vars, setVars] = useState<VarInfo[]>([]);
  const [show, setShow] = useState(false);
  const [filter, setFilter] = useState("");
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [target, setTarget] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build env var list
  useEffect(() => {
    const active = envs.find((e) => e.id === activeID) as models.Environment | undefined;
    if (!active) { setVars([]); return; }
    const resolved: VarInfo[] = [];
    for (const v of (active.vars ?? [])) {
      if (v.enabled !== false && v.key) {
        resolved.push({ key: v.key, value: v.value ?? "" });
      }
    }
    setVars(resolved);
  }, [envs, activeID]);

  const insertVar = useCallback((key: string) => {
    if (!target) return;
    const start = target.selectionStart ?? target.value.length;
    const before = target.value.slice(0, start);
    const after = target.value.slice(start);
    // Find the last `{{` before cursor
    const lastOpen = before.lastIndexOf("{{");
    if (lastOpen === -1) return;
    const newVal = before.slice(0, lastOpen) + `{{${key}}}` + after;
    target.value = newVal;
    // Trigger input event so React state updates
    const evt = new Event("input", { bubbles: true });
    target.dispatchEvent(evt);
    const newCursor = lastOpen + key.length + 4;
    target.setSelectionRange(newCursor, newCursor);
    target.focus();
    setShow(false);
  }, [target]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) {
        setShow(false);
        return;
      }
      const input = el as HTMLInputElement | HTMLTextAreaElement;
      const start = input.selectionStart ?? 0;
      const textBefore = input.value.slice(0, start);

      // Check if we're inside `{{ ...`
      const lastOpen = textBefore.lastIndexOf("{{");
      if (lastOpen === -1) {
        setShow(false);
        return;
      }
      const afterOpen = textBefore.slice(lastOpen + 2);
      // If there's `}}` between the `{{` and cursor, we're not inside
      if (afterOpen.includes("}}")) {
        setShow(false);
        return;
      }

      const typed = afterOpen;
      const rect = input.getBoundingClientRect();

      // Approximate cursor pixel position (works for monospace inputs)
      const charsBefore = textBefore.length;
      const lineHeight = 18;
      const charWidth = 7.5;
      const lines = textBefore.split("\n");
      const currentLine = lines.length - 1;
      const col = lines[currentLine]?.length ?? 0;

      setTarget(input);
      setFilter(typed);
      setPos({
        x: rect.left + Math.min(col * charWidth, rect.width - 240),
        y: rect.top + (currentLine + 1) * lineHeight + 4,
      });
      setSelectedIdx(0);
      setShow(true);
    };

    window.addEventListener("keyup", handler);
    return () => window.removeEventListener("keyup", handler);
  }, []);

  const filtered = filter
    ? vars.filter((v) => v.key.toLowerCase().includes(filter.toLowerCase()))
    : vars;

  // Keyboard navigation on the dropdown
  useEffect(() => {
    if (!show) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === "Enter" || e.key === "Tab") {
        if (filtered[selectedIdx]) {
          e.preventDefault();
          insertVar(filtered[selectedIdx].key);
        }
      }
      if (e.key === "Escape") { setShow(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [show, filtered, selectedIdx, insertVar]);

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current || !show) return;
    const el = listRef.current.children[selectedIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx, show]);

  if (!show || filtered.length === 0) return null;

  return (
    <div
      className="fixed z-[9999] min-w-[220px] max-w-[320px] bg-card border border-border rounded-lg shadow-xl overflow-hidden"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="px-3 py-1.5 text-[10px] text-subtext/50 border-b border-border font-semibold uppercase tracking-wide">
        Environment Variables
      </div>
      <div ref={listRef} className="max-h-[240px] overflow-y-auto">
        {filtered.map((v, i) => (
          <button
            key={v.key}
            type="button"
            onClick={() => insertVar(v.key)}
            onMouseEnter={() => setSelectedIdx(i)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors ${
              i === selectedIdx ? "bg-cyan/10 text-cyan" : "text-text hover:bg-cardHover"
            }`}
          >
            <span className="font-mono font-semibold shrink-0">{v.key}</span>
            <span className="text-subtext/50 truncate text-[11px] font-mono">→ {v.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
