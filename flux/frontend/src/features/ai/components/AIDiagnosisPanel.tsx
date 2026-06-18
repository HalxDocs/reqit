import { useState } from "react";
import { Sparkles, Loader2, Copy, Check } from "lucide-react";
import { useAIStore } from "../stores/useAIStore";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { useResponseStore } from "@/features/request/stores/useResponseStore";
import { buildPayload } from "@/features/request/lib/buildPayload";
import type { models } from "../../../../wailsjs/go/models";

export function AIDiagnosisPanel() {
  const { enabled, diagnose, generateAssertions } = useAIStore();
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"diagnose" | "assertions">("diagnose");
  const [copied, setCopied] = useState(false);

  const response = useResponseStore((s) => s.response);

  if (!enabled || !response || response.error) return null;

  const payload = buildPayload(useRequestStore.getState());

  const handleDiagnose = async () => {
    setLoading(true);
    setResult("");
    try {
      const r = await diagnose(payload as never, response as never);
      setResult(r);
    } catch (e: any) {
      setResult(`**Error:** ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAssertions = async () => {
    setLoading(true);
    setResult("");
    try {
      const r = await generateAssertions(payload as never, response as never);
      setResult(r);
    } catch (e: any) {
      setResult(`**Error:** ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="border-t border-border bg-bg">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Sparkles size={12} className="text-cyan" />
        <span className="text-11 font-semibold text-text">AI</span>
        <div className="flex gap-1 ml-2">
          <button
            type="button"
            onClick={() => setMode("diagnose")}
            className={`h-[22px] px-2 text-10 font-semibold rounded border transition-colors ${
              mode === "diagnose"
                ? "bg-cyan/10 text-cyan border-cyan/30"
                : "text-subtext border-border hover:text-text"
            }`}
          >
            Diagnose
          </button>
          <button
            type="button"
            onClick={() => setMode("assertions")}
            className={`h-[22px] px-2 text-10 font-semibold rounded border transition-colors ${
              mode === "assertions"
                ? "bg-cyan/10 text-cyan border-cyan/30"
                : "text-subtext border-border hover:text-text"
            }`}
          >
            Assertions
          </button>
        </div>
        <div className="flex-1" />
        {!loading && !result && (
          <button
            type="button"
            onClick={mode === "diagnose" ? handleDiagnose : handleAssertions}
            className="h-[24px] px-2.5 flex items-center gap-1.5 text-11 font-semibold text-cyan bg-cyan/10 border border-cyan/20 rounded-md hover:bg-cyan/20 transition-colors"
          >
            <Sparkles size={10} />
            {mode === "diagnose" ? "Diagnose with AI" : "Generate assertions"}
          </button>
        )}
        {result && (
          <button
            type="button"
            onClick={handleCopy}
            className="h-[22px] px-2 flex items-center gap-1 text-10 text-subtext hover:text-text rounded border border-border transition-colors"
          >
            {copied ? <Check size={10} className="text-teal" /> : <Copy size={10} />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
        {result && (
          <button
            type="button"
            onClick={() => { setResult(""); }}
            className="h-[22px] px-2 text-10 text-subtext hover:text-text rounded border border-border transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-4 py-6 justify-center text-subtext">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-12">Thinking...</span>
        </div>
      )}

      {result && !loading && (
        <div className="px-4 py-3 max-h-[400px] overflow-y-auto">
          <div className="text-12 text-text leading-relaxed whitespace-pre-wrap font-mono">
            {result}
          </div>
        </div>
      )}
    </div>
  );
}
