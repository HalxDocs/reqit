import { useState, useMemo } from "react";
import { useEnvStore } from "@/features/env/stores/useEnvStore";
import { GitCompareArrows } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function EnvCompareModal({ open, onClose }: Props) {
  const environments = useEnvStore((s) => s.environments);
  const [leftID, setLeftID] = useState("");
  const [rightID, setRightID] = useState("");

  const leftEnv = useMemo(() => environments.find((e) => e.id === leftID), [environments, leftID]);
  const rightEnv = useMemo(() => environments.find((e) => e.id === rightID), [environments, rightID]);

  const allKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const v of leftEnv?.vars ?? []) if (v.key) keys.add(v.key);
    for (const v of rightEnv?.vars ?? []) if (v.key) keys.add(v.key);
    return Array.from(keys).sort();
  }, [leftEnv, rightEnv]);

  const leftMap = useMemo(() => {
    const m = new Map<string, { value: string; enabled: boolean }>();
    for (const v of leftEnv?.vars ?? []) if (v.key) m.set(v.key, { value: v.value ?? "", enabled: v.enabled !== false });
    return m;
  }, [leftEnv]);

  const rightMap = useMemo(() => {
    const m = new Map<string, { value: string; enabled: boolean }>();
    for (const v of rightEnv?.vars ?? []) if (v.key) m.set(v.key, { value: v.value ?? "", enabled: v.enabled !== false });
    return m;
  }, [rightEnv]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="bg-card border border-border rounded-lg shadow-xl p-4 w-[560px] max-h-[80vh] flex flex-col pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-4">
            <GitCompareArrows size={16} className="text-cyan" />
            <h3 className="text-14 font-semibold text-text">Compare Environments</h3>
          </div>

          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="text-11 text-subtext mb-1 block">Environment A</label>
              <select
                value={leftID}
                onChange={(e) => setLeftID(e.target.value)}
                className="w-full h-[30px] px-2 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-cyan"
              >
                <option value="">Select…</option>
                {environments.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-11 text-subtext mb-1 block">Environment B</label>
              <select
                value={rightID}
                onChange={(e) => setRightID(e.target.value)}
                className="w-full h-[30px] px-2 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-cyan"
              >
                <option value="">Select…</option>
                {environments.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          </div>

          {!leftID || !rightID ? (
            <div className="py-8 text-center text-12 text-subtext">Select two environments to compare.</div>
          ) : allKeys.length === 0 ? (
            <div className="py-8 text-center text-12 text-subtext">No variables in either environment.</div>
          ) : (
            <div className="flex-1 overflow-y-auto border border-border rounded-md">
              <table className="w-full text-12">
                <thead>
                  <tr className="border-b border-border bg-surface/50">
                    <th className="text-left px-3 py-2 text-subtext font-semibold">Variable</th>
                    <th className="text-left px-3 py-2 text-subtext font-semibold">{leftEnv?.name ?? "A"}</th>
                    <th className="text-left px-3 py-2 text-subtext font-semibold">{rightEnv?.name ?? "B"}</th>
                  </tr>
                </thead>
                <tbody>
                  {allKeys.map((key) => {
                    const lv = leftMap.get(key);
                    const rv = rightMap.get(key);
                    const differs = (lv?.value ?? "") !== (rv?.value ?? "");
                    const onlyLeft = !rv;
                    const onlyRight = !lv;
                    return (
                      <tr key={key} className={`border-b border-border/50 ${differs ? "bg-amber/5" : ""}`}>
                        <td className="px-3 py-1.5 font-mono text-text">{key}</td>
                        <td className={`px-3 py-1.5 font-mono ${onlyLeft ? "text-cyan" : differs ? "text-amber" : "text-text"}`}>
                          {lv?.value ?? <span className="text-subtext/40 italic">missing</span>}
                          {lv?.enabled === false && <span className="ml-1 text-10 text-subtext/40">(off)</span>}
                        </td>
                        <td className={`px-3 py-1.5 font-mono ${onlyRight ? "text-cyan" : differs ? "text-amber" : "text-text"}`}>
                          {rv?.value ?? <span className="text-subtext/40 italic">missing</span>}
                          {rv?.enabled === false && <span className="ml-1 text-10 text-subtext/40">(off)</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end mt-4">
            <button type="button" onClick={onClose}
              className="h-[28px] px-3 text-12 text-subtext hover:text-text bg-cardHover rounded-md transition-colors">Close</button>
          </div>
        </div>
      </div>
    </>
  );
}
