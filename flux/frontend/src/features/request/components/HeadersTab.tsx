import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { KeyValueEditor } from "@/shared/components/KeyValueEditor";
import { HeaderPresetButtons } from "@/features/presets/components/PresetManager";

const COMMON_HEADERS = [
  "Accept",
  "Accept-Encoding",
  "Accept-Language",
  "Authorization",
  "Cache-Control",
  "Content-Type",
  "Cookie",
  "Origin",
  "Referer",
  "User-Agent",
  "X-Api-Key",
  "X-Requested-With",
];

export function HeadersTab() {
  const headers = useRequestStore((s) => s.headers);
  const addHeader = useRequestStore((s) => s.addHeader);
  const updateHeader = useRequestStore((s) => s.updateHeader);
  const removeHeader = useRequestStore((s) => s.removeHeader);

  return (
    <div>
      <div className="flex items-center justify-end mb-2 px-2">
        <HeaderPresetButtons />
      </div>
      <KeyValueEditor
        rows={headers}
        onAdd={addHeader}
        onUpdate={updateHeader}
        onRemove={removeHeader}
        keyPlaceholder="header"
        valuePlaceholder="value"
        keySuggestions={COMMON_HEADERS}
      />
    </div>
  );
}
