import { useEffect, useState } from "react";
import { useResponseStore } from "../../stores/useResponseStore";
import { cn } from "../../lib/cn";
import { formatSize, formatTiming, statusColor } from "../../lib/format";
import { ContractBadge } from "./ContractBadge";
import { CaptureVarMenu } from "../shared/CaptureVarMenu";

export function StatusBar() {
  const response = useResponseStore((s) => s.response);
  const isLoading = useResponseStore((s) => s.isLoading);
  const startedAt = useResponseStore((s) => s.startedAt);

  const [elapsed, setElapsed] = useState(0);
  const [capture, setCapture] = useState<{ value: string; x: number; y: number } | null>(null);
  useEffect(() => {
    if (!isLoading || !startedAt) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 100);
    return () => clearInterval(interval);
  }, [isLoading, startedAt]);

  if (isLoading) {
    return (
      <div className="h-[40px] px-4 border-b border-border flex items-center gap-4 text-12">
        <span className="text-blue font-bold">Sending…</span>
        <span className="text-subtext font-mono">{formatTiming(elapsed)}</span>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="h-[40px] px-4 border-b border-border flex items-center text-12 text-subtext">
        Status — Time — Size
      </div>
    );
  }

  if (response.error) {
    return (
      <div className="h-[40px] px-4 border-b border-border flex items-center gap-4 text-12">
        <span className="text-danger font-bold">ERROR</span>
        <span className="text-subtext font-mono">{formatTiming(response.timingMs)}</span>
      </div>
    );
  }

  const handleCtx = (e: React.MouseEvent, value: string) => {
    e.preventDefault();
    setCapture({ value, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="h-[40px] px-4 border-b border-border flex items-center gap-5 text-12">
      <span className="flex items-center gap-2">
        <span className="text-subtext text-11 uppercase tracking-wider">Status</span>
        <span
          className={cn("font-mono font-bold text-13 cursor-context-menu", statusColor(response.statusCode))}
          onContextMenu={(e) => handleCtx(e, String(response.statusCode))}
        >
          {response.statusCode} {extractStatusText(response.status, response.statusCode)}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className="text-subtext text-11 uppercase tracking-wider">Time</span>
        <span
          className="text-text font-mono cursor-context-menu"
          onContextMenu={(e) => handleCtx(e, formatTiming(response.timingMs))}
        >
          {formatTiming(response.timingMs)}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className="text-subtext text-11 uppercase tracking-wider">Size</span>
        <span
          className="text-text font-mono cursor-context-menu"
          onContextMenu={(e) => handleCtx(e, formatSize(response.sizeBytes))}
        >
          {formatSize(response.sizeBytes)}
        </span>
      </span>
      <ContractBadge validation={response.validation} />
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

function extractStatusText(status: string, code: number): string {
  // status looks like "200 OK"; strip leading code if present
  const trimmed = status.trim();
  if (trimmed.startsWith(String(code))) {
    return trimmed.slice(String(code).length).trim();
  }
  return trimmed;
}
