import { useMemo } from "react";
import { useEnvStore } from "../../stores/useEnvStore";
import { useRequestStore } from "../../stores/useRequestStore";
import { buildQueryString } from "../../lib/url";

const VAR_PATTERN = /(\{\{\s*[\w.-]+\s*\}\})/g;
const INNER_PATTERN = /^\{\{\s*([\w.-]+)\s*\}\}$/;

export function UrlPreview() {
  const url = useRequestStore((s) => s.url);
  const params = useRequestStore((s) => s.params);
  const environments = useEnvStore((s) => s.environments);
  const activeID = useEnvStore((s) => s.activeID);

  const { fullInput, map, hasVars } = useMemo(() => {
    const full = url + buildQueryString(params);
    const m = new Map<string, string>();
    const env = environments.find((e) => e.id === activeID);
    if (env) {
      for (const v of env.vars ?? []) {
        if (v.enabled !== false && v.key) m.set(v.key, v.value ?? "");
      }
    }
    return { fullInput: full, map: m, hasVars: VAR_PATTERN.test(full) };
  }, [url, params, environments, activeID]);

  if (!hasVars) return null;

  const segments = fullInput.split(VAR_PATTERN);
  const unresolvedCount = segments.filter((seg) => {
    const m = seg.match(INNER_PATTERN);
    return m && !map.has(m[1]);
  }).length;

  return (
    <div className="px-4 py-2 bg-card/50 border-b border-border">
      <div className="text-11 text-subtext mb-1 uppercase font-semibold tracking-wider flex items-center justify-between">
        <span>Preview</span>
        {unresolvedCount > 0 && (
          <span className="text-warn normal-case font-mono">
            {unresolvedCount} unresolved
          </span>
        )}
      </div>
      <div className="font-mono text-12 break-all">
        {segments.map((seg, i) => {
          const m = seg.match(INNER_PATTERN);
          if (m) {
            const name = m[1];
            const val = map.get(name);
            if (val !== undefined) {
              return (
                <span key={i} className="text-teal" title={`${name} → ${val}`}>
                  {val}
                </span>
              );
            }
            return (
              <span
                key={i}
                className="text-warn bg-warn/10 px-1 rounded-sm"
                title={`Variable "${name}" is not defined in the active environment`}
              >
                {seg}
              </span>
            );
          }
          return (
            <span key={i} className="text-text">
              {seg}
            </span>
          );
        })}
      </div>
    </div>
  );
}
