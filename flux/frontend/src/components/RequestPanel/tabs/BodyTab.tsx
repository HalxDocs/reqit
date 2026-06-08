import { useMemo } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { useRequestStore } from "../../../stores/useRequestStore";
import { cn } from "../../../lib/cn";
import { KeyValueEditor } from "../../shared/KeyValueEditor";
import { JsonEditor } from "../../shared/JsonEditor";
import { GraphqlEditor } from "../../shared/GraphqlEditor";
import type { BodyType } from "../../../types/request";

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

  const validity = useMemo(() => validateJson(bodyRaw), [bodyRaw]);

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(bodyRaw);
      setBodyRaw(JSON.stringify(parsed, null, 2));
    } catch {
      // ignore — button is disabled when invalid
    }
  };

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
              <div className="px-3 py-[6px] text-[10px] font-semibold text-subtext uppercase tracking-wider bg-card/50 border-b border-border">
                Query
              </div>
              <div className="flex-1 min-h-0">
                <GraphqlEditor
                  value={graphqlQuery}
                  onChange={setGraphqlQuery}
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
