import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Terminal } from "lucide-react";
import { useSocketStore } from "../../stores/useSocketStore";
import { useUIStore } from "../../stores/useUIStore";
import { cn } from "../../lib/cn";

const PROTOCOLS = [
  { id: "ws", label: "WebSocket", prefix: "ws://" },
  { id: "sse", label: "SSE", prefix: "https://" },
] as const;

export function SocketPanel() {
  const status = useSocketStore((s) => s.status);
  const protocol = useSocketStore((s) => s.protocol);
  const messages = useSocketStore((s) => s.messages);
  const connect = useSocketStore((s) => s.connect);
  const disconnect = useSocketStore((s) => s.disconnect);
  const send = useSocketStore((s) => s.send);
  const refresh = useSocketStore((s) => s.refresh);
  const setView = useUIStore((s) => s.setView);

  const [url, setUrl] = useState("");
  const [proto, setProto] = useState<string>("ws");
  const [inputMsg, setInputMsg] = useState("");
  const logEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Refresh state on mount (if reconnecting from previous session)
  useEffect(() => { void refresh(); }, [refresh]);

  // Auto-scroll to bottom on new messages only if user hasn't scrolled up
  const logContainer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = logContainer.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (isAtBottom) {
      logEnd.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const isConnected = status === "connected";
  const isBusy = status === "connecting";
  const canSend = isConnected && protocol === "ws";

  const handleConnect = async () => {
    if (isConnected) {
      await disconnect();
    } else {
      await connect(url, proto);
    }
  };

  const handleSend = async () => {
    if (!inputMsg.trim() || !canSend) return;
    try {
      await send(inputMsg.trim());
      setInputMsg("");
    } catch { /* toast will show error */ }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-bg">
      {/* Header bar */}
      <div className="h-[48px] flex items-center gap-3 px-4 border-b border-border bg-surface shrink-0">
        <button
          type="button"
          onClick={() => setView("http")}
          className="flex items-center gap-1 text-12 text-subtext hover:text-text transition-colors shrink-0"
        >
          <ArrowLeft size={14} />
          HTTP
        </button>

        {/* Protocol selector */}
        <div className="flex items-center gap-1">
          {PROTOCOLS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={isConnected}
              onClick={() => setProto(p.id)}
              className={cn(
                "h-[28px] px-2.5 text-11 rounded-md font-semibold transition-all",
                proto === p.id
                  ? "bg-blue text-white"
                  : "text-subtext hover:text-text bg-surface border border-border",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* URL input */}
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !isBusy) handleConnect(); }}
          placeholder={
            proto === "ws"
              ? "wss://echo.websocket.org"
              : "https://example.com/events"
          }
          disabled={isConnected}
          spellCheck={false}
          className="flex-1 h-[32px] px-3 bg-bg border border-border rounded-md text-12 text-text outline-none focus:border-blue transition-colors disabled:opacity-50"
        />

        {/* Connect / Disconnect button */}
        <button
          type="button"
          onClick={handleConnect}
          disabled={isBusy || (!isConnected && !url.trim())}
          className={cn(
            "h-[32px] px-4 text-12 font-bold rounded-md transition-all shrink-0 flex items-center gap-1.5",
            isConnected
              ? "bg-danger hover:bg-danger/80 text-white"
              : "bg-blue hover:bg-blue-hover text-white disabled:opacity-60",
          )}
        >
          {isBusy ? (
            <>
              <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Connecting…
            </>
          ) : isConnected ? (
            "Disconnect"
          ) : (
            <>Connect</>
          )}
        </button>
      </div>

      {/* Status bar */}
      <div className="h-[32px] px-4 border-b border-border flex items-center gap-3 text-11 shrink-0">
        <span className="text-subtext uppercase tracking-wider">Status</span>
        <span
          className={cn(
            "font-mono font-semibold",
            status === "connected" && "text-green",
            status === "connecting" && "text-warn",
            status === "error" && "text-danger",
            status === "disconnected" && "text-subtext",
          )}
        >
          {status === "connected" && "● Connected"}
          {status === "connecting" && "◌ Connecting…"}
          {status === "error" && "✕ Error"}
          {status === "disconnected" && "○ Disconnected"}
        </span>
        {isConnected && (
          <span className="text-subtext font-mono">{url}</span>
        )}
      </div>

      {/* Message log */}
      <div ref={logContainer} className="flex-1 min-h-0 overflow-y-auto bg-surface">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-subtext gap-3 px-6">
            <Terminal size={28} className="opacity-30" />
            <div className="text-12">
              {isConnected
                ? "Waiting for messages…"
                : "Connect to a WebSocket or SSE endpoint to view messages."}
            </div>
            {!isConnected && (
              <div className="text-11 text-subtext/60 max-w-[300px] text-center leading-relaxed">
                For WebSocket: wss://echo.websocket.org<br />
                For SSE: any server-sent events URL
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "px-4 py-2.5 flex items-start gap-3 hover:bg-card/30 transition-colors",
                  msg.direction === "sent" && "bg-blue/5",
                )}
              >
                <span
                  className={cn(
                    "shrink-0 text-10 font-mono font-bold uppercase tracking-wider mt-0.5 w-[60px]",
                    msg.direction === "sent" ? "text-blue" : "text-green",
                  )}
                >
                  {msg.direction === "sent" ? "SENT" : "RECV"}
                </span>
                <span className="text-11 text-subtext font-mono shrink-0 mt-0.5 w-[68px]">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
                <pre className="flex-1 text-12 text-text font-mono whitespace-pre-wrap break-all min-w-0 leading-relaxed">
                  {msg.body}
                </pre>
              </div>
            ))}
            <div ref={logEnd} />
          </div>
        )}
      </div>

      {/* Message input (WebSocket only) */}
      <div className="h-[52px] px-4 border-t border-border bg-surface flex items-center gap-2 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          placeholder={canSend ? "Type a message…" : "Connect to send messages"}
          disabled={!canSend}
          spellCheck={false}
          className="flex-1 h-[36px] px-3 bg-bg border border-border rounded-md text-12 text-text outline-none focus:border-blue transition-colors disabled:opacity-40"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend || !inputMsg.trim()}
          className="h-[36px] w-[36px] flex items-center justify-center bg-blue hover:bg-blue-hover text-white rounded-md disabled:opacity-40 transition-all shrink-0"
          title="Send"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
