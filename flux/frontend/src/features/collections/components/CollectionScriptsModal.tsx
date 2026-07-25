import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { Modal } from "@/shared/components/Modal";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";
import { useThemeStore } from "@/shared/lib/useTheme";
import { fluxCmTheme } from "@/shared/lib/cmTheme";
import { toast } from "@/app/stores/useToastStore";
import type { models } from "../../../../wailsjs/go/models";

interface Props {
  open: boolean;
  collectionID: string | null;
  onClose: () => void;
}

export function CollectionScriptsModal({ open, collectionID, onClose }: Props) {
  const collections = useCollectionStore((s) => s.collections);
  const updateScripts = useCollectionStore((s) => s.updateCollectionScripts);
  const theme = useThemeStore((s) => s.resolved);

  const [preScript, setPreScript] = useState("");
  const [postScript, setPostScript] = useState("");
  const [busy, setBusy] = useState(false);

  const collection: models.Collection | undefined = collectionID
    ? collections.find((c) => c.id === collectionID)
    : undefined;

  useEffect(() => {
    if (open && collection) {
      setPreScript(collection.preScript ?? "");
      setPostScript(collection.postScript ?? "");
    }
  }, [open, collection]);

  const handleSave = async () => {
    if (!collectionID) return;
    setBusy(true);
    try {
      await updateScripts(collectionID, preScript, postScript);
      toast.success("Collection scripts saved");
      onClose();
    } catch (err) {
      toast.error(`Failed to save scripts: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Collection scripts${collection ? ` — ${collection.name}` : ""}`}>
      <div className="flex flex-col gap-4 w-[520px] max-w-full">
        <div className="flex flex-col gap-1">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Pre-request Script</label>
          <p className="text-10 text-tertiary">
            Runs before every request in the collection. Access <code className="text-cyan">pm.*</code>, <code className="text-cyan">req.*</code> APIs.
          </p>
          <div className="border border-border rounded-md overflow-hidden">
            <CodeMirror
              value={preScript}
              onChange={(v) => setPreScript(v)}
              theme={theme}
              extensions={[javascript(), fluxCmTheme]}
              height="120px"
              basicSetup={{ lineNumbers: true, foldGutter: true }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Post-response Script</label>
          <p className="text-10 text-tertiary">
            Runs after every response. Use <code className="text-cyan">pm.response</code>, <code className="text-cyan">pm.variables</code>, and assertion helpers.
          </p>
          <div className="border border-border rounded-md overflow-hidden">
            <CodeMirror
              value={postScript}
              onChange={(v) => setPostScript(v)}
              theme={theme}
              extensions={[javascript(), fluxCmTheme]}
              height="120px"
              basicSetup={{ lineNumbers: true, foldGutter: true }}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-[32px] px-3 text-12 text-subtext hover:text-text rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="h-[32px] px-4 bg-cyan hover:bg-cyan-hover text-white text-12 font-bold rounded-md disabled:opacity-60 transition-all"
          >
            {busy ? "Saving…" : "Save Scripts"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
