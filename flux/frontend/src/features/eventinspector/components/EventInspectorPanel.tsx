import { useEffect, useState } from "react";
import { ArrowLeft, Play, Square, ShieldAlert, Copy, Trash2, RotateCcw, KeyRound, RefreshCw, CheckCircle2, XCircle, Layers } from "lucide-react";
import { useUIStore } from "@/app/stores/useUIStore";
import { useEventInspectorStore } from "@/features/eventinspector/stores/useEventInspectorStore";
import { cn } from "@/shared/lib/cn";
import type { models } from "../../../../wailsjs/go/models";

const verifyBadge: Record<string, { label: string; cls: string }> = {
  verified: { label: "Verified", cls: "bg-green-500/10 text-green-500" },
  unverified: { label: "Unverified", cls: "bg-amber-500/10 text-amber-500" },
  duplicate: { label: "Duplicate", cls: "bg-gray-500/10 text-gray-500" },
};

export function EventInspectorPanel() {
  const setView = useUIStore((s) => s.setView);
  const store = useEventInspectorStore();
  const { running, port, events, hasSecret } = store;

  const [secretInput, setSecretInput] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replayTarget, setReplayTarget] = useState("");
  const [preserveSvix, setPreserveSvix] = useState(false);
  const [replayId, setReplayId] = useState<string | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<string>("");

  useEffect(() => {
    void store.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = events.find((e) => e.id === selectedId) ?? null;

  const saveSecret = async () => {
    if (!secretInput.trim()) return;
    await store.setSecret(secretInput);
    setSecretInput("");
  };

  const openReplay = (id: string) => {
    setReplayId(id);
    setReplayTarget("");
    setReplayResult("");
    setPreserveSvix(false);
  };

  const doReplay = async () => {
    if (!replayId || !replayTarget.trim()) return;
    setReplaying(true);
    setReplayResult("");
    const res = await store.replay(replayId, replayTarget.trim(), preserveSvix);
    setReplaying(false);
    if (res) {
      setReplayResult(
        `${res.statusCode} ${res.error ? "— " + res.error : ""}${res.timingMs > 0 ? ` (${res.timingMs}ms)` : ""}`.trim(),
      );
    }
  };

  const copyBody = async (e: models.EventRecord) => {
    try {
      await navigator.clipboard.writeText(e.body);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg">
      <header className="h-[48px] flex items-center gap-3 px-4 border-b border-border shrink-0">
        <button onClick={() => setView("http")} className="text-subtext hover:text-text text-13">&larr; Back</button>
        <h1 className="text-14 font-semibold text-text">Event Inspector</h1>
      </header>

      {/* Control bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border shrink-0">
        <span className={cn("inline-block w-3 h-3 rounded-full", running ? "bg-green-500" : "bg-gray-500")} />
        <span className="text-13 text-text">
          {running ? `Capturing on 127.0.0.1:${port}` : "Capture stopped"}
        </span>
        <button
          onClick={() => void store.toggle()}
          className={cn(
            "h-[28px] px-3 flex items-center gap-1.5 text-12 rounded-md font-medium transition-colors",
            running ? "bg-red/15 text-red hover:bg-red/20" : "bg-cyan/15 text-cyan hover:bg-cyan/20",
          )}
        >
          {running ? <Square size={12} /> : <Play size={12} />}
          {running ? "Stop" : "Start"} Capture
        </button>
        <span className="text-12 text-subtext">{events.length} events</span>
        {events.length > 0 && (
          <button
            onClick={() => void store.clear()}
            className="ml-auto flex items-center gap-1 text-11 text-subtext hover:text-danger transition-colors"
          >
            <Trash2 size={11} /> Clear all
          </button>
        )}
      </div>

      {/* Secret + tunnel hint */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface/50 shrink-0">
        <KeyRound size={12} className="text-subtext shrink-0" />
        <input
          type={showSecret ? "text" : "password"}
          value={secretInput}
          onChange={(e) => setSecretInput(e.target.value)}
          placeholder={hasSecret ? "Signing secret saved (whsec_…)" : "Svix signing secret (whsec_…)"}
          spellCheck={false}
          className="flex-1 h-[26px] px-2 bg-bg border border-border rounded-sm text-11 text-text font-mono outline-none focus:border-cyan"
        />
        <button onClick={() => setShowSecret((v) => !v)} className="text-subtext hover:text-text transition-colors" title="Show/hide">
          <ShieldAlert size={12} />
        </button>
        <button
          onClick={() => void saveSecret()}
          disabled={!secretInput.trim()}
          className="h-[26px] px-3 text-11 rounded-md bg-cyan/15 text-cyan hover:bg-cyan/20 transition-colors disabled:opacity-40"
        >
          Save secret
        </button>
      </div>
      {running && (
        <div className="px-4 py-1.5 border-b border-border bg-surface/30">
          <p className="text-11 text-subtext font-mono">
            Point Flexprice's webhook at the tunnel forwarding to 127.0.0.1:{port}
            {!hasSecret && " — set the signing secret above to verify signatures."}
          </p>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Event list */}
        <div className="w-[46%] shrink-0 border-r border-border overflow-y-auto">
          {events.length === 0 ? (
            <div className="p-6 text-13 text-subtext">
              No events captured yet. Start capture and point a webhook (e.g. Flexprice via Svix) at the local listener.
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {events.map((e) => {
                const badge = verifyBadge[e.verifyStatus] ?? verifyBadge.unverified;
                return (
                  <button
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md border transition-colors",
                      selectedId === e.id
                        ? "bg-card border-cyan/50"
                        : "bg-surface border-border hover:bg-cardHover",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("text-10 font-semibold px-1.5 py-0.5 rounded-sm shrink-0", badge.cls)}>
                        {badge.label}
                      </span>
                      {e.eventType && (
                        <span className="text-11 font-mono text-cyan truncate flex-1">{e.eventType}</span>
                      )}
                      {!e.eventType && <span className="text-11 text-subtext truncate flex-1">(no event type)</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-10 text-subtext/70">
                      {e.providerEventId && <span className="font-mono truncate">{e.providerEventId}</span>}
                      {e.replayCount > 0 && <span className="shrink-0">{e.replayCount} replays</span>}
                      <span className="ml-auto shrink-0">{new Date(e.receivedAt).toLocaleString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail pane */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {!selected ? (
            <div className="p-6 text-13 text-subtext">Select an event to inspect its headers and payload.</div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <span className={cn("text-11 font-semibold px-2 py-1 rounded-md", (verifyBadge[selected.verifyStatus] ?? verifyBadge.unverified).cls)}>
                  {verifyBadge[selected.verifyStatus]?.label ?? selected.verifyStatus}
                </span>
                {selected.eventType && <span className="text-12 font-mono text-cyan">{selected.eventType}</span>}
                {selected.verifyError && (
                  <span className="text-11 text-amber-600 flex items-center gap-1"><ShieldAlert size={11} /> {selected.verifyError}</span>
                )}
                <span className="ml-auto text-11 text-subtext">
                  {new Date(selected.receivedAt).toLocaleString()}
                </span>
              </div>

              {selected.verifyStatus === "verified" ? (
                <p className="text-11 text-green-600 flex items-center gap-1.5">
                  <CheckCircle2 size={13} /> Signature valid — HMAC-SHA256 over svix-id · svix-timestamp · body
                </p>
              ) : selected.verifyStatus === "duplicate" ? (
                <p className="text-11 text-subtext flex items-center gap-1.5">
                  <Layers size={13} /> Duplicate delivery — svix-id already processed
                </p>
              ) : (
                <p className="text-11 text-amber-600 flex items-center gap-1.5">
                  <XCircle size={13} /> Not verified{hasSecret ? " — signature check failed" : " — no signing secret configured"}
                </p>
              )}

              {/* Replay */}
              <div className="rounded-md border border-border bg-surface p-3 space-y-2">
                <div className="text-11 text-subtext font-semibold flex items-center gap-1.5">
                  <RotateCcw size={12} /> Replay
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={replayId === selected.id ? replayTarget : ""}
                    onChange={(e) => setReplayTarget(e.target.value)}
                    placeholder="Target URL (e.g. https://myapp.test/webhooks/flexprice)"
                    spellCheck={false}
                    className="flex-1 h-[30px] px-2 bg-bg border border-border rounded-sm text-12 text-text font-mono outline-none focus:border-cyan"
                  />
                  <button
                    onClick={() => openReplay(selected.id)}
                    className="h-[30px] px-3 text-11 rounded-md bg-cyan/15 text-cyan hover:bg-cyan/20 transition-colors shrink-0"
                  >
                    Set target
                  </button>
                </div>
                {replayId === selected.id && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-11 text-subtext cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preserveSvix}
                        onChange={(e) => setPreserveSvix(e.target.checked)}
                        className="accent-cyan"
                      />
                      Preserve Svix signature headers
                    </label>
                    <button
                      onClick={() => void doReplay()}
                      disabled={replaying || !replayTarget.trim()}
                      className="h-[28px] px-3 flex items-center gap-1.5 text-11 rounded-md bg-cyan text-bg font-semibold hover:bg-cyan/90 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={cn(replaying && "animate-spin")} />
                      {replaying ? "Replaying…" : "Replay"}
                    </button>
                  </div>
                )}
                {replayResult && <div className="text-11 font-mono text-cyan">{replayResult}</div>}
              </div>

              {/* Headers */}
              <div>
                <div className="text-11 text-subtext font-semibold uppercase tracking-wider mb-1">Headers</div>
                <div className="rounded-md border border-border bg-surface divide-y divide-border/40 overflow-hidden">
                  {Object.entries(selected.headers ?? {}).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 px-3 py-1.5 text-11">
                      <span className="text-text font-semibold shrink-0">{k}</span>
                      <span className="text-subtext font-mono break-all">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center mb-1">
                  <span className="text-11 text-subtext font-semibold uppercase tracking-wider">Payload</span>
                  <button
                    onClick={() => void copyBody(selected)}
                    className="ml-auto flex items-center gap-1 text-10 text-subtext hover:text-cyan transition-colors"
                  >
                    <Copy size={10} /> Copy
                  </button>
                </div>
                <pre className="text-11 font-mono whitespace-pre-wrap break-all text-text bg-surface rounded-md p-3 border border-border/50 max-h-[40vh] overflow-auto">
                  {selected.body || "(empty)"}
                </pre>
              </div>

              {selected.replays && selected.replays.length > 0 && (
                <div>
                  <div className="text-11 text-subtext font-semibold uppercase tracking-wider mb-1">Replay history</div>
                  <div className="rounded-md border border-border bg-surface divide-y divide-border/40 overflow-hidden">
                    {selected.replays.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 px-3 py-1.5 text-11">
                        <span className={cn("font-mono font-semibold", r.status >= 200 && r.status < 400 ? "text-green-500" : "text-danger")}>
                          {r.status}
                        </span>
                        <span className="text-subtext font-mono truncate">{r.targetUrl}</span>
                        <span className="ml-auto text-subtext/60 shrink-0">{new Date(r.timestamp).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
