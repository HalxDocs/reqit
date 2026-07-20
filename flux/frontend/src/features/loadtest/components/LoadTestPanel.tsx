import { useState } from "react";
import { Modal } from "@/shared/components/Modal";
import { RunLoadTest } from "../../../../wailsjs/go/main/App";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { buildPayloadLiteral } from "@/features/request/lib/buildPayload";
import type { models } from "../../../../wailsjs/go/models";
import { useEnvStore } from "@/features/env/stores/useEnvStore";
import { toast } from "@/app/stores/useToastStore";

export function LoadTestPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const resolve = useEnvStore((s) => s.resolve);

  const [vus, setVUs] = useState(5);
  const [durationSec, setDurationSec] = useState(10);
  const [rampUpSec, setRampUpSec] = useState(2);
  const [iterations, setIterations] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<models.LoadTestResult | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const state = useRequestStore.getState();
      const rawPayload = buildPayloadLiteral(state);
      const resolvedPayload = {
        ...rawPayload,
        url: resolve(rawPayload.url),
        body: resolve(rawPayload.body),
        authValue: resolve(rawPayload.authValue),
      } as models.RequestPayload;

      const config: models.LoadTestConfig = {
        request: resolvedPayload,
        vus,
        durationSec,
        rampUpSec,
        iterations,
      } as models.LoadTestConfig;

      const res = await RunLoadTest(config);
      setResult(res);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setRunning(false);
    }
  };

  const fmtPct = (v: number, p: number) => {
    if (v === 0) return "0%";
    return `${Math.round((v / p) * 100)}%`;
  };

  return (
    <Modal open={open} onClose={onClose} title="Load / Performance Test">
      <div className="flex flex-col gap-4 min-w-[480px] max-w-[560px]">
        {/* Config */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-10 text-subtext uppercase tracking-wider">Virtual Users</label>
            <input
              type="number"
              min={1}
              value={vus}
              onChange={(e) => setVUs(Math.max(1, parseInt(e.target.value) || 1))}
              className="h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-10 text-subtext uppercase tracking-wider">Duration (sec)</label>
            <input
              type="number"
              min={1}
              value={durationSec}
              onChange={(e) => setDurationSec(Math.max(1, parseInt(e.target.value) || 1))}
              className="h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-10 text-subtext uppercase tracking-wider">Ramp-up (sec)</label>
            <input
              type="number"
              min={0}
              value={rampUpSec}
              onChange={(e) => setRampUpSec(Math.max(0, parseInt(e.target.value) || 0))}
              className="h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-10 text-subtext uppercase tracking-wider">Iterations (0 = timed)</label>
            <input
              type="number"
              min={0}
              value={iterations}
              onChange={(e) => setIterations(Math.max(0, parseInt(e.target.value) || 0))}
              className="h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan"
            />
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <div className="text-10 text-subtext uppercase tracking-wider">Total</div>
                <div className="text-18 font-bold text-text">{result.totalReqs}</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <div className="text-10 text-subtext uppercase tracking-wider">Passed</div>
                <div className="text-18 font-bold text-teal">{result.passed}</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <div className="text-10 text-subtext uppercase tracking-wider">Failed</div>
                <div className="text-18 font-bold text-danger">{result.failed}</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <div className="text-10 text-subtext uppercase tracking-wider">Duration</div>
                <div className="text-18 font-bold text-text">{result.durationMs}ms</div>
              </div>
            </div>

            {/* Percentiles bar */}
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="text-10 text-subtext uppercase tracking-wider mb-2">Latency</div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-11 text-subtext">Avg</div>
                  <div className="text-14 font-bold text-text">{result.avgTimingMs.toFixed(1)}ms</div>
                </div>
                <div>
                  <div className="text-11 text-subtext">P50</div>
                  <div className="text-14 font-bold text-text">{result.p50TimingMs.toFixed(1)}ms</div>
                </div>
                <div>
                  <div className="text-11 text-subtext">P95</div>
                  <div className="text-14 font-bold text-amber-400">{result.p95TimingMs.toFixed(1)}ms</div>
                </div>
                <div>
                  <div className="text-11 text-subtext">P99</div>
                  <div className="text-14 font-bold text-danger">{result.p99TimingMs.toFixed(1)}ms</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-[32px] px-3 text-12 text-subtext hover:text-text rounded-md transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="h-[32px] px-4 bg-cyan hover:bg-cyan-hover text-white text-12 font-bold rounded-md disabled:opacity-60 transition-all"
          >
            {running ? "Running…" : "Run"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
