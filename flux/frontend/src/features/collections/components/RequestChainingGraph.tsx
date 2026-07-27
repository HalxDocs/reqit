import { useMemo, useState } from "react";
import { GitBranch, X } from "lucide-react";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";

interface Props {
  collectionID: string;
}

export function RequestChainingGraph({ collectionID }: Props) {
  const collections = useCollectionStore((s) => s.collections);
  const [open, setOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<string | null>(null);

  const collection = collections.find((c) => c.id === collectionID);
  const requests = collection?.requests ?? [];

  // Build graph: for each request, find which variables it outputs and which requests consume them
  const graph = useMemo(() => {
    const nodes: { id: string; name: string }[] = requests.map((r) => ({ id: r.id, name: r.name }));
    const edges: { from: string; to: string; variable: string }[] = [];

    const outputs: Record<string, { reqID: string; vars: string[] }> = {};
    for (const r of requests) {
      const vars: string[] = [];
      if (r.extractRules) {
        for (const rule of r.extractRules) {
          if (rule.target) vars.push(rule.target);
        }
      }
      if (r.preSetVars) {
        for (const v of r.preSetVars) {
          if (v.key) vars.push(v.key);
        }
      }
      outputs[r.id] = { reqID: r.id, vars };
    }

    for (const r of requests) {
      const bodyVars = (r.payload?.body ?? "").match(/\{\{\s*([\w.-]+)\s*\}\}/g)?.map((m) => m.replace(/\{\{\s*|\s*\}\}/g, "")) ?? [];
      const urlVars = (r.payload?.url ?? "").match(/\{\{\s*([\w.-]+)\s*\}\}/g)?.map((m) => m.replace(/\{\{\s*|\s*\}\}/g, "")) ?? [];
      const consumed = [...new Set([...bodyVars, ...urlVars])];

      for (const [outReqID, out] of Object.entries(outputs)) {
        if (outReqID === r.id) continue;
        for (const v of out.vars) {
          if (consumed.includes(v)) {
            edges.push({ from: outReqID, to: r.id, variable: v });
          }
        }
      }
    }

    return { nodes, edges };
  }, [requests]);

  if (requests.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-11 text-subtext hover:text-text transition-colors"
        title="Request chaining graph"
      >
        <GitBranch size={11} /> Chaining
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl p-3 min-w-[320px] max-w-[480px] max-h-[400px] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-11 font-semibold text-text">Variable Flow</span>
              <span className="text-10 text-subtext">{graph.nodes.length} requests · {graph.edges.length} connections</span>
            </div>

            {graph.edges.length === 0 ? (
              <div className="text-11 text-subtext text-center py-4">No variable references between requests found.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {graph.nodes.map((node) => {
                  const outgoing = graph.edges.filter((e) => e.from === node.id);
                  const incoming = graph.edges.filter((e) => e.to === node.id);
                  return (
                    <div key={node.id} className="border border-border rounded-lg p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-12 font-medium text-text truncate">{node.name}</span>
                        <span className="text-10 text-subtext">{incoming.length > 0 ? `${incoming.length} in` : ""}{incoming.length > 0 && outgoing.length > 0 ? " · " : ""}{outgoing.length > 0 ? `${outgoing.length} out` : ""}</span>
                      </div>
                      {incoming.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {incoming.map((e, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-teal/10 text-teal text-10 rounded">
                              ← {e.variable}
                            </span>
                          ))}
                        </div>
                      )}
                      {outgoing.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {outgoing.map((e, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-cyan/10 text-cyan text-10 rounded">
                              → {e.variable}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
