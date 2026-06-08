import { useEffect, useMemo, useState } from "react";
import { Modal } from "../shared/Modal";
import { RunCollection } from "../../../wailsjs/go/main/App";
import { useEnvStore } from "../../stores/useEnvStore";
import type { models } from "../../../wailsjs/go/models";

interface AssertionShape {
  statusCode?: number;
  maxTimingMs?: number;
  bodyContains?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  collection: models.Collection;
}

const VAR_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

export function RunnerModal({ open, onClose, collection }: Props) {
  const resolve = useEnvStore((s) => s.resolve);

  const [assertions, setAssertions] = useState<Record<string, AssertionShape>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<models.CollectionRunResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setAssertions({});
    setResult(null);
    setRunning(false);
  }, [open]);

  const resolvedRequests = useMemo(() => {
    return collection.requests.map((r) => ({
      id: r.id,
      name: r.name,
      payload: resolvePayload(r.payload, resolve),
      preSetVars: r.preSetVars,
      extractRules: r.extractRules,
    }));
  }, [collection, resolve]) as any;

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await RunCollection(resolvedRequests as any, assertions);
      setResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  const updateAssertion = (reqID: string, partial: Partial<AssertionShape>) => {
    setAssertions((prev) => {
      const cur = prev[reqID] || { statusCode: 0, maxTimingMs: 0, bodyContains: "" };
      return { ...prev, [reqID]: { ...cur, ...partial } };
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={`Run: ${collection.name}`}>
      <div className="flex flex-col gap-4 min-w-[520px] max-w-[600px]">
        {/* Summary */}
        {result && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg text-13 font-semibold ${
            result.failed === 0 ? "bg-teal/10 text-teal" : "bg-danger/10 text-danger"
          }`}>
            <span>{result.passed}/{result.total} passed</span>
            <span className="text-subtext font-normal">· {result.durationMs}ms</span>
            {result.failed > 0 && <span>· {result.failed} failed</span>}
          </div>
        )}

        {/* Request list */}
        <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto">
          {collection.requests.map((req) => {
            const a = assertions[req.id] || {};
            const res = result?.results.find((r) => r.requestId === req.id);
            return (
              <div key={req.id} className="bg-card border border-border rounded-lg p-3 flex flex-col gap-2">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="text-12 font-semibold text-text">{req.name}</span>
                  {res && (
                    <span className={`text-11 font-bold ${res.passed ? "text-teal" : "text-danger"}`}>
                      {res.passed ? "PASS" : "FAIL"}
                    </span>
                  )}
                  {res && !res.error && (
                    <span className="text-11 text-subtext ml-2">
                      {res.statusCode} · {res.timingMs}ms
                    </span>
                  )}
                </div>

                {/* Error / Assertion errors */}
                {res?.error && (
                  <div className="text-11 text-danger break-words">{res.error}</div>
                )}
                {res?.assertionErrors?.map((err, i) => (
                  <div key={i} className="text-11 text-amber-400 break-words">{err}</div>
                ))}

                {/* Assertion inputs (shown while not running and before run) */}
                {!running && !result && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-10 text-subtext uppercase tracking-wider">Status</label>
                      <input
                        type="number"
                        placeholder="200"
                        value={a.statusCode || ""}
                        onChange={(e) => updateAssertion(req.id, { statusCode: e.target.value ? parseInt(e.target.value) : 0 })}
                        className="h-[28px] px-2 bg-surface border border-border rounded text-11 text-text outline-none focus:border-cyan"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-10 text-subtext uppercase tracking-wider">Max ms</label>
                      <input
                        type="number"
                        placeholder="3000"
                        value={a.maxTimingMs || ""}
                        onChange={(e) => updateAssertion(req.id, { maxTimingMs: e.target.value ? parseInt(e.target.value) : 0 })}
                        className="h-[28px] px-2 bg-surface border border-border rounded text-11 text-text outline-none focus:border-cyan"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-10 text-subtext uppercase tracking-wider">Body contains</label>
                      <input
                        type="text"
                        placeholder='"ok"'
                        value={a.bodyContains}
                        onChange={(e) => updateAssertion(req.id, { bodyContains: e.target.value })}
                        className="h-[28px] px-2 bg-surface border border-border rounded text-11 text-text outline-none focus:border-cyan"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-[32px] px-3 text-12 text-subtext hover:text-text rounded-md transition-colors"
          >
            Close
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="h-[32px] px-4 bg-cyan hover:bg-cyan-hover text-white text-12 font-bold rounded-md disabled:opacity-60 transition-all"
            >
              {running ? "Running…" : "Run"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function resolvePayload(payload: models.RequestPayload, resolve: (s: string) => string) {
  return {
    ...payload,
    url: resolve(payload.url),
    body: resolve(payload.body),
    headers: payload.headers?.map((h) => ({ ...h, key: resolve(h.key), value: resolve(h.value) })),
    params: payload.params?.map((p) => ({ ...p, key: resolve(p.key), value: resolve(p.value) })),
    bodyForm: payload.bodyForm?.map((f) => ({ ...f, key: resolve(f.key), value: resolve(f.value) })),
    authValue: resolve(payload.authValue),
  };
}
