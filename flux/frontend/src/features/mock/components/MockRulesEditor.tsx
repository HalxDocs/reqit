import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { GetMockRules, SetMockRules } from "../../../../wailsjs/go/main/App";
import type { mock } from "../../../../wailsjs/go/models";
import { cn } from "@/shared/lib/cn";
import { useToastStore } from "@/app/stores/useToastStore";

const FIELDS: { id: string; label: string; needsKey: boolean }[] = [
  { id: "method", label: "Method", needsKey: false },
  { id: "path", label: "Path", needsKey: false },
  { id: "header", label: "Header", needsKey: true },
  { id: "query", label: "Query", needsKey: true },
];

const OPERATORS = ["eq", "neq", "contains", "matches", "exists"];

/**
 * The editor keeps plain objects rather than the generated model classes:
 * the Wails classes carry a static convertValues that makes them awkward to
 * build, and the wire format is plain JSON either way.
 */
type Condition = {
  field: string;
  key: string;
  operator: string;
  value: string;
};

type Rule = {
  name: string;
  priority: number;
  conditions: Condition[];
  response: {
    statusCode: number;
    headers?: Record<string, string>;
    body?: string;
    delayMs?: number;
  };
};

function emptyRule(): Rule {
  return {
    name: "",
    priority: 0,
    conditions: [{ field: "method", key: "", operator: "eq", value: "GET" }],
    response: { statusCode: 200, headers: {}, body: "", delayMs: 0 },
  };
}

function newCondition(): Condition {
  return { field: "header", key: "", operator: "eq", value: "" };
}

/**
 * Editor for the rules the mock server evaluates.
 *
 * A rule matches on the request and answers with its own response, so the
 * same path can answer differently depending on the method, a header or a
 * query parameter. Rules are evaluated in priority order, highest first.
 */
export function MockRulesEditor() {
  const toast = useToastStore((s) => s.push);
  const [rules, setRules] = useState<Rule[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    GetMockRules()
      .then((r) => setRules(((r ?? []) as unknown as Rule[])))
      .catch(() => setRules([]));
  }, []);

  const update = useCallback((index: number, patch: Partial<Rule>) => {
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }, []);

  const removeRule = useCallback((index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await SetMockRules(rules as unknown as mock.Rule[]);
      toast("success", `Saved ${rules.length} rule${rules.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast("error", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [rules, toast]);

  return (
    <div className="bg-surface border border-border rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-12 font-semibold text-text flex items-center gap-1.5">
          <Zap size={12} className="text-cyan" />
          Rules
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setRules((prev) => [...prev, emptyRule()]);
              setExpanded(rules.length);
            }}
            className="text-11 text-subtext hover:text-text flex items-center gap-1 transition-colors"
          >
            <Plus size={11} />
            Add rule
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="text-11 font-semibold text-cyan hover:text-cyan-hover disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {rules.length === 0 ? (
        <p className="text-11 text-subtext/70">
          No rules. The server answers from the captured routes only. A rule lets the same path
          answer differently depending on the request.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rules.map((rule, index) => (
            <li key={index} className="border border-border/60 rounded-md">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === index ? null : index)}
                  className="flex items-center gap-1.5 text-11 font-mono text-text flex-1 min-w-0 text-left hover:text-cyan transition-colors"
                >
                  {expanded === index ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  <span className="truncate">
                    {rule.name || `Rule ${index + 1}`}
                  </span>
                </button>
                <span className="text-10 text-subtext/60 font-mono shrink-0">
                  {rule.response?.statusCode ?? 200}
                </span>
                <button
                  type="button"
                  onClick={() => removeRule(index)}
                  className="text-subtext hover:text-danger transition-colors shrink-0"
                  aria-label="Remove rule"
                >
                  <Trash2 size={11} />
                </button>
              </div>

              {expanded === index && (
                <div className="px-2 pb-2 pt-1 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input
                      value={rule.name ?? ""}
                      onChange={(e) => update(index, { name: e.target.value })}
                      placeholder="Rule name"
                      className="flex-1 h-[26px] px-2 bg-card border border-border rounded text-11 text-text placeholder:text-subtext outline-none focus:border-cyan"
                    />
                    <input
                      type="number"
                      value={rule.priority ?? 0}
                      onChange={(e) => update(index, { priority: Number(e.target.value) || 0 })}
                      title="Higher priority is evaluated first"
                      className="w-[64px] h-[26px] px-2 bg-card border border-border rounded text-11 font-mono text-text outline-none focus:border-cyan"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="text-10 font-semibold text-subtext uppercase tracking-wider">When</div>
                    {rule.conditions?.map((condition, ci) => (
                      <div key={ci} className="flex gap-1 items-center">
                        <select
                          value={condition.field}
                          onChange={(e) => {
                            const next = [...(rule.conditions ?? [])];
                            next[ci] = { ...condition, field: e.target.value };
                            update(index, { conditions: next });
                          }}
                          className="h-[26px] px-1 bg-card border border-border rounded text-11 text-text outline-none focus:border-cyan"
                        >
                          {FIELDS.map((f) => (
                            <option key={f.id} value={f.id}>{f.label}</option>
                          ))}
                        </select>
                        {FIELDS.find((f) => f.id === condition.field)?.needsKey && (
                          <input
                            value={condition.key ?? ""}
                            onChange={(e) => {
                              const next = [...(rule.conditions ?? [])];
                              next[ci] = { ...condition, key: e.target.value };
                              update(index, { conditions: next });
                            }}
                            placeholder="name"
                            className="w-[100px] h-[26px] px-2 bg-card border border-border rounded text-11 font-mono text-text placeholder:text-subtext outline-none focus:border-cyan"
                          />
                        )}
                        <select
                          value={condition.operator}
                          onChange={(e) => {
                            const next = [...(rule.conditions ?? [])];
                            next[ci] = { ...condition, operator: e.target.value };
                            update(index, { conditions: next });
                          }}
                          className="h-[26px] px-1 bg-card border border-border rounded text-11 text-text outline-none focus:border-cyan"
                        >
                          {OPERATORS.map((op) => (
                            <option key={op} value={op}>{op}</option>
                          ))}
                        </select>
                        <input
                          value={condition.value ?? ""}
                          onChange={(e) => {
                            const next = [...(rule.conditions ?? [])];
                            next[ci] = { ...condition, value: e.target.value };
                            update(index, { conditions: next });
                          }}
                          placeholder="value"
                          className="flex-1 min-w-0 h-[26px] px-2 bg-card border border-border rounded text-11 font-mono text-text placeholder:text-subtext outline-none focus:border-cyan"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            update(index, { conditions: (rule.conditions ?? []).filter((_, i) => i !== ci) })
                          }
                          className="text-subtext hover:text-danger transition-colors shrink-0"
                          aria-label="Remove condition"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => update(index, { conditions: [...(rule.conditions ?? []), newCondition()] })}
                      className="text-11 text-cyan hover:underline self-start"
                    >
                      + Condition
                    </button>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="text-10 font-semibold text-subtext uppercase tracking-wider">Respond</div>
                    <div className="flex gap-1 items-center">
                      <input
                        type="number"
                        value={rule.response?.statusCode ?? 200}
                        onChange={(e) =>
                          update(index, {
                            response: { ...rule.response, statusCode: Number(e.target.value) || 200 },
                          })
                        }
                        className="w-[70px] h-[26px] px-2 bg-card border border-border rounded text-11 font-mono text-text outline-none focus:border-cyan"
                      />
                      <span className="text-11 text-subtext">status</span>
                      <input
                        type="number"
                        value={rule.response?.delayMs ?? 0}
                        onChange={(e) =>
                          update(index, {
                            response: { ...rule.response, delayMs: Number(e.target.value) || 0 },
                          })
                        }
                        title="Delay in milliseconds"
                        className="w-[70px] h-[26px] px-2 bg-card border border-border rounded text-11 font-mono text-text outline-none focus:border-cyan"
                      />
                      <span className="text-11 text-subtext">ms delay</span>
                    </div>
                    <textarea
                      value={typeof rule.response?.body === "string" ? rule.response.body : ""}
                      onChange={(e) =>
                        update(index, { response: { ...rule.response, body: e.target.value } })
                      }
                      placeholder="Response body"
                      rows={3}
                      spellCheck={false}
                      className="w-full px-2 py-1.5 bg-card border border-border rounded text-11 font-mono text-text placeholder:text-subtext outline-none focus:border-cyan resize-none"
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
