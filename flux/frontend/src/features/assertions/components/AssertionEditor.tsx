import { Plus, Trash2 } from "lucide-react";
import type { models } from "../../../../wailsjs/go/models";

const ASSERTION_TYPES = [
  { value: "statusCode", label: "Status Code" },
  { value: "maxTiming", label: "Max Timing (ms)" },
  { value: "bodyContains", label: "Body Contains" },
  { value: "bodyMatch", label: "Body Regex Match" },
  { value: "bodyNotMatch", label: "Body Regex No Match" },
  { value: "jsonPath", label: "JSON Path Value" },
  { value: "header", label: "Header Value" },
  { value: "cookie", label: "Cookie Value" },
  { value: "varEqual", label: "Variable Equal" },
  { value: "varNotEqual", label: "Variable Not Equal" },
  { value: "jsonSchema", label: "JSON Schema" },
  { value: "customScript", label: "Custom Script" },
];

export function AssertionEditor({
  assertions,
  onChange,
}: {
  assertions: models.Assertion[];
  onChange: (assertions: models.Assertion[]) => void;
}) {
  const update = (i: number, partial: Partial<models.Assertion>) => {
    const next = [...assertions];
    next[i] = { ...next[i], ...partial };
    onChange(next);
  };

  const remove = (i: number) => {
    onChange(assertions.filter((_, idx) => idx !== i));
  };

  const add = () => {
    onChange([...assertions, { type: "statusCode", target: "", value: "", statusCode: 0, maxTimingMs: 0, bodyContains: "" } as models.Assertion]);
  };

  return (
    <div className="flex flex-col gap-2">
      {assertions.map((a, i) => (
        <div key={i} className="flex items-start gap-2 bg-card border border-border rounded-lg p-2">
          <select
            value={a.type}
            onChange={(e) => update(i, { type: e.target.value as any })}
            className="h-[28px] px-2 bg-surface border border-border rounded text-11 text-text outline-none focus:border-cyan shrink-0"
          >
            {ASSERTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {a.type !== "customScript" && a.type !== "statusCode" && a.type !== "maxTiming" && a.type !== "bodyContains" && (
            <input
              type="text"
              value={a.target}
              onChange={(e) => update(i, { target: e.target.value })}
              placeholder={placeholderFor(a.type)}
              spellCheck={false}
              className="h-[28px] min-w-0 flex-1 px-2 bg-surface border border-border rounded text-11 text-text outline-none focus:border-cyan"
            />
          )}

          {a.type !== "customScript" && a.type !== "jsonSchema" && a.type !== "statusCode" && a.type !== "maxTiming" && (
            <input
              type="text"
              value={a.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder={valuePlaceholderFor(a.type)}
              spellCheck={false}
              className="h-[28px] min-w-0 flex-1 px-2 bg-surface border border-border rounded text-11 text-text outline-none focus:border-cyan"
            />
          )}

          {(a.type === "customScript" || a.type === "jsonSchema") && (
            <textarea
              value={a.script || a.target}
              onChange={(e) => {
                if (a.type === "customScript") update(i, { script: e.target.value });
                else update(i, { target: e.target.value });
              }}
              placeholder={a.type === "customScript" ? "// JS assertion script" : '{ "$schema": "..." }'}
              spellCheck={false}
              rows={2}
              className="min-w-0 flex-1 px-2 py-1 bg-surface border border-border rounded text-11 text-text outline-none focus:border-cyan font-mono"
            />
          )}

          <button
            type="button"
            onClick={() => remove(i)}
            className="flex items-center justify-center w-[24px] h-[28px] text-subtext hover:text-danger transition-colors shrink-0"
          >
            <Trash2 size={11} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-11 text-cyan hover:text-cyan-hover transition-colors"
      >
        <Plus size={12} />
        Add assertion
      </button>
    </div>
  );
}

function placeholderFor(type: string): string {
  switch (type) {
    case "bodyMatch": case "bodyNotMatch": return "regex pattern";
    case "jsonPath": return "data.user.id";
    case "header": return "Content-Type";
    case "cookie": return "session_id";
    case "varEqual": case "varNotEqual": return "var name";
    case "jsonSchema": return '{ "$schema": "..." }';
    default: return "";
  }
}

function valuePlaceholderFor(type: string): string {
  switch (type) {
    case "jsonPath": return "expected value";
    case "header": case "cookie": return "expected value";
    case "varEqual": case "varNotEqual": return "other var name";
    case "bodyMatch": case "bodyNotMatch": return "";
    default: return "";
  }
}
