import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Building, ExternalLink, Award, Folder, Send, FileCheck, FileCode2, Shield, TestTube } from "lucide-react";
import { GetPublicProfile } from "../../../../wailsjs/go/main/App";
import reqitLogo from "../../../assets/images/reqitlogo.jpeg";

async function fetchProfileFromRepo(username: string): Promise<PublicProfileData> {
  const res = await fetch(`/api/profile/${username}`);
  if (!res.ok) throw new Error("Profile not found — have you published from the desktop app?");
  return await res.json();
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
  updatedAt: string;
}

interface Props {
  username: string;
  onBack: () => void;
}

export function PublicProfilePage({ username, onBack }: Props) {
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, [username]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      // Try Wails binding first (desktop app)
      if (typeof window !== "undefined" && (window as any).go) {
        const data = await GetPublicProfile();
        setProfile(data as unknown as PublicProfileData);
      } else {
        // Fallback for web — fetch from GitHub repo
        const data = await fetchProfileFromRepo(username);
        setProfile(data);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load profile");
    }
    setLoading(false);
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

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-bg/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 h-[52px] flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-subtext hover:text-text transition-colors">
            <ArrowLeft size={16} />
            <img src={reqitLogo} alt="reqit" className="h-[22px] w-auto object-contain" />
          </button>
          <span className="text-xs text-subtext font-mono">reqit.dev</span>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={displayName} className="w-16 h-16 rounded-full object-cover border-2 border-border" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-cyan/10 border-2 border-cyan/30 flex items-center justify-center text-cyan text-2xl font-bold">
              {displayName[0]?.toUpperCase() || "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-text">{displayName}</h1>
            <div className="text-sm text-subtext font-mono">@{profile.username}</div>
            {profile.bio && <p className="text-sm text-text mt-2 leading-relaxed">{profile.bio}</p>}
            <div className="flex items-center gap-3 mt-2 text-xs text-subtext">
              {profile.location && (
                <span className="flex items-center gap-1"><MapPin size={10} />{profile.location}</span>
              )}
              {profile.company && (
                <span className="flex items-center gap-1"><Building size={10} />{profile.company}</span>
              )}
            </div>
          </div>
        </div>

        {/* Links */}
        {profile.links.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {profile.links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-border text-subtext hover:border-cyan/40 hover:text-text transition-all"
              >
                <ExternalLink size={10} />
                {link.label || link.url}
              </a>
            ))}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {[
            { icon: <Folder size={16} />, label: "Collections", value: profile.stats.collectionsCreated, color: "text-cyan" },
            { icon: <Send size={16} />, label: "Requests Sent", value: profile.stats.requestsSent, color: "text-blue-400" },
            { icon: <TestTube size={16} />, label: "Assertions", value: profile.stats.assertionsWritten, color: "text-green-400" },
            { icon: <FileCode2 size={16} />, label: "Specs Authored", value: profile.stats.specsAuthored, color: "text-purple-400" },
            { icon: <Shield size={16} />, label: "Contract Pass", value: `${profile.stats.contractPassRate}%`, color: "text-amber-400" },
            { icon: <FileCheck size={16} />, label: "Protocols", value: profile.stats.protocolsUsed.length, color: "text-pink-400" },
          ].map(({ icon, label, value, color }) => (
            <div key={label} className="p-4 rounded-xl border border-border bg-card/50 hover:border-border transition-colors">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-subtext mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Protocols & Auth */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-4 rounded-xl border border-border bg-card/50">
            <div className="text-xs font-medium text-subtext mb-2">Protocols Used</div>
            <div className="flex flex-wrap gap-1.5">
              {profile.stats.protocolsUsed.map((p) => (
                <span key={p} className="px-2 py-0.5 text-[10px] rounded-full bg-cyan/10 text-cyan font-mono">{p}</span>
              ))}
              {profile.stats.protocolsUsed.length === 0 && (
                <span className="text-xs text-zinc-500">None yet</span>
              )}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card/50">
            <div className="text-xs font-medium text-subtext mb-2">Auth Types</div>
            <div className="flex flex-wrap gap-1.5">
              {profile.stats.authTypesUsed.map((a) => (
                <span key={a} className="px-2 py-0.5 text-[10px] rounded-full bg-purple-500/10 text-purple-400 font-mono">{a}</span>
              ))}
              {profile.stats.authTypesUsed.length === 0 && (
                <span className="text-xs text-zinc-500">None yet</span>
              )}
            </div>
          </div>
        </div>

        {/* Badges */}
        {profile.badges.length > 0 && (
          <div className="mb-8">
            <div className="text-xs font-medium text-subtext mb-3">Badges</div>
            <div className="flex flex-wrap gap-3">
              {profile.badges.map((b) => (
                <div key={b.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card/50">
                  <Award size={16} className="text-amber-400" />
                  <div>
                    <div className="text-xs font-medium text-text">{b.name}</div>
                    <div className="text-[10px] text-subtext">{b.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-subtext pt-8 border-t border-border">
          Built with reqit — the open-source API client
        </div>
      </main>
    </div>
  );
}
