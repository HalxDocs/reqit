import { useEffect, useRef, useState } from "react";
import { Modal } from "../shared/Modal";
import { useUIStore } from "../../stores/useUIStore";
import { useCollectionStore } from "../../stores/useCollectionStore";
import { ImportPostman } from "../../../wailsjs/go/main/App";

const NEW_COLLECTION = "__new__";

export function ImportPostmanModal() {
  const open = useUIStore((s) => s.importModalOpen);
  const close = useUIStore((s) => s.closeImportModal);
  const collections = useCollectionStore((s) => s.collections);
  const createCollection = useCollectionStore((s) => s.createCollection);
  const reload = useCollectionStore((s) => s.load);

  const [target, setTarget] = useState<string>("");
  const [newCollName, setNewCollName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setImported(null);
    setFile(null);
    setNewCollName("");
    setTarget(collections[0]?.id ?? NEW_COLLECTION);
    if (fileRef.current) fileRef.current.value = "";
  }, [open, collections]);

  const handleImport = async () => {
    if (!file) {
      setErr("Choose a Postman v2.1 collection JSON file");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      let targetID = target;
      if (target === NEW_COLLECTION) {
        const trimmed = newCollName.trim();
        if (!trimmed) {
          setErr("Enter a name for the new collection");
          setBusy(false);
          return;
        }
        const created = await createCollection(trimmed);
        targetID = created.id;
      }
      const text = await file.text();
      const count = await ImportPostman(targetID, text);
      await reload();
      setImported(count);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Import Postman v2.1">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">
            Collection JSON
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-12 text-text file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-border file:bg-surface file:text-text file:cursor-pointer hover:file:bg-cardHover"
          />
          {file && (
            <span className="text-11 text-subtext font-mono">
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">
            Target collection
          </label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="h-[36px] px-3 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-violet focus:ring-2 focus:ring-violet"
          >
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={NEW_COLLECTION}>+ New collection…</option>
          </select>
        </div>

        {target === NEW_COLLECTION && (
          <div className="flex flex-col gap-2">
            <label className="text-11 text-subtext font-semibold uppercase tracking-wider">
              New collection name
            </label>
            <input
              value={newCollName}
              onChange={(e) => setNewCollName(e.target.value)}
              spellCheck={false}
              placeholder="e.g. Imported APIs"
              className="h-[36px] px-3 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-violet focus:ring-2 focus:ring-violet"
            />
          </div>
        )}

        {err && <div className="text-12 text-danger">{err}</div>}
        {imported !== null && (
          <div className="text-12 text-teal">
            Imported {imported} request{imported === 1 ? "" : "s"}.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={close}
            className="h-[32px] px-3 text-12 text-subtext hover:text-text rounded-md transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={busy}
            className="h-[32px] px-4 bg-violet hover:bg-violet-hover text-white text-12 font-bold rounded-md disabled:opacity-60 transition-all"
          >
            {busy ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
