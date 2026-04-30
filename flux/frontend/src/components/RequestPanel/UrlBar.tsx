import { Code2, Save, Send, X } from "lucide-react";
import { useRequestStore } from "../../stores/useRequestStore";
import { useResponseStore } from "../../stores/useResponseStore";
import { useUIStore } from "../../stores/useUIStore";
import { MethodSelect } from "../shared/MethodSelect";
import { buildQueryString, parseQueryString, splitUrl } from "../../lib/url";
import { uid } from "../../lib/id";
import { CancelRequest } from "../../../wailsjs/go/main/App";
import type { KeyValue } from "../../types/request";

export function UrlBar({ onSend }: { onSend?: () => void }) {
  const method = useRequestStore((s) => s.method);
  const url = useRequestStore((s) => s.url);
  const params = useRequestStore((s) => s.params);
  const setMethod = useRequestStore((s) => s.setMethod);
  const setUrl = useRequestStore((s) => s.setUrl);
  const isLoading = useResponseStore((s) => s.isLoading);
  const openSaveModal = useUIStore((s) => s.openSaveModal);
  const openCodeGen = useUIStore((s) => s.openCodeGenModal);

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
    <div className="flex items-center gap-2 px-4 h-[60px] border-b border-border">
      <MethodSelect value={method} onChange={setMethod} />

      <input
        id="flux-url-bar"
        type="text"
        value={displayed}
        placeholder="https://api.example.com/endpoint"
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation(); // prevent double-fire with global Ctrl+Enter listener
            if (!isLoading) onSend?.();
          }
        }}
        spellCheck={false}
        autoComplete="off"
        className="flex-1 min-w-0 h-[40px] px-3 bg-card border border-border rounded-md font-mono text-13 text-text placeholder:text-subtext outline-none focus:border-blue focus:ring-2 focus:ring-blue transition-colors"
      />

      <button
        type="button"
        onClick={openCodeGen}
        title="Generate code (cURL / fetch / Python)"
        className="h-[36px] w-[36px] flex items-center justify-center bg-card border border-border hover:border-blue rounded-md text-subtext hover:text-text transition-colors"
        aria-label="Generate code"
      >
        <Code2 size={14} />
      </button>

      <button
        type="button"
        onClick={openSaveModal}
        title="Save request (Ctrl+S)"
        className="h-[36px] w-[36px] flex items-center justify-center bg-card border border-border hover:border-blue rounded-md text-subtext hover:text-text transition-colors"
        aria-label="Save request"
      >
        <Save size={14} />
      </button>

      {isLoading ? (
        <button
          type="button"
          onClick={() => {
            void CancelRequest();
          }}
          className="h-[36px] px-4 bg-danger hover:opacity-90 active:scale-[0.97] rounded-md font-bold text-13 text-white flex items-center gap-2 transition-all"
        >
          <X size={14} />
          <span>Cancel</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onSend}
          className="h-[36px] px-4 bg-blue hover:bg-blue-hover active:scale-[0.97] rounded-md font-bold text-13 text-white flex items-center gap-2 transition-all"
        >
          <Send size={14} />
          <span>Send</span>
        </button>
      )}
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
