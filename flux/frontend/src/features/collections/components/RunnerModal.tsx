import { useEffect, useMemo, useState, useCallback } from "react";
import { Modal } from "@/shared/components/Modal";
import {
  RunCollectionWithConfig,
  ExportReportAsHTML,
  ExportReportAsJSON,
} from "../../../../wailsjs/go/main/App";
import { useEnvStore } from "@/features/env/stores/useEnvStore";
import { AssertionEditor } from "@/features/assertions/components/AssertionEditor";
import { FileText, Download, Table } from "lucide-react";
import { models } from "../../../../wailsjs/go/models";
import { toast } from "@/app/stores/useToastStore";

interface Props {
  open: boolean;
  onClose: () => void;
  collection: models.Collection;
}

function parseDataRows(text: string, type: "csv" | "json"): { rows: Record<string, string>[]; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { rows: [], error: "" };
  try {
    if (type === "json") {
      const arr = JSON.parse(trimmed);
      if (!Array.isArray(arr) || arr.length === 0) return { rows: [], error: "JSON array is empty" };
      return { rows: arr.map((r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? "")]))), error: "" };
    }
    const lines = trimmed.split("\n").filter(Boolean);
    if (lines.length < 2) return { rows: [], error: "Need header + at least 1 data row" };
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const vals = line.split(",").map((v) => v.trim());
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
    });
    return { rows, error: "" };
  } catch (e) {
    return { rows: [], error: String(e) };
  }
}

export function RunnerModal({ open, onClose, collection }: Props) {
  const resolve = useEnvStore((s) => s.resolve);

  const [assertions, setAssertions] = useState<Record<string, models.Assertion[]>>({});
  const [retries, setRetries] = useState<Record<string, number>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<models.CollectionRunResult | null>(null);
  const [dataTab, setDataTab] = useState<"requests" | "data">("requests");
  const [dataText, setDataText] = useState("");
  const [dataType, setDataType] = useState<"csv" | "json">("csv");

  useEffect(() => {
    if (!open) return;
    setAssertions({});
    setRetries({});
    setResult(null);
    setRunning(false);
    setDataTab("requests");
    setDataText("");
    setDataType("csv");
  }, [open]);

  const { rows: dataRows, error: dataError } = useMemo(
    () => parseDataRows(dataText, dataType),
    [dataText, dataType]
  );

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

  const handleRun = useCallback(async () => {
    setRunning(true);
    setResult(null);
    try {
      const config: Record<string, unknown> = {
        requests: resolvedRequests,
        maxConcurrent: 5,
      };
      if (dataRows.length > 0) {
        (config as { dataRows: Record<string, string>[] }).dataRows = dataRows;
      }
      const res = await RunCollectionWithConfig(config as never);
      setResult(res);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setRunning(false);
    }
  }, [resolvedRequests, dataRows]);

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

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          <button
            type="button"
            onClick={() => setDataTab("requests")}
            className={`px-3 py-1.5 text-12 border-b-2 transition-colors ${
              dataTab === "requests"
                ? "border-cyan text-cyan font-semibold"
                : "border-transparent text-subtext hover:text-text"
            }`}
          >
            Requests ({collection.requests.length})
          </button>
          <button
            type="button"
            onClick={() => setDataTab("data")}
            className={`px-3 py-1.5 text-12 border-b-2 transition-colors flex items-center gap-1 ${
              dataTab === "data"
                ? "border-cyan text-cyan font-semibold"
                : "border-transparent text-subtext hover:text-text"
            }`}
          >
            <Table size={11} />
            Data{dataRows.length > 0 ? ` (${dataRows.length} rows)` : ""}
          </button>
        </div>

        {/* Data Tab */}
        {dataTab === "data" && !result && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="text-10 text-subtext uppercase tracking-wider">Format</label>
              <button
                type="button"
                onClick={() => setDataType("csv")}
                className={`px-2 py-0.5 text-11 rounded transition-colors ${
                  dataType === "csv" ? "bg-cyan/15 text-cyan" : "text-subtext hover:text-text"
                }`}
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => setDataType("json")}
                className={`px-2 py-0.5 text-11 rounded transition-colors ${
                  dataType === "json" ? "bg-cyan/15 text-cyan" : "text-subtext hover:text-text"
                }`}
              >
                JSON
              </button>
              {dataRows.length > 0 && (
                <span className="text-11 text-teal ml-2">{dataRows.length} rows detected — will run {dataRows.length} iterations</span>
              )}
            </div>
            <textarea
              value={dataText}
              onChange={(e) => setDataText(e.target.value)}
              placeholder={
                dataType === "csv"
                  ? "username,email,role\nalice,alice@test.com,admin\nbob,bob@test.com,user"
                  : '[{"username":"alice","email":"alice@test.com","role":"admin"},{"username":"bob","email":"bob@test.com","role":"user"}]'
              }
              spellCheck={false}
              className="h-[180px] w-full px-3 py-2 bg-surface border border-border rounded-lg font-mono text-11 text-text outline-none resize-none focus:border-cyan"
            />
            {dataError && (
              <div className="text-11 text-danger">{dataError}</div>
            )}
            <div className="text-10 text-subtext">
              Variables are injected as <code className="text-cyan">{"{{variable_name}}"}</code> in your requests. Use <code className="text-cyan">{"{{__row_index}}"}</code> for the current row number.
            </div>
          </div>
        )}

        {/* Request list */}
        {dataTab === "requests" && (
          <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto">
            {collection.requests.map((req) => {
              const a = assertions[req.id] || [];
              const retryCount = retries[req.id] || 0;
              const reqResults = result?.results.filter((r) => r.requestId === req.id) ?? [];
              const hasDataDriven = dataRows.length > 0;
              return (
                <div key={req.id} className="bg-card border border-border rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-12 font-semibold text-text">{req.name}</span>
                    <div className="flex items-center gap-2">
                      {reqResults.length > 0 && !hasDataDriven && (
                        <span className={`text-11 font-bold ${reqResults[0].passed ? "text-teal" : reqResults[0].skipped ? "text-subtext" : "text-danger"}`}>
                          {reqResults[0].skipped ? "SKIP" : reqResults[0].passed ? "PASS" : "FAIL"}
                        </span>
                      )}
                      {reqResults.length > 0 && !hasDataDriven && !reqResults[0].error && (
                        <span className="text-11 text-subtext">
                          {reqResults[0].statusCode} · {reqResults[0].timingMs}ms{(reqResults[0].retries ?? 0) > 0 ? ` (${reqResults[0].retries} retries)` : ""}
                        </span>
                      )}
                      {hasDataDriven && reqResults.length > 0 && (
                        <span className="text-11 text-subtext">
                          {reqResults.filter((r) => r.passed).length}/{reqResults.length} passed
                        </span>
                      )}
                    </div>
                  </div>

                  {reqResults.filter((r) => r.error).map((r, i) => (
                    <div key={i} className="text-11 text-danger break-words">{r.error}</div>
                  ))}
                  {reqResults.flatMap((r) => r.assertionErrors ?? []).map((err, i) => (
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
        )}

        {/* Data-driven results table */}
        {dataTab === "data" && result && dataRows.length > 0 && (
          <div className="max-h-[300px] overflow-y-auto border border-border rounded-lg">
            <table className="w-full text-11">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="px-2 py-1.5 text-left text-subtext font-semibold">Row</th>
                  <th className="px-2 py-1.5 text-left text-subtext font-semibold">Request</th>
                  <th className="px-2 py-1.5 text-left text-subtext font-semibold">Status</th>
                  <th className="px-2 py-1.5 text-left text-subtext font-semibold">Time</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-2 py-1.5 text-text font-mono">{i + 1}</td>
                    <td className="px-2 py-1.5 text-text">{r.requestName}</td>
                    <td className={`px-2 py-1.5 font-bold ${r.passed ? "text-teal" : r.skipped ? "text-subtext" : "text-danger"}`}>
                      {r.skipped ? "SKIP" : r.passed ? "PASS" : "FAIL"}
                    </td>
                    <td className="px-2 py-1.5 text-subtext">{r.statusCode} · {r.timingMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
                disabled={running || (dataTab === "data" && dataRows.length === 0 && dataText.trim() !== "")}
                className="h-[32px] px-4 bg-cyan hover:bg-cyan-hover text-white text-12 font-bold rounded-md disabled:opacity-60 transition-all"
              >
                {running ? "Running…" : dataRows.length > 0 ? `Run ${dataRows.length} iterations` : "Run"}
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
