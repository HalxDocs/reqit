import { Loader2, Send } from "lucide-react";
import { useRequestStore } from "../../stores/useRequestStore";
import { useResponseStore } from "../../stores/useResponseStore";
import { MethodSelect } from "../shared/MethodSelect";
import { buildQueryString, parseQueryString, splitUrl } from "../../lib/url";
import { uid } from "../../lib/id";
import type { KeyValue } from "../../types/request";

export function UrlBar({ onSend }: { onSend?: () => void }) {
  const method = useRequestStore((s) => s.method);
  const url = useRequestStore((s) => s.url);
  const params = useRequestStore((s) => s.params);
  const setMethod = useRequestStore((s) => s.setMethod);
  const setUrl = useRequestStore((s) => s.setUrl);
  const isLoading = useResponseStore((s) => s.isLoading);

  const displayed = url + buildQueryString(params);

  const handleChange = (val: string) => {
    const { base, query } = splitUrl(val);
    setUrl(base);
    if (query) {
      const parsed = parseQueryString(query);
      replaceParams(parsed.length ? parsed : [emptyRow()]);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 h-[56px] border-b border-border">
      <MethodSelect value={method} onChange={setMethod} />

      <input
        type="text"
        value={displayed}
        placeholder="https://api.example.com/endpoint"
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            if (!isLoading) onSend?.();
          }
        }}
        spellCheck={false}
        autoComplete="off"
        className="flex-1 h-[36px] px-3 bg-card border border-border rounded-md font-mono text-13 text-text placeholder:text-subtext outline-none focus:border-violet focus:ring-2 focus:ring-violet transition-colors"
      />

      <button
        type="button"
        onClick={onSend}
        disabled={isLoading}
        className="h-[36px] px-4 bg-violet hover:bg-violet-hover active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 rounded-md font-bold text-13 text-white flex items-center gap-2 transition-all"
      >
        {isLoading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            <span>Sending</span>
          </>
        ) : (
          <>
            <Send size={14} />
            <span>Send</span>
          </>
        )}
      </button>
    </div>
  );
}

const emptyRow = (): KeyValue => ({
  id: uid("kv"),
  key: "",
  value: "",
  enabled: true,
});

function replaceParams(rows: KeyValue[]) {
  useRequestStore.setState({ params: rows });
}
