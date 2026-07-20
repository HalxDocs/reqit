import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/shared/components/Modal";
import {
  RunCollection,
  ExportReportAsHTML,
  ExportReportAsJSON,
} from "../../../../wailsjs/go/main/App";
import { useEnvStore } from "@/features/env/stores/useEnvStore";
import { AssertionEditor } from "@/features/assertions/components/AssertionEditor";
import { FileText, Download } from "lucide-react";
import { models } from "../../../../wailsjs/go/models";
import { toast } from "@/app/stores/useToastStore";

interface Props {
  open: boolean;
  onClose: () => void;
  collection: models.Collection;
}

const VAR_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

export function RunnerModal({ open, onClose, collection }: Props) {
  const resolve = useEnvStore((s) => s.resolve);

  const [assertions, setAssertions] = useState<Record<string, models.Assertion[]>>({});
  const [retries, setRetries] = useState<Record<string, number>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<models.CollectionRunResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setAssertions({});
    setRetries({});
    setResult(null);
    setRunning(false);
  }, [open]);

  const resolvedRequests: models.RunnerRequest[] = useMemo(() => {
    return collection.requests.map((r) => ({
      id: r.id,
      name: r.name,
      payload: resolvePayload(r.payload, resolve),
      preSetVars: r.preSetVars,
      extractRules: r.extractRules,
      assertions: assertions[r.id] || [],
      retries: retries[r.id] || 0,
    } as models.RunnerRequest));
  }, [collection, resolve, assertions, retries]);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await RunCollection(resolvedRequests, {} as Record<string, models.Assertion>);
      setResult(res);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setRunning(false);
    }
  };

  const handleExportJSON = async () => {
    if (!result) return;
    try {
      const path = await ExportReportAsJSON(result);
      toast.success(`Report saved: ${path}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleExportHTML = async () => {
    if (!result) return;
    try {
      const path = await ExportReportAsHTML(result, null as unknown as models.LoadTestResult);
      toast.success(`Report saved: ${path}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Run: ${collection.name}`}>
      <div className="flex flex-col gap-4 min-w-[580px] max-w-[700px]">
        {/* Summary */}
        {result && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg text-13 font-semibold ${
            result.failed === 0 ? "bg-teal/10 text-teal" : "bg-danger/10 text-danger"
          }`}>
            <span>{result.passed}/{result.total} passed</span>
            <span className="text-subtext font-normal">· {result.durationMs}ms</span>
            {result.failed > 0 && <span>· {result.failed} failed</span>}
            {result.skipped > 0 && <span>· {result.skipped} skipped</span>}
          </div>
        )}

        {/* Request list */}
        <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto">
          {collection.requests.map((req) => {
            const a = assertions[req.id] || [];
            const retryCount = retries[req.id] || 0;
            const res = result?.results.find((r) => r.requestId === req.id);
            return (
              <div key={req.id} className="bg-card border border-border rounded-lg p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-12 font-semibold text-text">{req.name}</span>
                  <div className="flex items-center gap-2">
                    {res && (
                      <span className={`text-11 font-bold ${res.passed ? "text-teal" : res.skipped ? "text-subtext" : "text-danger"}`}>
                        {res.skipped ? "SKIP" : res.passed ? "PASS" : "FAIL"}
                      </span>
                    )}
                    {res && !res.error && (
                      <span className="text-11 text-subtext">
                        {res.statusCode} · {res.timingMs}ms{(res.retries ?? 0) > 0 ? ` (${res.retries} retries)` : ""}
                      </span>
                    )}
                  </div>
                </div>

                {res?.error && (
                  <div className="text-11 text-danger break-words">{res.error}</div>
                )}
                {res?.assertionErrors?.map((err, i) => (
                  <div key={i} className="text-11 text-amber-400 break-words">{err}</div>
                ))}

                {!running && !result && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <label className="text-10 text-subtext uppercase tracking-wider shrink-0">Retries</label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={retryCount}
                        onChange={(e) => setRetries((prev) => ({ ...prev, [req.id]: parseInt(e.target.value) || 0 }))}
                        className="h-[24px] w-[60px] px-2 bg-surface border border-border rounded text-11 text-text outline-none focus:border-cyan"
                      />
                    </div>
                    <AssertionEditor
                      assertions={a}
                      onChange={(next) => setAssertions((prev) => ({ ...prev, [req.id]: next }))}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-2">
          <div className="flex gap-1">
            {result && (
              <>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="flex items-center gap-1 h-[28px] px-2 text-11 text-subtext hover:text-text bg-card border border-border rounded transition-colors"
                  title="Export JSON report"
                >
                  <FileText size={11} />
                  JSON
                </button>
                <button
                  type="button"
                  onClick={handleExportHTML}
                  className="flex items-center gap-1 h-[28px] px-2 text-11 text-subtext hover:text-text bg-card border border-border rounded transition-colors"
                  title="Export HTML report"
                >
                  <Download size={11} />
                  HTML
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2">
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
