import React, { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { EditorView } from "@codemirror/view";
import { ArrowRightLeft, Plus, Trash2 } from "lucide-react";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { fluxCmTheme } from "@/shared/lib/cmTheme";
import { useThemeStore } from "@/shared/lib/useTheme";

export function ScriptsPanel() {
  const preSetVars = useRequestStore((s) => s.preSetVars);
  const extractRules = useRequestStore((s) => s.extractRules);
  const preScript = useRequestStore((s) => s.preScript);
  const postScript = useRequestStore((s) => s.postScript);
  const addPreSetVar = useRequestStore((s) => s.addPreSetVar);
  const updatePreSetVar = useRequestStore((s) => s.updatePreSetVar);
  const removePreSetVar = useRequestStore((s) => s.removePreSetVar);
  const addExtractRule = useRequestStore((s) => s.addExtractRule);
  const updateExtractRule = useRequestStore((s) => s.updateExtractRule);
  const removeExtractRule = useRequestStore((s) => s.removeExtractRule);
  const setPreScript = useRequestStore((s) => s.setPreScript);
  const setPostScript = useRequestStore((s) => s.setPostScript);
  const theme = useThemeStore((s) => s.resolved);

  const jsExtensions = useMemo(
    () => [javascript(), fluxCmTheme, EditorView.lineWrapping],
    [],
  );

  const pipeInputs = preSetVars.filter((v) => v.key);
  const pipeOutputs = extractRules.filter((r) => r.target);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Data Pipeline indicator */}
      {(pipeInputs.length > 0 || pipeOutputs.length > 0) && (
        <div className="px-4 py-2 bg-cyan/5 border-b border-cyan/10">
          <div className="flex items-center gap-2 text-11 text-cyan">
            <ArrowRightLeft size={12} />
            <span className="font-semibold">Data Pipeline Active</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-10 text-subtext font-mono">
            {pipeInputs.length > 0 && (
              <span title="Values set into environment before request">
                Input: {pipeInputs.map((v) => v.key).join(", ")}
              </span>
            )}
            {pipeInputs.length > 0 && pipeOutputs.length > 0 && (
              <span className="text-tertiary">→</span>
            )}
            {pipeOutputs.length > 0 && (
              <span title="Values extracted from response into environment">
                Output: {pipeOutputs.map((r) => r.target).join(", ")}
              </span>
            )}
          </div>
        </div>
      )}
      {/* Pre-request Script */}
      <div className="border-b border-border">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-11 text-subtext font-semibold uppercase tracking-wider">
            Pre-request Script (JavaScript)
          </span>
        </div>
        <div className="px-4 pb-2" style={{ height: 140 }}>
          <CodeMirror
            value={preScript}
            theme={theme}
            extensions={jsExtensions}
            onChange={(val) => setPreScript(val)}
            placeholder={"// Set variables before request\npm.variables.set(\"token\", \"abc123\");"}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
              highlightActiveLineGutter: true,
              autocompletion: false,
            }}
            height="100%"
            className="h-full"
          />
        </div>
      </div>

      {/* Post-response Script */}
      <div className="border-b border-border">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-11 text-subtext font-semibold uppercase tracking-wider">
            Post-response Script (JavaScript)
          </span>
        </div>
        <div className="px-4 pb-2" style={{ height: 140 }}>
          <CodeMirror
            value={postScript}
            theme={theme}
            extensions={jsExtensions}
            onChange={(val) => setPostScript(val)}
            placeholder={"// Extract values from response\npm.response.to.have.status(200);\nconst id = pm.response.json().data.id;\npm.variables.set(\"userId\", id);"}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
              highlightActiveLineGutter: true,
              autocompletion: false,
            }}
            height="100%"
            className="h-full"
          />
        </div>
      </div>

      {/* Pre-Set Variables */}
      <div className="border-b border-border">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-11 text-subtext font-semibold uppercase tracking-wider">
            Set Variables (before request)
          </span>
          <button
            type="button"
            onClick={addPreSetVar}
            className="flex items-center gap-1 text-11 text-cyan hover:text-cyan-hover transition-colors"
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
                className="h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan transition-colors"
              />
              <input
                type="text"
                value={v.value}
                onChange={(e) => updatePreSetVar(v.id, { value: e.target.value })}
                placeholder="Value (supports {{}} references)"
                spellCheck={false}
                className="h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan transition-colors"
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
            className="flex items-center gap-1 text-11 text-cyan hover:text-cyan-hover transition-colors"
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
                className="h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan transition-colors"
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
                className="h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan transition-colors"
              />
              <input
                type="text"
                value={r.target}
                onChange={(e) => updateExtractRule(r.id, { target: e.target.value })}
                placeholder="Target var (e.g. my_token)"
                spellCheck={false}
                className="h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan transition-colors"
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
