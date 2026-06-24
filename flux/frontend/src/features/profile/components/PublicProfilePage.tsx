import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Building, ExternalLink, Award, Folder, Send, FileCheck, FileCode2, Shield, TestTube, Code2, GitBranch, MessageSquare, Link as LinkIcon, GitCommit, Globe } from "lucide-react";
import reqitLogo from "../../../assets/images/reqitlogo.jpeg";

async function fetchProfileFromRepo(username: string): Promise<PublicProfileData> {
  const res = await fetch(`/api/profile/${username}`);
  if (!res.ok) throw new Error("Profile not found — have you published from the desktop app?");
  return await res.json();
}

interface GitHubCommit {
  sha: string;
  message: string;
  date: string;
  repo: string;
}

interface PublicProfileData {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  links: { label: string; url: string }[];
  location: string;
  company: string;
  badges: { id: string; name: string; description: string; icon: string; earnedAt: string }[];
  stats: {
    collectionsCreated: number;
    requestsSent: number;
    assertionsWritten: number;
    specsAuthored: number;
    mockServersCreated: number;
    contractPassRate: number;
    protocolsUsed: string[];
    authTypesUsed: string[];
  };
  skills: string[];
  socialLinks: { type: string; url: string }[];
  githubUsername: string;
  updatedAt: string;
}

const SOCIAL_META: Record<string, { label: string; icon: any; color: string }> = {
  github: { label: "GitHub", icon: GitBranch, color: "text-zinc-300" },
  twitter: { label: "Twitter / X", icon: MessageSquare, color: "text-sky-400" },
  linkedin: { label: "LinkedIn", icon: LinkIcon, color: "text-blue-400" },
  website: { label: "Website", icon: Globe, color: "text-teal" },
  devto: { label: "DEV.to", icon: Code2, color: "text-zinc-300" },
};

const SKILL_COLORS = [
  "bg-cyan/10 text-cyan border-cyan/20",
  "bg-blue-500/10 text-blue-400 border-blue-400/20",
  "bg-purple-500/10 text-purple-400 border-purple-400/20",
  "bg-green-500/10 text-green-400 border-green-400/20",
  "bg-amber-500/10 text-amber-400 border-amber-400/20",
  "bg-pink-500/10 text-pink-400 border-pink-400/20",
  "bg-teal/10 text-teal border-teal/20",
];

interface Props {
  username: string;
  onBack: () => void;
}

export function PublicProfilePage({ username, onBack }: Props) {
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);

  useEffect(() => {
    loadProfile();
  }, [username]);

  useEffect(() => {
    if (profile?.githubUsername) {
      fetchGitHubCommits(profile.githubUsername);
    }
  }, [profile?.githubUsername]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await fetchProfileFromRepo(username);
      setProfile(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load profile");
    }
    setLoading(false);
  };

  const fetchGitHubCommits = async (ghUsername: string) => {
    try {
      const res = await fetch(`https://api.github.com/users/${ghUsername}/events/public?per_page=30`);
      if (!res.ok) return;
      const events = await res.json();
      const pushEvents = (events || [])
        .filter((e: any) => e.type === "PushEvent")
        .slice(0, 5);
      const recentCommits: GitHubCommit[] = [];
      for (const event of pushEvents) {
        const repo = event.repo?.name || "";
        for (const c of (event.payload?.commits || []).slice(0, 2)) {
          recentCommits.push({
            sha: c.sha?.substring(0, 7) || "",
            message: c.message || "",
            date: event.created_at || "",
            repo,
          });
        }
        if (recentCommits.length >= 5) break;
      }
      setCommits(recentCommits);
    } catch {
      /* silent — GitHub rate limit or network */
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-subtext animate-pulse">Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-6xl opacity-20"><Folder size={64} /></div>
        <div className="text-text text-lg font-medium">Profile not found</div>
        <div className="text-subtext text-sm text-center max-w-md">
          No published profile exists for <span className="font-mono text-cyan">@{username}</span>.
          {error && <div className="text-xs text-zinc-500 mt-1">{error}</div>}
        </div>
        <div className="text-subtext text-xs text-center max-w-sm mt-2">
          If this is your profile, open the reqit desktop app, go to Dev Profile, and click <span className="font-semibold text-text">Publish to Web</span>.
        </div>
        <button onClick={onBack} className="mt-4 text-cyan hover:text-cyan-hover text-sm flex items-center gap-1">
          <ArrowLeft size={14} />Back to reqit
        </button>
      </div>
    );
  }

  const displayName = profile.displayName || profile.username;
  const links = profile.links || [];
  const badges = profile.badges || [];
  const skills = profile.skills || [];
  const socialLinks = (profile.socialLinks || []).filter((s) => s.url);
  const protocolsUsed = profile.stats?.protocolsUsed || [];
  const authTypesUsed = profile.stats?.authTypesUsed || [];

  const totalActivity = (profile.stats?.collectionsCreated || 0) +
    (profile.stats?.requestsSent || 0) +
    (profile.stats?.assertionsWritten || 0) +
    (profile.stats?.specsAuthored || 0);

  return (
    <div className="min-h-screen bg-bg">
      {/* Hero Header */}
      <header className="relative border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan/5 via-transparent to-purple-500/5" />
        <div className="relative max-w-[800px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <button onClick={onBack} className="flex items-center gap-2 text-subtext hover:text-text transition-colors mb-6">
            <ArrowLeft size={16} />
            <img src={reqitLogo} alt="reqit" className="h-[22px] w-auto object-contain" />
          </button>

          <div className="flex items-start gap-5">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={displayName} className="w-20 h-20 rounded-2xl object-cover border-2 border-border shadow-lg" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan/20 to-purple-500/20 border-2 border-cyan/30 flex items-center justify-center text-cyan text-3xl font-bold shadow-lg">
                {displayName[0]?.toUpperCase() || "?"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-text">{displayName}</h1>
              <div className="text-sm text-subtext font-mono mt-0.5">@{profile.username}</div>
              {profile.bio && <p className="text-sm text-text/80 mt-2 leading-relaxed max-w-lg">{profile.bio}</p>}
              <div className="flex items-center gap-4 mt-3 text-xs text-subtext">
                {profile.location && (
                  <span className="flex items-center gap-1"><MapPin size={12} />{profile.location}</span>
                )}
                {profile.company && (
                  <span className="flex items-center gap-1"><Building size={12} />{profile.company}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* Activity Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: <Folder size={18} />, label: "Collections", value: profile.stats?.collectionsCreated ?? 0, color: "from-cyan/10 to-cyan/5 border-cyan/20", text: "text-cyan" },
            { icon: <Send size={18} />, label: "Requests Sent", value: profile.stats?.requestsSent ?? 0, color: "from-blue-400/10 to-blue-400/5 border-blue-400/20", text: "text-blue-400" },
            { icon: <TestTube size={18} />, label: "Assertions", value: profile.stats?.assertionsWritten ?? 0, color: "from-green-400/10 to-green-400/5 border-green-400/20", text: "text-green-400" },
            { icon: <Shield size={18} />, label: "Contract Pass", value: `${profile.stats?.contractPassRate ?? 0}%`, color: "from-amber-400/10 to-amber-400/5 border-amber-400/20", text: "text-amber-400" },
          ].map(({ icon, label, value, color, text }) => (
            <div key={label} className={`p-4 rounded-xl border bg-gradient-to-br ${color} transition-all hover:scale-[1.02]`}>
              <div className={`text-2xl font-bold ${text}`}>{value}</div>
              <div className="text-[11px] text-subtext mt-1 flex items-center gap-1">{icon}{label}</div>
            </div>
          ))}
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-subtext mb-3 flex items-center gap-1.5"><Code2 size={12} /> Skills & Technologies</h3>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill, i) => (
                <span key={skill} className={`px-3 py-1 text-xs rounded-full border font-medium transition-all hover:scale-105 ${SKILL_COLORS[i % SKILL_COLORS.length]}`}>
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Social Links + Links */}
        {(socialLinks.length > 0 || links.length > 0) && (
          <section>
            <h3 className="text-xs font-medium text-subtext mb-3 flex items-center gap-1.5"><LinkIcon size={12} /> Links</h3>
            <div className="flex flex-wrap gap-2">
              {socialLinks.map((sl) => {
                const meta = SOCIAL_META[sl.type];
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <a
                    key={sl.type}
                    href={sl.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-border bg-card/50 hover:border-border hover:bg-card transition-all hover:scale-105"
                  >
                    <Icon size={12} className={meta.color} />
                    <span className="text-text">{meta.label}</span>
                  </a>
                );
              })}
              {links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-border bg-card/50 hover:border-cyan/40 hover:text-text transition-all hover:scale-105"
                >
                  <ExternalLink size={10} className="text-subtext" />
                  <span className="text-text">{link.label || link.url}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Protocols & Auth */}
        {(protocolsUsed.length > 0 || authTypesUsed.length > 0) && (
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {protocolsUsed.length > 0 && (
              <div className="p-4 rounded-xl border border-border bg-card/50">
                <div className="text-xs font-medium text-subtext mb-2">Protocols</div>
                <div className="flex flex-wrap gap-1.5">
                  {protocolsUsed.map((p) => (
                    <span key={p} className="px-2 py-0.5 text-[11px] rounded-full bg-cyan/10 text-cyan font-mono">{p}</span>
                  ))}
                </div>
              </div>
            )}
            {authTypesUsed.length > 0 && (
              <div className="p-4 rounded-xl border border-border bg-card/50">
                <div className="text-xs font-medium text-subtext mb-2">Auth Types</div>
                <div className="flex flex-wrap gap-1.5">
                  {authTypesUsed.map((a) => (
                    <span key={a} className="px-2 py-0.5 text-[11px] rounded-full bg-purple-500/10 text-purple-400 font-mono">{a}</span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* GitHub Activity */}
        {profile.githubUsername && (
          <section>
            <h3 className="text-xs font-medium text-subtext mb-3 flex items-center gap-1.5">
              <GitBranch size={12} />
              Recent Activity
              <span className="text-zinc-500 font-mono">@{profile.githubUsername}</span>
            </h3>
            {commits.length > 0 ? (
              <div className="space-y-2">
                {commits.map((c) => (
                  <div key={c.sha} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 hover:border-border transition-colors group">
                    <GitCommit size={14} className="text-green-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-text truncate">{c.message}</div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                        <span className="font-mono">{c.sha}</span>
                        <span>·</span>
                        <span className="font-mono truncate">{c.repo}</span>
                        <span>·</span>
                        <span>{timeAgo(c.date)}</span>
                      </div>
                    </div>
                    <a
                      href={`https://github.com/${profile.githubUsername}/${c.repo}/commit/${c.sha}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-500 hover:text-cyan transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <ExternalLink size={10} />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-border bg-card/50 text-center">
                <div className="text-xs text-zinc-500">Loading activity from GitHub...</div>
              </div>
            )}
          </section>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-subtext mb-3 flex items-center gap-1.5"><Award size={12} /> Badges</h3>
            <div className="flex flex-wrap gap-3">
              {badges.map((b) => (
                <div key={b.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card/50 hover:border-amber-400/30 transition-colors">
                  <Award size={16} className="text-amber-400" />
                  <div>
                    <div className="text-xs font-medium text-text">{b.name}</div>
                    <div className="text-[10px] text-subtext">{b.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-subtext pt-8 pb-4 border-t border-border">
          Built with <span className="text-cyan font-medium">reqit</span> — the open-source API client
        </div>
      </main>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
