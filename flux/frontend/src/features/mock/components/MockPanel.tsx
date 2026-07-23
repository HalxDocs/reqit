import { useEffect, useState } from "react";
import { Server, Square, Copy, Zap, ChevronDown, ChevronUp, Radio, Disc } from "lucide-react";
import { EventsOn } from "../../../../wailsjs/runtime/runtime";
import {
  StartMockServer,
  StopMockServer,
  GetMockStatus,
  ToggleMockRecording,
} from "../../../../wailsjs/go/main/App";
import type { main } from "../../../../wailsjs/go/models";
import { useToastStore } from "@/app/stores/useToastStore";

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
    try {
      await StopMockServer();
      setStatus(null);
      toast("success", "Mock server stopped");
    } catch (e) {
      toast("error", String(e));
    }
  };

  const copy = () => {
    if (status?.baseUrl) {
      navigator.clipboard.writeText(status.baseUrl).then(
        () => toast("success", "Copied to clipboard"),
        () => toast("error", "Failed to copy"),
      );
    }
  };

  const toggleRecording = async () => {
    if (!status) return;
    try {
      await ToggleMockRecording(!status.recording);
      toast("success", status.recording ? "Recording stopped" : "Recording started — traffic will be captured as mock routes");
    } catch (e) {
      toast("error", String(e));
    }
  };

  if (!status?.running) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-12">
        <div className="w-16 h-16 rounded-2xl bg-cyan/10 flex items-center justify-center">
          <Server size={28} className="text-cyan" />
        </div>
        <div className="text-center">
          <h3 className="text-14 font-semibold text-text mb-1">Mock Server</h3>
          <p className="text-12 text-subtext">Capture and replay API responses locally</p>
        </div>
        <button
          type="button"
          onClick={start}
          disabled={starting}
          className="h-[36px] px-6 flex items-center gap-2 bg-cyan text-white text-13 font-semibold rounded-lg hover:bg-cyan/80 transition-colors disabled:opacity-50"
        >
          <Server size={14} />
          {starting ? "Starting…" : "Start Mock Server"}
        </button>
        <span className="text-11 text-subtext/60">Port {DEFAULT_PORT}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3 bg-surface border border-border rounded-lg p-3">
        <span className="w-2 h-2 rounded-full bg-success animate-pulse shrink-0" />
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setShowRoutes((v) => !v)}
            className="flex items-center gap-1.5 text-12 text-success font-mono hover:text-success/80 transition-colors"
            title="Show mocked routes"
          >
            {status.baseUrl}
            <span className="text-subtext ml-1">({status.routeCount} routes)</span>
            {showRoutes ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        </div>
        <button type="button" onClick={copy} className="p-1 text-subtext hover:text-text transition-colors" title="Copy base URL">
          <Copy size={12} />
        </button>
        <button type="button" onClick={toggleRecording}
          className={status.recording ? "p-1 text-danger" : "p-1 text-subtext hover:text-text transition-colors"}
          title={status.recording ? "Stop recording" : "Start recording real traffic"}>
          {status.recording ? <Disc size={12} className="animate-pulse" /> : <Radio size={12} />}
        </button>
        <button type="button" onClick={stop} className="p-1 text-subtext hover:text-danger transition-colors" title="Stop mock server">
          <Square size={12} />
        </button>
      </div>

      {showRoutes && status.routes?.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="text-12 font-semibold text-text mb-2 flex items-center gap-1.5">
            <Zap size={12} className="text-success" />
            Mocked routes
          </div>
          <ul className="flex flex-col gap-1">
            {status.routes.map((r: string) => (
              <li key={r} className="text-12 font-mono text-subtext pl-4">{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
