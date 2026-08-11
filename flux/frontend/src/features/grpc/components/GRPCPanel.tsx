import { useCallback, useEffect, useRef, useState } from "react";
import { useUIStore } from "@/app/stores/useUIStore";
import { useEnvStore } from "@/features/env/stores/useEnvStore";
import {
  GRPCInvoke,
  GRPCListMethods,
  GRPCListProtoServices,
  GRPCListServices,
  GRPCStreamCancel,
  GRPCStreamCloseSend,
  GRPCStreamOpen,
  GRPCStreamSendMessage,
  PickFile,
} from "../../../../wailsjs/go/main/App";
import { EventsOn } from "../../../../wailsjs/runtime/runtime";
import { Play, Loader2, ChevronDown, ChevronRight, Server, Layers, RefreshCw, FileCode2, Send, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { models } from "../../../../wailsjs/go/models";

type SubTab = "unary" | "stream";

interface StreamFrame {
  flags: number;
  data: string;
}

interface GRPCStreamEvent {
  sessionId: string;
  type: string;
  frameNum?: number;
  data?: string;
  message?: string;
  durationMs?: number;
  grpcCode?: number;
  grpcStatus?: string;
  headers?: Record<string, string>;
  trailers?: Record<string, string>;
}

interface StreamResult {
  frames: StreamFrame[];
  statusCode: number;
  headers: Record<string, string>;
  trailers?: Record<string, string>;
  error?: string;
  grpcCode?: number;
  grpcStatus?: string;
  durationMs: number;
}

interface UnaryResult {
  statusCode: number;
  body: string;
  error?: string;
  durationMs: number;
  headers: Record<string, string>;
  trailers?: Record<string, string>;
  grpcCode?: number;
  grpcStatus?: string;
}

const SESSION_EVENT = "grpc:session";

export function GRPCPanel() {
  const setView = useUIStore((s) => s.setView);
  const resolveVars = useEnvStore((s) => s.resolve);
  const [tab, setTab] = useState<SubTab>("unary");
  const [url, setUrl] = useState("http://localhost:8080");
  const [service, setService] = useState("");
  const [method, setMethod] = useState("");
  const [body, setBody] = useState('{\n  "name": "test"\n}');
  const [metadata, setMetadata] = useState("{}");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UnaryResult | null>(null);
  const [streamResult, setStreamResult] = useState<StreamResult | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [reflecting, setReflecting] = useState(false);
  const [selectedService, setSelectedService] = useState("");
  const [protoFile, setProtoFile] = useState("");
  const [protoLoading, setProtoLoading] = useState(false);
  const [protoServices, setProtoServices] = useState<models.GRPCProtoService[]>([]);
  const [streamSession, setStreamSession] = useState("");
  const [streamInput, setStreamInput] = useState('{\n  "name": "test"\n}');
  const [streaming, setStreaming] = useState(false);
  const [streamFrames, setStreamFrames] = useState<StreamFrame[]>([]);
  const [streamStatus, setStreamStatus] = useState("");
  const [streamError, setStreamError] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [caCert, setCaCert] = useState("");
  const [clientCert, setClientCert] = useState("");
  const [clientKey, setClientKey] = useState("");
  const frameLogRef = useRef<HTMLDivElement>(null);

  const tlsConfig = (): models.GRPCTLSConfig => ({
    caCert: caCert || undefined,
    clientCert: clientCert || undefined,
    clientKey: clientKey || undefined,
  });

  const parseHeaders = (): Record<string, string> => {
    try { return JSON.parse(metadata); } catch { return {}; }
  };

  // Resolve {{var}} placeholders from the active environment across a value or
  // the keys/values of a headers map.
  const resolve = (text: string) => resolveVars(text);
  const resolveHeaders = (h: Record<string, string>): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(h)) {
      out[resolve(k)] = resolve(v);
    }
    return out;
  };

  // Auto-reflect when the URL changes (debounced).
  useEffect(() => {
    if (tab !== "unary" || !url.trim()) return;
    const t = setTimeout(() => { void loadServices(); }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, tab]);

  const loadServices = async () => {
    if (!url.trim()) return;
    setReflecting(true);
    setError("");
    setServices([]);
    setMethods([]);
    try {
      const svcs = await GRPCListServices(resolve(url.trim()), resolveHeaders(parseHeaders()), tlsConfig());
      setServices(svcs);
    } catch (e) {
      // silent — reflection is best-effort; user can still type names manually
    } finally {
      setReflecting(false);
    }
  };

  const loadMethods = async (svc: string) => {
    setService(svc);
    setSelectedService(svc);
    setMethod("");
    setMethods([]);
    try {
      const m = await GRPCListMethods(resolve(url.trim()), svc, resolveHeaders(parseHeaders()), tlsConfig());
      setMethods(m);
    } catch (e) {
      setError("Reflection failed: " + String(e));
    }
  };

  const pickProto = async () => {
    const path = await PickFile("Select .proto file", "*.proto");
    if (!path) return;
    setProtoLoading(true);
    setError("");
    try {
      const svcs = await GRPCListProtoServices(path);
      setProtoFile(path);
      setProtoServices(svcs);
      setServices(svcs.map((s) => s.fullyQualifiedName));
      setMethods([]);
      setService("");
      setSelectedService("");
      setMethod("");
    } catch (e) {
      setError("Proto load failed: " + String(e));
    } finally {
      setProtoLoading(false);
    }
  };

  const applyProtoMethod = (svcName: string, methodName: string) => {
    setService(svcName);
    setSelectedService(svcName);
    setMethod(methodName);
    const svc = protoServices.find((s) => s.fullyQualifiedName === svcName);
    const m = svc?.methods.find((x) => x.name === methodName);
    if (m?.exampleJson) setBody(m.exampleJson);
  };

  const clearProto = () => {
    setProtoFile("");
    setProtoServices([]);
    setServices([]);
    setMethods([]);
  };

  const invokeUnary = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const h = resolveHeaders(parseHeaders());
      const r = await GRPCInvoke(resolve(url), service, method, resolve(body), h, tlsConfig()) as unknown as UnaryResult;
      setResult(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // --- Live streaming (all 4 gRPC streaming types) ---
  useEffect(() => {
    if (tab !== "stream") return;
    const off = EventsOn(SESSION_EVENT, (ev: GRPCStreamEvent) => {
      if (!streamSession || ev.sessionId !== streamSession) return;
      if (ev.type === "frame") {
        setStreamFrames((prev) => [...prev, { flags: 0, data: ev.data ?? "" }]);
      } else if (ev.type === "done") {
        setStreaming(false);
        setStreamStatus(ev.grpcStatus || "OK");
        setStreamError(ev.message ?? "");
      } else if (ev.type === "error") {
        setStreaming(false);
        setStreamError(ev.message ?? "stream error");
      }
    });
    return () => {
      off();
      if (streamSession) void GRPCStreamCancel(streamSession).catch(() => {});
      setStreamSession("");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, streamSession]);

  useEffect(() => {
    frameLogRef.current?.scrollTo({ top: frameLogRef.current.scrollHeight });
  }, [streamFrames]);

  const startStream = async () => {
    setError("");
    setStreamFrames([]);
    setStreamStatus("");
    setStreamError("");
    setStreaming(true);
    try {
      const id = await GRPCStreamOpen({
        url: resolve(url),
        service,
        method,
        body: resolve(body),
        headers: resolveHeaders(parseHeaders()),
        protoFile: protoFile || undefined,
        autoClose: true,
        caCert: caCert || undefined,
        clientCert: clientCert || undefined,
        clientKey: clientKey || undefined,
      } as models.GRPCStreamRequest);
      setStreamSession(id);
    } catch (e) {
      setStreaming(false);
      setError("Start stream failed: " + String(e));
    }
  };

  const sendStreamMessage = async () => {
    if (!streamSession || !sendMessage.trim()) return;
    try {
      await GRPCStreamSendMessage(streamSession, resolve(sendMessage));
      setSendMessage("");
    } catch (e) {
      setStreamError("Send failed: " + String(e));
    }
  };

  const closeStreamSend = async () => {
    if (!streamSession) return;
    try {
      await GRPCStreamCloseSend(streamSession);
    } catch (e) {
      setStreamError("CloseSend failed: " + String(e));
    }
  };

  const stopStream = async () => {
    setStreaming(false);
    if (streamSession) {
      await GRPCStreamCancel(streamSession).catch(() => {});
      setStreamSession("");
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg">
      <header className="h-[48px] flex items-center gap-3 px-4 border-b border-border shrink-0">
        <button onClick={() => setView("http")} className="text-subtext hover:text-text text-13 transition-colors">&larr; Back</button>
        <h1 className="text-14 font-semibold text-text">gRPC Client</h1>
      </header>

      <div className="flex gap-1 px-4 py-2 border-b border-border shrink-0">
        {([{ key: "unary" as SubTab, label: "Unary" }, { key: "stream" as SubTab, label: "Stream (live)" }]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-12 rounded-md transition-colors ${tab === t.key ? "bg-cyan/10 text-cyan font-semibold" : "text-subtext hover:text-text hover:bg-cardHover"}`}
          >{t.label}</button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-[400px] shrink-0 border-r border-border overflow-y-auto p-3 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-11 text-subtext font-semibold block">Server URL</label>
              <button
                onClick={loadServices}
                disabled={reflecting || !url.trim()}
                className="flex items-center gap-1 text-10 text-subtext hover:text-cyan transition-colors disabled:opacity-40"
              >
                <RefreshCw size={10} className={cn(reflecting && "animate-spin")} />
                {reflecting ? "Reflecting…" : "Reflect"}
              </button>
            </div>
            <input value={url} onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-12 text-text outline-none focus:border-cyan transition-colors font-mono"
              placeholder="localhost:50051 or https://host:443"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-11 text-subtext font-semibold block">Proto file</label>
              <button
                onClick={pickProto}
                disabled={protoLoading}
                className="flex items-center gap-1 text-10 text-subtext hover:text-cyan transition-colors disabled:opacity-40"
              >
                <FileCode2 size={10} className={cn(protoLoading && "animate-spin")} />
                {protoLoading ? "Loading…" : "Import .proto"}
              </button>
            </div>
            <div className="flex items-center gap-1">
              <input value={protoFile} readOnly
                className="flex-1 bg-surface border border-border rounded-md px-3 py-1.5 text-11 text-subtext outline-none font-mono"
                placeholder="No proto file loaded"
              />
              {protoFile && (
                <button onClick={clearProto} title="Clear proto" className="text-subtext hover:text-danger transition-colors">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-11 text-subtext font-semibold block mb-1">Service</label>
              {services.length > 0 ? (
                <select value={service}
                  onChange={(e) => {
                    if (protoFile) {
                      const v = e.target.value;
                      setService(v);
                      setSelectedService(v);
                      const svc = protoServices.find((s) => s.fullyQualifiedName === v);
                      if (svc) {
                        setMethods(svc.methods.map((m) => m.name));
                        setMethod("");
                      }
                    } else {
                      void loadMethods(e.target.value);
                    }
                  }}
                  className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-12 text-text outline-none focus:border-cyan transition-colors font-mono">
                  <option value="">Select service…</option>
                  {services.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input value={service} onChange={(e) => { setService(e.target.value); setSelectedService(""); }}
                  className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-12 text-text outline-none focus:border-cyan transition-colors font-mono"
                  placeholder="my.package.MyService"
                />
              )}
            </div>
            <div className="flex-1">
              <label className="text-11 text-subtext font-semibold block mb-1">Method</label>
              {methods.length > 0 ? (
                <select value={method}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (protoFile) {
                      applyProtoMethod(service, v);
                    } else {
                      setMethod(v);
                    }
                  }}
                  className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-12 text-text outline-none focus:border-cyan transition-colors font-mono">
                  <option value="">Select method…</option>
                  {methods.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input value={method} onChange={(e) => setMethod(e.target.value)}
                  className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-12 text-text outline-none focus:border-cyan transition-colors font-mono"
                  placeholder="MyMethod"
                />
              )}
            </div>
          </div>

          <div>
            <details className="group">
              <summary className="text-11 text-subtext cursor-pointer hover:text-text transition-colors select-none">TLS / mTLS (PEM)</summary>
              <div className="mt-1 space-y-1.5">
                <input value={caCert} onChange={(e) => setCaCert(e.target.value)}
                  className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-11 text-text outline-none focus:border-cyan transition-colors font-mono"
                  placeholder="CA certificate (PEM) — custom root"
                />
                <input value={clientCert} onChange={(e) => setClientCert(e.target.value)}
                  className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-11 text-text outline-none focus:border-cyan transition-colors font-mono"
                  placeholder="Client certificate (PEM)"
                />
                <input value={clientKey} onChange={(e) => setClientKey(e.target.value)}
                  className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-11 text-text outline-none focus:border-cyan transition-colors font-mono"
                  placeholder="Client private key (PEM)"
                />
              </div>
            </details>
          </div>

          {tab === "unary" ? (
            <>
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
              <button onClick={invokeUnary}
                disabled={loading}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-cyan text-bg text-12 font-semibold hover:bg-cyan/90 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                Invoke Unary
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="text-11 text-subtext font-semibold block mb-1">First Message (JSON)</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)}
                  className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-12 text-text outline-none focus:border-cyan transition-colors font-mono resize-none"
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={streaming ? stopStream : startStream}
                  disabled={!url.trim() || !service || !method}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-12 font-semibold transition-colors disabled:opacity-50",
                    streaming ? "bg-danger/15 text-danger hover:bg-danger/25" : "bg-cyan text-bg hover:bg-cyan/90",
                  )}
                >
                  {streaming ? <X size={13} /> : <Play size={13} />}
                  {streaming ? "Stop Stream" : "Start Stream"}
                </button>
              </div>
              {streamSession && (
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="text-11 text-subtext font-semibold block mb-1">Send Message (client / bidi streams)</label>
                    <textarea value={sendMessage} onChange={(e) => setSendMessage(e.target.value)}
                      className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-12 text-text outline-none focus:border-cyan transition-colors font-mono resize-none"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={sendStreamMessage} disabled={!sendMessage.trim()}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-md bg-surface border border-border text-text text-11 hover:border-cyan transition-colors disabled:opacity-40"
                    >
                      <Send size={11} /> Send
                    </button>
                    <button onClick={closeStreamSend}
                      className="flex-1 px-3 py-1.5 rounded-md bg-surface border border-border text-text text-11 hover:border-cyan transition-colors"
                      title="Signal no more messages (required to finish a client-streaming / bidi call)"
                    >
                      Close Send
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-3 py-1 border-b border-border shrink-0">
            <span className="text-11 text-subtext font-semibold uppercase tracking-wider flex items-center gap-1.5">
              {tab === "unary" ? <Play size={12} /> : <Layers size={12} />}
              {tab === "unary" ? "Response" : "Streamed Frames"}
            </span>
            {tab === "unary" && result && (
              <span className="text-11 text-subtext">
                <span className={cn("mr-2", result.grpcStatus ? "text-cyan" : (result.statusCode > 0 && result.statusCode < 400) ? "text-green-400" : "text-danger")}>
                  {result.grpcStatus || result.statusCode || "error"}
                </span>
                {result.durationMs > 0 && <span>{result.durationMs}ms</span>}
              </span>
            )}
            {tab === "stream" && (
              <span className="text-11 text-subtext flex items-center gap-2">
                {streaming && <span className="flex items-center gap-1 text-amber"><Loader2 size={10} className="animate-spin" /> live</span>}
                <span className="text-cyan">{streamFrames.length} frames</span>
                {streamStatus && <span className="text-cyan">{streamStatus}</span>}
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
                {result.trailers && Object.keys(result.trailers).length > 0 && (
                  <details>
                    <summary className="text-11 text-subtext cursor-pointer hover:text-text">Trailers</summary>
                    <div className="mt-1 space-y-0.5">
                      {Object.entries(result.trailers).map(([k, v]) => (
                        <div key={k} className="text-11 text-subtext"><span className="text-text">{k}</span>: {v}</div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
            {tab === "stream" && (
              <div ref={frameLogRef} className="p-3 space-y-2 overflow-y-auto max-h-full">
                {streamError && <div className="text-12 text-danger">{streamError}</div>}
                {!streamSession && !streamFrames.length && (
                  <p className="text-12 text-subtext">Start a stream to watch responses arrive live.</p>
                )}
                {streamFrames.map((f, i) => (
                  <div key={i} className="rounded border border-border overflow-hidden">
                    <div className="flex items-center gap-2 px-2 py-1 bg-surface border-b border-border text-11 text-subtext">
                      <span className="font-semibold text-text">Frame #{i + 1}</span>
                      <span className="px-1.5 py-0.5 rounded text-10 bg-cyan/10 text-cyan">data</span>
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