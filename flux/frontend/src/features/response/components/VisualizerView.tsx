import { useState, useMemo, useEffect } from "react";
import { Eye, Table, MapPin, BarChart3 } from "lucide-react";
import { useResponseStore } from "@/features/request/stores/useResponseStore";
import { consumePendingVisualizer, renderTemplate } from "@/features/response/lib/visualizerRegistry";
import { cn } from "@/shared/lib/cn";

const EXAMPLES: Record<string, { label: string; template: string; data: any }> = {
  table: {
    label: "Table",
    template: `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#141414"><th style="padding:6px;text-align:left">Name</th><th style="padding:6px">Value</th></tr></thead><tbody>{{rows}}</tbody></table>`,
    data: { rows: `<tr><td>Use the response JSON — see raw</td></tr>` },
  },
  geo: {
    label: "Geo JSON",
    template: `<div style="padding:12px;background:#0A0A0A;color:#E6EDF3;font-family:monospace;font-size:11px;white-space:pre-wrap">{{json}}</div><div style="margin-top:8px;color:#9CA3AF;font-size:11px">Tip: paste a GeoJSON FeatureCollection to see it as a table — map rendering is opt-in.</div>`,
    data: {},
  },
  chart: {
    label: "Chart (bars)",
    template: `<div style="display:flex;align-items:end;gap:4px;height:120px;padding:12px;background:#141414;border:1px solid #2A2A2A;border-radius:8px">{{bars}}</div>`,
    data: { bars: `<div style="flex:1;background:#00D9FF;height:60%"></div><div style="flex:1;background:#00D9FF;height:90%"></div>` },
  },
};

export function VisualizerView() {
  const response = useResponseStore((s) => s.response);
  const body = response?.body ?? "";
  const [template, setTemplate] = useState<string>(() => {
    try {
      return localStorage.getItem("reqit:visualizer:template") || "";
    } catch {
      return "";
    }
  });
  const [example, setExample] = useState<string>("table");

  // Consume any pending visualizer.set() from a post-response script
  useEffect(() => {
    const pending = consumePendingVisualizer();
    if (pending?.template) {
      setTemplate(pending.template);
      try {
        localStorage.setItem("reqit:visualizer:template", pending.template);
      } catch {}
    }
  }, [body]);

  const rendered = useMemo(() => {
    if (!template.trim()) return "";
    try {
      // Try to parse body as JSON for data context
      let data: any = {};
      try {
        data = JSON.parse(body);
      } catch {
        data = { body };
      }
      // Support handlebars-like {{field}} plus {{json}} and {{rows}} helpers
      let html = template;
      // Inject a simple {{rows}} helper for table example
      if (html.includes("{{rows}}") && Array.isArray(data)) {
        const rows = data.slice(0, 50).map((row: any) => {
          const cells = Object.values(row).map((v) => `<td style="padding:6px;border-top:1px solid #2A2A2A">${String(v ?? "")}</td>`).join("");
          return `<tr>${cells}</tr>`;
        }).join("");
        html = html.replace(/\{\{\s*rows\s*\}\}/g, rows);
      }
      if (html.includes("{{bars}}") && Array.isArray(data)) {
        const max = Math.max(...data.map((d: any) => Number(d.value ?? d.count ?? 1)), 1);
        const bars = data.slice(0, 20).map((d: any) => {
          const h = Math.round((Number(d.value ?? d.count ?? 1) / max) * 100);
          return `<div style="flex:1;background:#00D9FF;height:${h}%;min-height:4px;border-radius:2px"></div>`;
        }).join("");
        html = html.replace(/\{\{\s*bars\s*\}\}/g, bars);
      }
      return renderTemplate(html, data, body);
    } catch (e) {
      return `<div style="color:#FF6B6B;font-size:12px">Template error: ${String(e)}</div>`;
    }
  }, [template, body]);

  const hasVisualizer = template.trim().length > 0;
  const isJson = (() => {
    try {
      JSON.parse(body);
      return true;
    } catch {
      return false;
    }
  })();

  if (!response) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-cyan/10 border border-cyan/20 flex items-center justify-center">
          <Eye size={20} className="text-cyan" />
        </div>
        <div className="text-xs font-bold text-text">Visualize</div>
        <div className="text-xs text-subtext max-w-sm">A render mode, not a new panel. Your post-response script can call <code className="font-mono bg-surface px-1 rounded">visualizer.set(template, data)</code> — or pick an example below and hit Send.</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-3 py-2 border-b border-border bg-surface/30 flex items-center gap-2">
        <span className="text-[10px] font-semibold text-subtext uppercase tracking-wider">Template</span>
        <select
          value={example}
          onChange={(e) => {
            const ex = EXAMPLES[e.target.value];
            if (ex) {
              setExample(e.target.value);
              setTemplate(ex.template);
              try {
                localStorage.setItem("reqit:visualizer:template", ex.template);
              } catch {}
            }
          }}
          className="h-[24px] px-2 text-11 bg-surface border border-border rounded text-text"
        >
          {Object.entries(EXAMPLES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={() => setTemplate(EXAMPLES.table.template)} className={cn("h-[22px] px-2 text-10 rounded border", template === EXAMPLES.table.template ? "bg-cyan text-white border-cyan" : "bg-surface border-border text-subtext")}><Table size={10} /> Table</button>
          <button onClick={() => setTemplate(EXAMPLES.geo.template)} className={cn("h-[22px] px-2 text-10 rounded border", template === EXAMPLES.geo.template ? "bg-cyan text-white border-cyan" : "bg-surface border-border text-subtext")}><MapPin size={10} /> Geo</button>
          <button onClick={() => setTemplate(EXAMPLES.chart.template)} className={cn("h-[22px] px-2 text-10 rounded border", template === EXAMPLES.chart.template ? "bg-cyan text-white border-cyan" : "bg-surface border-border text-subtext")}><BarChart3 size={10} /> Chart</button>
        </div>
        <button
          onClick={() => {
            setTemplate("");
            try {
              localStorage.removeItem("reqit:visualizer:template");
            } catch {}
          }}
          className="ml-auto text-10 text-subtext hover:text-danger"
        >
          Clear
        </button>
      </div>

      <div className="shrink-0 p-2 border-b border-border bg-bg">
        <textarea
          value={template}
          onChange={(e) => {
            setTemplate(e.target.value);
            try {
              localStorage.setItem("reqit:visualizer:template", e.target.value);
            } catch {}
          }}
          placeholder={`<div style="padding:12px">{{json}}</div>  — or use visualizer.set(template, data) in a post-response script`}
          spellCheck={false}
          rows={3}
          className="w-full px-2 py-1.5 bg-surface border border-border rounded text-11 font-mono text-text placeholder:text-subtext/60 outline-none focus:border-cyan"
        />
        <div className="text-[10px] text-subtext mt-1">
          In a post-response script: <code className="font-mono bg-surface px-1 rounded">visualizer.set("&lt;div&gt;&#123;&#123;name&#125;&#125;&lt;/div&gt;", JSON.parse(response.body))</code> — template supports <code className="font-mono bg-surface px-1 rounded">{"{{field}}"}</code>, <code className="font-mono bg-surface px-1 rounded">{"{{json}}"}</code>, <code className="font-mono bg-surface px-1 rounded">{"{{rows}}"}</code>, <code className="font-mono bg-surface px-1 rounded">{"{{bars}}"}</code>.
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {!hasVisualizer ? (
          <div className="p-6 text-center text-xs text-subtext">
            No template set — {isJson ? "try Table or Chart above, or paste your own HTML" : "response is not JSON, raw preview below"}
            <pre className="mt-3 text-left text-11 font-mono bg-card border border-border rounded p-3 overflow-x-auto max-h-[200px]">{body.slice(0, 2000) || "(empty)"}</pre>
          </div>
        ) : (
          <div className="p-4">
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-3 py-1.5 bg-surface border-b border-border flex items-center gap-1.5 text-[10px] font-semibold text-subtext uppercase tracking-wider">
                <Eye size={10} /> Visualized — {example}
              </div>
              <div className="p-3 bg-bg" dangerouslySetInnerHTML={{ __html: rendered }} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => navigator.clipboard.writeText(rendered)} className="h-[26px] px-2.5 text-xs rounded-md bg-surface border border-border text-subtext hover:text-text flex items-center gap-1">
                <Code2 size={11} /> Copy HTML
              </button>
              <span className="text-[10px] text-subtext">Rendered from <code className="font-mono bg-surface px-1 rounded">visualizer.set</code> — same response object</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Code2(props: any) {
  return (
    <svg width={props.size || 12} height={props.size || 12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
