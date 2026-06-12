import { useCallback, useState } from "react";
import { Send, Radio } from "lucide-react";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { cn } from "@/shared/lib/cn";
import { GRPCInvoke } from "../../../../wailsjs/go/main/App";
import type { GRPCResponse } from "@/features/request/types/request";

const inputClass =
  "h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text placeholder:text-subtext outline-none focus:border-cyan focus:ring-2 focus:ring-cyan transition-colors";

export default function GRPCPanel() {
  const grpcService = useRequestStore((s) => s.grpcService);
  const grpcMethod = useRequestStore((s) => s.grpcMethod);
  const grpcBody = useRequestStore((s) => s.grpcBody);
  const setGrpcService = useRequestStore((s) => s.setGrpcService);
  const setGrpcMethod = useRequestStore((s) => s.setGrpcMethod);
  const setGrpcBody = useRequestStore((s) => s.setGrpcBody);
  const url = useRequestStore((s) => s.url);

  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<GRPCResponse | null>(null);
  const [error, setError] = useState("");

  const handleSend = useCallback(async () => {
    if (!url.trim()) return;
    setSending(true);
    setError("");
    setResponse(null);
    try {
      const res = await GRPCInvoke(url, grpcService ?? "", grpcMethod ?? "", grpcBody ?? "", {});
      setResponse(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setSending(false);
    }
  }, [url, grpcService, grpcMethod, grpcBody]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <span className="inline-flex items-center gap-1 h-[22px] px-2 bg-cyan/10 text-cyan text-[10px] font-semibold uppercase tracking-wider rounded-sm">
          <Radio size={10} />
          gRPC-web
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4 border-b border-border">
        <div className="flex flex-col gap-1.5">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Service</label>
          <input
            type="text"
            value={grpcService}
            onChange={(e) => setGrpcService(e.target.value)}
            placeholder="package.ServiceName"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Method</label>
          <input
            type="text"
            value={grpcMethod}
            onChange={(e) => setGrpcMethod(e.target.value)}
            placeholder="SayHello"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-3 py-[6px] text-[10px] font-semibold text-subtext uppercase tracking-wider bg-card/50 border-b border-border">
          Request Body (JSON)
        </div>
        <textarea
          value={grpcBody}
          onChange={(e) => setGrpcBody(e.target.value)}
          placeholder='{ "name": "Alice" }'
          spellCheck={false}
          className="flex-1 min-h-0 w-full bg-surface text-text text-12 font-mono p-3 outline-none resize-none border-0 placeholder:text-subtext"
        />
      </div>

      <div className="flex items-center gap-2 px-3 py-3 border-t border-border">
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !url.trim() || !grpcService || !grpcMethod}
          className="h-[36px] px-5 bg-cyan hover:bg-cyan-hover active:scale-[0.97] text-white text-13 font-bold rounded-md flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <Send size={14} />
          {sending ? "Invoking…" : "Invoke"}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 text-12 text-danger border-t border-border">{error}</div>
      )}

      {response && (
        <div className="border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2 bg-card/50 border-b border-border text-11">
            <span className="text-subtext">Status:</span>
            <span className="font-mono font-semibold text-text">{response.statusCode}</span>
            <span className="text-subtext">Duration:</span>
            <span className="font-mono text-text">{response.durationMs}ms</span>
            {response.error && (
              <span className="text-danger ml-auto">{response.error}</span>
            )}
          </div>
          <pre className="max-h-[200px] overflow-auto p-3 text-12 text-text font-mono whitespace-pre-wrap break-all">
            {response.body || "(empty response)"}
          </pre>
        </div>
      )}
    </div>
  );
}
