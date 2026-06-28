import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Terminal, Plus, X } from "lucide-react";
import { useSocketStore } from "@/features/websocket/stores/useSocketStore";
import { useUIStore } from "@/app/stores/useUIStore";
import { cn } from "@/shared/lib/cn";

const PROTOCOLS = [
  { id: "ws", label: "WebSocket", prefix: "ws://" },
  { id: "sse", label: "SSE", prefix: "https://" },
  { id: "socketio", label: "Socket.IO", prefix: "http://" },
] as const;

export function SocketPanel() {
  const status = useSocketStore((s) => s.status);
  const protocol = useSocketStore((s) => s.protocol);
  const messages = useSocketStore((s) => s.messages);
  const connect = useSocketStore((s) => s.connect);
  const disconnect = useSocketStore((s) => s.disconnect);
  const send = useSocketStore((s) => s.send);
  const emitEvent = useSocketStore((s) => s.emitEvent);
  const refresh = useSocketStore((s) => s.refresh);
  const setView = useUIStore((s) => s.setView);

  const [url, setUrl] = useState("");
  const [proto, setProto] = useState<string>("ws");
  const [inputMsg, setInputMsg] = useState("");
  const [eventName, setEventName] = useState("message");
  const [cookies, setCookies] = useState("");
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>([{ key: "", value: "" }]);
  const logEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void refresh(); }, [refresh]);

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
  const canSend = isConnected;
  const isSocketIO = proto === "socketio";

  const handleConnect = async () => {
    if (isConnected) {
      await disconnect();
    } else {
      const headerObj: Record<string, string> = {};
      for (const h of headers) {
        if (h.key.trim()) headerObj[h.key.trim()] = h.value;
      }
      await connect(url, proto as any, { cookies, headers: headerObj });
    }
  };

  const handleSend = async () => {
    if (!inputMsg.trim() || !canSend) return;
    if (isSocketIO && eventName.trim()) {
      await emitEvent(eventName.trim(), inputMsg.trim());
    } else {
      await send(inputMsg.trim());
    }
    setInputMsg("");
  };

  const addHeader = () => setHeaders([...headers, { key: "", value: "" }]);
  const removeHeader = (i: number) => setHeaders(headers.filter((_, idx) => idx !== i));
  const updateHeader = (i: number, field: "key" | "value", val: string) => {
    const next = [...headers];
    next[i] = { ...next[i], [field]: val };
    setHeaders(next);
  };

  const showHeaders = proto === "socketio";

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

        <div className="flex items-center gap-1">
          {PROTOCOLS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProto(p.id)}
              className={cn(
                "h-[24px] px-2 text-11 rounded-sm transition-colors",
                proto === p.id
                  ? "bg-cyan/15 text-cyan font-semibold"
                  : "text-subtext hover:text-text",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex-1 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={isSocketIO ? "http://localhost:3000/socket.io/" : "ws://localhost:8080"}
            spellCheck={false}
            className="flex-1 h-[28px] px-2 bg-surface border border-border rounded-sm text-12 text-text font-mono outline-none focus:border-cyan"
          />
          <button
            type="button"
            onClick={handleConnect}
            disabled={isBusy || !url.trim()}
            className={cn(
              "h-[28px] px-3 text-12 rounded-sm transition-colors font-medium",
              isConnected
                ? "bg-red/15 text-red hover:bg-red/20"
                : "bg-cyan/15 text-cyan hover:bg-cyan/20",
              isBusy && "opacity-50 cursor-not-allowed",
            )}
          >
            {isConnected ? "Disconnect" : isBusy ? "Connecting…" : "Connect"}
          </button>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isConnected ? "bg-teal" : isBusy ? "bg-amber animate-pulse" : "bg-subtext/30",
          )} />
          <span className="text-11 text-subtext capitalize">{status}</span>
        </div>
      </div>

      {/* Cookie & Header inputs for Socket.IO */}
      {showHeaders && (
        <div className="border-b border-border bg-surface px-4 py-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-11 text-subtext font-semibold w-[60px] shrink-0">Cookie</span>
            <input
              type="text"
              value={cookies}
              onChange={(e) => setCookies(e.target.value)}
              placeholder="session=abc123; token=xyz"
              spellCheck={false}
              className="flex-1 h-[24px] px-2 bg-bg border border-border rounded-sm text-11 text-text font-mono outline-none focus:border-cyan"
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-11 text-subtext font-semibold w-[60px] shrink-0">Headers</span>
              <button
                type="button"
                onClick={addHeader}
                className="text-subtext hover:text-cyan transition-colors"
                title="Add header"
              >
                <Plus size={12} />
              </button>
            </div>
            {headers.map((h, i) => (
              <div key={i} className="flex items-center gap-1 ml-[60px]">
                <input
                  type="text"
                  value={h.key}
                  onChange={(e) => updateHeader(i, "key", e.target.value)}
                  placeholder="Header name"
                  spellCheck={false}
                  className="w-[140px] h-[22px] px-2 bg-bg border border-border rounded-sm text-11 text-text font-mono outline-none focus:border-cyan"
                />
                <input
                  type="text"
                  value={h.value}
                  onChange={(e) => updateHeader(i, "value", e.target.value)}
                  placeholder="Value"
                  spellCheck={false}
                  className="flex-1 h-[22px] px-2 bg-bg border border-border rounded-sm text-11 text-text font-mono outline-none focus:border-cyan"
                />
                {headers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeHeader(i)}
                    className="text-subtext hover:text-red transition-colors"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message log */}
      <div ref={logContainer} className="flex-1 min-h-0 overflow-y-auto p-4 font-mono text-12">
        {messages.length === 0 && (
          <div className="text-subtext/60 italic">
            {isConnected
              ? isSocketIO
                ? "Connected. Send events below."
                : "Connected. Send messages below."
              : "No messages yet."}
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "py-1 border-b border-border/30",
              msg.direction === "sent" ? "text-cyan" : "text-text",
            )}
          >
            <span className="text-10 text-subtext/60 mr-2">
              {msg.direction === "sent" ? "▶" : "◀"}
            </span>
            <span className="whitespace-pre-wrap break-all">{msg.body}</span>
          </div>
        ))}
        <div ref={logEnd} />
      </div>

      {/* Send bar */}
      {canSend && (
        <div className="border-t border-border bg-surface px-4 py-2 flex items-center gap-2">
          {isSocketIO && (
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Event name"
              spellCheck={false}
              className="w-[120px] h-[28px] px-2 bg-bg border border-border rounded-sm text-11 text-text font-mono outline-none focus:border-cyan"
            />
          )}
          <input
            ref={inputRef}
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder={isSocketIO ? "Event payload…" : "Type a message…"}
            spellCheck={false}
            className="flex-1 h-[28px] px-2 bg-bg border border-border rounded-sm text-12 text-text font-mono outline-none focus:border-cyan"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputMsg.trim()}
            className="h-[28px] px-3 flex items-center gap-1 bg-cyan/15 text-cyan text-12 rounded-sm hover:bg-cyan/20 transition-colors disabled:opacity-40"
          >
            <Send size={12} />
            {isSocketIO ? "Emit" : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}
