import { useEffect, useCallback, useState } from "react";
import { useUIStore } from "@/app/stores/useUIStore";
import { getCommands, setUserKeys, resetKeys, getActiveKeys } from "@/shared/lib/commands";
import { RotateCcw, X } from "lucide-react";

const CATEGORY_ORDER = ["General", "Request", "Tabs", "Response", "Import", "Collection", "Sidebar", "Environment", "Edit"];

export function ShortcutsModal() {
  const open = useUIStore((s) => s.shortcutsModalOpen);
  const close = useUIStore((s) => s.closeShortcutsModal);
  const [, forceUpdate] = useState(0);
  const [recording, setRecording] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (recording) setRecording(null);
        else close();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close, recording]);

  const handleRecordKey = useCallback((cmdId: string, e: React.KeyboardEvent | KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const native = e as KeyboardEvent;
    const parts: string[] = [];
    if (native.metaKey || native.ctrlKey) parts.push(native.metaKey ? "meta" : "ctrl");
    if (native.altKey) parts.push("alt");
    if (native.shiftKey) parts.push("shift");
    const key = native.key.toLowerCase();
    if (key === "control" || key === "alt" || key === "shift" || key === "meta") return;
    parts.push(key);
    const combo = parts.join("+");
    setUserKeys(cmdId, [combo]);
    setRecording(null);
    forceUpdate((n) => n + 1);
  }, []);

  if (!open) return null;

  const commands = getCommands().filter((c) => c.defaultKeys.length > 0);
  const grouped: Record<string, typeof commands> = {};
  for (const c of commands) {
    (grouped[c.category] ??= []).push(c);
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50" onClick={close}>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-[600px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-14 font-bold text-text">Keyboard Shortcuts</h2>
          <button type="button" onClick={close} className="text-subtext hover:text-text transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {recording && (
            <div className="mb-3 p-2 bg-cyan/10 border border-cyan/30 rounded-md text-12 text-cyan text-center">
              Press a key combination… (Escape to cancel)
            </div>
          )}
          {CATEGORY_ORDER.filter((cat) => grouped[cat]).map((cat) => (
            <div key={cat} className="mb-5 last:mb-0">
              <h3 className="text-11 font-semibold text-subtext uppercase tracking-wider mb-2">{cat}</h3>
              <div className="flex flex-col gap-1">
                {grouped[cat].map((c) => {
                  const activeKeys = getActiveKeys(c.id);
                  const isCustom = !!c.userKeys;
                  const isRecording = recording === c.id;
                  return (
                    <div key={c.id} className="flex items-center justify-between py-1 group">
                      <span className="text-12 text-text">{c.label}</span>
                      <div className="flex items-center gap-1.5">
                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => { resetKeys(c.id); forceUpdate((n) => n + 1); }}
                            className="text-subtext/40 hover:text-danger transition-colors"
                            title="Reset to default"
                          >
                            <RotateCcw size={10} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setRecording(isRecording ? null : c.id)}
                          onKeyDown={isRecording ? (e) => handleRecordKey(c.id, e) : undefined}
                          className={`text-11 font-mono rounded px-2 py-0.5 transition-colors border ${
                            isRecording
                              ? "bg-cyan/20 border-cyan text-cyan ring-2 ring-cyan/30"
                              : isCustom
                                ? "bg-amber/10 border-amber/30 text-amber hover:border-amber/60"
                                : "bg-surface border-border text-subtext hover:border-subtext/40"
                          }`}
                          title={isRecording ? "Press keys…" : "Click to remap"}
                        >
                          {activeKeys.map(formatKey).join(", ")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatKey(key: string): string {
  return key
    .replace(/^meta/, "⌘")
    .replace(/^ctrl/, "Ctrl")
    .replace(/^shift/, "Shift")
    .replace(/^alt/, "Alt")
    .replace(/^arrowup/, "↑")
    .replace(/^arrowdown/, "↓")
    .replace(/^arrowleft/, "←")
    .replace(/^arrowright/, "→")
    .replace(/^enter/, "⏎")
    .replace(/^escape/, "⎋")
    .replace(/^delete/, "⌦")
    .replace(/^backspace/, "⌫")
    .replace(/^tab/, "⇥")
    .replace(/^f(\d+)/, "F$1")
    .replace(/\+/g, " ");
}
