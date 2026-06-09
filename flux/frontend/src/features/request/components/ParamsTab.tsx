import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { KeyValueEditor } from "@/shared/components/KeyValueEditor";

export function ParamsTab() {
  const params = useRequestStore((s) => s.params);
  const addParam = useRequestStore((s) => s.addParam);
  const updateParam = useRequestStore((s) => s.updateParam);
  const removeParam = useRequestStore((s) => s.removeParam);

  return (
    <div>
      <KeyValueEditor
        rows={params}
        onAdd={addParam}
        onUpdate={updateParam}
        onRemove={removeParam}
        keyPlaceholder="param"
        valuePlaceholder="value"
      />
    </div>
  );
}
