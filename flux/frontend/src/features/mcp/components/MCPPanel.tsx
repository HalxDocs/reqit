import { useCallback, useEffect, useState } from "react";
import { Copy, Check, Terminal, Globe, Plug, RefreshCw, Play, Square, ExternalLink, Boxes, Activity, Trash2, Search, Clock } from "lucide-react";
import { PanelHeader } from "@/shared/components/PanelHeader";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { cn } from "@/shared/lib/cn";

type MCPStatus = {
  running: boolean;
  port: number;
  stdioCommand: string;
  httpUrl: string;
  toolCount: number;
};

const STDIO_EXAMPLE = `{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}`;

export function MCPPanel() {
  const [status, setStatus] = useState<MCPStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [portInput, setPortInput] = useState("7247");
  const [tab, setTab] = useState<"overview" | "traffic">("overview");
  const [traffic, setTraffic] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const debouncedFilter = useDebounce(filter, 200);

  const refresh = useCallback(async () => {
    try {
      const { GetMCPStatus } = await import("../../../../wailsjs/go/main/App");
      const s = await GetMCPStatus();
      setStatus(s as MCPStatus);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  const refreshTraffic = useCallback(async () => {
    try {
      const { GetMCPTraffic } = await import("../../../../wailsjs/go/main/App");
      const entries = await GetMCPTraffic();
      setTraffic((entries as any[]) || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (tab !== "traffic") return;
    refreshTraffic();
    const id = setInterval(refreshTraffic, 1000);
    return () => clearInterval(id);
  }, [tab, refreshTraffic]);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  const start = async () => {
    setBusy(true);
    try {
      const { StartMCPHTTP } = await import("../../../../wailsjs/go/main/App");
      await StartMCPHTTP(parseInt(portInput, 10) || 7247);
      await refresh();
    } catch (e: any) {
      console.warn(e);
    }
    setBusy(false);
  };

  const stop = async () => {
    setBusy(true);
    try {
      const { StopMCPHTTP } = await import("../../../../wailsjs/go/main/App");
      await StopMCPHTTP();
      await refresh();
    } catch {}
    setBusy(false);
  };

  const stdioCmd = status?.stdioCommand || "C:/Users/USER/Desktop/falkam/flux/build/bin/reqit.exe mcp";
  const httpUrl = status?.httpUrl || `http://127.0.0.1:${portInput}/mcp`;
  const opencodeJson = JSON.stringify(
    {
      mcp: {
        reqit: { type: "local", command: [stdioCmd.split(" ")[0], "mcp"], enabled: true },
        "reqit-http": { type: "remote", url: httpUrl, enabled: false },
      },
    },
    null,
    2,
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg">
      {/* Header */}
      <PanelHeader
        title="MCP Bridge"
        statusDot={status?.running ? "green" : "gray"}
        actions={
          <>
            <span className="text-[10px] text-subtext bg-surface px-1.5 py-0.5 rounded font-mono">OpenCode</span>
            {status && (
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-bold", status.running ? "text-green-400 bg-green-400/10 border-green-400/20" : "text-subtext bg-surface border-border")}>
                {status.running ? `● HTTP :${status.port}` : "● HTTP stopped"}
              </span>
            )}
            <button onClick={refresh} className="h-[28px] px-3 text-xs rounded-md bg-surface border border-border text-subtext hover:text-text flex items-center gap-1.5">
              <RefreshCw size={12} /> Refresh
            </button>
          </>
        }
      />

      {/* Tabs — Overview | Traffic Inspector (Wireshark for MCP) */}
      <div className="shrink-0 px-4 py-2 border-b border-border bg-card/30 flex items-center gap-2">
        <button
          onClick={() => setTab("overview")}
          className={cn("h-[28px] px-3 text-xs font-bold rounded-md", tab === "overview" ? "bg-cyan text-white" : "bg-surface border border-border text-subtext hover:text-text")}
        >
          Overview
        </button>
        <button
          onClick={() => setTab("traffic")}
          className={cn("h-[28px] px-3 text-xs font-bold rounded-md flex items-center gap-1.5", tab === "traffic" ? "bg-cyan text-white" : "bg-surface border border-border text-subtext hover:text-text")}
        >
          <Activity size={12} /> Traffic Inspector
          {traffic.length > 0 && <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-mono", tab === "traffic" ? "bg-white/20 text-white" : "bg-cyan/10 text-cyan")}>{traffic.length}</span>}
        </button>
        {tab === "traffic" && (
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-subtext" />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter method/tool…" className="h-[26px] pl-7 pr-2 w-[160px] bg-surface border border-border rounded-md text-xs text-text placeholder:text-subtext/60 outline-none focus:border-cyan" />
            </div>
            <button
              onClick={async () => {
                try {
                  const { ClearMCPTraffic } = await import("../../../../wailsjs/go/main/App");
                  await ClearMCPTraffic();
                  setTraffic([]);
                  setSelectedId(null);
                } catch {}
              }}
              className="h-[26px] px-2.5 text-xs rounded-md bg-surface border border-border text-subtext hover:text-red-400 hover:border-red-400/30 flex items-center gap-1"
            >
              <Trash2 size={11} /> Clear
            </button>
          </div>
        )}
      </div>

      {tab === "overview" && <div className="flex-1 overflow-y-auto">
        {/* Status cards */}
        <div className="p-4 grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg border border-border bg-surface">
            <div className="flex items-center gap-2 text-cyan">
              <Boxes size={14} /> <span className="text-xs font-semibold">Tools</span>
            </div>
            <div className="text-xl font-bold text-text mt-1">{status?.toolCount ?? 24}</div>
            <div className="text-[10px] text-subtext">collections · oauth · events</div>
          </div>
          <div className="p-3 rounded-lg border border-border bg-surface">
            <div className="flex items-center gap-2 text-cyan">
              <Terminal size={14} /> <span className="text-xs font-semibold">Stdio</span>
            </div>
            <div className="text-xs font-mono text-text mt-1 truncate">{stdioCmd}</div>
            <div className="text-[10px] text-subtext">local — OpenCode spawns</div>
          </div>
          <div className="p-3 rounded-lg border border-border bg-surface">
            <div className="flex items-center gap-2 text-cyan">
              <Globe size={14} /> <span className="text-xs font-semibold">HTTP</span>
            </div>
            <div className="text-xs font-mono text-text mt-1 truncate">{httpUrl}</div>
            <div className="text-[10px] text-subtext">{status?.running ? "running" : "stopped — click Start"}</div>
          </div>
        </div>

        {/* Demo banner */}
        <div className="mx-4 mb-4 p-3 rounded-lg border border-cyan/20 bg-cyan/5 flex items-center gap-3">
          <Activity size={16} className="text-cyan shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-text">OpenCode MCP Demo (20 endpoints) is ready</div>
            <div className="text-[11px] text-subtext">Collection lives in your active workspace — try <span className="font-mono text-cyan">tools/call run_collection</span> from OpenCode.</div>
          </div>
          <span className="text-[10px] bg-green-400/10 text-green-400 border border-green-400/20 px-2 py-0.5 rounded-full font-bold">20 endpoints</span>
        </div>

        {/* Stdio */}
        <div className="mx-4 mb-4 rounded-xl border border-border bg-card/50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-surface/30 flex items-center justify-between">
            <div className="text-xs font-bold text-text flex items-center gap-2"><Terminal size={12} className="text-cyan" /> Stdio (default)</div>
            <button onClick={() => copy(stdioCmd, "stdio")} className="h-[26px] px-2.5 text-xs rounded-md bg-surface border border-border text-subtext hover:text-text flex items-center gap-1.5">
              {copied === "stdio" ? <Check size={11} className="text-green-400" /> : <Copy size={11} />} Copy
            </button>
          </div>
          <div className="p-4 space-y-3">
            <pre className="text-xs font-mono bg-bg border border-border rounded-lg p-3 overflow-x-auto">{stdioCmd}</pre>
            <div className="text-[11px] text-subtext">Test: <code className="font-mono bg-surface px-1 rounded">echo '{`{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}`}' | {stdioCmd}</code></div>
          </div>
        </div>

        {/* HTTP */}
        <div className="mx-4 mb-4 rounded-xl border border-border bg-card/50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-surface/30 flex items-center justify-between">
            <div className="text-xs font-bold text-text flex items-center gap-2"><Globe size={12} className="text-cyan" /> HTTP</div>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-bold", status?.running ? "text-green-400 bg-green-400/10 border-green-400/20" : "text-amber-400 bg-amber-400/10 border-amber-400/20")}>
              {status?.running ? "Running" : "Stopped"}
            </span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input value={portInput} onChange={(e) => setPortInput(e.target.value.replace(/\D/g, ""))} className="h-[32px] w-[90px] px-2 text-xs bg-surface border border-border rounded text-text font-mono" placeholder="7247" />
              <button onClick={status?.running ? stop : start} disabled={busy} className={cn("h-[32px] px-4 text-xs font-bold rounded-md flex items-center gap-1.5", status?.running ? "bg-red-500 text-white hover:bg-red-600" : "bg-cyan text-white hover:bg-cyan-hover")}>
                {status?.running ? <Square size={12} /> : <Play size={12} />} {busy ? "..." : status?.running ? "Stop HTTP" : "Start HTTP :"+portInput}
              </button>
              <button onClick={() => copy(httpUrl, "http")} className="h-[32px] px-3 text-xs rounded-md bg-surface border border-border text-subtext hover:text-text flex items-center gap-1.5">
                {copied === "http" ? <Check size={11} className="text-green-400" /> : <Copy size={11} />} Copy URL
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
              <a href={httpUrl.replace("/mcp","/health")} target="_blank" rel="noreferrer" className="p-2 rounded bg-bg border border-border hover:border-cyan/40 flex items-center gap-1.5"><ExternalLink size={11} className="text-cyan" /> GET /health <span className="text-subtext">→ ok</span></a>
              <a href={httpUrl.replace("/mcp","/tools")} target="_blank" rel="noreferrer" className="p-2 rounded bg-bg border border-border hover:border-cyan/40 flex items-center gap-1.5"><ExternalLink size={11} className="text-cyan" /> GET /tools <span className="text-subtext">→ 24</span></a>
              <div className="p-2 rounded bg-bg border border-border">POST /mcp <span className="text-subtext">→ JSON-RPC</span></div>
            </div>
            <pre className="text-xs font-mono bg-bg border border-border rounded-lg p-3 overflow-x-auto">{`curl -s -X POST ${httpUrl} -H "Content-Type: application/json" -d '${STDIO_EXAMPLE}' | jq`}</pre>
          </div>
        </div>

        {/* opencode.json */}
        <div className="mx-4 mb-4 rounded-xl border border-border bg-card/50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-surface/30 flex items-center justify-between">
            <div className="text-xs font-bold text-text">opencode.json</div>
            <button onClick={() => copy(opencodeJson, "json")} className="h-[26px] px-2.5 text-xs rounded-md bg-surface border border-border text-subtext hover:text-text flex items-center gap-1.5">
              {copied === "json" ? <Check size={11} className="text-green-400" /> : <Copy size={11} />} Copy
            </button>
          </div>
          <pre className="text-xs font-mono bg-bg border border-border rounded-lg p-3 overflow-x-auto m-4 mt-3">{opencodeJson}</pre>
          <div className="px-4 pb-4 text-[11px] text-subtext leading-relaxed">
            Place at workspace root or <code className="font-mono bg-surface px-1 rounded">C:\Users\USER\Desktop\falkam\opencode.json</code> → restart OpenCode → <code className="font-mono text-cyan">opencode_ping</code> should reply <span className="text-green-400">reqit MCP ✓</span>.
          </div>
        </div>

        {/* Tools */}
        <div className="mx-4 mb-6 rounded-xl border border-border bg-card/50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-surface/30 flex items-center gap-2">
            <Boxes size={12} className="text-cyan" /> <span className="text-xs font-bold text-text">Tools</span>
            <span className="text-[10px] text-subtext bg-surface px-1.5 py-0.5 rounded font-mono">{status?.toolCount ?? 24} total</span>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3 text-[11px]">
            {[
              "list_collections","get_collection","create_request","update_request","delete_request","run_collection",
              "list_environments","get_environment","set_variable","switch_environment",
              "send_request","diagnose_response","generate_assertions",
              "diff_collection","get_collection_history","blame_request",
              "get_project_root","list_workspaces",
              "opencode_ping","oauth_discover","oauth_diagnose_loopback","event_inspector_list","event_inspector_get","get_request",
            ].map(n => (
              <div key={n} className="font-mono bg-bg border border-border rounded px-2 py-1.5 truncate">{n}</div>
            ))}
          </div>
          <div className="px-4 pb-3 text-[11px] text-subtext">Full docs: <span className="font-mono text-cyan">flux/MCP_BRIDGE.md</span></div>
        </div>
      </div>
      }
      {tab === "traffic" && (
        <div className="flex-1 flex min-h-0">
          {/* List */}
          <div className="w-[38%] border-r border-border flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-border bg-surface/30 text-[10px] font-semibold text-subtext uppercase tracking-wider flex items-center justify-between">
              <span>Frames — {traffic.filter((e: any) => !debouncedFilter || `${e.method} ${e.toolName} ${e.raw}`.toLowerCase().includes(debouncedFilter.toLowerCase())).length} / {traffic.length}</span>
              <span className="text-[10px] text-subtext/60">live • 1s poll</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {traffic.length === 0 ? (
                <div className="p-6 text-center text-xs text-subtext">
                  No MCP traffic yet.<br />
                  <span className="text-[11px]">Run an agent or <code className="font-mono bg-surface px-1 rounded">tools/list</code> to see frames.</span>
                </div>
              ) : (
                traffic
                  .filter((e: any) => !debouncedFilter || `${e.method} ${e.toolName} ${e.raw}`.toLowerCase().includes(debouncedFilter.toLowerCase()))
                  .map((e: any) => {
                    const isError = e.status === "error";
                    const badge =
                      e.method === "initialize"
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : e.method === "tools/list"
                          ? "bg-cyan/10 text-cyan border-cyan/20"
                          : e.method === "tools/call"
                            ? isError
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-surface text-subtext border-border";
                    return (
                      <button
                        key={e.id}
                        onClick={() => setSelectedId(e.id)}
                        className={cn("w-full text-left px-3 py-2 border-b border-border hover:bg-surface/60 flex flex-col gap-1", selectedId === e.id && "bg-cyan/5")}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono", badge)}>{e.method}</span>
                          {e.toolName && <span className="text-xs font-mono text-text truncate">{e.toolName}</span>}
                          <span className="ml-auto text-[10px] text-subtext flex items-center gap-1">
                            <Clock size={10} /> {e.latencyMs}ms
                          </span>
                        </div>
                        <div className="text-[11px] text-subtext truncate font-mono">{(e.raw || "").slice(0, 120)}</div>
                        <div className="text-[10px] text-subtext/60">{new Date(e.timestamp).toLocaleTimeString()} • {e.id.slice(0, 8)}</div>
                      </button>
                    );
                  })
              )}
            </div>
          </div>
          {/* Detail */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {(() => {
              const sel = traffic.find((x: any) => x.id === selectedId) || traffic[0];
              if (!sel) {
                return <div className="flex-1 flex items-center justify-center text-xs text-subtext p-8 text-center">Select a frame to inspect its JSON-RPC payload.<br />Wireshark for your MCP server — zero-config.</div>;
              }
              const pretty = (v: any) => {
                try {
                  const obj = typeof v === "string" ? JSON.parse(v) : v;
                  return JSON.stringify(obj, null, 2);
                } catch {
                  return String(v ?? "");
                }
              };
              return (
                <div className="p-4 space-y-4">
                  <div className={cn("px-3 py-2 rounded-lg border text-xs flex items-center gap-2", sel.status === "error" ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-green-500/10 border-green-500/20 text-green-400")}>
                    <Activity size={12} /> {sel.method} {sel.toolName ? `• ${sel.toolName}` : ""} — {sel.status} • {sel.latencyMs}ms
                    <span className="ml-auto font-mono text-[10px] text-subtext">{sel.id.slice(0, 8)}</span>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-subtext uppercase tracking-wider mb-1">Request Params</div>
                    <pre className="text-xs font-mono bg-bg border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{pretty(sel.params) || "(none)"}</pre>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-subtext uppercase tracking-wider mb-1">Response {sel.error ? "(Error)" : "(Result)"}</div>
                    <pre className={cn("text-xs font-mono border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all", sel.status === "error" ? "bg-red-500/5 border-red-500/20 text-red-300" : "bg-bg border-border text-text")}>
                      {sel.error ? JSON.stringify(sel.error, null, 2) : pretty(sel.result) || "(no result)"}
                    </pre>
                  </div>
                  <div className="text-[10px] text-subtext">Raw: <span className="font-mono break-all">{sel.raw?.slice(0, 500)}</span></div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const text = JSON.stringify({ jsonrpc: "2.0", id: sel.requestId || 1, method: sel.method, params: sel.params ? JSON.parse(String(sel.params)) : {} }, null, 2);
                        await copy(text, "frame");
                      }}
                      className="h-[28px] px-3 text-xs rounded-md bg-surface border border-border text-subtext hover:text-text flex items-center gap-1.5"
                    >
                      {copied === "frame" ? <Check size={11} className="text-green-400" /> : <Copy size={11} />} Copy JSON-RPC
                    </button>
                    <span className="text-[10px] text-subtext">{new Date(sel.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
