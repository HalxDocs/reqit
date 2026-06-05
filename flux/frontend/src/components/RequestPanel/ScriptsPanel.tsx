import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRequestStore } from "../../stores/useRequestStore";

export function ScriptsPanel() {
  const preSetVars = useRequestStore((s) => s.preSetVars);
  const extractRules = useRequestStore((s) => s.extractRules);
  const addPreSetVar = useRequestStore((s) => s.addPreSetVar);
  const updatePreSetVar = useRequestStore((s) => s.updatePreSetVar);
  const removePreSetVar = useRequestStore((s) => s.removePreSetVar);
  const addExtractRule = useRequestStore((s) => s.addExtractRule);
  const updateExtractRule = useRequestStore((s) => s.updateExtractRule);
  const removeExtractRule = useRequestStore((s) => s.removeExtractRule);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Pre-Set Variables */}
      <div className="border-b border-border">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-11 text-subtext font-semibold uppercase tracking-wider">
            Set Variables (before request)
          </span>
          <button
            type="button"
            onClick={addPreSetVar}
            className="flex items-center gap-1 text-11 text-blue hover:text-blue-hover transition-colors"
          >
            <Plus size={12} />
            Add
          </button>
        </div>
        <div className="grid grid-cols-[1fr_1fr_24px] gap-2 px-4 pb-2">
          {preSetVars.map((v) => (
            <React.Fragment key={v.id}>
              <input
                type="text"
                value={v.key}
                onChange={(e) => updatePreSetVar(v.id, { key: e.target.value })}
                placeholder="Variable name (e.g. token)"
                spellCheck={false}
                className="h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-blue transition-colors"
              />
              <input
                type="text"
                value={v.value}
                onChange={(e) => updatePreSetVar(v.id, { value: e.target.value })}
                placeholder="Value (supports {{}} references)"
                spellCheck={false}
                className="h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-blue transition-colors"
              />
              <button
                type="button"
                onClick={() => removePreSetVar(v.id)}
                className="flex items-center justify-center text-subtext hover:text-danger transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Extract Rules */}
      <div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-11 text-subtext font-semibold uppercase tracking-wider">
            Extract Variables (after response)
          </span>
          <button
            type="button"
            onClick={addExtractRule}
            className="flex items-center gap-1 text-11 text-blue hover:text-blue-hover transition-colors"
          >
            <Plus size={12} />
            Add
          </button>
        </div>
        <div className="grid grid-cols-[80px_1fr_1fr_24px] gap-2 px-4 pb-3">
          {extractRules.map((r) => (
            <React.Fragment key={r.id}>
              <select
                value={r.type}
                onChange={(e) => updateExtractRule(r.id, { type: e.target.value as "body_json" | "header" })}
                className="h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-blue transition-colors"
              >
                <option value="body_json">JSON Body</option>
                <option value="header">Header</option>
              </select>
              <input
                type="text"
                value={r.source}
                onChange={(e) => updateExtractRule(r.id, { source: e.target.value })}
                placeholder={r.type === "header" ? "Content-Type" : "data.id"}
                spellCheck={false}
                className="h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-blue transition-colors"
              />
              <input
                type="text"
                value={r.target}
                onChange={(e) => updateExtractRule(r.id, { target: e.target.value })}
                placeholder="Target var (e.g. my_token)"
                spellCheck={false}
                className="h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-blue transition-colors"
              />
              <button
                type="button"
                onClick={() => removeExtractRule(r.id)}
                className="flex items-center justify-center text-subtext hover:text-danger transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </React.Fragment>
          ))}
        </div>
        <div className="px-4 pb-3 text-11 text-subtext/60 leading-relaxed">
          <strong>JSON Body:</strong> path like <code className="font-mono bg-card px-1 rounded">user.id</code> extracts <code className="font-mono bg-card px-1 rounded">response.body.user.id</code>
          <br />
          <strong>Header:</strong> source is the header name, case-insensitive
        </div>
      </div>
    </div>
  );
}
