import { useEffect, useState } from "react";
import { GitBranch, GitCommit, RefreshCw, Upload, Settings, ChevronDown, ChevronRight, Plus } from "lucide-react";
import {
  GetGitStatus,
  InitGit,
  CommitAndPush,
  GitPull,
  GetBranches,
  SwitchBranch,
  CreateBranch,
  GetGitLog,
} from "../../../wailsjs/go/main/App";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { useToastStore } from "../../stores/useToastStore";

interface GitStatus {
  initialised: boolean;
  hasChanges: boolean;
  currentBranch: string;
  remoteUrl: string;
}

interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  when: string;
}

export function GitPanel() {
  const toast = useToastStore((s) => s.push);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [log, setLog] = useState<CommitInfo[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showBranches, setShowBranches] = useState(false);
  const [commitMsg, setCommitMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [setupForm, setSetupForm] = useState({ remoteUrl: "", pat: "" });
  const [newBranch, setNewBranch] = useState("");

  const refresh = async () => {
    try {
      const s = await GetGitStatus();
      setStatus(s as GitStatus);
      if ((s as GitStatus).initialised) {
        const b = await GetBranches();
        setBranches(b ?? []);
      }
    } catch {
      // not a git repo yet
    }
  };

  useEffect(() => {
    void refresh();
    const off = EventsOn("git:pull:complete", () => {
      void refresh();
      toast("success", "Workspace updated from remote");
    });
    return () => { if (typeof off === "function") off(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSetup = async () => {
    setLoading(true);
    try {
      await InitGit(setupForm.remoteUrl, setupForm.pat);
      toast("success", "Git initialised");
      setShowSetup(false);
      await refresh();
    } catch (e) {
      toast("error", String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCommitPush = async () => {
    if (!commitMsg.trim()) return;
    setLoading(true);
    try {
      await CommitAndPush(commitMsg.trim());
      toast("success", "Committed and pushed");
      setCommitMsg("");
      await refresh();
    } catch (e) {
      toast("error", String(e));
    } finally {
      setLoading(false);
    }
  };

  const handlePull = async () => {
    setLoading(true);
    try {
      await GitPull();
      toast("success", "Pulled latest changes");
      await refresh();
    } catch (e) {
      toast("error", String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchBranch = async (name: string) => {
    if (name === status?.currentBranch) return;
    try {
      await SwitchBranch(name);
      await refresh();
      toast("success", `Switched to ${name}`);
    } catch (e) {
      toast("error", String(e));
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranch.trim()) return;
    try {
      await CreateBranch(newBranch.trim());
      setNewBranch("");
      await refresh();
      toast("success", `Created branch ${newBranch.trim()}`);
    } catch (e) {
      toast("error", String(e));
    }
  };

  const loadLog = async () => {
    try {
      const entries = await GetGitLog(10);
      setLog(entries ?? []);
    } catch {
      setLog([]);
    }
  };

  const toggleLog = async () => {
    if (!showLog) await loadLog();
    setShowLog((v) => !v);
  };

  return (
    <div className="border-t border-border">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-3 py-2 flex items-center justify-between text-subtext text-11 font-semibold uppercase tracking-wider hover:text-text transition-colors"
      >
        <span className="flex items-center gap-2">
          <GitBranch size={12} />
          <span>Git Sync</span>
          {status?.hasChanges && (
            <span className="w-[6px] h-[6px] rounded-full bg-amber-400 shrink-0" title="Uncommitted changes" />
          )}
        </span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-2">

          {/* Not initialised */}
          {!status?.initialised && !showSetup && (
            <button
              type="button"
              onClick={() => setShowSetup(true)}
              className="w-full text-11 text-blue hover:underline text-left py-1"
            >
              + Connect a Git remote
            </button>
          )}

          {/* Setup form */}
          {showSetup && (
            <div className="flex flex-col gap-1.5">
              <input
                className="w-full h-[28px] px-2 text-11 bg-card border border-border rounded text-text placeholder:text-subtext/50 outline-none focus:border-blue/40"
                placeholder="Remote URL (https://github.com/…)"
                value={setupForm.remoteUrl}
                onChange={(e) => setSetupForm((f) => ({ ...f, remoteUrl: e.target.value }))}
              />
              <input
                type="password"
                className="w-full h-[28px] px-2 text-11 bg-card border border-border rounded text-text placeholder:text-subtext/50 outline-none focus:border-blue/40"
                placeholder="Personal Access Token (PAT)"
                value={setupForm.pat}
                onChange={(e) => setSetupForm((f) => ({ ...f, pat: e.target.value }))}
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleSetup}
                  disabled={loading}
                  className="flex-1 h-[26px] text-11 font-semibold bg-blue text-white rounded hover:bg-blue-hover transition-colors disabled:opacity-50"
                >
                  {loading ? "…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSetup(false)}
                  className="h-[26px] px-2 text-11 text-subtext hover:text-text transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Initialised controls */}
          {status?.initialised && (
            <>
              {/* Branch row */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowBranches((v) => !v)}
                  className="flex items-center gap-1 text-11 text-subtext hover:text-text transition-colors min-w-0"
                >
                  <GitBranch size={11} />
                  <span className="truncate max-w-[110px]">{status.currentBranch || "detached"}</span>
                  <ChevronDown size={10} />
                </button>
                <button
                  type="button"
                  onClick={handlePull}
                  disabled={loading}
                  className="ml-auto flex items-center gap-1 h-[22px] px-2 text-11 text-subtext bg-card border border-border rounded hover:border-blue/40 hover:text-blue transition-all disabled:opacity-50"
                  title="Pull"
                >
                  <RefreshCw size={10} />
                  <span>Pull</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSetup((v) => !v)}
                  className="h-[22px] w-[22px] flex items-center justify-center text-subtext bg-card border border-border rounded hover:border-blue/40 hover:text-blue transition-all"
                  title="Edit remote / PAT"
                >
                  <Settings size={10} />
                </button>
              </div>

              {/* Branch list */}
              {showBranches && (
                <div className="bg-card border border-border rounded overflow-hidden">
                  {branches.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => { void handleSwitchBranch(b); setShowBranches(false); }}
                      className={`w-full text-left px-2 py-1 text-11 flex items-center gap-1.5 hover:bg-cardHover transition-colors ${b === status.currentBranch ? "text-blue" : "text-text"}`}
                    >
                      <GitBranch size={10} />
                      {b}
                    </button>
                  ))}
                  {/* New branch */}
                  <div className="flex items-center gap-1 px-2 py-1 border-t border-border">
                    <input
                      className="flex-1 h-[20px] text-11 bg-transparent text-text placeholder:text-subtext/40 outline-none"
                      placeholder="New branch name…"
                      value={newBranch}
                      onChange={(e) => setNewBranch(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleCreateBranch(); }}
                    />
                    <button type="button" onClick={handleCreateBranch} className="text-subtext hover:text-blue">
                      <Plus size={11} />
                    </button>
                  </div>
                </div>
              )}

              {/* Commit message */}
              <textarea
                className="w-full h-[52px] px-2 py-1.5 text-11 bg-card border border-border rounded text-text placeholder:text-subtext/50 outline-none focus:border-blue/40 resize-none leading-relaxed"
                placeholder="Commit message…"
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
              />

              {/* Commit + Push */}
              <button
                type="button"
                onClick={handleCommitPush}
                disabled={loading || !commitMsg.trim()}
                className="w-full h-[28px] flex items-center justify-center gap-1.5 text-11 font-semibold bg-blue text-white rounded hover:bg-blue-hover transition-colors disabled:opacity-40"
              >
                <Upload size={11} />
                {loading ? "Pushing…" : "Commit & Push"}
              </button>

              {/* Log toggle */}
              <button
                type="button"
                onClick={toggleLog}
                className="flex items-center gap-1.5 text-11 text-subtext hover:text-text transition-colors"
              >
                <GitCommit size={11} />
                <span>{showLog ? "Hide" : "Show"} commit history</span>
              </button>

              {showLog && log.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  {log.map((c) => (
                    <div key={c.hash} className="flex flex-col gap-0.5 py-1.5 border-b border-border/50 last:border-0">
                      <span className="text-11 text-text truncate">{c.message.split("\n")[0]}</span>
                      <span className="text-10 text-subtext">
                        {c.author} · <code className="text-blue">{c.hash}</code>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
