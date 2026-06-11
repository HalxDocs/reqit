import { useEffect, useMemo, useRef, useState } from "react";
import { getCommands, type Command } from "@/shared/lib/commands";
import { cn } from "@/shared/lib/cn";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo(() => getCommands(), []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && filtered[selected]) {
      e.preventDefault();
      filtered[selected].action();
      onClose();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div
        className="w-[520px] max-h-[380px] bg-surface border border-border rounded-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <span className="text-subtext text-12 font-mono">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search commands…"
            spellCheck={false}
            className="flex-1 bg-transparent text-13 text-text outline-none placeholder:text-tertiary"
          />
          <button type="button" onClick={onClose} className="text-11 text-subtext hover:text-text">Esc</button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-3 text-12 text-subtext italic">No matching commands.</div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              type="button"
              onClick={() => { cmd.action(); onClose(); }}
              onMouseEnter={() => setSelected(i)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                i === selected ? "bg-cardHover" : "hover:bg-card/50",
              )}
            >
              <span className="text-10 text-tertiary uppercase tracking-wider w-[80px] shrink-0">
                {cmd.category}
              </span>
              <span className="flex-1 text-12 text-text truncate">{cmd.label}</span>
              <span className="text-10 text-tertiary font-mono shrink-0">
                {formatKeys(getKeyLabels(cmd))}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function getKeyLabels(cmd: Command): string[] {
  const keys = cmd.userKeys || cmd.defaultKeys;
  return keys.map(formatKeyDisplay);
}

function formatKeyDisplay(k: string): string {
  return k
    .replace("meta", "⌘")
    .replace("ctrl", "⌃")
    .replace("alt", "⌥")
    .replace("shift", "⇧")
    .replace(/\+/g, " ")
    .toUpperCase();
}

function formatKeys(keys: string[]): string {
  return keys.join(" ");
}
