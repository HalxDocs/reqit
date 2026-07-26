import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, FileCode2 } from "lucide-react";
import { useUIStore } from "@/app/stores/useUIStore";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";
import { ExportOpenAPI } from "../../../../wailsjs/go/main/App";
import { MethodBadge } from "@/shared/components/MethodBadge";
import { toast } from "@/app/stores/useToastStore";

interface OpenAPISpec {
  openapi?: string;
  info?: { title?: string; version?: string; description?: string };
  paths?: Record<string, Record<string, any>>;
  tags?: { name: string; description?: string }[];
}

interface Endpoint {
  path: string;
  method: string;
  summary?: string;
  operationId?: string;
  parameters?: any[];
  requestBody?: any;
  responses?: Record<string, any>;
  tags?: string[];
}

export function OpenAPIRenderer() {
  const close = useUIStore((s) => s.closeOpenAPI);
  const openapiCollID = useUIStore((s) => s.openapiCollID);
  const collections = useCollectionStore((s) => s.collections);
  const collection = openapiCollID ? collections.find((c) => c.id === openapiCollID) : null;

  const [spec, setSpec] = useState<OpenAPISpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!openapiCollID) { setLoading(false); return; }
    setLoading(true);
    ExportOpenAPI(openapiCollID)
      .then((raw: string) => {
        try {
          const parsed = JSON.parse(raw);
          setSpec(parsed);
          // Expand all tags by default so the full API is visible
          if (parsed?.paths) {
            const tags = new Set<string>();
            for (const [, methods] of Object.entries(parsed.paths)) {
              if (!methods) continue;
              for (const method of ["get", "post", "put", "patch", "delete", "options", "head"]) {
                const ep = (methods as Record<string, any>)[method];
                if (ep) {
                  const tag = (ep.tags?.[0]) ?? "default";
                  tags.add(tag);
                }
              }
            }
            setExpandedPaths(new Set(tags));
          }
        } catch { toast.error("Failed to parse OpenAPI spec"); }
      })
      .catch((e: any) => toast.error(String(e)))
      .finally(() => setLoading(false));
  }, [openapiCollID]);

  const endpoints: Endpoint[] = useMemo(() => {
    if (!spec?.paths) return [];
    const eps: Endpoint[] = [];
    for (const [path, methods] of Object.entries(spec.paths)) {
      if (!methods) continue;
      // Include path-level parameters
      const pathParams = methods.parameters ?? [];
      for (const method of ["get", "post", "put", "patch", "delete", "options", "head"]) {
        const ep = (methods as Record<string, any>)[method];
        if (ep) {
          const mergedParams = [...(pathParams), ...(ep.parameters ?? [])];
          eps.push({ path, method: method.toUpperCase(), ...ep, parameters: mergedParams });
        }
      }
    }
    return eps;
  }, [spec]);

  const filtered = useMemo(() => {
    if (!search) return endpoints;
    const q = search.toLowerCase();
    return endpoints.filter(
      (ep) => ep.path.toLowerCase().includes(q) || (ep.summary ?? "").toLowerCase().includes(q),
    );
  }, [endpoints, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Endpoint[]>();
    for (const ep of filtered) {
      const tag = (ep.tags?.[0]) ?? "default";
      if (!map.has(tag)) map.set(tag, []);
      map.get(tag)!.push(ep);
    }
    return map;
  }, [filtered]);

  const togglePath = (key: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col bg-bg min-h-0">
      <header className="flex items-center gap-3 px-4 h-[48px] border-b border-border shrink-0">
        <button
          type="button"
          onClick={close}
          className="flex items-center gap-1 text-12 text-subtext hover:text-text transition-colors"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <FileCode2 size={14} className="text-cyan" />
        <span className="text-13 font-semibold text-text">
          {spec?.info?.title ?? collection?.name ?? "OpenAPI Spec"}
        </span>
        {spec?.info?.version && (
          <span className="text-11 text-subtext font-mono">v{spec.info.version}</span>
        )}
        <div className="flex-1" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search endpoints…"
          spellCheck={false}
          className="h-[28px] w-[200px] px-2 bg-surface border border-border rounded text-11 text-text outline-none placeholder:text-tertiary focus:border-cyan"
        />
        <span className="text-11 text-subtext">{endpoints.length} endpoints</span>
      </header>

      {loading && (
        <div className="flex-1 flex items-center justify-center text-12 text-subtext">
          <div className="w-5 h-5 rounded-full border-2 border-cyan border-t-transparent animate-spin mr-2" />
          Loading spec…
        </div>
      )}

      {!loading && !spec && (
        <div className="flex-1 flex items-center justify-center text-12 text-subtext">
          No spec loaded. Select a collection with a linked OpenAPI spec.
        </div>
      )}

      {!loading && spec && (
        <div className="flex-1 overflow-y-auto min-h-0">
          {spec.info?.description && (
            <div className="px-4 py-3 text-12 text-subtext border-b border-border whitespace-pre-wrap">
              {spec.info.description}
            </div>
          )}
          {grouped.size === 0 && (
            <div className="px-4 py-8 text-12 text-subtext text-center">
              {search ? "No endpoints match your search." : "No endpoints found in this spec."}
            </div>
          )}
          {Array.from(grouped.entries()).map(([tag, eps]) => (
            <div key={tag} className="border-b border-border">
              <div
                className="px-4 py-2 text-11 font-semibold uppercase tracking-wider text-subtext bg-surface/50 cursor-pointer hover:bg-cardHover transition-colors flex items-center gap-2"
                onClick={() => togglePath(tag)}
              >
                {expandedPaths.has(tag) ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                {tag}
                <span className="text-10 text-tertiary font-normal normal-case ml-1">({eps.length})</span>
              </div>
              {expandedPaths.has(tag) && eps.map((ep, i) => (
                <div key={`${ep.method}-${ep.path}-${i}`} className="px-4 py-2 hover:bg-cardHover transition-colors border-t border-border/50">
                  <div className="flex items-center gap-3">
                    <MethodBadge method={ep.method as any} />
                    <code className="text-12 text-text font-mono">{ep.path}</code>
                    {ep.summary && (
                      <span className="text-11 text-subtext truncate">{ep.summary}</span>
                    )}
                    {ep.operationId && (
                      <span className="text-10 text-tertiary font-mono ml-auto">{ep.operationId}</span>
                    )}
                  </div>
                  {(ep.parameters?.length ?? 0) > 0 && (
                    <div className="ml-12 mt-1 flex flex-wrap gap-1">
                      {ep.parameters?.map((p, j) => (
                        <span
                          key={j}
                          className="text-10 px-1.5 py-0.5 rounded-sm bg-card border border-border text-tertiary font-mono"
                        >
                          {p.in === "path" ? ":" : ""}{p.name}{p.required ? "*" : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
