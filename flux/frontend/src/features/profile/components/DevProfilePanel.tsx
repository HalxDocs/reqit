import { useState, useEffect, useCallback } from "react";
import { X, MapPin, Building, Globe, Plus, Trash2, RefreshCw, Copy, Check, User, ExternalLink } from "lucide-react";
import { useUIStore } from "@/app/stores/useUIStore";
import { toast } from "@/app/stores/useToastStore";

interface DevProfileData {
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
  public: boolean;
  updatedAt: string;
}

function emptyProfile(): DevProfileData {
  return {
    username: "", displayName: "", bio: "", avatarUrl: "",
    links: [], location: "", company: "", badges: [],
    stats: { collectionsCreated: 0, requestsSent: 0, assertionsWritten: 0,
             specsAuthored: 0, mockServersCreated: 0, contractPassRate: 0,
             protocolsUsed: [], authTypesUsed: [] },
    public: false, updatedAt: "",
  };
}

export function DevProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [p, setP] = useState<DevProfileData>(emptyProfile);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);
  const [upstashUrl, setUpstashUrl] = useState("");
  const [upstashToken, setUpstashToken] = useState("");
  const [upstashConfigured, setUpstashConfigured] = useState(false);
  const [showUpstash, setShowUpstash] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const { GetDevProfile } = await import("../../../../wailsjs/go/main/App");
      const prof = await GetDevProfile();
      if (prof) {
        setP({
          username: prof.username || "",
          displayName: prof.displayName || "",
          bio: prof.bio || "",
          avatarUrl: prof.avatarUrl || "",
          links: prof.links || [],
          location: prof.location || "",
          company: prof.company || "",
          badges: prof.badges || [],
          stats: {
            collectionsCreated: prof.stats?.collectionsCreated || 0,
            requestsSent: prof.stats?.requestsSent || 0,
            assertionsWritten: prof.stats?.assertionsWritten || 0,
            specsAuthored: prof.stats?.specsAuthored || 0,
            mockServersCreated: prof.stats?.mockServersCreated || 0,
            contractPassRate: prof.stats?.contractPassRate || 0,
            protocolsUsed: prof.stats?.protocolsUsed || [],
            authTypesUsed: prof.stats?.authTypesUsed || [],
          },
          public: prof.public || false,
          updatedAt: prof.updatedAt || "",
        });
      }
    } catch (e) {
      console.warn("DevProfile: could not load profile (first launch?):", e);
    }
  }, []);

  const loadUpstashStatus = useCallback(async () => {
    try {
      const { IsUpstashConfigured } = await import("../../../../wailsjs/go/main/App");
      const ok = await IsUpstashConfigured();
      setUpstashConfigured(ok);
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    if (open) {
      loadProfile();
      loadUpstashStatus();
    }
  }, [open, loadProfile, loadUpstashStatus]);

  const refreshStats = async () => {
    try {
      const { ComputeDevStats } = await import("../../../../wailsjs/go/main/App");
      const s = await ComputeDevStats();
      if (s) {
        setP((prev) => ({
          ...prev,
          stats: {
            collectionsCreated: s.collectionsCreated || 0,
            requestsSent: s.requestsSent || 0,
            assertionsWritten: s.assertionsWritten || 0,
            specsAuthored: s.specsAuthored || 0,
            mockServersCreated: s.mockServersCreated || 0,
            contractPassRate: s.contractPassRate || 0,
            protocolsUsed: s.protocolsUsed || [],
            authTypesUsed: s.authTypesUsed || [],
          },
        }));
      }
    } catch (e) {
      console.warn("DevProfile: could not compute stats:", e);
    }
  };

  const save = async () => {
    if (!p.username) return;
    setSaving(true);
    try {
      const { SaveDevProfile } = await import("../../../../wailsjs/go/main/App");
      await SaveDevProfile({
        username: p.username,
        displayName: p.displayName,
        bio: p.bio,
        avatarUrl: p.avatarUrl,
        links: p.links,
        location: p.location,
        company: p.company,
        badges: p.badges,
        stats: p.stats,
        public: p.public,
        updatedAt: p.updatedAt,
      } as any);
      setSaved(true);
      toast.success("Profile saved");
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message || err}`);
    }
    setSaving(false);
  };

  const publish = async () => {
    if (!p.username) {
      toast.error("Set a username first");
      return;
    }
    setPublishing(true);
    try {
      const { PublishDevProfile } = await import("../../../../wailsjs/go/main/App");
      const url = await PublishDevProfile();
      setPublished(true);
      toast.success("Profile published! Live at " + url);
      setTimeout(() => setPublished(false), 5000);
    } catch (err: any) {
      toast.error(`Publish failed: ${err?.message || err}`);
    }
    setPublishing(false);
  };

  const togglePublic = async () => {
    const next = !p.public;
    setP({ ...p, public: next });
    try {
      const { SetDevProfilePublic } = await import("../../../../wailsjs/go/main/App");
      await SetDevProfilePublic(next);
    } catch { /* ignore */ }
  };

  const addLink = () => {
    setP({ ...p, links: [...p.links, { label: "", url: "" }] });
  };

  const updateLink = (i: number, field: "label" | "url", val: string) => {
    const links = [...p.links];
    links[i] = { ...links[i], [field]: val };
    setP({ ...p, links });
  };

  const removeLink = (i: number) => {
    setP({ ...p, links: p.links.filter((_l, idx) => idx !== i) });
  };

  const PROFILE_BASE = "https://reqit.vercel.app";
  const profileUrl = p.username ? `${PROFILE_BASE}/${p.username}` : "";

  const copyUrl = () => {
    if (!profileUrl) return;
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openInBrowser = () => {
    if (!profileUrl) return;
    window.open(profileUrl, "_blank");
  };

  const saveUpstash = async () => {
    if (!upstashUrl || !upstashToken) {
      toast.error("Enter both URL and token");
      return;
    }
    try {
      const { SaveUpstashConfig } = await import("../../../../wailsjs/go/main/App");
      await SaveUpstashConfig(upstashUrl, upstashToken);
      setUpstashConfigured(true);
      setShowUpstash(false);
      toast.success("Upstash configured");
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message || err}`);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[520px] max-h-[85vh] overflow-y-auto bg-card border border-border rounded-xl shadow-2xl mx-4">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex items-center gap-2">
            <User size={16} className="text-cyan" />
            <h2 className="text-sm font-bold text-text">Dev Profile</h2>
          </div>
          <button onClick={onClose} className="text-subtext hover:text-text transition-colors p-1 rounded-md hover:bg-cardHover">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Public toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface">
            <div>
              <div className="text-sm font-medium text-text">Public Profile</div>
              <div className="text-xs text-subtext">Make your dev profile visible at your public URL</div>
            </div>
            <button
              onClick={togglePublic}
              className={`relative w-10 h-5 rounded-full transition-colors ${p.public ? "bg-cyan" : "bg-zinc-600"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${p.public ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          {/* Upstash Config */}
          <div className="p-3 rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-text">Web Storage</div>
                <div className="text-xs text-subtext">
                  {upstashConfigured ? (
                    <span className="text-teal">Upstash connected</span>
                  ) : (
                    "Required to publish profile online"
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowUpstash(!showUpstash)}
                className="text-xs text-cyan hover:text-cyan-hover transition-colors"
              >
                {upstashConfigured ? "Change" : "Setup"}
              </button>
            </div>
            {showUpstash && (
              <div className="mt-3 space-y-2">
                <input
                  type="url"
                  value={upstashUrl}
                  onChange={(e) => setUpstashUrl(e.target.value)}
                  placeholder="UPSTASH_REDIS_REST_URL"
                  className="w-full h-[28px] px-2 text-xs bg-surface border border-border rounded text-text placeholder:text-zinc-500 outline-none focus:border-cyan"
                />
                <input
                  type="password"
                  value={upstashToken}
                  onChange={(e) => setUpstashToken(e.target.value)}
                  placeholder="UPSTASH_REDIS_REST_TOKEN"
                  className="w-full h-[28px] px-2 text-xs bg-surface border border-border rounded text-text placeholder:text-zinc-500 outline-none focus:border-cyan"
                />
                <div className="text-[10px] text-subtext">
                  Get these from{" "}
                  <a href="https://upstash.com" target="_blank" rel="noopener" className="text-cyan hover:text-cyan-hover">
                    upstash.com
                  </a>{" "}
                  → Create Database → copy URL and Token
                </div>
                <button
                  onClick={saveUpstash}
                  className="h-[28px] px-3 text-xs font-bold rounded-md bg-cyan text-white hover:bg-cyan-hover transition-all"
                >
                  Save
                </button>
              </div>
            )}
          </div>

          {/* Profile URL */}
          {p.username && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-surface">
              <Globe size={14} className="text-subtext shrink-0" />
              <span className="text-xs text-subtext truncate flex-1 font-mono">{profileUrl}</span>
              <button onClick={openInBrowser} className="text-xs text-cyan hover:text-cyan-hover transition-colors shrink-0 flex items-center gap-1 font-medium" title="Open in browser">
                <ExternalLink size={12} />Open
              </button>
              <button onClick={copyUrl} className="text-xs text-subtext hover:text-text transition-colors shrink-0 flex items-center gap-1" title="Copy URL">
                {copied ? <><Check size={12} />Copied</> : <><Copy size={12} />Copy</>}
              </button>
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-xs font-medium text-subtext mb-1">Username</label>
            <input
              type="text"
              value={p.username}
              onChange={(e) => setP({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
              placeholder="your-name"
              className="w-full h-[32px] px-3 text-sm bg-surface border border-border rounded-md text-text placeholder:text-zinc-500 outline-none focus:border-cyan focus:ring-2 focus:ring-cyan"
            />
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-medium text-subtext mb-1">Display Name</label>
            <input
              type="text"
              value={p.displayName}
              onChange={(e) => setP({ ...p, displayName: e.target.value })}
              placeholder="Jane Doe"
              className="w-full h-[32px] px-3 text-sm bg-surface border border-border rounded-md text-text placeholder:text-zinc-500 outline-none focus:border-cyan focus:ring-2 focus:ring-cyan"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-medium text-subtext mb-1">Bio</label>
            <textarea
              value={p.bio}
              onChange={(e) => setP({ ...p, bio: e.target.value })}
              placeholder="Backend engineer who loves APIs, databases, and clean architecture."
              rows={2}
              className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-md text-text placeholder:text-zinc-500 outline-none focus:border-cyan focus:ring-2 focus:ring-cyan resize-none"
            />
          </div>

          {/* Location & Company */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-subtext mb-1"><MapPin size={10} className="inline mr-1" />Location</label>
              <input
                type="text"
                value={p.location}
                onChange={(e) => setP({ ...p, location: e.target.value })}
                placeholder="Nigeria"
                className="w-full h-[32px] px-3 text-sm bg-surface border border-border rounded-md text-text placeholder:text-zinc-500 outline-none focus:border-cyan focus:ring-2 focus:ring-cyan"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-subtext mb-1"><Building size={10} className="inline mr-1" />Company</label>
              <input
                type="text"
                value={p.company}
                onChange={(e) => setP({ ...p, company: e.target.value })}
                placeholder="Acme Corp"
                className="w-full h-[32px] px-3 text-sm bg-surface border border-border rounded-md text-text placeholder:text-zinc-500 outline-none focus:border-cyan focus:ring-2 focus:ring-cyan"
              />
            </div>
          </div>

          {/* Links */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-subtext">Links</label>
              <button onClick={addLink} className="text-xs text-cyan hover:text-cyan-hover flex items-center gap-1">
                <Plus size={10} />Add
              </button>
            </div>
            {p.links.map((link, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={link.label}
                  onChange={(e) => updateLink(i, "label", e.target.value)}
                  placeholder="Label"
                  className="w-24 h-[28px] px-2 text-xs bg-surface border border-border rounded text-text placeholder:text-zinc-500 outline-none focus:border-cyan"
                />
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => updateLink(i, "url", e.target.value)}
                  placeholder="https://..."
                  className="flex-1 h-[28px] px-2 text-xs bg-surface border border-border rounded text-text placeholder:text-zinc-500 outline-none focus:border-cyan"
                />
                <button onClick={() => removeLink(i)} className="text-zinc-500 hover:text-red-400 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-subtext">Stats</label>
              <button onClick={refreshStats} className="text-xs text-cyan hover:text-cyan-hover flex items-center gap-1">
                <RefreshCw size={10} />Refresh
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Collections", value: p.stats.collectionsCreated },
                { label: "Requests", value: p.stats.requestsSent },
                { label: "Assertions", value: p.stats.assertionsWritten },
                { label: "Specs", value: p.stats.specsAuthored },
                { label: "Contract", value: `${p.stats.contractPassRate}%` },
                { label: "Protocols", value: p.stats.protocolsUsed.length },
              ].map(({ label, value }) => (
                <div key={label} className="p-2 rounded-md bg-surface border border-border text-center">
                  <div className="text-lg font-bold text-text">{value}</div>
                  <div className="text-[10px] text-subtext">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Save + Publish */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={save}
              disabled={saving || !p.username}
              className="h-[32px] px-4 text-sm font-bold rounded-md bg-cyan text-white hover:bg-cyan-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
            {saved && <span className="text-11 text-teal">Saved</span>}
            <button
              onClick={publish}
              disabled={publishing || !p.username}
              className="h-[32px] px-4 text-sm font-bold rounded-md bg-purple-500 text-white hover:bg-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Globe size={12} />
              {publishing ? "Publishing..." : "Publish to Web"}
            </button>
            {published && <span className="text-11 text-teal">Published</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
