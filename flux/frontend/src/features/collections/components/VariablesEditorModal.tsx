import { Plus, Trash2 } from "lucide-react";
import type { models } from "../../../../wailsjs/go/models";

interface VariablesEditorModalProps {
  open: boolean;
  onClose: () => void;
  collection: models.Collection;
  draft: models.EnvVar[];
  setDraft: (draft: models.EnvVar[]) => void;
  onSave: (collectionID: string, vars: models.EnvVar[]) => void;
}

export function VariablesEditorModal({ open, onClose, collection, draft, setDraft, onSave }: VariablesEditorModalProps) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="bg-card border border-border rounded-lg shadow-xl p-4 w-[420px] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-13 font-semibold text-text mb-3">Variables — {collection.name}</h3>
          <p className="text-11 text-subtext mb-3">Collection-scoped variables override environment variables of the same name.</p>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
            {draft.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="checkbox" checked={v.enabled} onChange={(e) => {
                  const next = [...draft];
                  next[i] = { ...next[i], enabled: e.target.checked };
                  setDraft(next);
                }} className="accent-cyan w-[14px] h-[14px]" />
                <input type="text" value={v.key} onChange={(e) => {
                  const next = [...draft];
                  next[i] = { ...next[i], key: e.target.value };
                  setDraft(next);
                }} placeholder="Key" className="flex-1 h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan font-mono" />
                <input type="text" value={v.value} onChange={(e) => {
                  const next = [...draft];
                  next[i] = { ...next[i], value: e.target.value };
                  setDraft(next);
                }} placeholder="Value" className="flex-1 h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan font-mono" />
                <button type="button" onClick={() => setDraft(draft.filter((_, j) => j !== i))}
                  className="text-subtext hover:text-danger transition-colors p-1 shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setDraft([...draft, { key: "", value: "", enabled: true } as models.EnvVar])}
            className="flex items-center gap-1 mt-2 text-12 text-cyan hover:text-cyan-hover transition-colors">
            <Plus size={12} /> Add variable
          </button>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose}
              className="h-[28px] px-3 text-12 text-subtext hover:text-text bg-cardHover rounded-md transition-colors">Cancel</button>
            <button type="button" onClick={() => onSave(collection.id, draft)}
              className="h-[28px] px-3 text-12 text-white bg-cyan rounded-md hover:bg-cyan/80 transition-colors">Save</button>
          </div>
        </div>
      </div>
    </>
  );
}
