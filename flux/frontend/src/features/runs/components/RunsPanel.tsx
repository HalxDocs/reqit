import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Hash,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { PanelHeader } from "@/shared/components/PanelHeader";
import { cn } from "@/shared/lib/cn";
import {
  formatRunTime,
  listRuns,
  runKind,
  runTimingMs,
  truncateURL,
  verifyRuns,
  type RunHeader,
  type RunReceipt,
  type RunVerifyReport,
} from "@/features/runs/lib/runsApi";

const KIND_LABEL: Record<string, string> = {
  run: "run",
  loadtest: "load test",
};

function statusTone(r: RunReceipt): string {
  if (r.response?.error || r.response?.statusCode === 0) return "text-danger";
  const code = r.response?.statusCode ?? 0;
  if (code >= 500) return "text-danger";
  if (code >= 400) return "text-warn";
  if (code >= 200 && code < 300) return "text-success";
  return "text-subtext";
}

function statusText(r: RunReceipt): string {
  if (r.kind === "loadtest") return "summary";
  if (r.response?.error) return "error";
  return r.response?.statusCode ? String(r.response.statusCode) : "—";
}

function HeadersTable({ rows }: { rows?: RunHeader[] | null }) {
  if (!rows || rows.length === 0) return <p className="text-12 text-subtext">None.</p>;
  return (
    <div className="divide-y divide-border/60 rounded-md border border-border overflow-hidden">
      {rows.map((h, i) => (
        <div key={`${h.name}-${i}`} className="grid grid-cols-[180px_1fr] gap-3 px-3 py-1.5 text-11">
          <span className="font-mono text-subtext truncate">{h.name}</span>
          {h.redacted || !h.value ? (
            <span className="text-subtext/60 italic">redacted</span>
          ) : (
            <span className="font-mono text-text break-all">{h.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-10 font-bold uppercase tracking-wider text-subtext/60">{title}</h3>
      {children}
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 text-12">
      <span className="text-subtext">{label}</span>
      <span className="text-text break-all">{value}</span>
    </div>
  );
}

function LoadTestSummary({ r }: { r: RunReceipt }) {
  const lt = r.loadTest;
  if (!lt) return null;
  return (
    <div className="rounded-lg border border-border bg-surface/50 p-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-12">
        <span className="text-text font-semibold">{lt.totalReqs} requests</span>
        <span className="text-success">{lt.passed} passed</span>
        <span className={lt.failed ? "text-danger" : "text-subtext"}>{lt.failed} failed</span>
        <span className="text-subtext">{lt.vus} VUs</span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          ["avg", lt.avgMs],
          ["p50", lt.p50Ms],
          ["p95", lt.p95Ms],
          ["p99", lt.p99Ms],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md bg-bg border border-border/60 py-1.5">
            <div className="text-10 text-subtext uppercase">{label}</div>
            <div className="text-12 text-text font-mono">{Math.round(Number(value))}ms</div>
          </div>
        ))}
      </div>
      {lt.error && <p className="text-11 text-danger">{lt.error}</p>}
    </div>
  );
}

function ReceiptDetail({ r }: { r: RunReceipt }) {
  const [copied, setCopied] = useState(false);

  const copyID = async () => {
    try {
      await navigator.clipboard.writeText(r.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const total = runTimingMs(r);
  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-4 flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-11 px-1.5 py-0.5 rounded bg-cyan/10 text-cyan border border-cyan/20">
              {KIND_LABEL[runKind(r)] ?? runKind(r)}
            </span>
            <span className="text-11 text-subtext">{r.source}</span>
            {r.environment && <span className="text-11 text-subtext">· {r.environment}</span>}
          </div>
          <div className="mt-1 text-13 font-semibold text-text font-mono break-all">
            {r.request.method} {r.request.url}
          </div>
          <div className="mt-1 text-11 text-subtext">{formatRunTime(r.time)}</div>
        </div>
        <button
          type="button"
          onClick={copyID}
          className="h-[28px] px-2.5 text-11 rounded-md bg-surface border border-border text-subtext hover:text-text flex items-center gap-1.5 shrink-0"
          title="Copy receipt ID"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy ID"}
        </button>
      </div>

      {r.kind === "loadtest" ? (
        <Section title="Load test">
          <LoadTestSummary r={r} />
        </Section>
      ) : (
        <Section title="Response">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-12">
            <span className={cn("font-semibold", statusTone(r))}>{r.response.status || statusText(r)}</span>
            <span className="text-subtext flex items-center gap-1">
              <Clock size={12} /> {total}ms
            </span>
            <span className="text-subtext">{r.response.bodyBytes ?? 0} bytes</span>
            {r.response.cookies ? <span className="text-subtext">{r.response.cookies} cookies</span> : null}
          </div>
          {r.response.error && <p className="text-12 text-danger">{r.response.error}</p>}
          <KeyValue
            label="Body hash"
            value={<span className="font-mono text-11">{r.response.bodySha256 || "—"}</span>}
          />
        </Section>
      )}

      <Section title="Request as written">
        <KeyValue label="Method" value={r.request.method} />
        <KeyValue label="URL" value={<span className="font-mono text-11">{r.request.url}</span>} />
        {r.request.authType && <KeyValue label="Auth" value={r.request.authType} />}
        {r.request.bodyBytes ? (
          <KeyValue
            label="Body"
            value={
              <span className="font-mono text-11">
                {r.request.bodyBytes} bytes · {r.request.bodySha256 || "hashed"}
              </span>
            }
          />
        ) : null}
      </Section>

      <Section title="Headers">
        <HeadersTable rows={r.request.headers} />
      </Section>

      <Section title="Query parameters">
        <HeadersTable rows={r.request.params} />
      </Section>

      {r.resolution && r.resolution.length > 0 && (
        <Section title="Variables">
          <div className="flex flex-col gap-1">
            {r.resolution.map((v) => (
              <div key={v.name} className="flex items-center gap-2 text-12">
                <span className="font-mono text-cyan">{`{{${v.name}}}`}</span>
                <span className="text-subtext">from {v.source}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {r.validation && (
        <Section title="Contract validation">
          <div className="flex items-center gap-2 text-12">
            {r.validation.valid ? (
              <>
                <CheckCircle2 size={14} className="text-success" />
                <span className="text-success">Valid</span>
              </>
            ) : (
              <>
                <AlertTriangle size={14} className="text-warn" />
                <span className="text-warn">Issues found</span>
              </>
            )}
            {r.validation.skipReason && <span className="text-subtext">· {r.validation.skipReason}</span>}
          </div>
          {r.validation.errors?.map((e, i) => (
            <p key={i} className="text-11 text-warn font-mono">
              {e.layer ? `${e.layer}: ` : ""}
              {e.field ? `${e.field} — ` : ""}
              {e.message}
            </p>
          ))}
        </Section>
      )}

      <Section title="Chain">
        <KeyValue label="Receipt" value={<span className="font-mono text-11">{r.id}</span>} />
        <KeyValue label="Hash" value={<span className="font-mono text-11">{r.hash || "—"}</span>} />
        <KeyValue label="Prev hash" value={<span className="font-mono text-11">{r.prevHash || "—"}</span>} />
        <KeyValue
          label="Signature"
          value={
            r.signature ? (
              <span className="flex items-center gap-1.5 font-mono text-11 text-success">
                <ShieldCheck size={12} /> signed ({r.keyId})
              </span>
            ) : (
              <span className="text-subtext text-11">unsigned — this machine has no signing key</span>
            )
          }
        />
      </Section>
    </div>
  );
}

export function RunsPanel() {
  const [runs, setRuns] = useState<RunReceipt[]>([]);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<RunVerifyReport | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await listRuns();
      setRuns(next);
      setSelectedID((current) => {
        if (current && next.some((r) => r.id === current)) return current;
        return next[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const verify = useCallback(async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const next = await verifyRuns();
      if (!next) {
        setVerifyError("Run verification is only available in the desktop app.");
      } else {
        setReport(next);
      }
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : String(e));
    } finally {
      setVerifying(false);
    }
  }, []);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter((r) =>
      [r.id, r.request.url, r.request.method, r.source, runKind(r), r.response?.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [runs, filter]);

  const selected = useMemo(() => runs.find((r) => r.id === selectedID) ?? null, [runs, selectedID]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg">
      <PanelHeader
        title="Run Receipts"
        statusDot={report ? "green" : "gray"}
        actions={
          <>
            <button
              type="button"
              onClick={verify}
              disabled={verifying}
              className="h-[28px] px-3 text-xs rounded-md bg-surface border border-border text-subtext hover:text-text flex items-center gap-1.5 disabled:opacity-50"
            >
              {verifying ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
              Verify
            </button>
            <button
              type="button"
              onClick={refresh}
              className="h-[28px] px-3 text-xs rounded-md bg-surface border border-border text-subtext hover:text-text flex items-center gap-1.5"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </>
        }
      />

      <div className="px-4 py-2 border-b border-border flex items-center gap-3 shrink-0">
        <div className="relative flex-1 max-w-[360px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtext" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by URL, method, status or ID"
            className="w-full h-[30px] pl-8 pr-3 text-11 bg-surface border border-border rounded-md text-text placeholder:text-subtext/60 outline-none focus:border-cyan/40"
          />
        </div>
        <span className="text-11 text-subtext">
          {runs.length} receipt{runs.length === 1 ? "" : "s"}
        </span>
        {report && (
          <span className="text-11 text-success flex items-center gap-1">
            <ShieldCheck size={12} />
            {report.Checked} verified
            {report.Unsigned > 0 ? ` · ${report.Unsigned} unsigned` : ""}
          </span>
        )}
        {verifyError && <span className="text-11 text-danger truncate max-w-[380px]">{verifyError}</span>}
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-[340px] xl:w-[400px] shrink-0 border-r border-border overflow-y-auto">
          {loading ? (
            <div className="p-4 flex items-center gap-2 text-12 text-subtext">
              <Loader2 size={13} className="animate-spin" /> Loading receipts…
            </div>
          ) : error ? (
            <div className="p-4 flex items-start gap-2 text-12 text-danger">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {error}
            </div>
          ) : visible.length === 0 ? (
            <div className="p-5 text-12 text-subtext leading-relaxed">
              {runs.length === 0 ? (
                <>
                  No runs recorded in this workspace yet. Send a request and the receipt will appear here.
                  <div className="mt-2 text-11 text-subtext/70">
                    Receipts live in <span className="font-mono">.reqit/runs/</span> and can also be read with{" "}
                    <span className="font-mono">reqit runs list</span>.
                  </div>
                </>
              ) : (
                "No receipt matches this filter."
              )}
            </div>
          ) : (
            visible.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedID(r.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 border-b border-border/60 transition-colors",
                  selectedID === r.id ? "bg-cyan/10 border-l-2 border-l-cyan" : "hover:bg-cardHover",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-10 font-semibold text-cyan uppercase">{r.request.method || "—"}</span>
                  <span className={cn("text-11 font-mono", statusTone(r))}>{statusText(r)}</span>
                  <span className="ml-auto text-10 text-subtext">{runTimingMs(r)}ms</span>
                </div>
                <div className="mt-0.5 text-11 text-text truncate" title={r.request.url}>
                  {truncateURL(r.request.url, 56)}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-10 text-subtext">
                  <span>{KIND_LABEL[runKind(r)] ?? runKind(r)}</span>
                  <span>·</span>
                  <span>{r.source}</span>
                  <span className="ml-auto">{formatRunTime(r.time)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {selected ? (
          <ReceiptDetail r={selected} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-subtext">
            <Hash size={22} />
            <p className="text-12">Select a receipt to inspect it.</p>
          </div>
        )}
      </div>
    </div>
  );
}
