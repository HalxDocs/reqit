import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Building, ExternalLink, Award, Folder, Send, FileCheck, FileCode2, Shield, TestTube, Code2, GitBranch, MessageSquare, Link as LinkIcon, GitCommit, Globe } from "lucide-react";
import reqitLogo from "../../../assets/images/reqitlogo.jpeg";

async function fetchProfileFromRepo(username: string): Promise<PublicProfileData> {
  const res = await fetch(`/api/profile/${username}?t=${Date.now()}`);
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
    setError(null);
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
      /* silent */
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan/30 border-t-cyan rounded-full animate-spin" />
          <div className="text-subtext text-sm animate-pulse">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center opacity-40">
          <Folder size={32} className="text-subtext" />
        </div>
        <div>
          <div className="text-text text-lg font-semibold">Profile not found</div>
          <div className="text-subtext text-sm mt-1">
            No published profile for <span className="font-mono text-cyan">@{username}</span>.
          </div>
          {error && <div className="text-xs text-zinc-500 mt-2 max-w-sm">{error}</div>}
        </div>
        <div className="text-subtext text-xs max-w-sm leading-relaxed">
          Open the reqit desktop app → Dev Profile → fill in your details → click <span className="font-semibold text-text">Publish to Web</span>.
        </div>
        <button onClick={onBack} className="mt-2 text-cyan hover:text-cyan-hover text-sm flex items-center gap-1 transition-colors">
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

  return (
    <div className="w-full">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-cyan/5 via-card to-purple-500/5 mb-6">
        <div className="px-4 sm:px-6 py-6 sm:py-8">
          <button onClick={onBack} className="flex items-center gap-1.5 text-subtext hover:text-text transition-colors mb-4 text-xs">
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>

          <div className="flex items-start gap-4">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={displayName} className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border-2 border-border shadow-lg shrink-0" />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-br from-cyan/20 to-purple-500/20 border-2 border-cyan/30 flex items-center justify-center text-cyan text-2xl sm:text-3xl font-bold shadow-lg shrink-0">
                {displayName[0]?.toUpperCase() || "?"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-text leading-tight">{displayName}</h1>
              <div className="text-xs sm:text-sm text-subtext font-mono mt-0.5">@{profile.username}</div>
              {profile.bio && <p className="text-xs sm:text-sm text-text/70 mt-2 leading-relaxed">{profile.bio}</p>}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-subtext">
                {profile.location && (
                  <span className="flex items-center gap-1"><MapPin size={11} />{profile.location}</span>
                )}
                {profile.company && (
                  <span className="flex items-center gap-1"><Building size={11} />{profile.company}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-6">
        {[
          { icon: <Folder size={16} />, label: "Collections", value: profile.stats?.collectionsCreated ?? 0, color: "text-cyan", bg: "bg-cyan/5 border-cyan/15" },
          { icon: <Send size={16} />, label: "Requests", value: profile.stats?.requestsSent ?? 0, color: "text-blue-400", bg: "bg-blue-400/5 border-blue-400/15" },
          { icon: <TestTube size={16} />, label: "Assertions", value: profile.stats?.assertionsWritten ?? 0, color: "text-green-400", bg: "bg-green-400/5 border-green-400/15" },
          { icon: <Shield size={16} />, label: "Contract", value: `${profile.stats?.contractPassRate ?? 0}%`, color: "text-amber-400", bg: "bg-amber-400/5 border-amber-400/15" },
        ].map(({ icon, label, value, color, bg }) => (
          <div key={label} className={`p-3 sm:p-4 rounded-xl border ${bg}`}>
            <div className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-[10px] sm:text-[11px] text-subtext mt-0.5 flex items-center gap-1">{icon}{label}</div>
          </div>
        ))}
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-medium text-subtext mb-2.5 flex items-center gap-1.5"><Code2 size={12} /> Skills & Technologies</h3>
          <div className="flex flex-wrap gap-1.5">
            {skills.map((skill, i) => (
              <span key={skill} className={`px-2.5 py-1 text-[11px] sm:text-xs rounded-full border font-medium ${SKILL_COLORS[i % SKILL_COLORS.length]}`}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Social + Links */}
      {(socialLinks.length > 0 || links.length > 0) && (
        <div className="mb-6">
          <h3 className="text-xs font-medium text-subtext mb-2.5 flex items-center gap-1.5"><LinkIcon size={12} /> Links</h3>
          <div className="flex flex-wrap gap-1.5">
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
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] sm:text-xs rounded-full border border-border bg-card/50 hover:border-cyan/30 hover:bg-card transition-all"
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
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] sm:text-xs rounded-full border border-border bg-card/50 hover:border-cyan/30 hover:text-text transition-all"
              >
                <ExternalLink size={10} className="text-subtext" />
                <span className="text-text">{link.label || link.url}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Protocols & Auth */}
      {(protocolsUsed.length > 0 || authTypesUsed.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {protocolsUsed.length > 0 && (
            <div className="p-3 rounded-xl border border-border bg-card/50">
              <div className="text-[10px] sm:text-xs font-medium text-subtext mb-1.5">Protocols</div>
              <div className="flex flex-wrap gap-1">
                {protocolsUsed.map((p) => (
                  <span key={p} className="px-2 py-0.5 text-[10px] sm:text-[11px] rounded-full bg-cyan/10 text-cyan font-mono">{p}</span>
                ))}
              </div>
            </div>
          )}
          {authTypesUsed.length > 0 && (
            <div className="p-3 rounded-xl border border-border bg-card/50">
              <div className="text-[10px] sm:text-xs font-medium text-subtext mb-1.5">Auth Types</div>
              <div className="flex flex-wrap gap-1">
                {authTypesUsed.map((a) => (
                  <span key={a} className="px-2 py-0.5 text-[10px] sm:text-[11px] rounded-full bg-purple-500/10 text-purple-400 font-mono">{a}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* GitHub Activity */}
      {profile.githubUsername && (
        <div className="mb-6">
          <h3 className="text-xs font-medium text-subtext mb-2.5 flex items-center gap-1.5">
            <GitBranch size={12} />
            Recent Activity
            <span className="text-zinc-500 font-mono text-[10px]">@{profile.githubUsername}</span>
          </h3>
          {commits.length > 0 ? (
            <div className="space-y-1.5">
              {commits.map((c) => (
                <div key={c.sha} className="flex items-start gap-2.5 p-2.5 sm:p-3 rounded-lg border border-border bg-card/50 hover:border-border transition-colors group">
                  <GitCommit size={13} className="text-green-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] sm:text-xs text-text truncate">{c.message}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[9px] sm:text-[10px] text-zinc-500">
                      <span className="font-mono">{c.sha}</span>
                      <span>·</span>
                      <span className="font-mono truncate max-w-[120px] sm:max-w-none">{c.repo}</span>
                      <span>·</span>
                      <span>{timeAgo(c.date)}</span>
                    </div>
                  </div>
                  <a
                    href={`https://github.com/${profile.githubUsername}/${c.repo}/commit/${c.sha}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:text-cyan transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    <ExternalLink size={10} />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-lg border border-border bg-card/50 text-center">
              <div className="text-[11px] text-zinc-500">Loading activity from GitHub...</div>
            </div>
          )}
        </div>
      )}

      {/* Badges */}
      {badges.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-medium text-subtext mb-2.5 flex items-center gap-1.5"><Award size={12} /> Badges</h3>
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <div key={b.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border bg-card/50 hover:border-amber-400/20 transition-colors">
                <Award size={14} className="text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] sm:text-xs font-medium text-text">{b.name}</div>
                  <div className="text-[9px] sm:text-[10px] text-subtext truncate">{b.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-[10px] sm:text-xs text-subtext pt-4 pb-2 border-t border-border mt-4">
        Built with <span className="text-cyan font-medium">reqit</span> — the open-source API client
      </div>
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
