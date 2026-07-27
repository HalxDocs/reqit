import { useState } from "react";
import { Modal } from "@/shared/components/Modal";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";
import { toast } from "@/app/stores/useToastStore";
import type { HttpMethod } from "@/features/request/types/request";
import type { models } from "../../../../wailsjs/go/models";

interface Props {
  open: boolean;
  onClose: () => void;
  requestIDs: string[];
}

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export function BulkEditModal({ open, onClose, requestIDs }: Props) {
  const collections = useCollectionStore((s) => s.collections);
  const update = useCollectionStore((s) => s.updateRequest);

  const [method, setMethod] = useState("");
  const [addHeaderKey, setAddHeaderKey] = useState("");
  const [addHeaderVal, setAddHeaderVal] = useState("");
  const [urlPrefix, setUrlPrefix] = useState("");
  const [urlSuffix, setUrlSuffix] = useState("");
  const [busy, setBusy] = useState(false);

  // Collect the requests to edit
  const targets = collections.flatMap((c) =>
    c.requests?.filter((r) => requestIDs.includes(r.id)) ?? [],
  );

  const handleApply = async () => {
    setBusy(true);
    let updated = 0;
    try {
      for (const req of targets) {
        const p = { ...req.payload };
        const changed: string[] = [];

        if (method) {
          p.method = method;
          changed.push("method");
        }
        if (addHeaderKey) {
          p.headers = [...(p.headers ?? []), { key: addHeaderKey, value: addHeaderVal, enabled: true } as any];
          changed.push("headers");
        }
        if (urlPrefix) {
          p.url = urlPrefix + p.url;
          changed.push("url");
        }
        if (urlSuffix) {
          p.url = p.url + urlSuffix;
          changed.push("url");
        }

        if (changed.length === 0) continue;
        await update(req.id, req.name, p as any);
        updated++;
      }

      if (updated > 0) {
        toast.success(`Updated ${updated} request${updated > 1 ? "s" : ""}`);
      }
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Bulk Edit (${requestIDs.length} requests)`}>
      <div className="flex flex-col gap-4 min-w-[420px]">
        {/* Method */}
        <div className="flex flex-col gap-1">
          <label className="text-10 text-subtext uppercase tracking-wider">Change Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="h-[32px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan"
          >
            <option value="">— No change —</option>
            {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* URL prefix */}
        <div className="flex flex-col gap-1">
          <label className="text-10 text-subtext uppercase tracking-wider">URL Prefix (prepend)</label>
          <input
            type="text"
            value={urlPrefix}
            onChange={(e) => setUrlPrefix(e.target.value)}
            placeholder="https://api.newbase.com"
            className="h-[32px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan"
          />
        </div>

        {/* URL suffix */}
        <div className="flex flex-col gap-1">
          <label className="text-10 text-subtext uppercase tracking-wider">URL Suffix (append)</label>
          <input
            type="text"
            value={urlSuffix}
            onChange={(e) => setUrlSuffix(e.target.value)}
            placeholder="?version=2"
            className="h-[32px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan"
          />
        </div>

        {/* Add header */}
        <div className="flex flex-col gap-1">
          <label className="text-10 text-subtext uppercase tracking-wider">Add Header</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={addHeaderKey}
              onChange={(e) => setAddHeaderKey(e.target.value)}
              placeholder="Header name"
              className="flex-1 h-[32px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan"
            />
            <input
              type="text"
              value={addHeaderVal}
              onChange={(e) => setAddHeaderVal(e.target.value)}
              placeholder="Value"
              className="flex-1 h-[32px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan"
            />
          </div>
        </div>

        {/* Preview of affected requests */}
        <div className="border-t border-border pt-2">
          <div className="text-10 text-subtext uppercase tracking-wider mb-1">Affected requests</div>
          <div className="max-h-[120px] overflow-y-auto flex flex-col gap-0.5">
            {targets.map((req) => (
              <div key={req.id} className="text-11 text-text font-mono truncate">{req.name}</div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-[32px] px-3 text-12 text-subtext hover:text-text rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={busy}
            className="h-[32px] px-4 bg-cyan hover:bg-cyan-hover text-white text-12 font-bold rounded-md disabled:opacity-60 transition-all"
          >
            {busy ? "Applying…" : `Apply to ${targets.length} requests`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
