import { useEffect, useState } from "react";
import { Modal } from "../shared/Modal";
import { useUIStore } from "../../stores/useUIStore";
import { useCollectionStore } from "../../stores/useCollectionStore";
import { useRequestStore } from "../../stores/useRequestStore";
import { useTabsStore } from "../../stores/useTabsStore";
import { buildPayloadLiteral } from "../../lib/buildPayload";
import { toast } from "../../stores/useToastStore";

const NEW_COLLECTION_VALUE = "__new__";

export function SaveRequestModal() {
  const open = useUIStore((s) => s.saveModalOpen);
  const close = useUIStore((s) => s.closeSaveModal);
  const collections = useCollectionStore((s) => s.collections);
  const createCollection = useCollectionStore((s) => s.createCollection);
  const addRequest = useCollectionStore((s) => s.addRequest);
  const markActiveSaved = useTabsStore((s) => s.markActiveSaved);

  const [name, setName] = useState("");
  const [collID, setCollID] = useState<string>("");
  const [newCollName, setNewCollName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setBusy(false);
    setName(useRequestStore.getState().url || "Untitled request");
    setCollID(collections[0]?.id ?? NEW_COLLECTION_VALUE);
    setNewCollName("");
  }, [open, collections]);

  const handleSave = async () => {
    if (!name.trim()) {
      setErr("Name is required");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      let targetID = collID;
      if (collID === NEW_COLLECTION_VALUE) {
        if (!newCollName.trim()) {
          setErr("Enter a name for the new collection");
          setBusy(false);
          return;
        }
        const created = await createCollection(newCollName.trim());
        targetID = created.id;
      }
      const payload = buildPayloadLiteral(useRequestStore.getState());
      const saved = await addRequest(targetID, name.trim(), payload);
      markActiveSaved(saved.id, name.trim());
      useUIStore.getState().setLoadedRequestID(saved.id);
      toast.success(`Saved "${name.trim()}"`);
      close();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Save request">
      <div className="flex flex-col gap-4">
        <Field label="Request name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            spellCheck={false}
            className="h-[36px] px-3 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-blue focus:ring-2 focus:ring-blue"
          />
        </Field>

        <Field label="Collection">
          <select
            value={collID}
            onChange={(e) => setCollID(e.target.value)}
            className="h-[36px] px-3 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-blue focus:ring-2 focus:ring-blue"
          >
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={NEW_COLLECTION_VALUE}>+ New collection…</option>
          </select>
        </Field>

        {collID === NEW_COLLECTION_VALUE && (
          <Field label="New collection name">
            <input
              type="text"
              value={newCollName}
              onChange={(e) => setNewCollName(e.target.value)}
              spellCheck={false}
              placeholder="e.g. Auth API"
              className="h-[36px] px-3 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-blue focus:ring-2 focus:ring-blue"
            />
          </Field>
        )}

        {err && <div className="text-12 text-danger">{err}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={close}
            className="h-[32px] px-3 text-12 text-subtext hover:text-text rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="h-[32px] px-4 bg-blue hover:bg-blue-hover text-white text-12 font-bold rounded-md disabled:opacity-60 transition-all"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-11 text-subtext font-semibold uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}
