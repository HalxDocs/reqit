// Visualizer registry — a render mode inside the response pane, not a new panel.
// A post-response script can call visualizer.set(template, data) — here we
// expose a tiny Handlebars-like engine that the VisualizerView uses. Plugins
// that declare `Visualizer` in their manifest are also registered.

type VisualizerFn = (responseBody: string, headers: Record<string, string>) => string;

const registry = new Map<string, VisualizerFn>();

export function registerVisualizer(id: string, fn: VisualizerFn) {
  registry.set(id, fn);
}

export function getVisualizer(id: string): VisualizerFn | undefined {
  return registry.get(id);
}

export function listVisualizers(): string[] {
  return Array.from(registry.keys());
}

// Built-in example: render JSON array of {lat, lng} as a simple table.
// Users can replace this via postScript: visualizer.set(`<table>...</table>`, data)
registerVisualizer("table", (body) => {
  try {
    const data = JSON.parse(body);
    const arr = Array.isArray(data) ? data : data.items || data.data || [data];
    if (!Array.isArray(arr) || arr.length === 0) return `<pre>${escapeHtml(body.slice(0, 2000))}</pre>`;
    const keys = Object.keys(arr[0] || {});
    const head = keys.map((k) => `<th class="px-2 py-1 text-left text-xs text-subtext">${escapeHtml(k)}</th>`).join("");
    const rows = arr.slice(0, 50).map((row: any) => `<tr>${keys.map((k) => `<td class="px-2 py-1 text-xs border-t border-border">${escapeHtml(String(row[k] ?? ""))}</td>`).join("")}</tr>`).join("");
    return `<table class="w-full text-xs"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  } catch {
    return `<pre>${escapeHtml(body.slice(0, 2000))}</pre>`;
  }
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Expose a global for post-response scripts that run in the frontend's JS
// context (ScriptsPanel snippets). Go's scripting engine also exposes a
// `visualizer` object that writes to the same store via Wails bindings —
// this registry is the single source of truth for the view layer.
declare global {
  interface Window {
    visualizer?: { set: (template: string, data?: any) => void };
  }
}

let pendingTemplate: string | null = null;
let pendingData: any = null;

export function setPendingVisualizer(template: string, data?: any) {
  pendingTemplate = template;
  pendingData = data;
}

export function consumePendingVisualizer(): { template: string; data: any } | null {
  if (pendingTemplate == null) return null;
  const out = { template: pendingTemplate, data: pendingData };
  pendingTemplate = null;
  pendingData = null;
  return out;
}

// Simple template render: replace {{field}} with data[field] or {{json}} with raw body
export function renderTemplate(template: string, data: any, rawBody: string): string {
  if (!template) return rawBody;
  let html = template;
  // {{json}} placeholder for raw body
  html = html.replace(/\{\{\s*json\s*\}\}/g, escapeHtml(rawBody));
  if (data && typeof data === "object") {
    for (const [k, v] of Object.entries(data)) {
      html = html.replace(new RegExp(`\\{\\{\\s*${escapeRegExp(k)}\\s*\\}\\}`, "g"), escapeHtml(String(v)));
    }
  }
  return html;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Wire window.visualizer for frontend post-scripts
if (typeof window !== "undefined") {
  window.visualizer = {
    set: (template: string, data?: any) => setPendingVisualizer(template, data),
  };
}
