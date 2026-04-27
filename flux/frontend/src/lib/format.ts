export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatTiming(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function tryPrettyJSON(body: string): { pretty: string; ok: boolean } {
  const trimmed = body.trim();
  if (!trimmed) return { pretty: body, ok: false };
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return { pretty: body, ok: false };
  }
  try {
    return { pretty: JSON.stringify(JSON.parse(trimmed), null, 2), ok: true };
  } catch {
    return { pretty: body, ok: false };
  }
}

export function statusColor(code: number): string {
  if (code === 0) return "text-subtext";
  if (code >= 500) return "text-danger";
  if (code >= 400) return "text-warn";
  if (code >= 300) return "text-violet";
  if (code >= 200) return "text-teal";
  return "text-subtext";
}
