import { useMemo, useState } from "react";
import { Book, ChevronDown, ChevronRight, Copy, Search } from "lucide-react";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";
import { MethodBadge } from "@/shared/components/MethodBadge";
import { Button } from "@/shared/components/Button";
import { toast } from "@/app/stores/useToastStore";
import { cn } from "@/shared/lib/cn";

interface SavedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  capturedAt: string;
}

interface RequestPayload {
  method: string;
  url: string;
  headers: { key: string; value: string; enabled: boolean }[];
  params: { key: string; value: string; enabled: boolean }[];
  bodyType: string;
  body: string;
  authType: string;
  authValue: string;
}

interface SavedRequest {
  id: string;
  name: string;
  collectionId: string;
  payload: RequestPayload;
  createdAt: string;
  savedResponse?: SavedResponse;
}

interface Collection {
  id: string;
  name: string;
  spec?: string;
  requests: SavedRequest[];
}

function stringifyMap(m: Record<string, string> | undefined): string {
  if (!m) return "";
  return Object.entries(m).map(([k, v]) => `${k}: ${v}`).join("\n");
}

function ResponseBlock({ resp }: { resp: SavedResponse }) {
  return (
    <div className="mt-3 bg-bg rounded-md border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-surface">
        <span className="text-11 font-semibold">Example Response</span>
        <span className={cn(
          "ml-auto text-11 font-mono px-1.5 py-0.5 rounded-sm",
          resp.statusCode < 300 ? "bg-teal/10 text-teal" : "bg-danger/10 text-danger",
        )}>
          {resp.statusCode}
        </span>
      </div>
      {resp.headers && Object.keys(resp.headers).length > 0 && (
        <pre className="px-3 py-2 text-11 text-subtext font-mono border-b border-border">{stringifyMap(resp.headers)}</pre>
      )}
      {resp.body && (
        <pre className="px-3 py-2 text-12 text-text font-mono overflow-x-auto max-h-[300px]">{resp.body}</pre>
      )}
    </div>
  );
}

function RequestCard({ req }: { req: SavedRequest }) {
  const [expanded, setExpanded] = useState(false);
  const p = req.payload;

  const snippet = useMemo(() => {
    const parts: string[] = [];
    if (p.params?.length) {
      parts.push("Query Params:");
      for (const kv of p.params) {
        if (kv.enabled !== false && kv.key) parts.push(`  ${kv.key}: ${kv.value}`);
      }
    }
    if (p.headers?.length) {
      parts.push("Headers:");
      for (const h of p.headers) {
        if (h.enabled !== false && h.key) parts.push(`  ${h.key}: ${h.value}`);
      }
    }
    if (p.bodyType === "json" && p.body) {
      parts.push("Body:");
      parts.push(p.body);
    }
    return parts.join("\n");
  }, [p]);

  return (
    <div className="rounded-md border border-border bg-surface overflow-hidden">
      <button type="button" onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-cardHover transition-colors text-left">
        {expanded ? <ChevronDown size={12} className="shrink-0 text-subtext" /> : <ChevronRight size={12} className="shrink-0 text-subtext" />}
        <MethodBadge method={p.method as any} />
        <span className="text-12 text-text font-medium truncate">{req.name}</span>
        <code className="ml-auto text-11 text-subtext font-mono truncate max-w-[50%]">{p.url}</code>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-11 text-subtext font-mono">{p.method.toUpperCase()}</span>
            <code className="text-11 text-cyan font-mono">{p.url}</code>
            <Button variant="ghost" onClick={() => { navigator.clipboard.writeText(p.url); toast.success("URL copied"); }}>
              <Copy size={11} />
            </Button>
          </div>

          {p.authType !== "none" && p.authType && (
            <div className="mb-2">
              <span className="text-10 text-subtext uppercase font-semibold">Auth: {p.authType}</span>
            </div>
          )}

          {snippet && (
            <pre className="bg-bg border border-border rounded px-3 py-2 text-12 text-text font-mono overflow-x-auto whitespace-pre-wrap">
              {snippet}
            </pre>
          )}

          {req.savedResponse && <ResponseBlock resp={req.savedResponse} />}
        </div>
      )}
    </div>
  );
}

export function DocsPanel() {
  const collections = useCollectionStore((s) => s.collections);
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    if (!search.trim()) return collections;
    const q = search.toLowerCase();
    return collections
      .map((c) => ({
        ...c,
        requests: c.requests.filter(
          (r) => r.name.toLowerCase().includes(q) || r.payload.url.toLowerCase().includes(q),
        ),
      }))
      .filter((c) => c.requests.length > 0);
  }, [collections, search]);

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      <div className="flex items-center gap-2 px-3 h-[36px] border-b border-border shrink-0 bg-surface">
        <Book size={13} className="text-cyan" />
        <span className="text-12 font-semibold text-text">API Reference</span>
      </div>

      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-subtext pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter endpoints…"
            spellCheck={false}
            className="w-full h-[28px] pl-7 pr-2 bg-bg border border-border rounded-md text-12 text-text outline-none focus:border-cyan"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-3 flex flex-col gap-4">
          {visible.length === 0 && (
            <p className="text-12 text-subtext text-center py-8">
              {search ? "No matching endpoints." : "No collections yet."}
            </p>
          )}
          {visible.map((c) => (
            <div key={c.id}>
              <h3 className="text-13 font-semibold text-text mb-2">{c.name}</h3>
              <div className="flex flex-col gap-1.5">
                {c.requests.map((req) => (
                  <RequestCard key={req.id} req={req} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
