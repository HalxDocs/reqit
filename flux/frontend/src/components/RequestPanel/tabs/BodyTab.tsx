import { useRequestStore } from "../../../stores/useRequestStore";
import { cn } from "../../../lib/cn";
import { KeyValueEditor } from "../../shared/KeyValueEditor";
import type { BodyType } from "../../../types/request";

const MODES: { id: BodyType; label: string }[] = [
  { id: "none", label: "None" },
  { id: "json", label: "Raw JSON" },
  { id: "form", label: "form-data" },
  { id: "urlencoded", label: "x-www-form-urlencoded" },
];

export function BodyTab() {
  const bodyType = useRequestStore((s) => s.bodyType);
  const setBodyType = useRequestStore((s) => s.setBodyType);
  const bodyRaw = useRequestStore((s) => s.bodyRaw);
  const setBodyRaw = useRequestStore((s) => s.setBodyRaw);
  const bodyForm = useRequestStore((s) => s.bodyForm);
  const addBodyForm = useRequestStore((s) => s.addBodyForm);
  const updateBodyForm = useRequestStore((s) => s.updateBodyForm);
  const removeBodyForm = useRequestStore((s) => s.removeBodyForm);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border flex-wrap">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setBodyType(m.id)}
            className={cn(
              "px-3 h-[28px] rounded-sm text-12 font-medium transition-colors",
              bodyType === m.id
                ? "bg-violet text-white"
                : "bg-card text-subtext hover:text-text hover:bg-cardHover",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {bodyType === "none" && (
        <div className="px-4 py-6 text-12 text-subtext">
          No body will be sent with this request.
        </div>
      )}

      {bodyType === "json" && (
        <textarea
          value={bodyRaw}
          onChange={(e) => setBodyRaw(e.target.value)}
          spellCheck={false}
          placeholder='{\n  "key": "value"\n}'
          className="bg-bg font-mono text-12 text-teal placeholder:text-subtext p-3 outline-none resize-none min-h-[240px] border-b border-border"
        />
      )}

      {(bodyType === "form" || bodyType === "urlencoded") && (
        <KeyValueEditor
          rows={bodyForm}
          onAdd={addBodyForm}
          onUpdate={updateBodyForm}
          onRemove={removeBodyForm}
        />
      )}
    </div>
  );
}
