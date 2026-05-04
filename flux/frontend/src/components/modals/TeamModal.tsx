import { useEffect, useState, useCallback } from "react";
import {
  GitBranch, RefreshCw, Upload, Settings, Plus, Users,
  Link, Copy, Check, ChevronDown, GitCommit, X, Wifi, WifiOff,
} from "lucide-react";
import {
  GetGitStatus, InitGit, CommitAndPush, GitPull, GetBranches,
  SwitchBranch, CreateBranch, GetGitLog, GetActiveContributors,
} from "../../../wailsjs/go/main/App";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { useUIStore } from "../../stores/useUIStore";
import { useToastStore } from "../../stores/useToastStore";

interface GitStatus {
  initialised: boolean;
  hasChanges: boolean;
  currentBranch: string;
  remoteUrl: string;
}
interface CommitInfo { hash: string; message: string; author: string; when: string; }
interface Contributor { name: string; email: string; commits: number; lastSeen: string; }

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const AVATAR_COLORS = [
  "bg-violet-500/20 text-violet-400",
  "bg-cyan-500/20 text-cyan-400",
  "bg-emerald-500/20 text-emerald-400",
  "bg-amber-500/20 text-amber-400",
  "bg-rose-500/20 text-rose-400",
];

export function TeamModal() {
  const open = useUIStore((s) => s.teamModalOpen);
  const close = useUIStore((s) => s.closeTeamModal);
  const toast = useToastStore((s) => s.push);

  const [status, setStatus] = useState<GitStatus | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [log, setLog] = useState<CommitInfo[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showBranches, setShowBranches] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [commitMsg, setCommitMsg] = useState("");
  const [setupForm, setSetupForm] = useState({ remoteUrl: "", pat: "" });
  const [newBranch, setNewBranch] = useState("");
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await GetGitStatus();
      setStatus(s as GitStatus);
      if ((s as GitStatus).initialised) {
        const [b, c, l] = await Promise.all([
          GetBranches(), GetActiveContributors(), GetGitLog(8),
        ]);
        setBranches(b ?? []);
        setContributors((c ?? []) as Contributor[]);
        setLog(l ?? []);
      }
    } catch { /* not a git repo yet */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const off = EventsOn("git:pull:complete", () => void refresh());
    return () => { if (typeof off === "function") off(); };
  }, [open, refresh]);

  const handleSetup = async () => {
    setLoading(true);
    try {
      await InitGit(setupForm.remoteUrl, setupForm.pat);
      toast("success", "Git connected — workspace syncing");
      setShowSetup(false);
      await refresh();
    } catch (e) { toast("error", String(e)); }
    finally { setLoading(false); }
  };

  const handleCommitPush = async () => {
    if (!commitMsg.trim()) return;
    setLoading(true);
    try {
      await CommitAndPush(commitMsg.trim());
      toast("success", "Committed and pushed");
      setCommitMsg("");
      await refresh();
    } catch (e) { toast("error", String(e)); }
    finally { setLoading(false); }
  };

  const handlePull = async () => {
    setLoading(true);
    try {
      await GitPull();
      toast("success", "Pulled latest changes");
      await refresh();
    } catch (e) { toast("error", String(e)); }
    finally { setLoading(false); }
  };

  const handleSwitchBranch = async (name: string) => {
    if (name === status?.currentBranch) return;
    try {
      await SwitchBranch(name);
      await refresh();
      toast("success", `Switched to ${name}`);
    } catch (e) { toast("error", String(e)); }
  };

  const handleCreateBranch = async () => {
    if (!newBranch.trim()) return;
    try {
      await CreateBranch(newBranch.trim());
      setNewBranch("");
      setShowBranches(false);
      await refresh();
      toast("success", `Created branch ${newBranch.trim()}`);
    } catch (e) { toast("error", String(e)); }
  };

  const copyRemoteUrl = async () => {
    if (!status?.remoteUrl) return;
    await navigator.clipboard.writeText(status.remoteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  const connected = status?.initialised && !!status.remoteUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={close}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-[560px] max-h-[88vh] flex flex-col bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-[32px] h-[32px] rounded-lg bg-blue/15 flex items-center justify-center">
              <Users size={15} className="text-blue" />
            </div>
            <div>
              <div className="text-14 font-bold text-text">Team</div>
              <div className="text-11 text-subtext">
                {connected
                  ? <span className="flex items-center gap-1"><Wifi size={10} className="text-success" /> Connected</span>
                  : <span className="flex items-center gap-1"><WifiOff size={10} className="text-subtext" /> Not syncing</span>
                }
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="w-[28px] h-[28px] flex items-center justify-center text-subtext hover:text-text hover:bg-cardHover rounded-lg transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Active members */}
          {status?.initialised && (
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-11 font-semibold text-subtext uppercase tracking-wider">
                  Active today
                </span>
                {contributors.length > 0 && (
                  <span className="text-10 font-bold text-blue bg-blue/10 px-2 py-0.5 rounded-full">
                    {contributors.length} online
                  </span>
                )}
              </div>
              {contributors.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {/* Avatar row */}
                  <div className="flex -space-x-2">
                    {contributors.slice(0, 6).map((c, i) => (
                      <div
                        key={c.email}
                        title={`${c.name} — ${c.commits} commit${c.commits !== 1 ? "s" : ""}`}
                        className={`w-[30px] h-[30px] rounded-full border-2 border-surface flex items-center justify-center text-11 font-bold shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
                      >
                        {initials(c.name)}
                      </div>
                    ))}
                    {contributors.length > 6 && (
                      <div className="w-[30px] h-[30px] rounded-full border-2 border-surface bg-cardHover flex items-center justify-center text-10 font-bold text-subtext">
                        +{contributors.length - 6}
                      </div>
                    )}
                  </div>
                  {/* List */}
                  {contributors.map((c, i) => (
                    <div key={c.email} className="flex items-center gap-3 p-2 rounded-lg hover:bg-cardHover transition-colors">
                      <div className={`w-[32px] h-[32px] rounded-full flex items-center justify-center text-12 font-bold shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                        {initials(c.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-12 text-text font-medium truncate">{c.name}</div>
                        <div className="text-11 text-subtext">{c.commits} commit{c.commits !== 1 ? "s" : ""} · {timeAgo(c.lastSeen)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-12 text-subtext py-1">No activity in the last 24 hours</div>
              )}
            </div>
          )}

          {/* Connection / setup */}
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-11 font-semibold text-subtext uppercase tracking-wider">Git Remote</span>
              {connected && (
                <button
                  type="button"
                  onClick={() => setShowSetup((v) => !v)}
                  className="text-11 text-subtext hover:text-text flex items-center gap-1 transition-colors"
                >
                  <Settings size={11} />
                  Edit
                </button>
              )}
            </div>

            {!status?.initialised || showSetup ? (
              <div className="flex flex-col gap-2">
                {!status?.initialised && (
                  <p className="text-12 text-subtext mb-1">
                    Connect a Git remote so your team can sync this workspace automatically.
                  </p>
                )}
                <input
                  className="w-full h-[36px] px-3 text-12 bg-card border border-border rounded-lg text-text placeholder:text-subtext/50 outline-none focus:border-blue/50 transition-colors"
                  placeholder="Remote URL  (https://github.com/your-org/repo)"
                  value={setupForm.remoteUrl}
                  onChange={(e) => setSetupForm((f) => ({ ...f, remoteUrl: e.target.value }))}
                />
                <input
                  type="password"
                  className="w-full h-[36px] px-3 text-12 bg-card border border-border rounded-lg text-text placeholder:text-subtext/50 outline-none focus:border-blue/50 transition-colors"
                  placeholder="Personal Access Token (PAT)"
                  value={setupForm.pat}
                  onChange={(e) => setSetupForm((f) => ({ ...f, pat: e.target.value }))}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSetup}
                    disabled={loading || !setupForm.remoteUrl.trim()}
                    className="flex-1 h-[36px] text-12 font-semibold bg-blue text-white rounded-lg hover:bg-blue-hover transition-colors disabled:opacity-40"
                  >
                    {loading ? "Connecting…" : "Connect"}
                  </button>
                  {showSetup && (
                    <button
                      type="button"
                      onClick={() => setShowSetup(false)}
                      className="h-[36px] px-3 text-12 text-subtext hover:text-text transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
                <div className="w-[8px] h-[8px] rounded-full bg-success shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-11 text-subtext mb-0.5">Remote</div>
                  <div className="text-12 text-text font-mono truncate">{status.remoteUrl}</div>
                </div>
                <button
                  type="button"
                  onClick={copyRemoteUrl}
                  title="Copy remote URL"
                  className="w-[28px] h-[28px] flex items-center justify-center text-subtext hover:text-blue hover:bg-blue/10 rounded-lg transition-all"
                >
                  {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                </button>
                <button
                  type="button"
                  onClick={handlePull}
                  disabled={loading}
                  className="flex items-center gap-1.5 h-[28px] px-2.5 text-11 font-medium text-subtext bg-cardHover border border-border rounded-lg hover:border-blue/40 hover:text-blue transition-all disabled:opacity-50"
                >
                  <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
                  Pull
                </button>
              </div>
            )}
          </div>

          {/* Branch */}
          {status?.initialised && (
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-11 font-semibold text-subtext uppercase tracking-wider">Branch</span>
              </div>
              <button
                type="button"
                onClick={() => setShowBranches((v) => !v)}
                className="flex items-center gap-2 w-full h-[36px] px-3 bg-card border border-border rounded-lg text-12 text-text hover:border-blue/40 transition-colors"
              >
                <GitBranch size={12} className="text-blue shrink-0" />
                <span className="flex-1 text-left truncate">{status.currentBranch || "detached"}</span>
                <ChevronDown size={12} className="text-subtext shrink-0" />
              </button>

              {showBranches && (
                <div className="mt-2 bg-card border border-border rounded-lg overflow-hidden">
                  {branches.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => { void handleSwitchBranch(b); setShowBranches(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-12 hover:bg-cardHover transition-colors ${b === status.currentBranch ? "text-blue font-semibold" : "text-text"}`}
                    >
                      <GitBranch size={11} className="shrink-0" />
                      {b}
                      {b === status.currentBranch && <span className="ml-auto text-10 text-blue/60">current</span>}
                    </button>
                  ))}
                  <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
                    <input
                      className="flex-1 h-[24px] text-12 bg-transparent text-text placeholder:text-subtext/40 outline-none"
                      placeholder="New branch name…"
                      value={newBranch}
                      onChange={(e) => setNewBranch(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleCreateBranch(); }}
                    />
                    <button type="button" onClick={handleCreateBranch} className="text-subtext hover:text-blue transition-colors">
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Commit & Push */}
          {status?.initialised && (
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-11 font-semibold text-subtext uppercase tracking-wider">
                  Commit & Push
                </span>
                {status.hasChanges && (
                  <span className="flex items-center gap-1.5 text-11 text-amber-400">
                    <span className="w-[6px] h-[6px] rounded-full bg-amber-400" />
                    Uncommitted changes
                  </span>
                )}
              </div>
              <textarea
                className="w-full h-[72px] px-3 py-2 text-12 bg-card border border-border rounded-lg text-text placeholder:text-subtext/50 outline-none focus:border-blue/50 resize-none leading-relaxed transition-colors"
                placeholder="Describe what changed…"
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
              />
              <button
                type="button"
                onClick={handleCommitPush}
                disabled={loading || !commitMsg.trim()}
                className="mt-2 w-full h-[38px] flex items-center justify-center gap-2 text-13 font-semibold bg-blue text-white rounded-lg hover:bg-blue-hover transition-colors disabled:opacity-40"
              >
                <Upload size={13} />
                {loading ? "Pushing…" : "Commit & Push"}
              </button>
            </div>
          )}

          {/* Recent commits */}
          {status?.initialised && (
            <div className="px-5 py-4 border-b border-border">
              <button
                type="button"
                onClick={() => setShowLog((v) => !v)}
                className="flex items-center gap-2 text-11 font-semibold text-subtext uppercase tracking-wider hover:text-text transition-colors w-full"
              >
                <GitCommit size={12} />
                Recent commits
                <ChevronDown size={11} className={`ml-auto transition-transform ${showLog ? "rotate-180" : ""}`} />
              </button>
              {showLog && log.length > 0 && (
                <div className="mt-3 flex flex-col gap-0.5">
                  {log.map((c) => (
                    <div key={c.hash} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
                      <code className="text-10 font-mono text-blue bg-blue/10 px-1.5 py-0.5 rounded shrink-0 mt-0.5">{c.hash}</code>
                      <div className="flex-1 min-w-0">
                        <div className="text-12 text-text truncate">{c.message.split("\n")[0]}</div>
                        <div className="text-11 text-subtext mt-0.5">{c.author} · {timeAgo(c.when)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Invite a teammate */}
          <div className="px-5 py-4">
            <div className="text-11 font-semibold text-subtext uppercase tracking-wider mb-3">Invite a Teammate</div>
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-[22px] h-[22px] rounded-full bg-blue flex items-center justify-center text-white text-10 font-bold shrink-0 mt-0.5">1</div>
                <div>
                  <div className="text-12 font-semibold text-text">Create a private GitHub repo</div>
                  <div className="text-11 text-subtext mt-0.5">Go to github.com → New repository → set to Private</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-[22px] h-[22px] rounded-full bg-blue flex items-center justify-center text-white text-10 font-bold shrink-0 mt-0.5">2</div>
                <div>
                  <div className="text-12 font-semibold text-text">Share the remote URL</div>
                  <div className="text-11 text-subtext mt-0.5">
                    Copy your remote URL above and send it to your teammate
                  </div>
                  {connected && (
                    <button
                      type="button"
                      onClick={copyRemoteUrl}
                      className="mt-1.5 flex items-center gap-1.5 text-11 font-medium text-blue hover:text-blue-hover transition-colors"
                    >
                      {copied ? <Check size={11} /> : <Copy size={11} />}
                      {copied ? "Copied!" : "Copy remote URL"}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-[22px] h-[22px] rounded-full bg-blue flex items-center justify-center text-white text-10 font-bold shrink-0 mt-0.5">3</div>
                <div>
                  <div className="text-12 font-semibold text-text">Teammate connects on their machine</div>
                  <div className="text-11 text-subtext mt-0.5">
                    They open reqit → Team → paste the URL + their own GitHub PAT → Connect
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-[22px] h-[22px] rounded-full bg-success flex items-center justify-center text-white text-10 font-bold shrink-0 mt-0.5">
                  <Check size={10} />
                </div>
                <div>
                  <div className="text-12 font-semibold text-text">Done — workspace syncs automatically</div>
                  <div className="text-11 text-subtext mt-0.5">
                    reqit pulls on open, pushes on commit. Everyone sees each other in "Active today".
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 p-3 bg-blue/5 border border-blue/20 rounded-lg">
              <Link size={12} className="text-blue shrink-0" />
              <p className="text-11 text-subtext">
                Each teammate needs their own PAT. Generate one at{" "}
                <span className="text-blue font-mono">github.com → Settings → Developer settings → Personal access tokens</span>
                . Scopes needed: <span className="font-mono text-text">repo</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
