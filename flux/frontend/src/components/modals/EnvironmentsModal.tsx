import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "../shared/Modal";
import { KeyValueEditor } from "../shared/KeyValueEditor";
import { useUIStore } from "../../stores/useUIStore";
import { useEnvStore } from "../../stores/useEnvStore";
import { cn } from "../../lib/cn";
import { uid } from "../../lib/id";
import type { KeyValue } from "../../types/request";
import type { models } from "../../../wailsjs/go/models";
import { toast } from "../../stores/useToastStore";

interface DraftEnv {
  id: string;
  name: string;
  rows: KeyValue[];
}

const toRows = (env: models.Environment): KeyValue[] => {
  const rows: KeyValue[] = (env.vars ?? []).map((v) => ({
    id: uid("ev"),
    key: v.key ?? "",
    value: v.value ?? "",
    enabled: v.enabled !== false,
  }));
  if (rows.length === 0) rows.push({ id: uid("ev"), key: "", value: "", enabled: true });
  return rows;
};

const toVars = (rows: KeyValue[]): models.EnvVar[] =>
  rows
    .filter((r) => r.key)
    .map((r) => ({
      key: r.key,
      value: r.value,
      enabled: r.enabled,
    })) as models.EnvVar[];

export function EnvironmentsModal() {
  const open = useUIStore((s) => s.envModalOpen);
  const close = useUIStore((s) => s.closeEnvModal);
  const environments = useEnvStore((s) => s.environments);
  const create = useEnvStore((s) => s.create);
  const update = useEnvStore((s) => s.update);
  const remove = useEnvStore((s) => s.remove);

  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftEnv | null>(null);
  const [busy, setBusy] = useState(false);
  const initialized = useRef(false);

  // Pick a default selection on open, but don't clobber it when the env list
  // changes (which would steal the new env right after handleCreate sets it).
  useEffect(() => {
    if (!open) {
      initialized.current = false;
      return;
    }
    if (!initialized.current) {
      initialized.current = true;
      setSelectedID(environments[0]?.id ?? null);
    }
  }, [open, environments]);

  // If the selected env disappears (e.g. user deletes it), fall back.
  useEffect(() => {
    if (!open || !selectedID) return;
    if (!environments.some((e) => e.id === selectedID)) {
      setSelectedID(environments[0]?.id ?? null);
    }
  }, [environments, selectedID, open]);

  useEffect(() => {
    if (!selectedID) {
      setDraft(null);
      return;
    }
    const env = environments.find((e) => e.id === selectedID);
    if (env) setDraft({ id: env.id, name: env.name, rows: toRows(env) });
  }, [selectedID, environments]);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const env = await create("New environment");
      setSelectedID(env.id);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await update(draft.id, draft.name.trim() || "Untitled", toVars(draft.rows));
      toast.success(`Saved "${draft.name.trim() || "Untitled"}"`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!draft) return;
    if (!confirm(`Delete environment "${draft.name}"?`)) return;
    setBusy(true);
    try {
      await remove(draft.id);
      setSelectedID(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Manage environments">
      <div className="grid grid-cols-[160px_1fr] gap-4 min-h-[280px] w-[520px] max-w-full">
        <aside className="flex flex-col border-r border-border pr-3 -ml-1">
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            className="flex items-center gap-2 h-[28px] px-2 mb-2 text-12 text-subtext hover:text-blue transition-colors"
          >
            <Plus size={12} />
            <span>New</span>
          </button>
          <div className="flex flex-col">
            {environments.length === 0 && (
              <div className="text-11 text-subtext italic px-2 py-2">
                No environments yet.
              </div>
            )}
            {environments.map((env) => (
              <button
                key={env.id}
                type="button"
                onClick={() => setSelectedID(env.id)}
                className={cn(
                  "text-left px-2 py-1.5 rounded-sm text-12 transition-colors truncate",
                  env.id === selectedID
                    ? "bg-blue/15 text-blue"
                    : "text-text hover:bg-cardHover",
                )}
              >
                {env.name}
              </button>
            ))}
          </div>
        </aside>

        <div className="flex flex-col min-w-0">
          {!draft && (
            <div className="text-12 text-subtext py-6 text-center">
              Select an environment or create a new one.
            </div>
          )}

          {draft && (
            <>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Environment name"
                className="h-[32px] px-2 mb-3 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-blue focus:ring-2 focus:ring-blue"
              />

              <div className="flex-1 border border-border rounded-md overflow-hidden bg-surface">
                <KeyValueEditor
                  rows={draft.rows}
                  onAdd={() =>
                    setDraft({
                      ...draft,
                      rows: [
                        ...draft.rows,
                        { id: uid("ev"), key: "", value: "", enabled: true },
                      ],
                    })
                  }
                  onUpdate={(id, patch) =>
                    setDraft({
                      ...draft,
                      rows: draft.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
                    })
                  }
                  onRemove={(id) => {
                    const next = draft.rows.filter((r) => r.id !== id);
                    setDraft({
                      ...draft,
                      rows: next.length
                        ? next
                        : [{ id: uid("ev"), key: "", value: "", enabled: true }],
                    });
                  }}
                  keyPlaceholder="VAR_NAME"
                  valuePlaceholder="value"
                />
              </div>

              <div className="flex items-center justify-between mt-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="flex items-center gap-2 h-[28px] px-2 text-12 text-danger hover:bg-danger/10 rounded-sm transition-colors"
                >
                  <Trash2 size={12} />
                  <span>Delete</span>
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="h-[32px] px-3 text-12 text-subtext hover:text-text rounded-md transition-colors"
                  >
                    Close
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
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
