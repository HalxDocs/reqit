export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatTiming(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export type BodyKind = "json" | "xml" | "html" | "text";

export function detectBodyKind(body: string, contentType: string): BodyKind {
  const ct = contentType.toLowerCase();
  if (ct.includes("json")) return "json";
  if (ct.includes("xml")) return "xml";
  if (ct.includes("html")) return "html";
  // Sniff body if header is missing/wrong.
  const t = body.trim();
  if (!t) return "text";
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  if (t.startsWith("<?xml")) return "xml";
  if (t.startsWith("<!DOCTYPE") || t.startsWith("<html")) return "html";
  if (t.startsWith("<")) return "xml";
  return "text";
}

function prettyJSON(body: string): { pretty: string; ok: boolean } {
  const t = body.trim();
  if (!t) return { pretty: body, ok: false };
  try {
    return { pretty: JSON.stringify(JSON.parse(t), null, 2), ok: true };
  } catch {
    return { pretty: body, ok: false };
  }
}

// Lightweight XML/HTML pretty-printer. Doesn't validate — just inserts line
// breaks between sibling tags and indents based on tag depth. Works for the
// well-formed responses you'll see from APIs; ugly markup stays as-is.
function prettyMarkup(body: string): { pretty: string; ok: boolean } {
  const t = body.trim();
  if (!t || !t.startsWith("<")) return { pretty: body, ok: false };

  const withBreaks = t
    .replace(/>\s*</g, ">\n<")
    .replace(/(<\?[^?]+\?>)/g, "$1\n");

  let depth = 0;
  const lines = withBreaks
    .split("\n")
    .map((raw) => {
      const line = raw.trim();
      if (!line) return null;
      if (line.startsWith("<?") || line.startsWith("<!")) {
        return "  ".repeat(depth) + line;
      }
      if (line.startsWith("</")) {
        depth = Math.max(depth - 1, 0);
        return "  ".repeat(depth) + line;
      }
      const out = "  ".repeat(depth) + line;
      // Self-closing or paired-on-same-line stays at current depth.
      if (
        line.startsWith("<") &&
        !line.endsWith("/>") &&
        !/<\/\w+>$/.test(line) &&
        !/^<[^>]+>[^<]*<\/[^>]+>$/.test(line)
      ) {
        depth++;
      }
      return out;
    })
    .filter((l): l is string => l !== null);

  return { pretty: lines.join("\n"), ok: true };
}

export function tryPretty(
  body: string,
  contentType: string,
): { pretty: string; ok: boolean; kind: BodyKind } {
  const kind = detectBodyKind(body, contentType);
  if (kind === "json") {
    const r = prettyJSON(body);
    return { ...r, kind };
  }
  if (kind === "xml" || kind === "html") {
    const r = prettyMarkup(body);
    return { ...r, kind };
  }
  return { pretty: body, ok: false, kind };
}

// Kept for the BodyTab editor (request side) where we only care about JSON.
export function tryPrettyJSON(body: string): { pretty: string; ok: boolean } {
  return prettyJSON(body);
}

export function statusColor(code: number): string {
  if (code === 0) return "text-subtext";
  if (code >= 500) return "text-danger";
  if (code >= 400) return "text-warn";
  if (code >= 300) return "text-blue";
  if (code >= 200) return "text-teal";
  return "text-subtext";
}
