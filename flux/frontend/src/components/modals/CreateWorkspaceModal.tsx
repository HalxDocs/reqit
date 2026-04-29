import { useState } from "react";
import { Modal } from "../shared/Modal";
import { useWorkspaceStore } from "../../stores/useWorkspaceStore";
import { useCollectionStore } from "../../stores/useCollectionStore";
import { useHistoryStore } from "../../stores/useHistoryStore";
import { useEnvStore } from "../../stores/useEnvStore";
import { cn } from "../../lib/cn";

const COLORS = [
  { value: "#3B82F6", label: "Blue" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#14B8A6", label: "Teal" },
  { value: "#F97316", label: "Orange" },
  { value: "#EC4899", label: "Pink" },
  { value: "#22C55E", label: "Green" },
  { value: "#EF4444", label: "Red" },
  { value: "#64748B", label: "Slate" },
];

export function CreateWorkspaceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const createWs = useWorkspaceStore((s) => s.create);
  const loadCollections = useCollectionStore((s) => s.load);
  const loadHistory = useHistoryStore((s) => s.load);
  const loadEnvs = useEnvStore((s) => s.load);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0].value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setDescription("");
    setColor(COLORS[0].value);
    setErr(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setErr("Workspace name is required");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await createWs(name.trim(), description.trim(), color);
      // Reload workspace-scoped data into the new workspace
      await Promise.all([loadCollections(), loadHistory(), loadEnvs()]);
      reset();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="New workspace">
      <div className="flex flex-col gap-4 w-[400px] max-w-full">
        <div className="flex flex-col gap-2">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
            spellCheck={false}
            placeholder="e.g. Personal APIs"
            className="h-[36px] px-3 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-blue focus:ring-2 focus:ring-blue"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">
            Description <span className="normal-case font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            spellCheck={false}
            placeholder="What is this workspace for?"
            className="h-[36px] px-3 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-blue focus:ring-2 focus:ring-blue"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">
            Color
          </label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => setColor(c.value)}
                style={{ backgroundColor: c.value }}
                className={cn(
                  "w-[28px] h-[28px] rounded-full transition-all",
                  color === c.value
                    ? "ring-2 ring-offset-2 ring-offset-card scale-110"
                    : "opacity-70 hover:opacity-100",
                )}
              />
            ))}
          </div>
        </div>

        {err && <div className="text-12 text-danger">{err}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="h-[32px] px-3 text-12 text-subtext hover:text-text rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            className="h-[32px] px-4 text-white text-12 font-bold rounded-md disabled:opacity-60 transition-all"
            style={{ backgroundColor: color }}
          >
            {busy ? "Creating…" : "Create workspace"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
