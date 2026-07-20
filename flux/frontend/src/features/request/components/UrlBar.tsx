import { Code2, Copy, Save, Send, X, Server, Square, Copy as CopyIcon, Zap, Radio, Disc, ChevronDown, ChevronUp, Globe, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { useResponseStore } from "@/features/request/stores/useResponseStore";
import { useEnvStore } from "@/features/env/stores/useEnvStore";
import { useUIStore } from "@/app/stores/useUIStore";
import { useTabsStore, deriveTitle } from "@/features/tabs/stores/useTabsStore";
import { MethodSelect } from "@/shared/components/MethodSelect";
import { buildQueryString, parseQueryString, splitUrl } from "@/shared/lib/url";
import { uid } from "@/shared/lib/id";
import { CancelRequest, StartMockServer, StopMockServer, GetMockStatus, ToggleMockRecording, SetActiveEnvironment } from "../../../../wailsjs/go/main/App";
import { EventsOn } from "../../../../wailsjs/runtime/runtime";
import { useToastStore } from "@/app/stores/useToastStore";
import { useEndpointCache } from "@/features/request/stores/useEndpointCache";
import { cn } from "@/shared/lib/cn";
import type { KeyValue } from "@/features/request/types/request";
import type { main } from "../../../../wailsjs/go/models";

const DEFAULT_PORT = 4321;

export function UrlBar({ onSend }: { onSend?: () => void }) {
  const method = useRequestStore((s) => s.method);
  const url = useRequestStore((s) => s.url);
  const params = useRequestStore((s) => s.params);
  const setMethod = useRequestStore((s) => s.setMethod);
  const setUrl = useRequestStore((s) => s.setUrl);
  const isLoading = useResponseStore((s) => s.isLoading);
  const openSaveModal = useUIStore((s) => s.openSaveModal);
  const openCodeGen = useUIStore((s) => s.openCodeGenModal);
  const newTab = useTabsStore((s) => s.newTab);
  const requestState = useRequestStore.getState();
  const toast = useToastStore((s) => s.push);

  const cached = useEndpointCache(method, url);
  const [mockStatus, setMockStatus] = useState<main.MockStatus | null>(null);
  const [mockStarting, setMockStarting] = useState(false);
  const [showMockRoutes, setShowMockRoutes] = useState(false);

  useEffect(() => {
    void GetMockStatus().then((s) => {
      if (s.running) setMockStatus(s);
    });
    const offStart = EventsOn("mock:started", (s: main.MockStatus) => setMockStatus(s));
    const offStop = EventsOn("mock:stopped", () => setMockStatus(null));
    const offUpdate = EventsOn("mock:updated", (s: main.MockStatus) => setMockStatus(s));
    return () => { offStart(); offStop(); offUpdate(); };
  }, []);

  const startMock = async () => {
    setMockStarting(true);
    try {
      const s = await StartMockServer(DEFAULT_PORT);
      setMockStatus(s);
      toast("success", `Mock server running on :${DEFAULT_PORT}`);
    } catch (e) {
      toast("error", String(e));
    } finally {
      setMockStarting(false);
    }
  };

  const stopMock = async () => {
    try {
      await StopMockServer();
      setMockStatus(null);
      toast("success", "Mock server stopped");
    } catch (e) {
      toast("error", String(e));
    }
  };

  const copyMockUrl = () => {
    if (mockStatus?.baseUrl) {
      navigator.clipboard.writeText(mockStatus.baseUrl).then(
        () => toast("success", "Copied to clipboard"),
        () => toast("error", "Failed to copy"),
      );
    }
  };

  const toggleRecording = async () => {
    if (!mockStatus) return;
    try {
      await ToggleMockRecording(!mockStatus.recording);
      toast("success", mockStatus.recording ? "Recording stopped" : "Recording started");
    } catch (e) {
      toast("error", String(e));
    }
  };

  const handleFork = () => {
    newTab({
      title: deriveTitle(requestState) + " (fork)",
      savedRequestID: null,
      request: {
        method: requestState.method,
        url: requestState.url,
        params: requestState.params.map((p) => ({ ...p })),
        headers: requestState.headers.map((h) => ({ ...h })),
        bodyType: requestState.bodyType,
        bodyRaw: requestState.bodyRaw,
        bodyForm: requestState.bodyForm.map((f) => ({ ...f })),
        authType: requestState.authType,
        authToken: requestState.authToken,
        authUser: requestState.authUser,
        authPass: requestState.authPass,
        authKeyName: requestState.authKeyName,
        authKeyValue: requestState.authKeyValue,
        authKeyIn: requestState.authKeyIn,
        oauth2Config: requestState.oauth2Config ? { ...requestState.oauth2Config } : undefined,
        clientCert: requestState.clientCert,
        clientKey: requestState.clientKey,
        preSetVars: requestState.preSetVars.map((v) => ({ ...v })),
        extractRules: requestState.extractRules.map((r) => ({ ...r })),
        graphqlQuery: requestState.graphqlQuery,
        graphqlVariables: requestState.graphqlVariables,
        preScript: requestState.preScript,
        postScript: requestState.postScript,
        notes: requestState.notes,
        timeout: 0,
      },
      response: null,
      dirty: true,
    });
  };

  const displayed = url + buildQueryString(params);

  const handleChange = (val: string) => {
    const { base, query } = splitUrl(val);
    setUrl(base);
    if (query) {
      const parsed = parseQueryString(query);
      replaceParams(parsed.length ? parsed : [emptyRow()]);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface">
      <MethodSelect value={method} onChange={setMethod} />

      <div className="flex-1 min-w-0 relative">
        <div className="absolute inset-0 px-3 py-[9px] font-mono text-13 leading-[20px] whitespace-nowrap overflow-hidden pointer-events-none">
          {highlightVars(displayed)}
        </div>
        <input
          id="flux-url-bar"
          type="text"
          value={displayed}
          placeholder="https://api.example.com/endpoint"
          onChange={(e) => handleChange(e.target.value)}
          onScroll={(e) => {
            const el = e.currentTarget.previousElementSibling;
            if (el) el.scrollLeft = e.currentTarget.scrollLeft;
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              if (!isLoading) onSend?.();
            }
          }}
          spellCheck={false}
          autoComplete="off"
          className="relative w-full h-[38px] px-3 bg-transparent font-mono text-13 text-transparent caret-text placeholder:text-subtext outline-none border border-border rounded-lg focus:border-cyan focus:ring-2 focus:ring-cyan/30 transition-all"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <EnvQuickSwitch />
        <TimeoutControl />

        <button
          type="button"
          onClick={openCodeGen}
          title="Generate code (cURL / fetch / Python)"
          className="h-[34px] w-[34px] flex items-center justify-center bg-bg border border-border hover:border-cyan/50 rounded-lg text-subtext hover:text-text transition-all"
          aria-label="Generate code"
        >
          <Code2 size={14} />
        </button>

        <button
          type="button"
          onClick={openSaveModal}
          title="Save request (Ctrl+S)"
          className="h-[34px] w-[34px] flex items-center justify-center bg-bg border border-border hover:border-cyan/50 rounded-lg text-subtext hover:text-text transition-all"
          aria-label="Save request"
        >
          <Save size={14} />
        </button>

        <button
          type="button"
          onClick={handleFork}
          title="Duplicate to new tab"
          className="h-[34px] w-[34px] flex items-center justify-center bg-bg border border-border hover:border-cyan/50 rounded-lg text-subtext hover:text-text transition-all"
          aria-label="Fork request"
        >
          <Copy size={14} />
        </button>

        <div className="w-px h-[24px] bg-border mx-0.5" />

        {/* Mock server status — compact inline */}
        {mockStatus?.running ? (
          <div className="relative flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowMockRoutes((v) => !v)}
              className="h-[34px] px-2 flex items-center gap-1.5 bg-bg border border-border rounded-lg text-11 text-success font-mono hover:border-success/50 transition-all"
            >
              <span className="w-[5px] h-[5px] rounded-full bg-success animate-pulse" />
              <span>{mockStatus.baseUrl.replace(/^https?:\/\//, "")}</span>
              {showMockRoutes ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            <button type="button" onClick={copyMockUrl} className="h-[34px] w-[28px] flex items-center justify-center text-subtext hover:text-text transition-colors" title="Copy URL">
              <CopyIcon size={11} />
            </button>
            <button type="button" onClick={toggleRecording} className={`h-[34px] w-[28px] flex items-center justify-center transition-colors ${mockStatus.recording ? "text-danger" : "text-subtext hover:text-text"}`} title={mockStatus.recording ? "Stop recording" : "Start recording"}>
              {mockStatus.recording ? <Disc size={11} className="animate-pulse" /> : <Radio size={11} />}
            </button>
            <button type="button" onClick={stopMock} className="h-[34px] w-[28px] flex items-center justify-center text-subtext hover:text-danger transition-colors" title="Stop mock server">
              <Square size={11} />
            </button>
            {showMockRoutes && mockStatus.routes?.length > 0 && (
              <div className="absolute top-full right-0 mt-1.5 z-50 bg-card border border-border rounded-xl shadow-xl p-3 min-w-[240px]">
                <div className="text-11 font-semibold text-text mb-2 flex items-center gap-1.5">
                  <Zap size={11} className="text-success" />
                  Mocked routes
                </div>
                <ul className="flex flex-col gap-1">
                  {mockStatus.routes.map((r: string) => (
                    <li key={r} className="text-11 font-mono text-subtext">{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={startMock}
            disabled={mockStarting}
            title="Start mock server"
            className="h-[34px] px-2.5 flex items-center gap-1.5 bg-bg border border-border rounded-lg text-11 text-subtext hover:text-text hover:border-cyan/50 transition-all disabled:opacity-50"
          >
            <Server size={12} />
            <span>{mockStarting ? "Starting…" : "Mock"}</span>
          </button>
        )}

        <div className="w-px h-[24px] bg-border mx-0.5" />

        {cached && !isLoading && (
          <span
            className={`text-11 font-mono font-semibold whitespace-nowrap tabular-nums ${
              cached.statusCode < 300 ? "text-teal" : cached.statusCode < 500 ? "text-warn" : "text-danger"
            }`}
            title={`Last response: ${cached.status} in ${cached.timingMs}ms`}
          >
            {cached.statusCode} · {cached.timingMs}ms
          </span>
        )}

        {isLoading ? (
          <button
            type="button"
            onClick={() => void CancelRequest()}
            title="Cancel request"
            className="h-[34px] px-4 bg-danger/90 hover:bg-danger active:scale-[0.97] rounded-lg font-bold text-13 text-white flex items-center gap-2 transition-all"
          >
            <X size={14} />
            <span>Cancel</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            title="Send request (Ctrl+Enter)"
            className="h-[34px] px-4 bg-cyan hover:bg-cyan-hover active:scale-[0.97] rounded-lg font-bold text-13 text-white flex items-center gap-2 transition-all shadow-sm shadow-cyan/20"
          >
            <Send size={14} />
            <span>Send</span>
          </button>
        )}
      </div>
    </div>
  );
}

function highlightVars(text: string) {
  const { environments, activeID } = useEnvStore.getState();
  const env = environments.find((e) => e.id === activeID);
  const activeKeys = new Set((env?.vars ?? []).filter((v) => v.enabled !== false && v.key).map((v) => v.key));
  const parts = text.split(/(\{\{[\w.-]+\}\})/g);
  return parts.map((part, i) => {
    const m = part.match(/^\{\{\s*([\w.-]+)\s*\}\}$/);
    if (m && activeKeys.has(m[1])) {
      return <span key={i} className="text-cyan font-semibold">{part}</span>;
    }
    return <span key={i} className="text-text">{part}</span>;
  });
}

function TimeoutControl() {
  const timeout = useRequestStore((s) => s.timeout);
  const setTimeout = useRequestStore((s) => s.setTimeout);
  const [open, setOpen] = useState(false);

  const presets = [0, 5, 10, 30, 60, 120];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-[34px] px-2 flex items-center gap-1 bg-bg border border-border hover:border-cyan/50 rounded-lg text-11 text-subtext hover:text-text transition-all"
        title="Request timeout"
      >
        <Clock size={12} />
        <span className="font-mono">{timeout === 0 ? "30s" : `${timeout}s`}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl p-3 min-w-[180px]">
            <div className="text-11 font-semibold text-text mb-2">Timeout (seconds)</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {presets.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTimeout(t); setOpen(false); }}
                  className={cn(
                    "px-2 py-1 text-11 rounded-md border transition-colors",
                    timeout === t
                      ? "bg-cyan/10 border-cyan/30 text-cyan font-semibold"
                      : "bg-bg border-border text-subtext hover:text-text",
                  )}
                >
                  {t === 0 ? "Default" : `${t}s`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={300}
                value={timeout || ""}
                placeholder="30"
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 0;
                  setTimeout(Math.min(Math.max(v, 0), 300));
                }}
                className="w-[60px] h-[26px] px-2 bg-bg border border-border rounded text-12 font-mono text-text outline-none focus:border-cyan"
              />
              <span className="text-11 text-subtext">Custom (1-300s)</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EnvQuickSwitch() {
  const environments = useEnvStore((s) => s.environments);
  const activeID = useEnvStore((s) => s.activeID);
  const [open, setOpen] = useState(false);

  const switchEnv = async (id: string) => {
    try {
      await SetActiveEnvironment(id);
      useEnvStore.getState().load();
      setOpen(false);
    } catch {}
  };

  if (environments.length === 0) return null;

  const active = environments.find((e) => e.id === activeID);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-[34px] px-2 flex items-center gap-1.5 bg-bg border border-border hover:border-cyan/50 rounded-lg text-11 text-subtext hover:text-text transition-all"
        title="Switch environment"
      >
        <Globe size={12} />
        <span className="max-w-[80px] truncate">{active?.name ?? "None"}</span>
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl min-w-[160px] py-1">
            <button
              type="button"
              onClick={() => switchEnv("")}
              className={cn(
                "w-full px-3 py-1.5 text-12 text-left hover:bg-cardHover transition-colors",
                !activeID ? "text-cyan font-semibold" : "text-text",
              )}
            >
              No environment
            </button>
            {environments.map((env) => (
              <button
                key={env.id}
                type="button"
                onClick={() => switchEnv(env.id)}
                className={cn(
                  "w-full px-3 py-1.5 text-12 text-left hover:bg-cardHover transition-colors",
                  env.id === activeID ? "text-cyan font-semibold" : "text-text",
                )}
              >
                {env.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const emptyRow = (): KeyValue => ({
  id: uid("kv"),
  key: "",
  value: "",
  enabled: true,
});

function replaceParams(rows: KeyValue[]) {
  useRequestStore.setState({ params: rows });
}
