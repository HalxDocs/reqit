import { useState, useEffect } from "react";
import { useUIStore } from "@/app/stores/useUIStore";
import { Button } from "@/shared/components/Button";
import {
  StartInterceptor, StopInterceptor, GetInterceptorStatus,
  GetCapturedRequests, ClearCapturedRequests, ExportExtension, SendNotification,
} from "../../../../wailsjs/go/main/App";
import type { interceptor } from "../../../../wailsjs/go/models";

export function InterceptorPanel() {
  const setView = useUIStore((s) => s.setView);
  const [status, setStatus] = useState({ running: false, port: 0, count: 0 });
  const [captured, setCaptured] = useState<interceptor.CapturedRequest[]>([]);

  const refresh = async () => {
    setStatus(await GetInterceptorStatus());
    setCaptured(await GetCapturedRequests());
  };
  useEffect(() => { refresh(); const id = setInterval(refresh, 3000); return () => clearInterval(id); }, []);

  const toggle = async () => {
    if (status.running) {
      await StopInterceptor();
    } else {
      await StartInterceptor();
    }
    refresh();
  };

  const exportExt = async () => {
    const dir = await ExportExtension("reqit-extension");
    refresh();
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg">
      <header className="h-[48px] flex items-center gap-3 px-4 border-b border-border shrink-0">
        <button onClick={() => setView("http")} className="text-subtext hover:text-text text-13">&larr; Back</button>
        <h1 className="text-14 font-semibold text-text">Browser Traffic Interceptor</h1>
      </header>
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
        <span className={`inline-block w-3 h-3 rounded-full ${status.running ? "bg-green-500" : "bg-gray-500"}`} />
        <span className="text-13 text-text">{status.running ? `Proxy running on 127.0.0.1:${status.port}` : "Proxy stopped"}</span>
        <Button onClick={toggle}>{status.running ? "Stop" : "Start"} Interceptor</Button>
        <Button onClick={exportExt}>Export Extension</Button>
        <span className="text-12 text-subtext">{status.count} captured</span>
      </div>
      {status.running && (
        <div className="px-4 py-2 border-b border-border">
          <p className="text-12 text-subtext">Configure your Chrome extension with this proxy address, or use the exported extension source.</p>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4">
        {captured.length === 0 ? (
          <p className="text-13 text-subtext">No requests captured yet. Start the proxy and send traffic through it.</p>
        ) : (
          <div className="space-y-2">
            {captured.slice().reverse().map((cr, i) => (
              <div key={i} className="bg-surface border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-11 font-bold px-1.5 py-0.5 rounded ${
                    cr.method === "GET" ? "bg-green-500/10 text-green-500" :
                    cr.method === "POST" ? "bg-blue-500/10 text-blue-500" :
                    cr.method === "PUT" ? "bg-amber-500/10 text-amber-500" :
                    cr.method === "DELETE" ? "bg-red-500/10 text-red-500" :
                    "bg-gray-500/10 text-gray-500"
                  }`}>{cr.method}</span>
                  <span className="text-13 text-text truncate flex-1">{cr.url}</span>
                  <span className="text-11 text-subtext/50">{new Date(cr.timestamp).toLocaleTimeString()}</span>
                </div>
                {cr.body && <pre className="text-11 text-subtext bg-bg p-2 rounded mt-1 max-h-[100px] overflow-auto">{cr.body.slice(0, 500)}</pre>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
