import { useState } from "react";
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { ValidationResult } from "../../types/request";

interface Props {
  validation: ValidationResult | undefined;
}

export function ContractBadge({ validation }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!validation || validation.skipReason) return null;

  if (validation.valid) {
    return (
      <span className="flex items-center gap-1 text-11 text-success font-semibold">
        <CheckCircle size={11} />
        Contract OK
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-11 text-danger font-semibold"
      >
        <XCircle size={11} />
        {validation.errors.length} violation{validation.errors.length !== 1 ? "s" : ""}
        {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>

      {expanded && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-lg p-3 min-w-[320px] max-w-[480px]">
          <div className="text-11 font-semibold text-text mb-2">
            Contract violations — {validation.method} {validation.endpoint}
          </div>
          <ul className="flex flex-col gap-1.5">
            {validation.errors.map((e, i) => (
              <li key={i} className="flex items-start gap-2 text-11">
                <span
                  className={`shrink-0 text-10 font-mono px-1.5 py-0.5 rounded uppercase tracking-wide ${
                    e.layer === "status"
                      ? "bg-warning/15 text-warning"
                      : e.layer === "body"
                      ? "bg-danger/15 text-danger"
                      : "bg-cyan/15 text-cyan"
                  }`}
                >
                  {e.layer}
                </span>
                <span className="text-subtext leading-relaxed">
                  {e.field && <code className="text-text">{e.field}</code>}
                  {e.field ? " — " : ""}
                  {e.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
