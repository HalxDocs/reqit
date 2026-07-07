import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Play, Square, Trash2, X } from "lucide-react";
import { toast } from "@/app/stores/useToastStore";
import { useSocketStore } from "@/features/websocket/stores/useSocketStore";
import { cn } from "@/shared/lib/cn";

export function SSEViewer() {
  const { status, url, messages, connect, disconnect } = useSocketStore();
  const [inputURL, setInputURL] = useState(url || "https://");
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [filterEvent, setFilterEvent] = useState("");
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [prettyJSON, setPrettyJSON] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const events = useMemo(() => {
    let e = messages.filter((m) => m.direction === "received");
    if (filterEvent) {
      e = e.filter((m) => (m.eventType || "").toLowerCase() === filterEvent.toLowerCase());
    }
    return e;
  }, [messages, filterEvent]);

  const eventTypes = useMemo(() => {
    const types = new Set<string>();
    for (const m of messages) {
      if (m.direction === "received" && m.eventType) types.add(m.eventType);
    }
    return Array.from(types).sort();
  }, [messages]);

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events.length, autoScroll]);

  const formatData = (body: string) => {
    if (!prettyJSON) return body;
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  };

  const handleConnect = async () => {
    if (!inputURL.trim()) return;
    try {
      await connect(inputURL.trim(), "sse");
      toast.success("SSE connected");
    } catch (e) {
      toast.error("SSE connection failed: " + String(e));
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  const handleClear = () => {
    useSocketStore.setState({ messages: [] });
  };

  const handleExport = () => {
    const data = JSON.stringify(events, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sse-events-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  // Use last event ID for auto-reconnect
  const lastEventID = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].eventId) return messages[i].eventId;
    }
    return "";
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Connection bar */}
      <div className="px-3 py-2 flex items-center gap-2 border-b border-border">
        <input
          type="text"
          value={inputURL}
          onChange={(e) => setInputURL(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleConnect(); }}
          placeholder="https://example.com/events"
          spellCheck={false}
          disabled={isConnected || isConnecting}
          className="flex-1 h-[26px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan placeholder:text-tertiary font-mono"
        />
        {isConnected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            className="flex items-center gap-1 h-[26px] px-2 text-11 text-white bg-danger rounded hover:bg-danger-hover transition-colors"
          >
            <Square size={10} /> Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={isConnecting || !inputURL.trim()}
            className="flex items-center gap-1 h-[26px] px-2 text-11 text-white bg-cyan rounded hover:bg-cyan-hover disabled:opacity-40 transition-colors"
          >
            <Play size={10} /> {isConnecting ? "Connecting..." : "Connect"}
          </button>
        )}
      </div>

      {/* Status bar */}
      <div className="px-3 py-1.5 flex items-center gap-3 text-10 border-b border-border">
        <span className="flex items-center gap-1">
          <span className={cn(
            "w-[6px] h-[6px] rounded-full",
            isConnected ? "bg-green-500" : isConnecting ? "bg-amber-400" : status === "error" ? "bg-danger" : "bg-subtext/40",
          )} />
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
        <span className="text-subtext">{events.length} event{events.length !== 1 ? "s" : ""}</span>
        {autoReconnect && lastEventID && (
          <span className="text-subtext" title="Last-Event-ID will be sent on reconnect">ID: {lastEventID.slice(0, 20)}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1 cursor-pointer text-subtext hover:text-text transition-colors">
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="accent-cyan w-[10px] h-[10px]" />
            Scroll
          </label>
          <label className="flex items-center gap-1 cursor-pointer text-subtext hover:text-text transition-colors">
            <input type="checkbox" checked={prettyJSON} onChange={(e) => setPrettyJSON(e.target.checked)} className="accent-cyan w-[10px] h-[10px]" />
            Pretty
          </label>
          <button
            type="button"
            onClick={handleClear}
            className="text-subtext hover:text-danger transition-colors p-0.5"
            title="Clear events"
          >
            <Trash2 size={10} />
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="text-subtext hover:text-text transition-colors p-0.5"
            title="Export events as JSON"
          >
            <Download size={10} />
          </button>
        </div>
      </div>

      {/* Event type filter chips */}
      {eventTypes.length > 0 && (
        <div className="px-3 py-1 flex flex-wrap gap-1 border-b border-border">
          <button
            type="button"
            onClick={() => setFilterEvent("")}
            className={cn(
              "px-1.5 h-[16px] text-9 rounded-sm border transition-colors",
              !filterEvent ? "bg-cyan/20 border-cyan text-cyan" : "border-border text-subtext hover:text-text",
            )}
          >
            All
          </button>
          {eventTypes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterEvent(t === filterEvent ? "" : t)}
              className={cn(
                "px-1.5 h-[16px] text-9 rounded-sm border transition-colors",
                filterEvent === t ? "bg-cyan/20 border-cyan text-cyan" : "border-border text-subtext hover:text-text",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Event list */}
      <div ref={listRef} className="flex-1 overflow-y-auto min-h-0">
        {events.length === 0 ? (
          <div className="px-3 py-2 text-11 text-subtext italic">
            {isConnected ? "Waiting for events..." : "Connect to an SSE endpoint to see events."}
          </div>
        ) : (
          <div className="flex flex-col gap-px">
            {events.map((e, i) => (
              <div key={e.timestamp + "-" + i} className="px-3 py-1.5 hover:bg-cardHover transition-colors group">
                <div className="flex items-center gap-2 mb-0.5">
                  {e.eventType ? (
                    <span className="px-1 py-0.5 text-9 font-bold bg-cyan/15 text-cyan rounded-sm uppercase leading-none">{e.eventType}</span>
                  ) : (
                    <span className="px-1 py-0.5 text-9 text-tertiary italic leading-none">message</span>
                  )}
                  {e.eventId && (
                    <span className="text-9 text-subtext font-mono" title="Event ID">#{e.eventId.slice(0, 24)}</span>
                  )}
                  {(e.retry ?? 0) > 0 && (
                    <span className="text-9 text-subtext" title="Reconnection time (ms)">retry: {e.retry}ms</span>
                  )}
                  {showTimestamps && (
                    <span className="text-9 text-tertiary ml-auto">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(e.body);
                      toast.success("Copied");
                    }}
                    className="text-transparent group-hover:text-subtext hover:text-text transition-colors p-0.5 text-9 ml-1"
                  >
                    Copy
                  </button>
                </div>
                <pre className="text-11 text-text font-mono whitespace-pre-wrap break-all pl-0.5 leading-relaxed max-h-[120px] overflow-y-auto">
                  {formatData(e.body)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}