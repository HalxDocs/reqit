import { useState, useEffect, useCallback } from "react";
import { X, MapPin, Building, Globe, Plus, Trash2, RefreshCw, Copy, Check, User, ExternalLink, Code2, GitBranch, MessageSquare, Link as LinkIcon, Folder, Image, Tag } from "lucide-react";
import { toast } from "@/app/stores/useToastStore";
import type { profile } from "../../../../wailsjs/go/models";

interface UserProject {
  name: string;
  description: string;
  url: string;
  liveUrl: string;
  techStack: string[];
  imageUrl: string;
}

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
  skills: string[];
  socialLinks: { type: string; url: string }[];
  githubUsername: string;
  projects: { name: string; description: string; requestCount: number; protocols: string[]; hasSpec: boolean }[];
  userProjects: UserProject[];
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
    skills: [], socialLinks: [], githubUsername: "", projects: [], userProjects: [],
    public: false, updatedAt: "",
  };
}

const SOCIAL_TYPES = [
  { value: "github", label: "GitHub", icon: GitBranch, placeholder: "https://github.com/username" },
  { value: "twitter", label: "X / Twitter", icon: MessageSquare, placeholder: "https://x.com/username" },
  { value: "linkedin", label: "LinkedIn", icon: LinkIcon, placeholder: "https://linkedin.com/in/username" },
  { value: "website", label: "Website", icon: Globe, placeholder: "https://yoursite.com" },
  { value: "devto", label: "DEV.to", icon: Code2, placeholder: "https://dev.to/username" },
];

const COMMON_SKILLS = [
  "Go", "TypeScript", "JavaScript", "Python", "Rust", "Java", "C#", "Ruby",
  "REST API", "GraphQL", "gRPC", "WebSocket", "MQTT", "SOAP",
  "Docker", "Kubernetes", "AWS", "PostgreSQL", "Redis", "MongoDB",
  "CI/CD", "Git", "Linux", "Testing", "Microservices", "OpenAPI",
];

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
  const [skillInput, setSkillInput] = useState("");
  const [techInputs, setTechInputs] = useState<Record<number, string>>({});
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});

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
          skills: prof.skills || [],
          socialLinks: prof.socialLinks || [],
          githubUsername: prof.githubUsername || "",
          projects: (prof.projects || []).map((proj: any) => ({
            name: proj.name || "",
            description: proj.description || "",
            requestCount: proj.requestCount || 0,
            protocols: proj.protocols || [],
            hasSpec: proj.hasSpec || false,
          })),
          userProjects: (prof.userProjects || []).map((up: any) => ({
            name: up.name || "",
            description: up.description || "",
            url: up.url || "",
            liveUrl: up.liveUrl || "",
            techStack: up.techStack || [],
            imageUrl: up.imageUrl || "",
          })),
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
        skills: p.skills,
        socialLinks: p.socialLinks,
        githubUsername: p.githubUsername,
        projects: p.projects,
        userProjects: p.userProjects,
        public: p.public,
        updatedAt: p.updatedAt,
      } as profile.DevProfile);
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

  const addLink = () => setP({ ...p, links: [...p.links, { label: "", url: "" }] });
  const updateLink = (i: number, field: "label" | "url", val: string) => {
    const links = [...p.links];
    links[i] = { ...links[i], [field]: val };
    setP({ ...p, links });
  };
  const removeLink = (i: number) => setP({ ...p, links: p.links.filter((_l, idx) => idx !== i) });

  const addSkill = (skill: string) => {
    const s = skill.trim();
    if (s && !p.skills.includes(s)) setP({ ...p, skills: [...p.skills, s] });
  };
  const removeSkill = (skill: string) => setP({ ...p, skills: p.skills.filter((s) => s !== skill) });
  const handleSkillKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(skillInput); setSkillInput(""); }
  };

  const addSocialLink = (type: string) => {
    if (!p.socialLinks.find((s) => s.type === type)) setP({ ...p, socialLinks: [...p.socialLinks, { type, url: "" }] });
  };
  const updateSocialLink = (type: string, url: string) => {
    setP({ ...p, socialLinks: p.socialLinks.map((s) => (s.type === type ? { ...s, url } : s)) });
  };
  const removeSocialLink = (type: string) => setP({ ...p, socialLinks: p.socialLinks.filter((s) => s.type !== type) });

  const addUserProject = () => {
    const idx = p.userProjects.length;
    setP({ ...p, userProjects: [...p.userProjects, { name: "", description: "", url: "", liveUrl: "", techStack: [], imageUrl: "" }] });
    setExpandedProjects({ ...expandedProjects, [idx]: true });
  };
  const updateUserProject = (i: number, field: keyof UserProject, val: any) => {
    const projects = [...p.userProjects];
    projects[i] = { ...projects[i], [field]: val };
    setP({ ...p, userProjects: projects });
  };
  const removeUserProject = (i: number) => setP({ ...p, userProjects: p.userProjects.filter((_u, idx) => idx !== i) });

  const addTechToProject = (i: number) => {
    const val = (techInputs[i] || "").trim();
    if (!val) return;
    const projects = [...p.userProjects];
    if (!projects[i].techStack.includes(val)) {
      projects[i] = { ...projects[i], techStack: [...projects[i].techStack, val] };
      setP({ ...p, userProjects: projects });
    }
    setTechInputs({ ...techInputs, [i]: "" });
  };
  const removeTechFromProject = (i: number, tech: string) => {
    const projects = [...p.userProjects];
    projects[i] = { ...projects[i], techStack: projects[i].techStack.filter((t) => t !== tech) };
    setP({ ...p, userProjects: projects });
  };

  const PROFILE_BASE = "https://reqit.dev";
  const profileUrl = p.username ? `${PROFILE_BASE}/${p.username}` : "";
  const apiUrl = p.username ? `${PROFILE_BASE}/api/v1/profile/${p.username}` : "";

  const copyUrl = () => {
    if (!profileUrl) return;
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openInBrowser = () => { if (profileUrl) window.open(profileUrl, "_blank"); };

  const saveUpstash = async () => {
    if (!upstashUrl || !upstashToken) { toast.error("Enter both URL and token"); return; }
    try {
      const { SaveUpstashConfig } = await import("../../../../wailsjs/go/main/App");
      await SaveUpstashConfig(upstashUrl, upstashToken);
      setUpstashConfigured(true);
      setShowUpstash(false);
      toast.success("Upstash configured");
    } catch (err: any) { toast.error(`Save failed: ${err?.message || err}`); }
  };

  const suggestedSkills = COMMON_SKILLS.filter((s) => !p.skills.includes(s)).slice(0, 12);
  const unusedSocialTypes = SOCIAL_TYPES.filter((st) => !p.socialLinks.find((s) => s.type === st.value));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[560px] max-h-[85vh] overflow-y-auto bg-card border border-border rounded-xl shadow-2xl mx-4">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex items-center gap-2">
            <User size={16} className="text-cyan" />
            <h2 className="text-sm font-bold text-text">Dev Profile</h2>
          </div>
          <button onClick={onClose} className="text-subtext hover:text-text transition-colors p-1 rounded-md hover:bg-cardHover"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Public toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface">
            <div>
              <div className="text-sm font-medium text-text">Public Profile</div>
              <div className="text-xs text-subtext">Make your dev profile visible at your public URL</div>
            </div>
            <button onClick={togglePublic} className={`relative w-10 h-5 rounded-full transition-colors ${p.public ? "bg-cyan" : "bg-zinc-600"}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${p.public ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          {/* Upstash */}
          <div className="p-3 rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-text">Web Storage</div>
                <div className="text-xs text-subtext">{upstashConfigured ? <span className="text-teal">Upstash connected</span> : "Required to publish profile online"}</div>
              </div>
              <button onClick={() => setShowUpstash(!showUpstash)} className="text-xs text-cyan hover:text-cyan-hover transition-colors">{upstashConfigured ? "Change" : "Setup"}</button>
            </div>
            {showUpstash && (
              <div className="mt-3 space-y-2">
                <input type="url" value={upstashUrl} onChange={(e) => setUpstashUrl(e.target.value)} placeholder="UPSTASH_REDIS_REST_URL" className="w-full h-[28px] px-2 text-xs bg-surface border border-border rounded text-text placeholder:text-zinc-500 outline-none focus:border-cyan" />
                <input type="password" value={upstashToken} onChange={(e) => setUpstashToken(e.target.value)} placeholder="UPSTASH_REDIS_REST_TOKEN" className="w-full h-[28px] px-2 text-xs bg-surface border border-border rounded text-text placeholder:text-zinc-500 outline-none focus:border-cyan" />
                <div className="text-[10px] text-subtext">Get these from <a href="https://upstash.com" target="_blank" rel="noopener" className="text-cyan hover:text-cyan-hover">upstash.com</a> → Create Database → copy URL and Token</div>
                <button onClick={saveUpstash} className="h-[28px] px-3 text-xs font-bold rounded-md bg-cyan text-white hover:bg-cyan-hover transition-all">Save</button>
              </div>
            )}
          </div>

          {/* URLs */}
          {p.username && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-surface">
                <Globe size={14} className="text-subtext shrink-0" />
                <span className="text-xs text-subtext truncate flex-1 font-mono">{profileUrl}</span>
                <button onClick={openInBrowser} className="text-xs text-cyan hover:text-cyan-hover transition-colors shrink-0 flex items-center gap-1 font-medium"><ExternalLink size={12} />Open</button>
                <button onClick={copyUrl} className="text-xs text-subtext hover:text-text transition-colors shrink-0 flex items-center gap-1">{copied ? <><Check size={12} />Copied</> : <><Copy size={12} />Copy</>}</button>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-surface">
                <Code2 size={14} className="text-subtext shrink-0" />
                <span className="text-xs text-subtext truncate flex-1 font-mono">{apiUrl}</span>
                <button onClick={() => { navigator.clipboard.writeText(apiUrl); toast.success("API URL copied"); }} className="text-xs text-cyan hover:text-cyan-hover transition-colors shrink-0 flex items-center gap-1 font-medium"><Copy size={12} />API</button>
              </div>
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-xs font-medium text-subtext mb-1">Username</label>
            <input type="text" value={p.username} onChange={(e) => setP({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="your-name" className="w-full h-[32px] px-3 text-sm bg-surface border border-border rounded-md text-text placeholder:text-zinc-500 outline-none focus:border-cyan focus:ring-2 focus:ring-cyan" />
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-medium text-subtext mb-1">Display Name</label>
            <input type="text" value={p.displayName} onChange={(e) => setP({ ...p, displayName: e.target.value })} placeholder="Jane Doe" className="w-full h-[32px] px-3 text-sm bg-surface border border-border rounded-md text-text placeholder:text-zinc-500 outline-none focus:border-cyan focus:ring-2 focus:ring-cyan" />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-medium text-subtext mb-1">Bio</label>
            <textarea value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} placeholder="Backend engineer who loves APIs, databases, and clean architecture." rows={2} className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-md text-text placeholder:text-zinc-500 outline-none focus:border-cyan focus:ring-2 focus:ring-cyan resize-none" />
          </div>

          {/* Location & Company */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-subtext mb-1"><MapPin size={10} className="inline mr-1" />Location</label>
              <input type="text" value={p.location} onChange={(e) => setP({ ...p, location: e.target.value })} placeholder="Nigeria" className="w-full h-[32px] px-3 text-sm bg-surface border border-border rounded-md text-text placeholder:text-zinc-500 outline-none focus:border-cyan focus:ring-2 focus:ring-cyan" />
            </div>
            <div>
              <label className="block text-xs font-medium text-subtext mb-1"><Building size={10} className="inline mr-1" />Company</label>
              <input type="text" value={p.company} onChange={(e) => setP({ ...p, company: e.target.value })} placeholder="Acme Corp" className="w-full h-[32px] px-3 text-sm bg-surface border border-border rounded-md text-text placeholder:text-zinc-500 outline-none focus:border-cyan focus:ring-2 focus:ring-cyan" />
            </div>
          </div>

          {/* Skills */}
          <div>
            <label className="block text-xs font-medium text-subtext mb-1"><Code2 size={10} className="inline mr-1" />Skills & Technologies</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {p.skills.map((skill) => (
                <span key={skill} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-cyan/10 text-cyan border border-cyan/20">
                  {skill}
                  <button onClick={() => removeSkill(skill)} className="hover:text-red-400 transition-colors"><X size={10} /></button>
                </span>
              ))}
            </div>
            <input type="text" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={handleSkillKeyDown} placeholder="Type a skill and press Enter (e.g. Go, REST API, Docker)" className="w-full h-[28px] px-2 text-xs bg-surface border border-border rounded text-text placeholder:text-zinc-500 outline-none focus:border-cyan" />
            {suggestedSkills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {suggestedSkills.map((skill) => (
                  <button key={skill} onClick={() => addSkill(skill)} className="px-2 py-0.5 text-[10px] rounded-full border border-border text-subtext hover:border-cyan/40 hover:text-cyan transition-all">+ {skill}</button>
                ))}
              </div>
            )}
          </div>

          {/* GitHub Username */}
          <div>
            <label className="block text-xs font-medium text-subtext mb-1"><GitBranch size={10} className="inline mr-1" />GitHub Username</label>
            <input type="text" value={p.githubUsername} onChange={(e) => setP({ ...p, githubUsername: e.target.value.replace(/[^a-zA-Z0-9-]/g, "") })} placeholder="your-github-username" className="w-full h-[32px] px-3 text-sm bg-surface border border-border rounded-md text-text placeholder:text-zinc-500 outline-none focus:border-cyan focus:ring-2 focus:ring-cyan" />
            <div className="text-[10px] text-subtext mt-1">Shows your recent commits and contribution activity on your profile</div>
          </div>

          {/* User Projects */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-subtext"><Folder size={10} className="inline mr-1" />My Projects</label>
              <button onClick={addUserProject} className="text-xs text-cyan hover:text-cyan-hover flex items-center gap-1"><Plus size={10} />Add Project</button>
            </div>
            <div className="text-[10px] text-subtext mb-2">Add your own projects to showcase on your profile</div>

            {p.userProjects.length === 0 && p.projects.length === 0 && (
              <div className="text-[10px] text-zinc-500 p-3 rounded-lg border border-dashed border-border text-center">No projects yet. Add your own or create collections in reqit.</div>
            )}

            {p.projects.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] text-zinc-500 mb-1.5 font-medium">From collections (auto)</div>
                <div className="space-y-1.5">
                  {p.projects.map((proj) => (
                    <div key={proj.name} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-surface/50">
                      <Folder size={12} className="text-cyan shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-text font-medium truncate">{proj.name}</div>
                        <div className="text-[10px] text-subtext">{proj.requestCount} requests{proj.hasSpec ? " · OpenAPI" : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {p.userProjects.length > 0 && (
              <div className="space-y-3">
                {p.userProjects.map((up, i) => {
                  const isExpanded = expandedProjects[i];
                  if (isExpanded) {
                    return (
                      <div key={i} className="p-3 rounded-lg border border-cyan/30 bg-surface/50 space-y-2">
                        <div className="flex items-center gap-2">
                          <input type="text" value={up.name} onChange={(e) => updateUserProject(i, "name", e.target.value)} placeholder="Project name" className="flex-1 h-[28px] px-2 text-xs bg-surface border border-border rounded text-text placeholder:text-zinc-500 outline-none focus:border-cyan" />
                          <button onClick={() => removeUserProject(i)} className="text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                        </div>
                        <textarea value={up.description} onChange={(e) => updateUserProject(i, "description", e.target.value)} placeholder="What does this project do?" rows={2} className="w-full px-2 py-1.5 text-xs bg-surface border border-border rounded text-text placeholder:text-zinc-500 outline-none focus:border-cyan resize-none" />
                        <div className="grid grid-cols-2 gap-2">
                          <input type="url" value={up.url} onChange={(e) => updateUserProject(i, "url", e.target.value)} placeholder="GitHub repo URL" className="h-[28px] px-2 text-xs bg-surface border border-border rounded text-text placeholder:text-zinc-500 outline-none focus:border-cyan" />
                          <input type="url" value={up.liveUrl} onChange={(e) => updateUserProject(i, "liveUrl", e.target.value)} placeholder="Live demo URL" className="h-[28px] px-2 text-xs bg-surface border border-border rounded text-text placeholder:text-zinc-500 outline-none focus:border-cyan" />
                        </div>
                        <input type="url" value={up.imageUrl} onChange={(e) => updateUserProject(i, "imageUrl", e.target.value)} placeholder="Screenshot URL (optional)" className="w-full h-[28px] px-2 text-xs bg-surface border border-border rounded text-text placeholder:text-zinc-500 outline-none focus:border-cyan" />
                        <div>
                          <div className="flex flex-wrap gap-1 mb-1">
                            {up.techStack.map((tech) => (
                              <span key={tech} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-purple-500/10 text-purple-400 border border-purple-400/20">
                                {tech}
                                <button onClick={() => removeTechFromProject(i, tech)} className="hover:text-red-400"><X size={8} /></button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={techInputs[i] || ""}
                              onChange={(e) => setTechInputs({ ...techInputs, [i]: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTechToProject(i); } }}
                              placeholder="Add tech (e.g. React, Node.js)"
                              className="flex-1 h-[26px] px-2 text-[10px] bg-surface border border-border rounded text-text placeholder:text-zinc-500 outline-none focus:border-cyan"
                            />
                            <button
                              onClick={() => addTechToProject(i)}
                              className="h-[26px] px-2 text-[10px] font-bold rounded bg-purple-500/20 text-purple-400 border border-purple-400/20 hover:bg-purple-500/30 transition-colors flex items-center gap-0.5"
                            >
                              <Plus size={10} />Add
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button onClick={() => removeUserProject(i)} className="h-[28px] px-3 text-xs font-bold rounded-md border border-border text-zinc-400 hover:text-red-400 hover:border-red-400/30 transition-all">Cancel</button>
                          <button
                            onClick={() => { setExpandedProjects({ ...expandedProjects, [i]: false }); toast.success(up.name ? `"${up.name}" added` : "Project added"); }}
                            className="h-[28px] px-4 text-xs font-bold rounded-md bg-cyan text-white hover:bg-cyan-hover transition-all"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="p-3 rounded-lg border border-border bg-surface/50 space-y-2 cursor-pointer hover:border-cyan/30 transition-colors" onClick={() => setExpandedProjects({ ...expandedProjects, [i]: true })}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Folder size={12} className="text-cyan" />
                          <span className="text-xs font-medium text-text">{up.name || "Untitled project"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => { e.stopPropagation(); removeUserProject(i); }} className="text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                          <span className="text-[10px] text-cyan">Edit</span>
                        </div>
                      </div>
                      {up.description && <div className="text-[10px] text-subtext truncate">{up.description}</div>}
                      <div className="flex flex-wrap gap-1">
                        {up.techStack.map((tech) => (
                          <span key={tech} className="px-1.5 py-0.5 text-[9px] rounded-full bg-purple-500/10 text-purple-400 border border-purple-400/20">{tech}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Social Links */}
          <div>
            <label className="block text-xs font-medium text-subtext mb-1"><LinkIcon size={10} className="inline mr-1" />Social Links</label>
            <div className="space-y-2">
              {p.socialLinks.map((sl) => {
                const meta = SOCIAL_TYPES.find((st) => st.value === sl.type);
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <div key={sl.type} className="flex items-center gap-2">
                    <Icon size={14} className="text-subtext shrink-0" />
                    <input type="url" value={sl.url} onChange={(e) => updateSocialLink(sl.type, e.target.value)} placeholder={meta.placeholder} className="flex-1 h-[28px] px-2 text-xs bg-surface border border-border rounded text-text placeholder:text-zinc-500 outline-none focus:border-cyan" />
                    <button onClick={() => removeSocialLink(sl.type)} className="text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                  </div>
                );
              })}
            </div>
            {unusedSocialTypes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {unusedSocialTypes.map((st) => {
                  const Icon = st.icon;
                  return (
                    <button key={st.value} onClick={() => addSocialLink(st.value)} className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full border border-border text-subtext hover:border-cyan/40 hover:text-cyan transition-all">
                      <Icon size={10} />+ {st.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Links */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-subtext"><ExternalLink size={10} className="inline mr-1" />Other Links</label>
              <button onClick={addLink} className="text-xs text-cyan hover:text-cyan-hover flex items-center gap-1"><Plus size={10} />Add</button>
            </div>
            {p.links.map((link, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input type="text" value={link.label} onChange={(e) => updateLink(i, "label", e.target.value)} placeholder="Label" className="w-24 h-[28px] px-2 text-xs bg-surface border border-border rounded text-text placeholder:text-zinc-500 outline-none focus:border-cyan" />
                <input type="url" value={link.url} onChange={(e) => updateLink(i, "url", e.target.value)} placeholder="https://..." className="flex-1 h-[28px] px-2 text-xs bg-surface border border-border rounded text-text placeholder:text-zinc-500 outline-none focus:border-cyan" />
                <button onClick={() => removeLink(i)} className="text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-subtext">Stats</label>
              <button onClick={refreshStats} className="text-xs text-cyan hover:text-cyan-hover flex items-center gap-1"><RefreshCw size={10} />Refresh</button>
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
          <div className="flex items-center gap-3 pt-2 pb-2">
            <button onClick={save} disabled={saving || !p.username} className="h-[32px] px-4 text-sm font-bold rounded-md bg-cyan text-white hover:bg-cyan-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? "Saving..." : "Save Profile"}
            </button>
            {saved && <span className="text-[11px] text-teal">Saved</span>}
            <button onClick={publish} disabled={publishing || !p.username} className="h-[32px] px-4 text-sm font-bold rounded-md bg-purple-500 text-white hover:bg-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
              <Globe size={12} />{publishing ? "Publishing..." : "Publish to Web"}
            </button>
            {published && <span className="text-[11px] text-teal">Published</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
