import { useCallback, useState } from "react";
import { FileText, Code } from "lucide-react";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { cn } from "@/shared/lib/cn";
import { BuildSOAPEnvelope } from "../../../../wailsjs/go/main/App";

const inputClass =
  "h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text placeholder:text-subtext outline-none focus:border-cyan focus:ring-2 focus:ring-cyan transition-colors";

export default function SOAPPanel() {
  const soapAction = useRequestStore((s) => s.soapAction);
  const soapVersion = useRequestStore((s) => s.soapVersion);
  const soapBody = useRequestStore((s) => s.soapBody);
  const setSoapAction = useRequestStore((s) => s.setSoapAction);
  const setSoapVersion = useRequestStore((s) => s.setSoapVersion);
  const setSoapBody = useRequestStore((s) => s.setSoapBody);

  const [envelope, setEnvelope] = useState("");
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");

  const handleBuildEnvelope = useCallback(async () => {
    if (!soapBody?.trim()) return;
    setBuilding(true);
    setError("");
    try {
      const result = await BuildSOAPEnvelope(soapAction ?? "", soapBody ?? "", "", soapVersion ?? "1.1", {});
      setEnvelope(Array.isArray(result) ? result[0] : result);
    } catch (e) {
      setError(String(e));
    } finally {
      setBuilding(false);
    }
  }, [soapAction, soapVersion, soapBody]);

  const handleUseEnvelope = useCallback(() => {
    if (envelope) setSoapBody(envelope);
  }, [envelope, setSoapBody]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-3 p-4 border-b border-border">
        <div className="flex flex-col gap-1.5">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">SOAP Action</label>
          <input
            type="text"
            value={soapAction}
            onChange={(e) => setSoapAction(e.target.value)}
            placeholder="urn:example:service#Method"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">SOAP Version</label>
          <div className="flex items-center gap-2">
            {(["1.1", "1.2"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSoapVersion(v)}
                className={cn(
                  "h-[32px] px-4 text-12 font-semibold rounded-md transition-all",
                  soapVersion === v
                    ? "bg-cyan text-white"
                    : "bg-surface border border-border text-subtext hover:text-text hover:border-cyan",
                )}
              >
                SOAP {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-3 py-[6px] text-[10px] font-semibold text-subtext uppercase tracking-wider bg-card/50 border-b border-border">
          SOAP Body (XML)
        </div>
        <textarea
          value={soapBody}
          onChange={(e) => setSoapBody(e.target.value)}
          placeholder="<example:Request><param>value</param></example:Request>"
          spellCheck={false}
          className="flex-1 min-h-0 w-full bg-surface text-text text-12 font-mono p-3 outline-none resize-none border-0 placeholder:text-subtext"
        />
      </div>

      <div className="flex items-center gap-2 px-3 py-3 border-t border-border">
        <button
          type="button"
          onClick={handleBuildEnvelope}
          disabled={building || !(soapBody ?? "").trim()}
          className="h-[36px] px-5 bg-cyan hover:bg-cyan-hover active:scale-[0.97] text-white text-13 font-bold rounded-md flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <Code size={14} />
          {building ? "Building…" : "Build Envelope"}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 text-12 text-danger border-t border-border">{error}</div>
      )}

      {envelope && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-3 py-[6px] bg-card/50 border-b border-border">
            <span className="text-[10px] font-semibold text-subtext uppercase tracking-wider">Built Envelope</span>
            <button
              type="button"
              onClick={handleUseEnvelope}
              className="text-11 text-cyan hover:text-cyan-hover flex items-center gap-1 transition-colors"
            >
              <FileText size={12} />
              Use Envelope as Body
            </button>
          </div>
          <pre className="max-h-[240px] overflow-auto p-3 text-12 text-text font-mono whitespace-pre-wrap break-all">
            {envelope}
          </pre>
        </div>
      )}
    </div>
  );
}
