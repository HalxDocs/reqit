import { useEffect, useState } from "react";
import { useUIStore } from "@/app/stores/useUIStore";
import { ArrowLeftRight, Book, GitPullRequest, Globe, HeartHandshake, MessageCircle, Star, Trophy, Users, Vote } from "lucide-react";
import { GetTiers, GetTierCategories, GetRecipes, GetRecipe, GetRecipeCategories, GetCommunityConfig, SetDiscordURL, GetFeatureRequests, UpvoteFeatureRequest, GetBadges } from "../../../../wailsjs/go/main/App";

type SubTab = "tiers" | "recipes" | "community" | "roadmap" | "badges";

export function GrowthPanel() {
  const setView = useUIStore((s) => s.setView);
  const [tab, setTab] = useState<SubTab>("tiers");
  const [msg, setMsg] = useState("");

  const tabs: { key: SubTab; label: string; icon: React.ReactNode }[] = [
    { key: "tiers", label: "Tiers", icon: <Trophy size={13} /> },
    { key: "recipes", label: "Recipes", icon: <Book size={13} /> },
    { key: "community", label: "Community", icon: <Users size={13} /> },
    { key: "roadmap", label: "Roadmap", icon: <Vote size={13} /> },
    { key: "badges", label: "Badges", icon: <Star size={13} /> },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg">
      <header className="h-[48px] flex items-center gap-3 px-4 border-b border-border shrink-0">
        <button onClick={() => setView("http")} className="text-subtext hover:text-text text-13 transition-colors">&larr; Back</button>
        <h1 className="text-14 font-semibold text-text">Growth &amp; Community</h1>
      </header>
      <div className="flex gap-1 px-4 py-2 border-b border-border overflow-x-auto shrink-0">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setMsg(""); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-12 rounded-md transition-colors whitespace-nowrap ${
              tab === t.key ? "bg-cyan/10 text-cyan font-semibold" : "text-subtext hover:text-text hover:bg-cardHover"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-cyan/10 text-cyan text-13 border border-cyan/20">{msg}</div>}
        {tab === "tiers" && <TiersTab onMsg={setMsg} />}
        {tab === "recipes" && <RecipesTab onMsg={setMsg} />}
        {tab === "community" && <CommunityTab onMsg={setMsg} />}
        {tab === "roadmap" && <RoadmapTab onMsg={setMsg} />}
        {tab === "badges" && <BadgesTab onMsg={setMsg} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Open-core / Tier Definitions                                    */
/* ------------------------------------------------------------------ */

interface FeatureTier {
  feature: string;
  oss: boolean;
  pro: boolean;
  enterprise: boolean;
  category: string;
  description: string;
}

function TiersTab({ onMsg }: { onMsg: (m: string) => void }) {
  const [tiers, setTiers] = useState<FeatureTier[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("");
  useEffect(() => {
    GetTiers().then((raw) => {
      try { setTiers(JSON.parse(raw)); } catch {}
    }).catch(() => {});
    GetTierCategories().then(setCategories).catch(() => {});
  }, []);

  const filtered = filter
    ? tiers.filter((t) => t.category === filter)
    : tiers;

  const cell = (v: boolean) => (
    <span className={`inline-block w-5 h-5 rounded-full ${v ? "bg-cyan text-bg" : "bg-cardHover text-subtext"} flex items-center justify-center text-10 font-bold`}>
      {v ? "✓" : "—"}
    </span>
  );

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-13 text-subtext leading-relaxed">
        Reqit follows an <strong className="text-text">open-core model</strong>: the core HTTP client, scripting,
        collections, and Git sync are free and open-source. Advanced protocols, enterprise security,
        and team features are available in paid tiers. This ensures long-term sustainability while
        keeping the community edition powerful and unrestricted.
      </p>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter("")}
          className={`px-3 py-1 rounded-md text-11 transition-colors ${!filter ? "bg-cyan/10 text-cyan font-semibold" : "text-subtext hover:text-text bg-card hover:bg-cardHover"}`}
        >All</button>
        {categories.map((c) => (
          <button key={c} onClick={() => setFilter(c)}
            className={`px-3 py-1 rounded-md text-11 transition-colors ${filter === c ? "bg-cyan/10 text-cyan font-semibold" : "text-subtext hover:text-text bg-card hover:bg-cardHover"}`}
          >{c}</button>
        ))}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-12">
          <thead>
            <tr className="bg-surface border-b border-border">
              <th className="text-left px-3 py-2 text-subtext font-semibold">Feature</th>
              <th className="text-center px-3 py-2 text-subtext font-semibold w-[50px]">OSS</th>
              <th className="text-center px-3 py-2 text-subtext font-semibold w-[50px]">Pro</th>
              <th className="text-center px-3 py-2 text-subtext font-semibold w-[80px]">Enterprise</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-cardHover/50 transition-colors">
                <td className="px-3 py-2">
                  <div className="text-text">{t.feature}</div>
                  <div className="text-11 text-subtext/70">{t.description}</div>
                </td>
                <td className="text-center px-3">{cell(t.oss)}</td>
                <td className="text-center px-3">{cell(t.pro)}</td>
                <td className="text-center px-3">{cell(t.enterprise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 text-11 text-subtext pt-2">
        <span><span className="inline-block w-3 h-3 rounded-full bg-cyan align-middle mr-1" /> Included</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-cardHover align-middle mr-1" /> Not included</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Documentation & Recipes (Cookbooks)                             */
/* ------------------------------------------------------------------ */

interface Step {
  order: number;
  title: string;
  instruction: string;
  code: string;
  expected: string;
}

interface Recipe {
  id: string;
  title: string;
  category: string;
  description: string;
  steps: Step[];
  tags: string[];
}

function RecipesTab({ onMsg }: { onMsg: (m: string) => void }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [catFilter, setCatFilter] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<Recipe | null>(null);

  useEffect(() => {
    GetRecipes().then((raw) => {
      try { setRecipes(JSON.parse(raw)); } catch {}
    }).catch(() => {});
    GetRecipeCategories().then(setCategories).catch(() => {});
  }, []);

  const filtered = catFilter ? recipes.filter((r) => r.category === catFilter) : recipes;

  if (detail) {
    return (
      <div className="max-w-2xl space-y-4">
        <button onClick={() => setDetail(null)} className="text-12 text-cyan hover:text-cyan/80 transition-colors">&larr; Back to recipes</button>
        <h2 className="text-16 font-semibold text-text">{detail.title}</h2>
        <p className="text-13 text-subtext">{detail.description}</p>
        <div className="flex gap-2 flex-wrap">
          {detail.tags.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-cyan/10 text-cyan text-10">{t}</span>
          ))}
        </div>
        <div className="space-y-3">
          {detail.steps.map((s) => (
            <div key={s.order} className="rounded-lg border border-border p-3 bg-surface">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan/15 text-cyan flex items-center justify-center text-10 font-bold shrink-0 mt-0.5">{s.order}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-13 font-semibold text-text mb-1">{s.title}</h3>
                  <p className="text-12 text-subtext/80 mb-2">{s.instruction}</p>
                  {s.code && (
                    <pre className="text-11 bg-bg rounded-md p-2.5 overflow-x-auto text-text border border-border/50"><code>{s.code}</code></pre>
                  )}
                  {s.expected && (
                    <p className="text-12 text-cyan/80 mt-1"><span className="font-semibold">Expected:</span> {s.expected}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-13 text-subtext leading-relaxed">
        Step-by-step developer cookbooks to help you master complex scenarios — from chained
        authentication loops to CI/CD integration.
      </p>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setCatFilter("")}
          className={`px-3 py-1 rounded-md text-11 transition-colors ${!catFilter ? "bg-cyan/10 text-cyan font-semibold" : "text-subtext hover:text-text bg-card hover:bg-cardHover"}`}
        >All</button>
        {categories.map((c) => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={`px-3 py-1 rounded-md text-11 transition-colors ${catFilter === c ? "bg-cyan/10 text-cyan font-semibold" : "text-subtext hover:text-text bg-card hover:bg-cardHover"}`}
          >{c}</button>
        ))}
      </div>

      <div className="grid gap-2">
        {filtered.map((r) => (
          <button key={r.id} onClick={() => setDetail(r)}
            className="text-left rounded-lg border border-border p-3 bg-surface hover:bg-cardHover transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-13 font-semibold text-text">{r.title}</h3>
                <p className="text-12 text-subtext mt-0.5">{r.description}</p>
              </div>
              <span className="text-11 text-cyan/70 shrink-0 whitespace-nowrap">{r.steps.length} steps</span>
            </div>
            <div className="flex gap-2 mt-1.5">
              <span className="px-2 py-0.5 rounded-full bg-cyan/8 text-cyan/70 text-10">{r.category}</span>
              {r.tags.slice(0, 3).map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-full bg-cardHover text-subtext/70 text-10">{t}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Community Architecture                                          */
/* ------------------------------------------------------------------ */

interface CommunityConfig {
  discord_url: string;
  github_discussions: string;
  github_issues: string;
  twitter_url: string;
  maintainers_online: number;
  last_updated: string;
}

function CommunityTab({ onMsg }: { onMsg: (m: string) => void }) {
  const [cfg, setCfg] = useState<CommunityConfig | null>(null);
  const [discordURL, setDiscordURL] = useState("");
  useEffect(() => {
    GetCommunityConfig().then((raw) => {
      try {
        const c = JSON.parse(raw) as CommunityConfig;
        setCfg(c);
        setDiscordURL(c.discord_url);
      } catch {}
    }).catch(() => {});
  }, []);

  const handleSaveDiscord = async () => {
    try {
      await SetDiscordURL(discordURL);
      onMsg("Discord URL updated");
    } catch (e) {
      onMsg(String(e));
    }
  };

  if (!cfg) return <div className="text-subtext text-13">Loading community info...</div>;

  return (
    <div className="max-w-xl space-y-5">
      <p className="text-13 text-subtext leading-relaxed">
        Reqit is built in the open. Join our community spaces to ask questions, share feedback,
        and connect with maintainers and other users.
      </p>

      <div className="rounded-lg border border-border overflow-hidden">
        <a href={cfg.discord_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 hover:bg-cardHover transition-colors border-b border-border group"
        >
          <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-400 shrink-0">
            <MessageCircle size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-13 text-text group-hover:text-cyan transition-colors font-semibold">Discord</div>
            <div className="text-12 text-subtext truncate">{cfg.discord_url}</div>
          </div>
          <span className="text-subtext/50 text-11 shrink-0">Join &rarr;</span>
        </a>
        <a href={cfg.github_discussions} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 hover:bg-cardHover transition-colors border-b border-border group"
        >
          <div className="w-9 h-9 rounded-lg bg-cyan/15 flex items-center justify-center text-cyan shrink-0">
            <HeartHandshake size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-13 text-text group-hover:text-cyan transition-colors font-semibold">GitHub Discussions</div>
            <div className="text-12 text-subtext truncate">{cfg.github_discussions}</div>
          </div>
          <span className="text-subtext/50 text-11 shrink-0">Explore &rarr;</span>
        </a>
        <a href={cfg.github_issues} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 hover:bg-cardHover transition-colors group"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
            <GitPullRequest size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-13 text-text group-hover:text-cyan transition-colors font-semibold">GitHub Issues</div>
            <div className="text-12 text-subtext truncate">{cfg.github_issues}</div>
          </div>
          <span className="text-subtext/50 text-11 shrink-0">Report &rarr;</span>
        </a>
      </div>

      <div className="rounded-lg border border-border p-3 bg-surface">
        <div className="flex items-center gap-2 mb-2">
          <Globe size={14} className="text-cyan" />
          <span className="text-12 text-text font-semibold">Maintainer Presence</span>
        </div>
        <div className="flex items-center gap-2 text-12 text-subtext">
          <span className={`inline-block w-2 h-2 rounded-full ${cfg.maintainers_online > 0 ? "bg-green-400" : "bg-subtext/30"}`} />
          <span>
            {cfg.maintainers_online > 0
              ? `${cfg.maintainers_online} maintainer${cfg.maintainers_online > 1 ? "s" : ""} currently online`
              : "No maintainers currently online"}
          </span>
          <span className="text-11 text-subtext/50 ml-auto">Updated {new Date(cfg.last_updated).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="rounded-lg border border-border p-3 bg-surface">
        <label className="text-12 text-text font-semibold block mb-1.5">Custom Discord Invite URL</label>
        <div className="flex gap-2">
          <input value={discordURL} onChange={(e) => setDiscordURL(e.target.value)}
            className="flex-1 bg-bg border border-border rounded-md px-3 py-1.5 text-12 text-text outline-none focus:border-cyan transition-colors"
          />
          <button onClick={handleSaveDiscord}
            className="px-3 py-1.5 rounded-md bg-cyan text-bg text-12 font-semibold hover:bg-cyan/90 transition-colors"
          >Save</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Community-Prioritized Roadmap (Voting)                          */
/* ------------------------------------------------------------------ */

interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  votes: number;
  status: string;
  tags: string[];
}

const statusColors: Record<string, string> = {
  "planned": "bg-amber-500/15 text-amber-400",
  "in-progress": "bg-blue-500/15 text-blue-400",
  "shipped": "bg-green-500/15 text-green-400",
  "under-review": "bg-purple-500/15 text-purple-400",
};

function RoadmapTab({ onMsg }: { onMsg: (m: string) => void }) {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  useEffect(() => {
    GetFeatureRequests().then((raw) => {
      try { setRequests(JSON.parse(raw)); } catch {}
    }).catch(() => {});
  }, []);
  // Separate shipped items
  const shipped = requests.filter((r) => r.status === "shipped");
  const active = requests.filter((r) => r.status !== "shipped");

  const handleUpvote = async (id: string) => {
    if (voted.has(id)) return;
    try {
      await UpvoteFeatureRequest(id);
      setVoted((prev) => new Set(prev).add(id));
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, votes: r.votes + 1 } : r))
      );
      onMsg("Vote recorded!");
    } catch (e) {
      onMsg(String(e));
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-13 text-subtext leading-relaxed">
        Community votes drive our roadmap. Upvote the features you want most, and we prioritise
        accordingly. Every user gets one vote per feature.
      </p>

      {active.length === 0 && <p className="text-subtext text-12">No feature requests yet.</p>}

      {active.map((r) => (
        <div key={r.id} className="rounded-lg border border-border p-3 bg-surface hover:bg-cardHover/50 transition-colors">
          <div className="flex items-start gap-3">
            <button onClick={() => handleUpvote(r.id)}
              disabled={voted.has(r.id)}
              className={`flex flex-col items-center w-10 py-1.5 rounded-md transition-colors ${
                voted.has(r.id)
                  ? "bg-cyan/15 text-cyan cursor-default"
                  : "bg-cardHover text-subtext hover:bg-cyan/10 hover:text-cyan"
              }`}
            >
              <Vote size={14} />
              <span className="text-11 font-semibold mt-0.5">{r.votes}</span>
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-13 font-semibold text-text">{r.title}</h3>
                <span className={`px-2 py-0.5 rounded-full text-10 font-medium ${statusColors[r.status] || "bg-cardHover text-subtext"}`}>{r.status}</span>
              </div>
              <p className="text-12 text-subtext mt-0.5">{r.description}</p>
              <div className="flex gap-2 mt-1.5">
                <span className="px-2 py-0.5 rounded-full bg-cyan/8 text-cyan/70 text-10">{r.category}</span>
                {r.tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-cardHover text-subtext/70 text-10">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

      {shipped.length > 0 && (
        <>
          <h3 className="text-13 font-semibold text-subtext pt-2 border-t border-border mt-4">&#10003; Shipped</h3>
          {shipped.map((r) => (
            <div key={r.id} className="rounded-lg border border-border/50 p-3 bg-surface/50 opacity-60">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center w-10 py-1.5 rounded-md bg-green-500/10 text-green-400">
                  <span className="text-11 font-semibold">{r.votes}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-13 font-semibold text-text">{r.title}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-10 font-medium">shipped</span>
                  </div>
                  <p className="text-12 text-subtext mt-0.5">{r.description}</p>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Ecosystem Growth Badges                                         */
/* ------------------------------------------------------------------ */

interface Badge {
  id: string;
  name: string;
  description: string;
  svg: string;
  markdown: string;
  html: string;
}

function BadgesTab({ onMsg }: { onMsg: (m: string) => void }) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [copyMsg, setCopyMsg] = useState("");
  useEffect(() => {
    GetBadges().then((raw) => {
      try { setBadges(JSON.parse(raw)); } catch {}
    }).catch(() => {});
  }, []);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg(`${label} copied!`);
      setTimeout(() => setCopyMsg(""), 2000);
    } catch {}
  };

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-13 text-subtext leading-relaxed">
        Show the world your project is built with reqit. Add one of these badges to your repository&apos;s README.
      </p>

      {copyMsg && <div className="px-3 py-2 rounded-lg bg-cyan/10 text-cyan text-13 border border-cyan/20">{copyMsg}</div>}

      {badges.map((b) => (
        <div key={b.id} className="rounded-lg border border-border p-4 bg-surface space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-13 font-semibold text-text">{b.name}</h3>
              <p className="text-12 text-subtext mt-0.5">{b.description}</p>
            </div>
            <span className="text-11 text-cyan/60 bg-cyan/8 px-2 py-0.5 rounded">{b.id}</span>
          </div>

          <div className="flex items-center gap-3 bg-bg rounded-md p-3 border border-border/50">
            <img src={`data:image/svg+xml;utf8,${encodeURIComponent(b.svg)}`} alt={b.name} className="h-5" />
            <span className="text-11 text-subtext">Preview</span>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-11 text-subtext font-semibold">Markdown</span>
                <button onClick={() => copyToClipboard(b.markdown, "Markdown")} className="text-11 text-cyan hover:text-cyan/80 transition-colors">Copy</button>
              </div>
              <pre className="text-11 bg-bg rounded-md p-2.5 overflow-x-auto text-text border border-border/50">
                <code>{b.markdown}</code>
              </pre>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-11 text-subtext font-semibold">HTML</span>
                <button onClick={() => copyToClipboard(b.html, "HTML")} className="text-11 text-cyan hover:text-cyan/80 transition-colors">Copy</button>
              </div>
              <pre className="text-11 bg-bg rounded-md p-2.5 overflow-x-auto text-text border border-border/50">
                <code>{b.html}</code>
              </pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
