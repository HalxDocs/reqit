import { useMemo } from "react";
import { useHistoryStore } from "@/features/history/stores/useHistoryStore";
import { useRequestStore } from "@/features/request/stores/useRequestStore";

export function PerformanceChart() {
  const entries = useHistoryStore((s) => s.entries);
  const currentUrl = useRequestStore((s) => s.url);

  const chartData = useMemo(() => {
    if (!currentUrl) return [];
    const urlBase = currentUrl.split("?")[0].toLowerCase();
    return entries
      .filter((e) => e.payload.url?.toLowerCase().split("?")[0] === urlBase && e.response.timingMs > 0)
      .slice(-50)
      .map((e) => ({
        time: e.createdAt,
        timingMs: e.response.timingMs,
        status: e.response.statusCode,
      }));
  }, [entries, currentUrl]);

  if (!currentUrl) {
    return <div className="p-5 text-12 text-subtext">Send a request to see performance history.</div>;
  }

  if (chartData.length === 0) {
    return <div className="p-5 text-12 text-subtext">No timing data yet for this URL.</div>;
  }

  const maxTiming = Math.max(...chartData.map((d) => d.timingMs), 1);
  const avgTiming = Math.round(chartData.reduce((s, d) => s + d.timingMs, 0) / chartData.length);
  const p95Index = Math.floor(chartData.length * 0.95);
  const p95Timing = chartData.length > 0 ? chartData.slice().sort((a, b) => a.timingMs - b.timingMs)[p95Index]?.timingMs ?? 0 : 0;

  const chartWidth = 500;
  const chartHeight = 120;
  const padding = { top: 10, right: 10, bottom: 20, left: 50 };
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  const points = chartData.map((d, i) => {
    const x = padding.left + (i / Math.max(chartData.length - 1, 1)) * innerW;
    const y = padding.top + innerH - (d.timingMs / maxTiming) * innerH;
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: padding.top + innerH - f * innerH,
    label: Math.round(maxTiming * f) + "ms",
  }));

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center gap-4 text-11">
        <span className="text-subtext">Samples: <span className="text-text font-semibold">{chartData.length}</span></span>
        <span className="text-subtext">Avg: <span className="text-text font-semibold">{avgTiming}ms</span></span>
        <span className="text-subtext">P95: <span className="text-amber font-semibold">{p95Timing}ms</span></span>
        <span className="text-subtext">Max: <span className="text-danger font-semibold">{maxTiming}ms</span></span>
      </div>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-[120px]"
        role="img"
        aria-label="Response time history chart"
      >
        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padding.left} y1={t.y} x2={chartWidth - padding.right} y2={t.y} stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="3,3" />
            <text x={padding.left - 4} y={t.y + 3} textAnchor="end" fontSize="9" fill="var(--color-subtext)">
              {t.label}
            </text>
          </g>
        ))}

        {/* Line */}
        <path d={pathD} fill="none" stroke="var(--color-cyan)" strokeWidth="1.5" strokeLinejoin="round" />

        {/* Area fill */}
        <path
          d={`${pathD} L${points[points.length - 1]?.x ?? 0},${padding.top + innerH} L${padding.left},${padding.top + innerH} Z`}
          fill="var(--color-cyan)"
          fillOpacity="0.08"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={p.status >= 400 ? "var(--color-danger)" : "var(--color-cyan)"} />
        ))}
      </svg>
    </div>
  );
}
