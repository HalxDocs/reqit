import { useRequestStore } from "../../../stores/useRequestStore";
import { KeyValueEditor } from "../../shared/KeyValueEditor";

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
