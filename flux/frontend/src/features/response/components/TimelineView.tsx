import { useResponseStore } from "@/features/request/stores/useResponseStore";
import { formatTiming } from "@/shared/lib/format";
import { cn } from "@/shared/lib/cn";

type Phase = {
  label: string;
  key: string;
  ms: number;
  color: string;
};

export function TimelineView() {
  const response = useResponseStore((s) => s.response);
  const timing = response?.timing;
  if (!timing) {
    return (
      <div className="flex-1 flex items-center justify-center text-12 text-subtext">
        {response ? "No timing data available." : "Send a request to see timing."}
      </div>
    );
  }

  const total = timing.totalMs || 1;
  const phases: Phase[] = [
    { label: "DNS Lookup", key: "dns", ms: timing.dnsLookupMs, color: "bg-cyan" },
    { label: "TCP Connect", key: "tcp", ms: timing.tcpConnectMs, color: "bg-blue-500" },
    { label: "TLS Handshake", key: "tls", ms: timing.tlsHandshakeMs, color: "bg-purple-500" },
    { label: "TTFB", key: "ttfb", ms: timing.ttfbMs, color: "bg-amber-500" },
    { label: "Download", key: "download", ms: timing.downloadMs, color: "bg-green-500" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      <h3 className="text-11 text-subtext font-semibold uppercase tracking-wider mb-2">
        Request Timeline
      </h3>

      {phases.map((p) => {
        if (p.ms <= 0) return null;
        const pct = Math.max((p.ms / total) * 100, 1);
        return (
          <div key={p.key} className="flex items-center gap-3">
            <span className="w-[100px] text-11 text-subtext shrink-0">{p.label}</span>
            <div className="flex-1 h-[16px] bg-card rounded-sm overflow-hidden relative">
              <div
                className={cn("h-full rounded-sm transition-all", p.color)}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="w-[60px] text-11 text-text font-mono text-right shrink-0">
              {formatTiming(p.ms)}
            </span>
          </div>
        );
      })}

      <div className="border-t border-border pt-3 mt-4">
        <div className="flex items-center justify-between text-12">
          <span className="text-subtext font-semibold">Total</span>
          <span className="font-mono text-text">{formatTiming(total)}</span>
        </div>
        <div className="flex items-center justify-between text-12 mt-1">
          <span className="text-subtext">Response Size</span>
          <span className="font-mono text-text">
            {formatSize(response?.sizeBytes ?? 0)}
          </span>
        </div>
        <div className="flex items-center justify-between text-12 mt-1">
          <span className="text-subtext">Status</span>
          <span className="font-mono text-text">
            {response?.statusCode} {response?.status}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
