import { useEffect } from "react";
import { useUIStore } from "@/app/stores/useUIStore";
import { getCommands } from "@/shared/lib/commands";
import { X } from "lucide-react";

const CATEGORY_ORDER = ["General", "Request", "Tabs", "Response", "Import", "Collection", "Sidebar", "Environment", "Edit"];

export function ShortcutsModal() {
  const open = useUIStore((s) => s.shortcutsModalOpen);
  const close = useUIStore((s) => s.closeShortcutsModal);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

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
          {CATEGORY_ORDER.filter((cat) => grouped[cat]).map((cat) => (
            <div key={cat} className="mb-5 last:mb-0">
              <h3 className="text-11 font-semibold text-subtext uppercase tracking-wider mb-2">{cat}</h3>
              <div className="flex flex-col gap-1">
                {grouped[cat].map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-1">
                    <span className="text-12 text-text">{c.label}</span>
                    <kbd className="text-11 font-mono text-subtext bg-surface border border-border rounded px-2 py-0.5">
                      {c.defaultKeys.map(formatKey).join(", ")}
                    </kbd>
                  </div>
                ))}
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
