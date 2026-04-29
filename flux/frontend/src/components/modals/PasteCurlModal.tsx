import { useEffect, useState } from "react";
import { Modal } from "../shared/Modal";
import { useUIStore } from "../../stores/useUIStore";
import { useTabsStore, deriveTitle } from "../../stores/useTabsStore";
import { parseCurl } from "../../lib/curlParser";

export function PasteCurlModal() {
  const open = useUIStore((s) => s.pasteCurlModalOpen);
  const close = useUIStore((s) => s.closePasteCurlModal);
  const newTab = useTabsStore((s) => s.newTab);

  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setText("");
    setErr(null);
  }, [open]);

  const handleImport = () => {
    setErr(null);
    try {
      const decoded = parseCurl(text);
      newTab({
        title: deriveTitle(decoded),
        savedRequestID: null,
        request: decoded,
        response: null,
        dirty: false,
      });
      close();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Modal open={open} onClose={close} title="Paste cURL command">
      <div className="flex flex-col gap-3 w-[600px] max-w-full">
        <p className="text-12 text-subtext">
          Paste a cURL command from your browser DevTools or API docs.
          Method, URL, headers, body, and Bearer/Basic auth are imported.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          autoFocus
          placeholder={`curl -X POST 'https://api.example.com/users' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"name":"alice"}'`}
          className="bg-surface border border-border rounded-md p-3 font-mono text-12 text-text placeholder:text-subtext outline-none focus:border-blue focus:ring-2 focus:ring-blue resize-none min-h-[200px]"
        />

        {err && <div className="text-12 text-danger">{err}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={close}
            className="h-[32px] px-3 text-12 text-subtext hover:text-text rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!text.trim()}
            className="h-[32px] px-4 bg-blue hover:bg-blue-hover text-white text-12 font-bold rounded-md disabled:opacity-60 transition-all"
          >
            Import as new tab
          </button>
        </div>
      </div>
    </Modal>
  );
}
