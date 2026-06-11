import { useState } from "react";
import { FileText, Plus, Text, Trash2, Upload } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { KeyValue } from "@/features/request/types/request";
import { PickFile } from "../../../wailsjs/go/main/App";

type Props = {
  rows: KeyValue[];
  onUpdate: (id: string, patch: Partial<KeyValue>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  keySuggestions?: string[];
  showTypeToggle?: boolean;
  bulkEdit?: boolean;
};

export function KeyValueEditor({
  rows,
  onUpdate,
  onRemove,
  onAdd,
  keyPlaceholder = "key",
  valuePlaceholder = "value",
  keySuggestions,
  showTypeToggle = false,
  bulkEdit: bulkProp,
}: Props) {
  const listId = keySuggestions ? `kv-suggestions-${keySuggestions.length}` : undefined;
  const [bulkText, setBulkText] = useState("");
  const [bulkOpen, setBulkOpen] = useState(bulkProp ?? false);

  const handleBulkApply = () => {
    const lines = bulkText.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      const sep = line.includes(":") ? ":" : "\t";
      const idx = line.indexOf(sep);
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        onAdd();
        if (rows.length > 0) {
          const last = rows[rows.length - 1];
          onUpdate(last.id, { key, value, enabled: true });
        }
      }
    }
    setBulkText("");
    setBulkOpen(false);
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-1 border-b border-border">
        <span className="text-11 text-subtext font-semibold uppercase tracking-wider" />
        <button
          type="button"
          onClick={() => setBulkOpen(!bulkOpen)}
          className="text-11 text-subtext hover:text-cyan transition-colors"
        >
          {bulkOpen ? "Table View" : "Bulk Edit"}
        </button>
      </div>

      {bulkOpen ? (
        <div className="p-3">
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`key: value\nkey2: value2`}
            spellCheck={false}
            className="w-full h-[200px] bg-surface border border-border rounded text-12 font-mono text-text p-2 outline-none focus:border-cyan resize-none placeholder:text-tertiary"
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleBulkApply}
              disabled={!bulkText.trim()}
              className="h-[28px] px-3 bg-cyan text-white text-12 font-medium rounded hover:bg-cyan-hover disabled:opacity-50 transition-colors"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => { setBulkText(""); setBulkOpen(false); }}
              className="h-[28px] px-3 text-12 text-subtext hover:text-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[24px_1fr_1fr_60px_24px] gap-2 px-3 py-2 text-11 text-subtext font-semibold uppercase tracking-wider border-b border-border">
            <span />
            <span>Key</span>
            <span>Value</span>
            {showTypeToggle && <span className="text-center">Type</span>}
            <span />
          </div>

          {rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[24px_1fr_1fr_60px_24px] gap-2 px-3 py-2 items-center border-b border-border/50 hover:bg-card/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(e) => onUpdate(row.id, { enabled: e.target.checked })}
                className="accent-blue w-[14px] h-[14px] cursor-pointer"
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
              {showTypeToggle && row.valueType === "file" ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const path = await PickFile("Select file", "");
                      if (path) onUpdate(row.id, { value: path });
                    } catch {}
                  }}
                  className={cn(
                    "flex items-center gap-1 text-11 font-mono border border-border rounded px-2 h-[24px] transition-colors",
                    row.value
                      ? "text-text bg-cardHover border-cyan/50"
                      : "text-subtext hover:text-text hover:bg-cardHover",
                  )}
                >
                  <Upload size={10} />
                  <span className="truncate max-w-[120px]">{row.value ? row.value.split("\\").pop()?.split("/").pop() || "file" : "Pick File"}</span>
                </button>
              ) : (
                <input
                  type="text"
                  value={row.value}
                  placeholder={showTypeToggle && row.valueType === "file" ? "Pick a file…" : valuePlaceholder}
                  onChange={(e) => onUpdate(row.id, { value: e.target.value })}
                  className={cn(
                    "bg-transparent text-11 font-mono placeholder:text-subtext text-text outline-none",
                    !row.enabled && "opacity-50",
                  )}
                />
              )}
              {showTypeToggle && (
                <button
                  type="button"
                  onClick={() => onUpdate(row.id, { valueType: row.valueType === "file" ? "text" : "file", value: "" })}
                  className={cn(
                    "flex items-center justify-center gap-1 text-11 transition-colors rounded-sm px-1",
                    row.valueType === "file"
                      ? "text-cyan bg-cyan/10"
                      : "text-subtext hover:text-text",
                  )}
                  title={row.valueType === "file" ? "Text mode" : "File upload mode"}
                >
                  {row.valueType === "file" ? <FileText size={10} /> : <Text size={10} />}
                </button>
              )}
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
            className="flex items-center gap-2 px-3 py-2 text-12 text-subtext hover:text-cyan transition-colors w-fit"
          >
            <Plus size={12} />
            <span>Add row</span>
          </button>
        </>
      )}
    </div>
  );
}
