import { useState } from "react";
import { useUIStore } from "@/app/stores/useUIStore";
import { GRPCInvoke, GRPCStreamInvoke } from "../../../../wailsjs/go/main/App";
import { Play, Loader2, ChevronDown, ChevronRight, Server, Layers } from "lucide-react";
import { cn } from "@/shared/lib/cn";

type SubTab = "unary" | "stream";

interface StreamFrame {
  flags: number;
  data: string;
}

interface StreamResult {
  frames: StreamFrame[];
  statusCode: number;
  headers: Record<string, string>;
  error?: string;
  durationMs: number;
}

interface UnaryResult {
  statusCode: number;
  body: string;
  error?: string;
  durationMs: number;
  headers: Record<string, string>;
}

export function GRPCPanel() {
  const setView = useUIStore((s) => s.setView);
  const [tab, setTab] = useState<SubTab>("unary");
  const [url, setUrl] = useState("http://localhost:8080");
  const [service, setService] = useState("my.package.MyService");
  const [method, setMethod] = useState("MyMethod");
  const [body, setBody] = useState('{\n  "name": "test"\n}');
  const [metadata, setMetadata] = useState("{}");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UnaryResult | null>(null);
  const [streamResult, setStreamResult] = useState<StreamResult | null>(null);

  const parseHeaders = (): Record<string, string> => {
    try { return JSON.parse(metadata); } catch { return {}; }
  };

  const invokeUnary = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const h = parseHeaders();
      const r = await GRPCInvoke(url, service, method, body, h) as unknown as UnaryResult;
      setResult(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const invokeStream = async () => {
    setLoading(true);
    setError("");
    setStreamResult(null);
    try {
      const h = parseHeaders();
      const raw = await GRPCStreamInvoke(url, service, method, body, h);
      const r: StreamResult = JSON.parse(raw);
      setStreamResult(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg">
      <header className="h-[48px] flex items-center gap-3 px-4 border-b border-border shrink-0">
        <button onClick={() => setView("http")} className="text-subtext hover:text-text text-13 transition-colors">&larr; Back</button>
        <h1 className="text-14 font-semibold text-text">gRPC Client</h1>
      </header>

      <div className="flex gap-1 px-4 py-2 border-b border-border shrink-0">
        {([{ key: "unary" as SubTab, label: "Unary" }, { key: "stream" as SubTab, label: "Server Stream" }]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-12 rounded-md transition-colors ${tab === t.key ? "bg-cyan/10 text-cyan font-semibold" : "text-subtext hover:text-text hover:bg-cardHover"}`}
          >{t.label}</button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-[400px] shrink-0 border-r border-border overflow-y-auto p-3 space-y-3">
          <div>
            <label className="text-11 text-subtext font-semibold block mb-1">Server URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-12 text-text outline-none focus:border-cyan transition-colors"
              placeholder="http://localhost:8080"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-11 text-subtext font-semibold block mb-1">Service</label>
              <input value={service} onChange={(e) => setService(e.target.value)}
                className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-12 text-text outline-none focus:border-cyan transition-colors font-mono"
                placeholder="my.package.MyService"
              />
            </div>
            <div className="flex-1">
              <label className="text-11 text-subtext font-semibold block mb-1">Method</label>
              <input value={method} onChange={(e) => setMethod(e.target.value)}
                className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-12 text-text outline-none focus:border-cyan transition-colors font-mono"
                placeholder="MyMethod"
              />
            </div>
          </div>
          <div>
            <label className="text-11 text-subtext font-semibold block mb-1">Request Body (JSON)</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)}
              className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-12 text-text outline-none focus:border-cyan transition-colors font-mono resize-none"
              rows={6}
            />
          </div>
          <div>
            <details className="group">
              <summary className="text-11 text-subtext cursor-pointer hover:text-text transition-colors select-none">Metadata / Headers</summary>
              <textarea value={metadata} onChange={(e) => setMetadata(e.target.value)}
                className="w-full mt-1 bg-surface border border-border rounded-md px-3 py-1.5 text-12 text-text outline-none focus:border-cyan transition-colors font-mono resize-none"
                rows={3}
                placeholder='{"Authorization": "Bearer token"}'
              />
            </details>
          </div>
          <button onClick={tab === "unary" ? invokeUnary : invokeStream}
            disabled={loading}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-cyan text-bg text-12 font-semibold hover:bg-cyan/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {tab === "unary" ? "Invoke Unary" : "Start Stream"}
          </button>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-3 py-1 border-b border-border shrink-0">
            <span className="text-11 text-subtext font-semibold uppercase tracking-wider flex items-center gap-1.5">
              {tab === "unary" ? <Play size={12} /> : <Layers size={12} />}
              {tab === "unary" ? "Response" : "Streamed Frames"}
            </span>
            {result && tab === "unary" && (
              <span className="text-11 text-subtext">
                <span className={cn("mr-2", (result.statusCode > 0 && result.statusCode < 400) ? "text-green-400" : "text-danger")}>
                  {result.statusCode || "error"}
                </span>
                {result.durationMs > 0 && <span>{result.durationMs}ms</span>}
              </span>
            )}
            {streamResult && tab === "stream" && (
              <span className="text-11 text-subtext">
                <span className="text-cyan mr-2">{streamResult.frames?.length || 0} frames</span>
                <span className={streamResult.statusCode > 0 && streamResult.statusCode < 400 ? "text-green-400" : "text-danger"}>
                  {streamResult.statusCode || "error"}
                </span>
                {streamResult.durationMs > 0 && <span className="ml-2">{streamResult.durationMs}ms</span>}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {error && <div className="p-3 text-12 text-danger">{error}</div>}
            {result && tab === "unary" && (
              <div className="p-3 space-y-3">
                {result.error && <div className="text-12 text-danger">{result.error}</div>}
                <pre className="text-12 font-mono whitespace-pre-wrap break-all text-text bg-surface rounded-md p-3 border border-border/50">
                  <code>{result.body || "(empty)"}</code>
                </pre>
                {result.headers && Object.keys(result.headers).length > 0 && (
                  <details>
                    <summary className="text-11 text-subtext cursor-pointer hover:text-text">Response Headers</summary>
                    <div className="mt-1 space-y-0.5">
                      {Object.entries(result.headers).map(([k, v]) => (
                        <div key={k} className="text-11 text-subtext"><span className="text-text">{k}</span>: {v}</div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
            {streamResult && tab === "stream" && (
              <div className="p-3 space-y-2">
                {streamResult.error && <div className="text-12 text-danger">{streamResult.error}</div>}
                {(!streamResult.frames || streamResult.frames.length === 0) && (
                  <p className="text-12 text-subtext">No frames received.</p>
                )}
                {streamResult.frames?.map((f, i) => (
                  <div key={i} className="rounded border border-border overflow-hidden">
                    <div className="flex items-center gap-2 px-2 py-1 bg-surface border-b border-border text-11 text-subtext">
                      <span className="font-semibold text-text">Frame #{i + 1}</span>
                      <span className={cn("px-1.5 py-0.5 rounded text-10", f.flags === 1 ? "bg-green-500/15 text-green-400" : "bg-cyan/10 text-cyan")}>
                        {f.flags === 1 ? "trailer" : "data"}
                      </span>
                    </div>
                    <pre className="text-11 font-mono whitespace-pre-wrap break-all text-text p-2">
                      <code>{f.data || "(empty)"}</code>
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
