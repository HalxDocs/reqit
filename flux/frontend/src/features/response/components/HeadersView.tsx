import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { CaptureVarMenu } from "@/shared/components/CaptureVarMenu";

export function HeadersView({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers).sort(([a], [b]) => a.localeCompare(b));
  const [capture, setCapture] = useState<{ value: string; x: number; y: number } | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleCtx = (e: React.MouseEvent, value: string) => {
    e.preventDefault();
    setCapture({ value, x: e.clientX, y: e.clientY });
  };

  const copyAll = useCallback(async () => {
    const text = entries.map(([k, v]) => `${k}: ${v}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  }, [entries]);

  if (entries.length === 0) {
    return <div className="p-5 text-12 text-subtext">No response headers.</div>;
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="grid grid-cols-[1fr_2fr] gap-3 flex-1 text-11 text-subtext font-semibold uppercase tracking-wider">
          <span>Name</span>
          <span>Value</span>
        </div>
        <button
          type="button"
          onClick={copyAll}
          className="flex items-center gap-1 text-11 text-subtext hover:text-text transition-colors ml-2 shrink-0"
          title="Copy all headers"
        >
          {copiedAll ? <Check size={11} className="text-teal" /> : <Copy size={11} />}
          {copiedAll ? "Copied" : "Copy all"}
        </button>
      </div>
      {entries.map(([name, value]) => (
        <div
          key={name}
          className="grid grid-cols-[1fr_2fr] gap-3 px-4 py-2 border-b border-border/50 hover:bg-card/50 transition-colors"
        >
          <span className="font-mono text-11 text-subtext break-all">{name}</span>
          <span
            className="font-mono text-11 text-text break-all cursor-context-menu"
            onContextMenu={(e) => handleCtx(e, value)}
          >
            {value}
          </span>
        </div>
      ))}
      <CaptureVarMenu
        open={capture !== null}
        value={capture?.value ?? ""}
        x={capture?.x ?? 0}
        y={capture?.y ?? 0}
        onClose={() => setCapture(null)}
      />
    </div>
  );
}
