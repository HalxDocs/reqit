import { useState } from "react";
import { Fingerprint, AlertCircle, CheckCircle2 } from "lucide-react";
import { DecodeJWT } from "../../../../wailsjs/go/main/App";
import type { JWTDecoded } from "@/features/request/types/request";

function KeyValueList({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="flex flex-col gap-1">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="grid grid-cols-[auto_1fr] gap-3 text-12">
          <span className="text-subtext font-mono whitespace-nowrap">{key}:</span>
          <span className="text-text font-mono break-all">{String(value)}</span>
        </div>
      ))}
    </div>
  );
}

export function JWTDecoder() {
  const [token, setToken] = useState("");
  const [decoded, setDecoded] = useState<JWTDecoded | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDecode = async () => {
    if (!token.trim()) return;
    setLoading(true);
    try {
      const result = await DecodeJWT(token.trim());
      setDecoded(result);
    } catch (e) {
      setDecoded({
        header: {},
        claims: {},
        valid: false,
        expired: false,
        error: String(e),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="p-4 border-b border-border flex flex-col gap-2">
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste your JWT token here..."
          rows={4}
          spellCheck={false}
          className="w-full px-3 py-2 bg-surface border border-border rounded-md font-mono text-12 text-text placeholder:text-subtext outline-none focus:border-cyan focus:ring-2 focus:ring-cyan transition-colors resize-none"
        />
        <button
          type="button"
          onClick={handleDecode}
          disabled={loading || !token.trim()}
          className="h-[36px] px-4 bg-cyan hover:bg-cyan-hover active:scale-[0.97] rounded-md font-bold text-13 text-white flex items-center gap-2 transition-all self-start disabled:opacity-50"
        >
          <Fingerprint size={14} />
          <span>{loading ? "Decoding..." : "Decode"}</span>
        </button>
      </div>

      {decoded?.error && (
        <div className="px-4 py-3 flex items-center gap-2 text-12 text-danger border-b border-border">
          <AlertCircle size={14} />
          <span>{decoded.error}</span>
        </div>
      )}

      {decoded && !decoded.error && (
        <>
          <div className="border-b border-border">
            <div className="px-4 py-2 text-11 text-subtext font-semibold uppercase tracking-wider">
              Header
            </div>
            <div className="px-4 pb-3">
              <KeyValueList data={decoded.header} />
            </div>
          </div>

          <div className="border-b border-border">
            <div className="px-4 py-2 text-11 text-subtext font-semibold uppercase tracking-wider">
              Claims
            </div>
            <div className="px-4 pb-3">
              <KeyValueList data={decoded.claims} />
            </div>
          </div>

          <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
            {decoded.expired ? (
              <>
                <AlertCircle size={14} className="text-danger" />
                <span className="text-12 text-danger font-semibold">Expired</span>
              </>
            ) : decoded.valid ? (
              <>
                <CheckCircle2 size={14} className="text-success" />
                <span className="text-12 text-success font-semibold">Valid</span>
              </>
            ) : (
              <>
                <AlertCircle size={14} className="text-subtext" />
                <span className="text-12 text-subtext font-semibold">Unknown</span>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
