import { useState, useEffect } from "react";
import { useUIStore } from "@/app/stores/useUIStore";
import { toast } from "@/app/stores/useToastStore";
import { Button } from "@/shared/components/Button";
import {
  GetGitStatus, GitStash, GitPopStash, GetGitStashList,
  GitMergeBranch, GetGitDiff, GetBranches, SwitchBranch, CreateBranch,
  GetGitDiffContent, GetGitConflictFiles, GitResolveConflictOurs, GitResolveConflictTheirs,
} from "../../../../wailsjs/go/main/App";
import type { git } from "../../../../wailsjs/go/models";
import { GitPullRequest, FileCode2, AlertTriangle, Check, X, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";

type PanelTab = "changes" | "conflicts";

export function PRPreviewPanel() {
  const setView = useUIStore((s) => s.setView);
  const [tab, setTab] = useState<PanelTab>("changes");
  const [status, setStatus] = useState({ initialised: false, hasChanges: false, currentBranch: "", remoteUrl: "" });
  const [branches, setBranches] = useState<string[]>([]);
  const [stashes, setStashes] = useState<git.StashEntry[]>([]);
  const [diff, setDiff] = useState<git.DiffEntry[]>([]);
  const [diffContent, setDiffContent] = useState<Record<string, string>>({});
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set());
  const [conflictFiles, setConflictFiles] = useState<string[]>([]);
  const [targetBranch, setTargetBranch] = useState("");
  const [newBranch, setNewBranch] = useState("");

  const refresh = async () => {
    try { setStatus(await GetGitStatus()); } catch {}
    try { setBranches(await GetBranches()); } catch {}
    try { setStashes(await GetGitStashList()); } catch {}
  };
  useEffect(() => { refresh(); }, []);

  const loadDiff = async () => {
    try { setDiff(await GetGitDiff("", "")); } catch { setDiff([]); }
  };

  const handleStash = async () => {
    if (!confirm("Stash current changes?")) return;
    try { await GitStash(); } catch (e) { toast.error(`Stash failed: ${e}`); }
    refresh();
  };
  const handlePop = async () => {
    if (!confirm("Pop latest stash? This may cause conflicts.")) return;
    try { await GitPopStash(); } catch (e) { toast.error(`Pop failed: ${e}`); }
    refresh();
  };

  const handleMerge = async () => {
    if (!targetBranch) return;
    if (!confirm(`Merge ${targetBranch} into current branch?`)) return;
    try { await GitMergeBranch(targetBranch); } catch (e) { toast.error(`Merge failed: ${e}`); }
    refresh();
    try { setConflictFiles(await GetGitConflictFiles() || []); } catch {}
  };

  const handleSwitch = async (branch: string) => {
    try { await SwitchBranch(branch); } catch (e) { toast.error(`Switch failed: ${e}`); }
    refresh();
  };
  const handleCreateBranch = async () => {
    if (!newBranch) return;
    try { await CreateBranch(newBranch); } catch (e) { toast.error(`Create branch failed: ${e}`); }
    setNewBranch("");
    refresh();
  };

  const toggleFile = async (path: string) => {
    const next = new Set(openFiles);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
      if (!diffContent[path]) {
        try {
          const raw = await GetGitDiffContent(path);
          setDiffContent((prev) => ({ ...prev, [path]: raw }));
        } catch (e) { toast.error(`Failed to load diff: ${e}`); }
      }
    }
    setOpenFiles(next);
  };

  const handleResolveOurs = async (path: string) => {
    if (!confirm(`Use OURS version for ${path}?`)) return;
    try { await GitResolveConflictOurs(path); } catch (e) { toast.error(`Resolve failed: ${e}`); }
    try { setConflictFiles(await GetGitConflictFiles() || []); } catch {}
  };

  const handleResolveTheirs = async (path: string) => {
    if (!confirm(`Use THEIRS version for ${path}?`)) return;
    try { await GitResolveConflictTheirs(path); } catch (e) { toast.error(`Resolve failed: ${e}`); }
    try { setConflictFiles(await GetGitConflictFiles() || []); } catch {}
  };

  if (!status.initialised) {
    return (
      <div className="flex-1 flex flex-col min-w-0 bg-bg">
        <header className="h-[48px] flex items-center gap-3 px-4 border-b border-border shrink-0">
          <button onClick={() => setView("http")} className="text-subtext hover:text-text text-13">&larr; Back</button>
          <h1 className="text-14 font-semibold text-text">Git &amp; PR Preview</h1>
        </header>
        <div className="p-6 text-13 text-subtext">Git not initialised. Set up Git in the Team panel first.</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg">
      <header className="h-[48px] flex items-center gap-3 px-4 border-b border-border shrink-0">
        <button onClick={() => setView("http")} className="text-subtext hover:text-text text-13">&larr; Back</button>
        <h1 className="text-14 font-semibold text-text">Git &amp; PR Preview</h1>
        <span className="ml-auto flex items-center gap-2 text-12 text-subtext">
          <span className="font-semibold text-text">{status.currentBranch}</span>
          {status.hasChanges && <span className="text-amber-400">(dirty)</span>}
          {conflictFiles.length > 0 && <span className="text-danger flex items-center gap-1"><AlertTriangle size={12} />{conflictFiles.length} conflict{conflictFiles.length > 1 ? "s" : ""}</span>}
        </span>
      </header>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 py-2 border-b border-border shrink-0">
        <button onClick={() => setTab("changes")}
          className={`px-3 py-1.5 text-12 rounded-md transition-colors flex items-center gap-1.5 ${tab === "changes" ? "bg-cyan/10 text-cyan font-semibold" : "text-subtext hover:text-text hover:bg-cardHover"}`}
        ><FileCode2 size={13} /> Changes</button>
        <button onClick={async () => { setTab("conflicts"); try { setConflictFiles(await GetGitConflictFiles() || []); } catch {} }}
          className={`px-3 py-1.5 text-12 rounded-md transition-colors flex items-center gap-1.5 ${tab === "conflicts" ? "bg-cyan/10 text-cyan font-semibold" : "text-subtext hover:text-text hover:bg-cardHover"}`}
        ><AlertTriangle size={13} /> Conflicts {conflictFiles.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-danger/15 text-danger text-10">{conflictFiles.length}</span>}</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Branch management */}
        <section>
          <h2 className="text-13 font-semibold text-text mb-2">Branches</h2>
          <div className="flex flex-wrap gap-2 mb-2">
            {branches.map((b) => (
              <button key={b} onClick={() => handleSwitch(b)}
                className={cn(
                  "px-2.5 py-1 text-12 rounded-md border transition-colors",
                  b === status.currentBranch
                    ? "bg-cyan/10 border-cyan/30 text-cyan font-semibold"
                    : "bg-surface border-border text-subtext hover:text-text hover:border-cyan/30",
                )}
              >{b}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newBranch} onChange={(e) => setNewBranch(e.target.value)}
              placeholder="New branch name"
              className="flex-1 px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text outline-none focus:border-cyan transition-colors" />
            <Button onClick={handleCreateBranch}>Create &amp; Switch</Button>
          </div>
        </section>

        {/* Stash */}
        <section>
          <h2 className="text-13 font-semibold text-text mb-2">Stash</h2>
          <div className="flex gap-2 mb-2">
            <Button onClick={handleStash}>Stash Changes</Button>
            <Button onClick={handlePop}>Pop Stash</Button>
          </div>
          {stashes.length > 0 && (
            <div className="space-y-1">
              {stashes.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-12 text-subtext bg-surface px-3 py-1.5 rounded-lg">
                  <span className="font-mono text-cyan">{s.ref}</span>
                  <span className="truncate flex-1">{s.message}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Merge */}
        <section>
          <h2 className="text-13 font-semibold text-text mb-2">Merge Branch</h2>
          <div className="flex gap-2">
            <select value={targetBranch} onChange={(e) => setTargetBranch(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text outline-none focus:border-cyan transition-colors">
              <option value="">Select branch to merge into current</option>
              {branches.filter((b) => b !== status.currentBranch).map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <Button onClick={handleMerge}>Merge</Button>
          </div>
        </section>

        {tab === "changes" && (
          <section>
            <h2 className="text-13 font-semibold text-text mb-2">Working Tree Diff</h2>
            <Button onClick={loadDiff}>Show Changes</Button>
            {diff.length > 0 && (
              <div className="mt-3 space-y-1">
                {diff.map((d, i) => (
                  <div key={i}>
                    <button onClick={() => toggleFile(d.path)}
                      className="w-full flex items-center gap-3 text-12 bg-surface px-3 py-1.5 rounded-lg hover:bg-cardHover transition-colors text-left"
                    >
                      {openFiles.has(d.path) ? <ChevronDown size={12} className="text-subtext shrink-0" /> : <ChevronRight size={12} className="text-subtext shrink-0" />}
                      <span className="text-text truncate flex-1">{d.path}</span>
                      {d.added > 0 && <span className="text-green-500 font-medium">+{d.added}</span>}
                      {d.deleted > 0 && <span className="text-red-500 font-medium">-{d.deleted}</span>}
                    </button>
                    {openFiles.has(d.path) && diffContent[d.path] && (
                      <DiffViewer diffText={diffContent[d.path]} />
                    )}
                    {openFiles.has(d.path) && !diffContent[d.path] && (
                      <div className="px-3 py-2 text-11 text-subtext">No diff content available</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "conflicts" && (
          <section>
            <h2 className="text-13 font-semibold text-text mb-2 flex items-center gap-2">
              <AlertTriangle size={14} className="text-danger" />
              Merge Conflicts
            </h2>
            {conflictFiles.length === 0 ? (
              <p className="text-12 text-subtext">No conflicts detected.</p>
            ) : (
              <div className="space-y-2">
                {conflictFiles.map((path) => (
                  <div key={path} className="rounded-lg border border-danger/30 bg-danger/5 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-13 font-semibold text-text">{path}</span>
                      <span className="text-11 text-danger flex items-center gap-1"><AlertTriangle size={11} /> Conflict</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleResolveOurs(path)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface border border-border text-12 text-text hover:bg-cardHover transition-colors"
                      ><Check size={12} className="text-green-400" /> Use Ours</button>
                      <button onClick={() => handleResolveTheirs(path)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface border border-border text-12 text-text hover:bg-cardHover transition-colors"
                      ><Check size={12} className="text-blue-400" /> Use Theirs</button>
                    </div>
                    <ConflictMarkerPreview path={path} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

/* Visual diff viewer — parses unified diff format and colorizes */
function DiffViewer({ diffText }: { diffText: string }) {
  const lines = diffText.split("\n");
  const hunks: { lines: { text: string; type: "add" | "del" | "ctx" | "header" }[] }[] = [];
  let currentHunk: typeof hunks[0] | null = null;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      if (currentHunk) hunks.push(currentHunk);
      currentHunk = { lines: [{ text: line, type: "header" }] };
    } else if (line.startsWith("+")) {
      if (currentHunk) currentHunk.lines.push({ text: line, type: "add" });
    } else if (line.startsWith("-")) {
      if (currentHunk) currentHunk.lines.push({ text: line, type: "del" });
    } else if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("diff")) {
      // skip headers
    } else {
      if (currentHunk) currentHunk.lines.push({ text: line, type: "ctx" });
    }
  }
  if (currentHunk) hunks.push(currentHunk);

  return (
    <div className="border border-border/50 rounded-md overflow-hidden mt-1">
      {hunks.map((hunk, i) => (
        <div key={i}>
          {hunk.lines.map((l, j) => (
            <div key={j} className={cn(
              "flex font-mono text-11 leading-[18px] px-3",
              l.type === "add" ? "bg-green-500/10 text-green-300" :
              l.type === "del" ? "bg-red-500/10 text-red-300" :
              l.type === "header" ? "bg-cyan/8 text-cyan/70" :
              "text-text/80",
            )}>
              <span className="w-4 shrink-0 text-center text-subtext/40 select-none">
                {l.type === "add" ? "+" : l.type === "del" ? "-" : " "}
              </span>
              <span className="whitespace-pre flex-1 min-w-0">{l.text}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* Conflict marker preview — shows <<< === >>> markers */
function ConflictMarkerPreview({ path }: { path: string }) {
  return (
    <div className="mt-2 rounded border border-border/50 bg-bg p-2 font-mono text-11 text-text/70">
      <div className="text-red-400">&lt;&lt;&lt;&lt;&lt;&lt;&lt; Ours</div>
      <div className="pl-3 text-text/50">// changes from current branch</div>
      <div className="text-subtext/50">=======</div>
      <div className="pl-3 text-text/50">// changes from merged branch</div>
      <div className="text-blue-400">&gt;&gt;&gt;&gt;&gt;&gt;&gt; Theirs</div>
      <div className="mt-1 text-11 text-subtext">Use the buttons above to resolve with Ours or Theirs version.</div>
    </div>
  );
}
