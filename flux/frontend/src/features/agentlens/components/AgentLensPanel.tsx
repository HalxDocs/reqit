import { useState, useEffect, useCallback } from "react";
import { ScanEye, RefreshCw, ChevronRight, AlertTriangle, AlertCircle, Info, Check, Zap, Play, Download, FolderOpen, Clock, Target } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { toast } from "@/app/stores/useToastStore";

interface LintResult {
  ruleId: string;
  ruleName: string;
  severity: "error" | "warning" | "info";
  message: string;
  fixSuggestion: string;
}

interface ToolScore {
  toolName: string;
  requestId: string;
  score: number;
  results: LintResult[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

interface CollectionScore {
  score: number;
  toolCount: number;
  exposedCount: number;
  tools: ToolScore[];
  errors: number;
  warnings: number;
  infos: number;
}

interface EvalRunResult {
  taskIndex: number;
  prompt: string;
  expectTool: string;
  actualTool: string;
  toolMatch: boolean;
  argsMatch: boolean;
  passed: boolean;
  latencyMs: number;
  error: string;
}

interface EvalTaskResult {
  taskIndex: number;
  prompt: string;
  runs: EvalRunResult[];
  passRate: number;
  passed: boolean;
}

interface EvalSuiteResult {
  provider: string;
  model: string;
  tasks: EvalTaskResult[];
  totalRuns: number;
  totalPassed: number;
  passRate: number;
  score: number;
  startedAt: string;
  finishedAt: string;
}

interface ExportResult {
  outputDir: string;
  files: string[];
  tools: number;
}

interface Collection {
  id: string;
  name: string;
  requests: any[];
}

type Tab = "lint" | "eval" | "export";

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 90 ? "text-green-400 bg-green-400/10 border-green-400/20" :
    score >= 70 ? "text-amber-400 bg-amber-400/10 border-amber-400/20" :
    "text-red-400 bg-red-400/10 border-red-400/20";

  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full border", color)}>
      {score >= 90 ? <Check size={10} /> : score >= 70 ? <AlertTriangle size={10} /> : <AlertCircle size={10} />}
      {score}/100
    </span>
  );
}

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case "error": return <AlertCircle size={12} className="text-red-400 shrink-0" />;
    case "warning": return <AlertTriangle size={12} className="text-amber-400 shrink-0" />;
    default: return <Info size={12} className="text-blue-400 shrink-0" />;
  }
}

function PassFailBadge({ passed }: { passed: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full border",
      passed
        ? "text-green-400 bg-green-400/10 border-green-400/20"
        : "text-red-400 bg-red-400/10 border-red-400/20"
    )}>
      {passed ? <Check size={10} /> : <AlertCircle size={10} />}
      {passed ? "PASS" : "FAIL"}
    </span>
  );
}

export function AgentLensPanel() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedColl, setSelectedColl] = useState<string>("");
  const [score, setScore] = useState<CollectionScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [tab, setTab] = useState<Tab>("lint");

  // Eval state
  const [evalResult, setEvalResult] = useState<EvalSuiteResult | null>(null);
  const [evalRunning, setEvalRunning] = useState(false);

  // Export state
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadCollections = useCallback(async () => {
    try {
      const { GetCollections } = await import("../../../../wailsjs/go/main/App");
      const colls = await GetCollections();
      setCollections(colls || []);
      if (colls?.length > 0 && !selectedColl) {
        setSelectedColl(colls[0].id);
      }
    } catch (e) {
      console.warn("AgentLens: could not load collections:", e);
    }
  }, [selectedColl]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const analyze = async () => {
    if (!selectedColl) return;
    setAnalyzing(true);
    try {
      const { AnalyzeCollectionAgentLens } = await import("../../../../wailsjs/go/main/App");
      const result = await AnalyzeCollectionAgentLens(selectedColl);
      setScore(result as unknown as CollectionScore);
    } catch (e: any) {
      toast.error(`Analysis failed: ${e?.message || e}`);
    }
    setAnalyzing(false);
  };

  const analyzeAll = async () => {
    setAnalyzing(true);
    try {
      const { AnalyzeAllCollectionsAgentLens } = await import("../../../../wailsjs/go/main/App");
      const result = await AnalyzeAllCollectionsAgentLens();
      setScore(result as unknown as CollectionScore);
    } catch (e: any) {
      toast.error(`Analysis failed: ${e?.message || e}`);
    }
    setAnalyzing(false);
  };

  const runEval = async () => {
    setEvalRunning(true);
    try {
      const { RunEvalAgentLens } = await import("../../../../wailsjs/go/main/App");
      const result = await RunEvalAgentLens();
      setEvalResult(result as unknown as EvalSuiteResult);
      toast.success(`Eval complete: ${result.totalPassed}/${result.totalRuns} passed`);
    } catch (e: any) {
      toast.error(`Eval failed: ${e?.message || e}`);
    }
    setEvalRunning(false);
  };

  const exportMCP = async () => {
    setExporting(true);
    try {
      const { ExportMCPServerAgentLens } = await import("../../../../wailsjs/go/main/App");
      const result = await ExportMCPServerAgentLens();
      setExportResult(result as unknown as ExportResult);
      toast.success(`MCP server exported to ${result.outputDir}`);
    } catch (e: any) {
      toast.error(`Export failed: ${e?.message || e}`);
    }
    setExporting(false);
  };

  const selectedCollName = collections.find((c) => c.id === selectedColl)?.name || "";

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanEye size={16} className="text-cyan" />
            <h2 className="text-sm font-bold text-text">Agent Lens</h2>
            <span className="text-[10px] text-subtext bg-surface px-1.5 py-0.5 rounded font-mono">M1-M3</span>
          </div>
          <div className="flex items-center gap-1">
            {(["lint", "eval", "export"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "h-[28px] px-3 text-xs font-bold rounded-md transition-all",
                  tab === t
                    ? "bg-cyan text-white"
                    : "bg-surface border border-border text-subtext hover:text-text hover:border-cyan/40"
                )}
              >
                {t === "lint" ? "Lint" : t === "eval" ? "Eval" : "Export"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lint Tab */}
      {tab === "lint" && (
        <div className="flex-1 flex min-h-0">
          {/* Toolbar */}
          <div className="shrink-0 px-4 py-2 border-b border-border bg-card/50 flex items-center gap-2 w-full absolute right-0" style={{ display: 'none' }} />

          {/* Left: Tool List */}
          <div className="w-[280px] shrink-0 border-r border-border flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-border">
              <div className="text-[10px] font-semibold text-subtext uppercase tracking-wider">Tools</div>
              {score && (
                <div className="flex items-center gap-2 mt-1">
                  <ScoreBadge score={score.score} />
                  <span className="text-[10px] text-subtext">
                    {score.exposedCount} exposed / {score.toolCount} total
                  </span>
                </div>
              )}
            </div>
            <div className="px-3 py-2 border-b border-border flex items-center gap-2">
              <select
                value={selectedColl}
                onChange={(e) => setSelectedColl(e.target.value)}
                className="flex-1 h-[28px] px-2 text-xs bg-surface border border-border rounded text-text outline-none focus:border-cyan"
              >
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.requests?.length || 0})</option>
                ))}
              </select>
              <button
                onClick={analyze}
                disabled={analyzing || !selectedColl}
                className="h-[28px] px-3 text-xs font-bold rounded-md bg-cyan text-white hover:bg-cyan-hover transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {analyzing ? <RefreshCw size={10} className="animate-spin" /> : <Zap size={10} />}
                Analyze
              </button>
              <button
                onClick={analyzeAll}
                disabled={analyzing || collections.length === 0}
                className="h-[28px] px-3 text-xs font-bold rounded-md bg-surface border border-border text-subtext hover:text-text hover:border-cyan/40 transition-all disabled:opacity-50"
              >
                All
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!score && (
                <div className="p-4 text-center text-xs text-subtext">
                  Select a collection and click <span className="text-cyan font-semibold">Analyze</span> to score your API's agent-readiness.
                </div>
              )}
              {score?.tools.map((tool) => (
                <div
                  key={tool.requestId}
                  className="px-3 py-2 border-b border-border hover:bg-surface/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ScoreBadge score={tool.score} />
                    <span className="text-xs text-text font-mono truncate">{tool.toolName}</span>
                  </div>
                  {(tool.errorCount > 0 || tool.warningCount > 0) && (
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-subtext">
                      {tool.errorCount > 0 && <span className="text-red-400">{tool.errorCount} errors</span>}
                      {tool.warningCount > 0 && <span className="text-amber-400">{tool.warningCount} warnings</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Results */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {!score && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                <div className="w-16 h-16 rounded-2xl bg-cyan/10 border border-cyan/20 flex items-center justify-center">
                  <ScanEye size={32} className="text-cyan" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">Agent Lens</h3>
                  <p className="text-xs text-subtext max-w-sm leading-relaxed">
                    Score how well an AI agent will understand your API as tools.
                    Detects confusing names, missing descriptions, near-duplicates, and more.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] text-subtext max-w-md">
                  {["R1: Description Quality", "R2: Parameter Coverage", "R3: Naming Limits", "R4: Near-Duplicates", "R5: Destructive Tagging"].map((r) => (
                    <span key={r} className="px-2 py-0.5 rounded-full border border-border bg-surface">{r}</span>
                  ))}
                </div>
              </div>
            )}

            {score && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Score", value: `${score.score}/100`, color: score.score >= 90 ? "text-green-400" : score.score >= 70 ? "text-amber-400" : "text-red-400" },
                    { label: "Tools", value: score.exposedCount, color: "text-cyan" },
                    { label: "Errors", value: score.errors, color: "text-red-400" },
                    { label: "Warnings", value: score.warnings, color: "text-amber-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="p-3 rounded-lg border border-border bg-surface">
                      <div className={`text-lg font-bold ${color}`}>{value}</div>
                      <div className="text-[10px] text-subtext">{label}</div>
                    </div>
                  ))}
                </div>

                {score.tools.map((tool) => (
                  <div key={tool.requestId} className="rounded-xl border border-border bg-card/50 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface/30">
                      <ScoreBadge score={tool.score} />
                      <span className="text-sm font-mono font-semibold text-text">{tool.toolName}</span>
                      {tool.errorCount > 0 && (
                        <span className="text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full">{tool.errorCount} errors</span>
                      )}
                      {tool.warningCount > 0 && (
                        <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">{tool.warningCount} warnings</span>
                      )}
                    </div>
                    {tool.results.length > 0 ? (
                      <div className="divide-y divide-border">
                        {tool.results.map((r, i) => (
                          <div key={i} className="px-4 py-2.5 flex items-start gap-2.5">
                            <SeverityIcon severity={r.severity} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-subtext">{r.ruleId}</span>
                                <span className="text-xs text-text">{r.message}</span>
                              </div>
                              {r.fixSuggestion && (
                                <div className="text-[10px] text-cyan mt-0.5">{r.fixSuggestion}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-3 text-xs text-green-400 flex items-center gap-1.5">
                        <Check size={12} /> All checks passed
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Eval Tab */}
      {tab === "eval" && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="shrink-0 px-4 py-3 border-b border-border bg-card/50 flex items-center justify-between">
            <div className="text-xs text-subtext">
              Sends test prompts to your AI provider and checks if the right tool is called.
            </div>
            <button
              onClick={runEval}
              disabled={evalRunning}
              className="h-[28px] px-3 text-xs font-bold rounded-md bg-cyan text-white hover:bg-cyan-hover transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {evalRunning ? <RefreshCw size={10} className="animate-spin" /> : <Play size={10} />}
              {evalRunning ? "Running..." : "Run Eval"}
            </button>
          </div>

          {!evalResult && !evalRunning && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-cyan/10 border border-cyan/20 flex items-center justify-center">
                <Target size={32} className="text-cyan" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text mb-1">Eval Runner</h3>
                <p className="text-xs text-subtext max-w-sm leading-relaxed">
                  Run your eval suite (suite.yaml) against your configured AI provider.
                  Each task sends a prompt and checks if the correct tool is called.
                </p>
              </div>
              <div className="text-[10px] text-subtext bg-surface px-3 py-1.5 rounded-lg border border-border">
                Add tasks in <span className="font-mono text-cyan">.reqit/agent-lens/suite.yaml</span>
              </div>
            </div>
          )}

          {evalRunning && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <RefreshCw size={24} className="text-cyan animate-spin" />
              <div className="text-xs text-subtext">Running eval tasks...</div>
            </div>
          )}

          {evalResult && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Score", value: `${evalResult.score}/100`, color: evalResult.score >= 90 ? "text-green-400" : evalResult.score >= 70 ? "text-amber-400" : "text-red-400" },
                  { label: "Tasks", value: evalResult.tasks.length, color: "text-cyan" },
                  { label: "Passed", value: evalResult.totalPassed, color: "text-green-400" },
                  { label: "Failed", value: evalResult.totalRuns - evalResult.totalPassed, color: "text-red-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-3 rounded-lg border border-border bg-surface">
                    <div className={`text-lg font-bold ${color}`}>{value}</div>
                    <div className="text-[10px] text-subtext">{label}</div>
                  </div>
                ))}
              </div>

              {evalResult.tasks.map((task) => (
                <div key={task.taskIndex} className="rounded-xl border border-border bg-card/50 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface/30">
                    <PassFailBadge passed={task.passed} />
                    <span className="text-xs text-text flex-1 truncate">{task.prompt}</span>
                    <span className="text-[10px] text-subtext font-mono">{(task.passRate * 100).toFixed(0)}%</span>
                  </div>
                  <div className="divide-y divide-border">
                    {task.runs.map((run, i) => (
                      <div key={i} className="px-4 py-2 flex items-center gap-3 text-xs">
                        <PassFailBadge passed={run.passed} />
                        <span className="text-subtext w-16 shrink-0">#{i + 1}</span>
                        <span className="text-text flex-1">
                          {run.expectTool && (
                            <span className="text-subtext">expected:</span>
                          )} <span className="font-mono">{run.expectTool || "(any)"}</span>
                        </span>
                        <span className="text-text">
                          <span className="text-subtext">got:</span> <span className={cn("font-mono", run.toolMatch ? "text-green-400" : "text-red-400")}>{run.actualTool || "(none)"}</span>
                        </span>
                        <span className="text-subtext font-mono w-16 text-right">{run.latencyMs}ms</span>
                        {run.error && (
                          <span className="text-red-400 text-[10px] truncate max-w-[150px]">{run.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Export Tab */}
      {tab === "export" && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="shrink-0 px-4 py-3 border-b border-border bg-card/50 flex items-center justify-between">
            <div className="text-xs text-subtext">
              Generate a standalone MCP server Go module from your exposed tools.
            </div>
            <button
              onClick={exportMCP}
              disabled={exporting}
              className="h-[28px] px-3 text-xs font-bold rounded-md bg-cyan text-white hover:bg-cyan-hover transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {exporting ? <RefreshCw size={10} className="animate-spin" /> : <Download size={10} />}
              {exporting ? "Exporting..." : "Export MCP Server"}
            </button>
          </div>

          {!exportResult && !exporting && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-cyan/10 border border-cyan/20 flex items-center justify-center">
                <Download size={32} className="text-cyan" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text mb-1">MCP Server Export</h3>
                <p className="text-xs text-subtext max-w-sm leading-relaxed">
                  Export your exposed tools as a standalone Go module implementing the MCP protocol.
                  Run <span className="font-mono text-cyan">go mod tidy</span> and build.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] text-subtext max-w-md">
                {["Hand-rolled JSON-RPC 2.0", "No external dependencies", "stdio transport", "One tool per request"].map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full border border-border bg-surface">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {exporting && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <RefreshCw size={24} className="text-cyan animate-spin" />
              <div className="text-xs text-subtext">Generating MCP server...</div>
            </div>
          )}

          {exportResult && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-border bg-surface">
                  <div className="text-lg font-bold text-cyan">{exportResult.tools}</div>
                  <div className="text-[10px] text-subtext">Tools</div>
                </div>
                <div className="p-3 rounded-lg border border-border bg-surface">
                  <div className="text-lg font-bold text-cyan">{exportResult.files.length}</div>
                  <div className="text-[10px] text-subtext">Files</div>
                </div>
                <div className="p-3 rounded-lg border border-border bg-surface">
                  <div className="text-sm font-bold text-green-400">Ready</div>
                  <div className="text-[10px] text-subtext">Status</div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
                <div className="px-4 py-2 border-b border-border bg-surface/30">
                  <div className="text-[10px] font-semibold text-subtext uppercase tracking-wider">Generated Files</div>
                </div>
                <div className="divide-y divide-border">
                  {exportResult.files.map((f) => (
                    <div key={f} className="px-4 py-2 flex items-center gap-2 text-xs">
                      <FolderOpen size={12} className="text-cyan shrink-0" />
                      <span className="font-mono text-text">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="text-[10px] font-semibold text-subtext uppercase tracking-wider mb-2">Quick Start</div>
                <pre className="text-xs text-text font-mono bg-bg rounded-lg p-3 overflow-x-auto">
{`cd ${exportResult.outputDir}
go mod tidy
go build -o mcp-server .
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | ./mcp-server`}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
