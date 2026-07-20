import { useCallback, useState } from "react";
import { Check, Save } from "lucide-react";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { useTabsStore } from "@/features/tabs/stores/useTabsStore";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";
import { buildPayloadLiteral } from "@/features/request/lib/buildPayload";
import { toast } from "@/app/stores/useToastStore";

export function NotesTab() {
  const notes = useRequestStore((s) => s.notes);
  const setNotes = useRequestStore((s) => s.setNotes);
  const savedRequestID = useTabsStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeID);
    return tab?.savedRequestID ?? null;
  });
  const updateRequest = useCollectionStore((s) => s.updateRequest);

  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    if (!savedRequestID) {
      toast.info("Save the request to a collection first");
      return;
    }
    const s = useRequestStore.getState();
    const payload = buildPayloadLiteral(s);
    try {
      const colls = useCollectionStore.getState().collections;
      for (const c of colls) {
        const req = c.requests.find((r) => r.id === savedRequestID);
        if (req) {
          await updateRequest(savedRequestID, req.name, payload);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
          return;
        }
      }
    } catch {
      toast.error("Failed to save notes");
    }
  }, [savedRequestID, updateRequest]);

  return (
    <div className="p-4 h-full flex flex-col">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes about this request — purpose, expected behavior, edge cases, links to docs…"
        spellCheck={false}
        className="flex-1 resize-none bg-surface border border-border rounded-md p-3 text-12 text-text font-mono outline-none focus:border-cyan placeholder:text-subtext/40"
      />
      <div className="flex justify-end mt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saved}
          className="h-[28px] px-3 flex items-center gap-1.5 text-11 font-semibold rounded-md transition-all bg-surface border border-border hover:border-cyan hover:text-cyan disabled:opacity-60"
        >
          {saved ? (
            <>
              <Check className="w-3 h-3 text-green" />
              Saved
            </>
          ) : (
            <>
              <Save className="w-3 h-3" />
              Save notes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
