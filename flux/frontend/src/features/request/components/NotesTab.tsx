import { useRequestStore } from "@/features/request/stores/useRequestStore";

export function NotesTab() {
  const notes = useRequestStore((s) => s.notes);
  const setNotes = useRequestStore((s) => s.setNotes);

  return (
    <div className="p-4 h-full flex flex-col">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes about this request — purpose, expected behavior, edge cases, links to docs…"
        spellCheck={false}
        className="flex-1 resize-none bg-surface border border-border rounded-md p-3 text-12 text-text font-mono outline-none focus:border-cyan placeholder:text-subtext/40"
      />
    </div>
  );
}
