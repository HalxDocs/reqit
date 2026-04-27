import { Plus, Trash2 } from "lucide-react";
import { cn } from "../../lib/cn";
import type { KeyValue } from "../../types/request";

type Props = {
  rows: KeyValue[];
  onUpdate: (id: string, patch: Partial<KeyValue>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  keySuggestions?: string[];
};

export function KeyValueEditor({
  rows,
  onUpdate,
  onRemove,
  onAdd,
  keyPlaceholder = "key",
  valuePlaceholder = "value",
  keySuggestions,
}: Props) {
  const listId = keySuggestions ? `kv-suggestions-${keySuggestions.length}` : undefined;

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-[24px_1fr_1fr_24px] gap-2 px-3 py-2 text-11 text-subtext font-semibold uppercase tracking-wider border-b border-border">
        <span />
        <span>Key</span>
        <span>Value</span>
        <span />
      </div>

      {rows.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-[24px_1fr_1fr_24px] gap-2 px-3 py-2 items-center border-b border-border/50 hover:bg-card/50 transition-colors"
        >
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => onUpdate(row.id, { enabled: e.target.checked })}
            className="accent-violet w-[14px] h-[14px] cursor-pointer"
            aria-label="Enable row"
          />
          <input
            type="text"
            value={row.key}
            placeholder={keyPlaceholder}
            list={listId}
            onChange={(e) => onUpdate(row.id, { key: e.target.value })}
            className={cn(
              "bg-transparent text-11 font-mono placeholder:text-subtext text-text outline-none",
              !row.enabled && "opacity-50",
            )}
          />
          <input
            type="text"
            value={row.value}
            placeholder={valuePlaceholder}
            onChange={(e) => onUpdate(row.id, { value: e.target.value })}
            className={cn(
              "bg-transparent text-11 font-mono placeholder:text-subtext text-text outline-none",
              !row.enabled && "opacity-50",
            )}
          />
          <button
            type="button"
            onClick={() => onRemove(row.id)}
            className="text-subtext hover:text-danger transition-colors p-1 rounded-sm"
            aria-label="Remove row"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      {keySuggestions && (
        <datalist id={listId}>
          {keySuggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}

      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-2 px-3 py-2 text-12 text-subtext hover:text-violet transition-colors w-fit"
      >
        <Plus size={12} />
        <span>Add row</span>
      </button>
    </div>
  );
}
