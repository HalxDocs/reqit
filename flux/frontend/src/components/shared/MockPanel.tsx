import { useEffect, useState } from "react";
import { Server, Square, Copy, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import {
  StartMockServer,
  StopMockServer,
  GetMockStatus,
} from "../../../wailsjs/go/main/App";
import type { main } from "../../../wailsjs/go/models";
import { useToastStore } from "../../stores/useToastStore";

const DEFAULT_PORT = 4321;

export function MockPanel() {
  const toast = useToastStore((s) => s.push);
  const [status, setStatus] = useState<main.MockStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [showRoutes, setShowRoutes] = useState(false);

  useEffect(() => {
    void GetMockStatus().then((s) => {
      if (s.running) setStatus(s);
    });
    const offStart = EventsOn("mock:started", (s: main.MockStatus) => setStatus(s));
    const offStop = EventsOn("mock:stopped", () => setStatus(null));
    const offUpdate = EventsOn("mock:updated", (s: main.MockStatus) => setStatus(s));
    return () => { offStart(); offStop(); offUpdate(); };
  }, []);

  const start = async () => {
    setStarting(true);
    try {
      const s = await StartMockServer(DEFAULT_PORT);
      setStatus(s);
      toast("success", `Mock server running on :${DEFAULT_PORT}`);
    } catch (e) {
      toast("error", String(e));
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    await StopMockServer();
    setStatus(null);
    toast("success", "Mock server stopped");
  };

  const copy = () => {
    if (status?.baseUrl) {
      void navigator.clipboard.writeText(status.baseUrl);
      toast("success", "Copied to clipboard");
    }
  };

  if (!status?.running) {
    return (
      <button
        type="button"
        onClick={start}
        disabled={starting}
        className="flex items-center gap-1.5 px-2 py-1 text-11 text-subtext hover:text-text border border-border rounded-md transition-colors disabled:opacity-50"
        title="Start local mock server"
      >
        <Server size={11} />
        {starting ? "Starting…" : "Mock Server"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
      <button
        type="button"
        onClick={() => setShowRoutes((v) => !v)}
        className="flex items-center gap-1 text-11 text-success font-mono"
        title="Show mocked routes"
      >
        {status.baseUrl}
        <span className="text-subtext ml-1">({status.routeCount} routes)</span>
        {showRoutes ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      <button type="button" onClick={copy} className="p-0.5 text-subtext hover:text-text" title="Copy base URL">
        <Copy size={10} />
      </button>
      <button type="button" onClick={stop} className="p-0.5 text-subtext hover:text-danger transition-colors" title="Stop mock server">
        <Square size={10} />
      </button>

      {showRoutes && status.routes?.length > 0 && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-lg p-3 min-w-[260px]">
          <div className="text-11 font-semibold text-text mb-2 flex items-center gap-1.5">
            <Zap size={11} className="text-success" />
            Mocked routes
          </div>
          <ul className="flex flex-col gap-1">
            {status.routes.map((r) => (
              <li key={r} className="text-11 font-mono text-subtext">{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
