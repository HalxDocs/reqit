import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Building, ExternalLink, Award, Folder, Send, FileCheck, FileCode2, Shield, TestTube, Code2, GitBranch, MessageSquare, Link as LinkIcon, GitCommit, Globe, Zap, Terminal, Sparkles, ChevronRight, Lock, Wifi, ChevronDown, ChevronUp } from "lucide-react";

async function fetchProfileFromRepo(username: string): Promise<PublicProfileData> {
  const upstashUrl = import.meta.env.VITE_UPSTASH_URL as string | undefined;
  const upstashToken = import.meta.env.VITE_UPSTASH_TOKEN as string | undefined;

  if (!upstashUrl || !upstashToken) {
    throw new Error("Profile service not configured — VITE_UPSTASH_URL and VITE_UPSTASH_TOKEN are not set in this build. Check your pxxl dashboard env vars.");
  }

  let r: Response;
  try {
    r = await fetch(`${upstashUrl}/get/profile:${username}`, {
      headers: { Authorization: `Bearer ${upstashToken}` },
    });
  } catch (e: any) {
    throw new Error(`Network error fetching profile: ${e?.message || e}`);
  }
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Profile not found (Upstash ${r.status}): ${body.slice(0, 200)}`);
  }
  const data = await r.json();
  if (!data.result) throw new Error("Profile not found — no data for this username in Upstash. Publish your profile from Settings > Profile in the reqit app.");
  const parsed = JSON.parse(data.result);

  let githubActivity: any[] = [];
  if (parsed.githubUsername) {
    try {
      const ghRes = await fetch(`https://api.github.com/users/${encodeURIComponent(parsed.githubUsername)}/events/public?per_page=15`);
      if (ghRes.ok) {
        const events = await ghRes.json();
        for (const event of (events || []).filter((e: any) => e.type === "PushEvent").slice(0, 5)) {
          const repo = event.repo?.name || "";
          for (const c of (event.payload?.commits || []).slice(0, 2)) {
            githubActivity.push({ sha: c.sha?.substring(0, 7) || "", message: c.message || "", date: event.created_at || "", repo });
          }
          if (githubActivity.length >= 5) break;
        }
      }
    } catch { /* ignore */ }
  }
  if (parsed.githubUsername) parsed.githubActivity = githubActivity;
  return parsed;
}

interface GitHubCommit { sha: string; message: string; date: string; repo: string; }
interface UserProject { name: string; description: string; url: string; liveUrl: string; techStack: string[]; imageUrl: string; }
interface CollectionProject { name: string; description: string; requestCount: number; testCount: number; protocols: string[]; hasSpec: boolean; public: boolean; }

interface PublicProfileData {
  username: string; displayName: string; bio: string; avatarUrl: string;
  links: { label: string; url: string }[];
  location: string; company: string;
  badges: { id: string; name: string; description: string; icon: string; earnedAt: string }[];
  stats: { collectionsCreated: number; requestsSent: number; assertionsWritten: number; specsAuthored: number; mockServersCreated: number; contractPassRate: number; protocolsUsed: string[]; authTypesUsed: string[]; };
  skills: string[];
  socialLinks: { type: string; url: string }[];
  githubUsername: string;
  projects: CollectionProject[];
  userProjects: UserProject[];
  updatedAt: string;
}

const SOCIAL_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  github: { label: "GitHub", icon: GitBranch, color: "text-zinc-300", bg: "bg-zinc-500/10 border-zinc-500/20" },
  twitter: { label: "X / Twitter", icon: MessageSquare, color: "text-sky-400", bg: "bg-sky-400/10 border-sky-400/20" },
  linkedin: { label: "LinkedIn", icon: LinkIcon, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  website: { label: "Website", icon: Globe, color: "text-teal", bg: "bg-teal/10 border-teal/20" },
  devto: { label: "DEV.to", icon: Code2, color: "text-zinc-300", bg: "bg-zinc-400/10 border-zinc-400/20" },
};

const SKILL_COLORS = ["bg-cyan/10 text-cyan border-cyan/20", "bg-blue-500/10 text-blue-400 border-blue-400/20", "bg-purple-500/10 text-purple-400 border-purple-400/20", "bg-green-500/10 text-green-400 border-green-400/20", "bg-amber-500/10 text-amber-400 border-amber-400/20", "bg-pink-500/10 text-pink-400 border-pink-400/20", "bg-teal/10 text-teal border-teal/20"];
const PROTO_COLORS: Record<string, string> = { GET: "bg-green-500/10 text-green-400 border-green-400/20", POST: "bg-blue-500/10 text-blue-400 border-blue-400/20", PUT: "bg-amber-500/10 text-amber-400 border-amber-400/20", PATCH: "bg-purple-500/10 text-purple-400 border-purple-400/20", DELETE: "bg-red-500/10 text-red-400 border-red-400/20", WEBSOCKET: "bg-teal/10 text-teal border-teal/20", MQTT: "bg-pink-500/10 text-pink-400 border-pink-400/20", GRPC: "bg-indigo-500/10 text-indigo-400 border-indigo-400/20" };

interface Props { username: string; onBack: () => void; }

export function PublicProfilePage({ username, onBack }: Props) {
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [commitsError, setCommitsError] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "projects" | "activity">("overview");
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  useEffect(() => { loadProfile(); }, [username]);
  useEffect(() => { if (profile?.githubUsername) fetchGitHubCommits(profile.githubUsername); }, [profile?.githubUsername]);

  const loadProfile = async () => {
    setLoading(true); setError(null);
    try { const data = await fetchProfileFromRepo(username); setProfile(data); }
    catch (err: any) { setError(err?.message || "Failed to load profile"); }
    setLoading(false);
  };

  const fetchGitHubCommits = async (ghUsername: string) => {
    try {
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(ghUsername)}/events/public?per_page=30`);
      if (!res.ok) { setCommitsError(true); return; }
      const events = await res.json();
      const commits: GitHubCommit[] = [];
      for (const event of (events || []).filter((e: any) => e.type === "PushEvent").slice(0, 5)) {
        const repo = event.repo?.name || "";
        for (const c of (event.payload?.commits || []).slice(0, 2)) {
          commits.push({ sha: c.sha?.substring(0, 7) || "", message: c.message || "", date: event.created_at || "", repo });
        }
        if (commits.length >= 5) break;
      }
      setCommits(commits);
    } catch { setCommitsError(true); }
  };

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-cyan/30 border-t-cyan rounded-full animate-spin" />
        <div className="text-subtext text-sm animate-pulse">Loading profile...</div>
      </div>
    </div>
  );

  if (error || !profile) return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center opacity-40"><Folder size={32} className="text-subtext" /></div>
      <div>
        <div className="text-text text-lg font-semibold">Profile not found</div>
        <div className="text-subtext text-sm mt-1">No published profile for <span className="font-mono text-cyan">@{username}</span>.</div>
      </div>
      <button onClick={onBack} className="mt-2 text-cyan hover:text-cyan-hover text-sm flex items-center gap-1 transition-colors"><ArrowLeft size={14} />Back to reqit</button>
    </div>
  );

  const displayName = profile.displayName || profile.username;
  const links = profile.links || [];
  const badges = profile.badges || [];
  const skills = profile.skills || [];
  const socialLinks = (profile.socialLinks || []).filter((s) => s.url);
  const protocolsUsed = profile.stats?.protocolsUsed || [];
  const authTypesUsed = profile.stats?.authTypesUsed || [];
  const collectionProjects = profile.projects || [];
  const userProjects = profile.userProjects || [];

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-cyan/5 via-card to-purple-500/5 mb-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          <div className="relative px-5 sm:px-8 py-6 sm:py-8">
            <button onClick={onBack} className="flex items-center gap-1.5 text-subtext hover:text-text transition-colors mb-4 text-xs"><ArrowLeft size={14} /><span>Back</span></button>
            <div className="flex items-start gap-4 sm:gap-6">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={displayName} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-border shadow-lg shrink-0" />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-cyan/20 to-purple-500/20 border-2 border-cyan/30 flex items-center justify-center text-cyan text-2xl sm:text-3xl font-bold shadow-lg shrink-0">{displayName[0]?.toUpperCase() || "?"}</div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-text leading-tight">{displayName}</h1>
                <div className="text-xs sm:text-sm text-subtext font-mono mt-0.5">@{profile.username}</div>
                {profile.bio && <p className="text-xs sm:text-sm text-text/70 mt-2 leading-relaxed max-w-lg">{profile.bio}</p>}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-subtext">
                  {profile.location && <span className="flex items-center gap-1"><MapPin size={11} />{profile.location}</span>}
                  {profile.company && <span className="flex items-center gap-1"><Building size={11} />{profile.company}</span>}
                </div>
              </div>
            </div>
            {socialLinks.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-border/50">
                {socialLinks.map((sl) => { const meta = SOCIAL_META[sl.type]; if (!meta) return null; const Icon = meta.icon; return (
                  <a key={sl.type} href={sl.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] sm:text-xs rounded-full border ${meta.bg} hover:opacity-80 transition-all`}><Icon size={12} className={meta.color} /><span className="text-text">{meta.label}</span></a>
                ); })}
                {links.map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] sm:text-xs rounded-full border border-border bg-card/50 hover:border-cyan/30 transition-all"><ExternalLink size={10} className="text-subtext" /><span className="text-text">{link.label || link.url}</span></a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">
          {[
            { icon: <Folder size={16} />, label: "Collections", value: profile.stats?.collectionsCreated ?? 0, color: "text-cyan", bg: "bg-cyan/5 border-cyan/15" },
            { icon: <Send size={16} />, label: "Requests", value: profile.stats?.requestsSent ?? 0, color: "text-blue-400", bg: "bg-blue-400/5 border-blue-400/15" },
            { icon: <TestTube size={16} />, label: "Assertions", value: profile.stats?.assertionsWritten ?? 0, color: "text-green-400", bg: "bg-green-400/5 border-green-400/15" },
            { icon: <Shield size={16} />, label: "Contract", value: `${profile.stats?.contractPassRate ?? 0}%`, color: "text-amber-400", bg: "bg-amber-400/5 border-amber-400/15" },
          ].map(({ icon, label, value, color, bg }) => (
            <div key={label} className={`p-3 sm:p-4 rounded-xl border ${bg} transition-all hover:scale-[1.02]`}>
              <div className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-[10px] sm:text-[11px] text-subtext mt-0.5 flex items-center gap-1">{icon}{label}</div>
            </div>
          ))}
        </div>

        {/* Mobile-first Tabs — horizontal scroll pills */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
          {([
            { id: "overview" as const, label: "Overview", icon: Sparkles },
            { id: "projects" as const, label: `Projects`, icon: Folder },
            { id: "activity" as const, label: "Activity", icon: Zap },
          ]).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full border transition-all whitespace-nowrap shrink-0 ${activeTab === id ? "bg-cyan text-white border-cyan" : "bg-surface text-subtext border-border hover:border-cyan/40"}`}>
              <Icon size={12} />{label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            {skills.length > 0 && (
              <Section title="Skills" icon={<Code2 size={13} />}>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((skill, i) => <span key={skill} className={`px-3 py-1 text-[11px] sm:text-xs rounded-full border font-medium ${SKILL_COLORS[i % SKILL_COLORS.length]}`}>{skill}</span>)}
                </div>
              </Section>
            )}
            {(protocolsUsed.length > 0 || authTypesUsed.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {protocolsUsed.length > 0 && (
                  <Section title="Protocols" icon={<Wifi size={13} />}>
                    <div className="flex flex-wrap gap-1">{protocolsUsed.map((p) => <span key={p} className={`px-2.5 py-1 text-[10px] sm:text-[11px] rounded-full border font-mono font-medium ${PROTO_COLORS[p.toUpperCase()] || "bg-surface text-subtext border-border"}`}>{p}</span>)}</div>
                  </Section>
                )}
                {authTypesUsed.length > 0 && (
                  <Section title="Auth" icon={<Lock size={13} />}>
                    <div className="flex flex-wrap gap-1">{authTypesUsed.map((a) => <span key={a} className="px-2.5 py-1 text-[10px] sm:text-[11px] rounded-full bg-purple-500/10 text-purple-400 border border-purple-400/20 font-mono font-medium">{a}</span>)}</div>
                  </Section>
                )}
              </div>
            )}
            {badges.length > 0 && (
              <Section title="Badges" icon={<Award size={13} />}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {badges.map((b) => (
                    <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/50">
                      <div className="w-9 h-9 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0"><Award size={16} className="text-amber-400" /></div>
                      <div className="min-w-0"><div className="text-[11px] sm:text-xs font-semibold text-text">{b.name}</div><div className="text-[9px] sm:text-[10px] text-subtext truncate">{b.description}</div></div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}

        {/* Projects */}
        {activeTab === "projects" && (
          <div className="space-y-4">
            {userProjects.length > 0 && (
              <Section title="My Projects" icon={<Folder size={13} />}>
                <div className="space-y-3">
                  {userProjects.map((up, i) => (
                    <div key={i} className="rounded-xl border border-border bg-card/50 overflow-hidden hover:border-cyan/20 transition-all">
                      {up.imageUrl && <div className="h-36 sm:h-44 bg-surface overflow-hidden"><img src={up.imageUrl} alt={up.name} className="w-full h-full object-cover" /></div>}
                      <div className="p-4">
                        <h4 className="text-sm font-semibold text-text">{up.name}</h4>
                        {up.description && <p className="text-xs text-subtext mt-1 leading-relaxed">{up.description}</p>}
                        {up.techStack.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">{up.techStack.map((tech) => <span key={tech} className="px-2 py-0.5 text-[10px] rounded-full bg-purple-500/10 text-purple-400 border border-purple-400/20 font-medium">{tech}</span>)}</div>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          {up.url && <a href={up.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 text-[11px] rounded-lg bg-surface border border-border text-subtext hover:text-text hover:border-cyan/30 transition-all"><GitBranch size={11} />Code</a>}
                          {up.liveUrl && <a href={up.liveUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 text-[11px] rounded-lg bg-cyan/10 border border-cyan/20 text-cyan hover:bg-cyan/20 transition-all"><Globe size={11} />Live Demo</a>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {collectionProjects.length > 0 && (
              <Section title="API Collections" icon={<Terminal size={13} />}>
                <div className="space-y-2">
                  {collectionProjects.map((cp) => {
                    const isExpanded = expandedProject === cp.name;
                    return (
                      <div key={cp.name} className="rounded-xl border border-border bg-card/50 overflow-hidden">
                        <button onClick={() => setExpandedProject(isExpanded ? null : cp.name)} className="w-full flex items-center gap-3 p-3 sm:p-4 text-left hover:bg-surface/30 transition-colors">
                          <div className="w-8 h-8 rounded-lg bg-cyan/10 border border-cyan/20 flex items-center justify-center shrink-0"><Terminal size={14} className="text-cyan" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-text truncate">{cp.name}</span>
                              {cp.hasSpec && <span className="px-1.5 py-0.5 text-[9px] rounded bg-amber-400/10 text-amber-400 border border-amber-400/20 font-medium">OpenAPI</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500">
                              <span>{cp.requestCount} requests</span>
                              {cp.protocols.length > 0 && <span>· {cp.protocols.slice(0, 3).join(", ")}{cp.protocols.length > 3 ? ` +${cp.protocols.length - 3}` : ""}</span>}
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp size={14} className="text-subtext shrink-0" /> : <ChevronDown size={14} className="text-subtext shrink-0" />}
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-0 border-t border-border/50">
                            <div className="pt-3 space-y-2">
                              <div className="text-xs text-subtext">
                                This collection contains <span className="text-text font-medium">{cp.requestCount} API requests</span> across {cp.protocols.length} protocol{cp.protocols.length !== 1 ? "s" : ""}.
                              </div>
                              {cp.protocols.length > 0 && (
                                <div className="flex flex-wrap gap-1">{cp.protocols.map((p) => <span key={p} className={`px-2 py-0.5 text-[10px] rounded-full border font-mono ${PROTO_COLORS[p.toUpperCase()] || "bg-surface text-subtext border-border"}`}>{p}</span>)}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {userProjects.length === 0 && collectionProjects.length === 0 && (
              <div className="text-center py-12 text-subtext text-sm"><Folder size={32} className="mx-auto mb-3 opacity-30" />No projects yet.</div>
            )}
          </div>
        )}

        {/* Activity */}
        {activeTab === "activity" && (
          <div className="space-y-4">
            {profile.githubUsername && (
              <Section title="GitHub" icon={<GitBranch size={13} />} action={<span className="text-[10px] text-zinc-500 font-mono">@{profile.githubUsername}</span>}>
                {commitsError ? (
                  <div className="p-6 rounded-xl border border-border bg-card/50 text-center">
                    <div className="text-xs text-zinc-500 mb-2">Could not load GitHub activity</div>
                    <a href={`https://github.com/${profile.githubUsername}`} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan hover:underline">View on GitHub</a>
                  </div>
                ) : commits.length > 0 ? (
                  <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                    {commits.map((c) => (
                      <div key={c.sha} className="flex items-start gap-3 px-4 py-3 bg-card/50 hover:bg-surface/30 transition-colors group">
                        <div className="mt-1 shrink-0"><GitCommit size={14} className="text-green-400" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-text font-medium leading-snug">{c.message}</div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-zinc-500">
                            <span className="font-mono bg-surface px-1.5 py-0.5 rounded text-[9px] border border-border">{c.sha}</span>
                            <span className="text-cyan font-mono">{c.repo}</span>
                            <span>{timeAgo(c.date)}</span>
                          </div>
                        </div>
                        <a href={`https://github.com/${profile.githubUsername}/${c.repo}/commit/${c.sha}`} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-cyan transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-1"><ExternalLink size={10} /></a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-border bg-card/50 text-center">
                    <div className="text-xs text-zinc-500 mb-2">No recent public activity</div>
                    <a href={`https://github.com/${profile.githubUsername}`} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan hover:underline">View profile on GitHub</a>
                  </div>
                )}
              </Section>
            )}

            <Section title="API Activity" icon={<Terminal size={13} />}>
              <div className="space-y-2">
                {protocolsUsed.length > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/50">
                    <div className="w-7 h-7 rounded-lg bg-cyan/10 border border-cyan/20 flex items-center justify-center shrink-0"><Terminal size={12} className="text-cyan" /></div>
                    <div className="flex-1"><div className="text-xs text-text font-medium">Protocols explored</div><div className="text-[10px] text-subtext">{protocolsUsed.join(", ")}</div></div>
                    <span className="text-xs font-bold text-cyan">{protocolsUsed.length}</span>
                  </div>
                )}
                {authTypesUsed.length > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/50">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-400/20 flex items-center justify-center shrink-0"><Lock size={12} className="text-purple-400" /></div>
                    <div className="flex-1"><div className="text-xs text-text font-medium">Auth methods tested</div><div className="text-[10px] text-subtext">{authTypesUsed.join(", ")}</div></div>
                    <span className="text-xs font-bold text-purple-400">{authTypesUsed.length}</span>
                  </div>
                )}
                {(profile.stats?.specsAuthored ?? 0) > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/50">
                    <div className="w-7 h-7 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0"><FileCode2 size={12} className="text-amber-400" /></div>
                    <div className="flex-1"><div className="text-xs text-text font-medium">OpenAPI specs</div><div className="text-[10px] text-subtext">Validated API contracts</div></div>
                    <span className="text-xs font-bold text-amber-400">{profile.stats.specsAuthored}</span>
                  </div>
                )}
              </div>
            </Section>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-5 border-t border-border text-center">
          <div className="text-[11px] text-zinc-600">
            Built with <span className="font-bold text-cyan">reqit</span> · <a href="https://reqit.pxxl.dev" target="_blank" rel="noopener noreferrer" className="hover:text-cyan transition-colors">reqit.pxxl.dev</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-xs font-medium text-subtext flex items-center gap-1.5">{icon}{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
