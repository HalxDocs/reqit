import { useMemo, useCallback, useState } from "react";
import { Check, AlertTriangle, RefreshCw, ChevronRight, ChevronDown } from "lucide-react";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { cn } from "@/shared/lib/cn";
import { KeyValueEditor } from "@/shared/components/KeyValueEditor";
import { JsonEditor } from "@/shared/components/JsonEditor";
import { GraphqlEditor } from "@/shared/components/GraphqlEditor";
import { fetchGraphQLSchema } from "@/features/request/lib/introspectGraphQL";
import type { BodyType, GraphQLSchemaType } from "@/features/request/types/request";

const MODES: { id: BodyType; label: string }[] = [
  { id: "none", label: "None" },
  { id: "json", label: "Raw JSON" },
  { id: "graphql", label: "GraphQL" },
  { id: "form", label: "form-data" },
  { id: "urlencoded", label: "x-www-form-urlencoded" },
];

function validateJson(body: string): { ok: boolean; error?: string } {
  const trimmed = body.trim();
  if (!trimmed) return { ok: true };
  try {
    JSON.parse(trimmed);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

export function BodyTab() {
  const bodyType = useRequestStore((s) => s.bodyType);
  const setBodyType = useRequestStore((s) => s.setBodyType);
  const bodyRaw = useRequestStore((s) => s.bodyRaw);
  const setBodyRaw = useRequestStore((s) => s.setBodyRaw);
  const bodyForm = useRequestStore((s) => s.bodyForm);
  const addBodyForm = useRequestStore((s) => s.addBodyForm);
  const updateBodyForm = useRequestStore((s) => s.updateBodyForm);
  const removeBodyForm = useRequestStore((s) => s.removeBodyForm);
  const graphqlQuery = useRequestStore((s) => s.graphqlQuery);
  const setGraphqlQuery = useRequestStore((s) => s.setGraphqlQuery);
  const graphqlVariables = useRequestStore((s) => s.graphqlVariables);
  const setGraphqlVariables = useRequestStore((s) => s.setGraphqlVariables);
  const graphqlSchema = useRequestStore((s) => s.graphqlSchema);
  const setGraphqlSchema = useRequestStore((s) => s.setGraphqlSchema);
  const graphqlSchemaLoading = useRequestStore((s) => s.graphqlSchemaLoading);
  const setGraphqlSchemaLoading = useRequestStore((s) => s.setGraphqlSchemaLoading);
  const graphqlSchemaError = useRequestStore((s) => s.graphqlSchemaError);
  const setGraphqlSchemaError = useRequestStore((s) => s.setGraphqlSchemaError);
  const url = useRequestStore((s) => s.url);
  const headers = useRequestStore((s) => s.headers);
  const authType = useRequestStore((s) => s.authType);
  const authValue = useRequestStore((s) => {
    if (s.authType === "bearer") return s.authToken;
    if (s.authType === "basic") return `${s.authUser}:${s.authPass}`;
    if (s.authType === "apikey") return `${s.authKeyIn}:${s.authKeyName}:${s.authKeyValue}`;
    return "";
  });

  const validity = useMemo(() => validateJson(bodyRaw), [bodyRaw]);

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(bodyRaw);
      setBodyRaw(JSON.stringify(parsed, null, 2));
    } catch {
      // ignore
    }
  };

  const handleFetchSchema = useCallback(async () => {
    if (!url.trim()) {
      setGraphqlSchemaError("Enter a URL before fetching schema");
      return;
    }
    setGraphqlSchemaLoading(true);
    setGraphqlSchemaError("");
    try {
      const schema = await fetchGraphQLSchema(url, headers, authType, authValue);
      setGraphqlSchema(schema);
    } catch (err) {
      setGraphqlSchemaError(err instanceof Error ? err.message : "Failed to fetch schema");
      setGraphqlSchema(null);
    } finally {
      setGraphqlSchemaLoading(false);
    }
  }, [url, headers, authType, authValue, setGraphqlSchema, setGraphqlSchemaLoading, setGraphqlSchemaError]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border flex-wrap">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setBodyType(m.id)}
            className={cn(
              "px-3 h-[28px] rounded-sm text-12 font-medium transition-colors",
              bodyType === m.id
                ? "bg-cyan text-white"
                : "bg-card text-subtext hover:text-text hover:bg-cardHover",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {bodyType === "none" && (
        <div className="px-4 py-6 text-12 text-subtext">
          No body will be sent with this request.
        </div>
      )}

      {bodyType === "json" && (
        <>
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2 text-11">
              {bodyRaw.trim() === "" ? (
                <span className="text-subtext">Empty body</span>
              ) : validity.ok ? (
                <span className="text-teal flex items-center gap-1">
                  <Check size={11} />
                  Valid JSON
                </span>
              ) : (
                <span className="text-warn flex items-center gap-1" title={validity.error}>
                  <AlertTriangle size={11} />
                  Invalid JSON
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleFormat}
              disabled={!validity.ok || !bodyRaw.trim()}
              className="text-11 text-subtext hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Format
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <JsonEditor
              value={bodyRaw}
              onChange={setBodyRaw}
              placeholder='{ "key": "value" }'
            />
          </div>
        </>
      )}

      {bodyType === "graphql" && (
        <div className="flex flex-col h-full">
          <div className="flex-1 min-h-0 flex flex-col sm:flex-row gap-0 sm:gap-0">
            <div className="flex-1 min-h-0 flex flex-col border-b sm:border-b-0 sm:border-r border-border">
              <div className="flex items-center justify-between px-3 py-[6px] text-[10px] font-semibold text-subtext uppercase tracking-wider bg-card/50 border-b border-border">
                <span>Query</span>
                <button
                  type="button"
                  onClick={handleFetchSchema}
                  disabled={graphqlSchemaLoading}
                  className="inline-flex items-center gap-1 text-[10px] font-medium normal-case text-cyan hover:text-cyan-hover transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={11} className={cn(graphqlSchemaLoading && "animate-spin")} />
                  {graphqlSchemaLoading ? "Loading…" : graphqlSchema ? "Re-fetch" : "Fetch Schema"}
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <GraphqlEditor
                  value={graphqlQuery}
                  onChange={setGraphqlQuery}
                  schema={graphqlSchema}
                  schemaLoading={graphqlSchemaLoading}
                />
              </div>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="px-3 py-[6px] text-[10px] font-semibold text-subtext uppercase tracking-wider bg-card/50 border-b border-border">
                Variables (JSON)
              </div>
              <div className="flex-1 min-h-0">
                <JsonEditor
                  value={graphqlVariables}
                  onChange={setGraphqlVariables}
                  placeholder='{ "key": "value" }'
                />
              </div>
            </div>
          </div>

          {graphqlSchemaError && (
            <div className="px-3 py-2 text-11 text-warn border-t border-border">
              {graphqlSchemaError}
            </div>
          )}

          {graphqlSchema && graphqlSchema.types.length > 0 && (
            <div className="border-t border-border max-h-[180px] overflow-y-auto">
              <div className="px-3 py-[6px] text-[10px] font-semibold text-subtext uppercase tracking-wider bg-card/50 border-b border-border sticky top-0">
                Schema ({graphqlSchema.types.length} types)
              </div>
              <SchemaTree types={graphqlSchema.types} />
            </div>
          )}
        </div>
      )}

      {(bodyType === "form" || bodyType === "urlencoded") && (
        <KeyValueEditor
          rows={bodyForm}
          onAdd={addBodyForm}
          onUpdate={updateBodyForm}
          onRemove={removeBodyForm}
        />
      )}
    </div>
  );
}

function SchemaTree({ types }: { types: GraphQLSchemaType[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = useCallback((name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  return (
    <div className="py-1">
      {types.map((t) => (
        <div key={t.name}>
          <button
            type="button"
            onClick={() => toggle(t.name)}
            className="w-full flex items-center gap-1.5 px-3 py-[3px] text-11 text-subtext hover:text-text hover:bg-cardHover transition-colors text-left"
          >
            {t.fields && t.fields.length > 0 ? (
              expanded.has(t.name) ? <ChevronDown size={10} /> : <ChevronRight size={10} />
            ) : (
              <span className="w-[10px]" />
            )}
            <span className="text-cyan font-medium">{t.name}</span>
            <span className="text-tertiary text-[10px]">{t.kind}</span>
          </button>
          {expanded.has(t.name) && t.fields && (
            <div className="ml-3 pl-3 border-l border-border/50">
              {t.fields.map((f) => (
                <div key={f.name} className="flex items-center gap-1.5 px-3 py-[2px] text-11 text-subtext">
                  <span className="text-text">{f.name}</span>
                  {f.type && (
                    <span className="text-tertiary text-[10px] font-mono">
                      : {f.type.name || f.type.kind}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
