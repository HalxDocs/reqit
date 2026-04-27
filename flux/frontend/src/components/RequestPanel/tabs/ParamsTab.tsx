import { useRequestStore } from "../../../stores/useRequestStore";
import { KeyValueEditor } from "../../shared/KeyValueEditor";

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
