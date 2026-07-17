import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ArrowLeft, BookOpen, Clock, Tag, Calendar, Search, Bookmark } from "lucide-react";
import { BLOG_POSTS, CATEGORIES, type BlogPost } from "@/features/blog/blogData";

const SYNONYMS: Record<string, string[]> = {
  "openai": ["openapi", "spec", "swagger"],
  "openapi": ["openai", "spec", "swagger"],
  "spec": ["openapi", "openai", "swagger", "specification"],
  "swagger": ["openapi", "spec"],
  "link": ["linking", "connect", "integrate", "link"],
  "linking": ["link", "connect", "integrate"],
  "connect": ["link", "linking", "integrate"],
  "integrate": ["link", "linking", "connect", "integration"],
  "import": ["migrate", "migration", "postman", "bring"],
  "export": ["share", "output", "generate"],
  "postman": ["import", "migrate", "workspace"],
  "test": ["testing", "assertion", "validate", "check", "runner"],
  "testing": ["test", "assertion", "validate", "check"],
  "mock": ["fake", "pretend", "stub", "mock server"],
  "fake": ["mock", "stub", "pretend"],
  "websocket": ["ws", "realtime", "real-time", "socket", "ws"],
  "realtime": ["websocket", "real-time", "sse", "streaming"],
  "grpc": ["grpc-web", "protocol", "binary"],
  "graphql": ["gql", "query", "mutation", "schema"],
  "auth": ["authentication", "login", "token", "oauth", "bearer", "api key"],
  "authentication": ["auth", "login", "token", "oauth"],
  "oauth": ["oauth2", "authorization", "token", "pkce"],
  "jwt": ["token", "bearer", "claims", "auth"],
  "git": ["version control", "commit", "branch", "merge", "stash"],
  "version control": ["git", "commit", "branch"],
  "ci/cd": ["cicd", "pipeline", "github actions", "gitlab ci", "jenkins", "automation"],
  "automation": ["scripting", "runner", "ci/cd", "cli", "pipeline"],
  "cli": ["terminal", "command line", "headless", "scripting"],
  "terminal": ["cli", "command line"],
  "load test": ["performance", "stress", "load testing", "benchmark"],
  "performance": ["load test", "speed", "timing", "latency"],
  "environment": ["env", "variables", "config", "settings", "dev", "staging", "prod"],
  "variable": ["environment", "env", "interpolation", "placeholder"],
  "collection": ["folder", "group", "organize", "requests"],
  "cookie": ["session", "cookie jar", "auth"],
  "history": ["log", "past requests", "previous"],
  "shortcut": ["keyboard", "hotkey", "keybinding", "ctrl"],
  "theme": ["dark mode", "light mode", "appearance", "colors"],
  "vault": ["secrets", "passwords", "api keys", "encryption"],
  "security": ["auth", "vault", "encryption", "enterprise", "sso"],
  "enterprise": ["sso", "rbac", "audit", "security", "team"],
  "team": ["collaboration", "share", "invite", "enterprise"],
  "share": ["export", "collaborate", "team", "invite"],
  "json": ["data", "format", "response", "body"],
  "response": ["status", "body", "headers", "timing"],
  "request": ["send", "api call", "endpoint", "method"],
  "api": ["rest", "endpoint", "http", "request", "response"],
  "rest": ["api", "http", "endpoint"],
  "http": ["rest", "api", "method", "get", "post", "put", "delete"],
  "design": ["blueprint", "spec", "openapi", "api designer"],
  "code": ["generate", "snippet", "codegen", "javascript", "python", "curl"],
  "report": ["json", "html", "results", "analytics"],
  "soap": ["wsdl", "envelope", "xml"],
  "mqtt": ["iot", "publish", "subscribe", "broker"],
  "sse": ["server-sent events", "streaming", "event source"],
};

function fuzzyMatch(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return 100;
  const words = q.split(/\s+/);
  let score = 0;
  let matched = 0;
  for (const word of words) {
    if (word.length < 2) continue;
    if (t.includes(word)) {
      score += 20;
      matched++;
    } else {
      for (const syn of SYNONYMS[word] || []) {
        if (t.includes(syn)) {
          score += 10;
          matched++;
          break;
        }
      }
    }
  }
  return words.length > 0 ? (matched / words.length) * score : 0;
}

function searchPost(query: string, post: BlogPost): number {
  let score = 0;
  const q = query.toLowerCase();

  score += fuzzyMatch(query, post.title) * 3;
  score += fuzzyMatch(query, post.description) * 2;
  score += fuzzyMatch(query, post.category) * 1.5;
  post.tags.forEach((t) => { score += fuzzyMatch(query, t) * 1; });

  const contentLower = post.content.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  for (const word of words) {
    if (contentLower.includes(word)) {
      score += 5;
    }
    for (const syn of SYNONYMS[word] || []) {
      if (contentLower.includes(syn)) {
        score += 3;
        break;
      }
    }
  }

  return score;
}

function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ["http:", "https:", "mailto:"].includes(u.protocol);
  } catch {
    return url.startsWith("#") || url.startsWith("/");
  }
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?\/?>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "")
    .replace(/on\w+=[^\s>]+/gi, "")
    .replace(/href\s*=\s*["']?\s*javascript:/gi, 'href="#"')
    .replace(/src\s*=\s*["']?\s*javascript:/gi, 'src=""')
    .replace(/href\s*=\s*["']?\s*data:/gi, 'href="#"')
    .replace(/style\s*=\s*["'][^"']*expression\s*\(/gi, 'style=""');
}

function renderMarkdown(text: string): string {
  const html = text
    .replace(/\[video\]\(([^)]+)\)/g, (_, url) => {
      if (/youtu(\.be\/|be\.com\/)/.test(url)) {
        const id = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
        if (id) return `<div class="relative w-full pt-[56.25%] my-4 rounded-lg overflow-hidden border border-border"><iframe class="absolute inset-0 w-full h-full" src="https://www.youtube.com/embed/${id}" frameborder="0" allowfullscreen></iframe></div>`;
      }
      return `<video class="w-full rounded-lg border border-border my-4" controls preload="metadata"><source src="${url}" /></video>`;
    })
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-bg border border-border rounded-lg p-3 my-3 overflow-x-auto"><code class="text-12 font-mono text-cyan">$1</code></pre>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-text">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-card px-1.5 py-0.5 rounded-sm text-12 font-mono text-cyan">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
      const safeUrl = isSafeUrl(url) ? url : "#";
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-cyan underline hover:brightness-110">${text}</a>`;
    })
    .replace(/^## (.+)$/gm, '<h2 class="text-16 font-bold text-text mt-6 mb-2">$1</h2>')
    .replace(/^- \*\*(.+?)\*\*(.*)$/gm, '<li class="ml-4 text-13 text-text list-disc"><strong class="font-semibold">$1</strong>$2</li>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-13 text-text list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 text-13 text-text list-decimal">$1. $2</li>')
    .replace(/\n\n/g, '</p><p class="text-13 text-subtext leading-relaxed mb-3">')
    .replace(/\n/g, '<br />')
    .replace(/^/, '<p class="text-13 text-subtext leading-relaxed mb-3">')
    .replace(/$/, "</p>")
    .replace(/<p class="[^"]*"><\/p>/g, "")
    .replace(/<br \/>\s*<\/p>/g, "</p>")
    .replace(/<p class="[^"]*">\s*<br \/>/g, '<p class="text-13 text-subtext leading-relaxed mb-3">');
  return sanitizeHtml(html);
}

export function BlogContent({ post, onBack }: { post: BlogPost; onBack: () => void }) {
  const html = renderMarkdown(post.content);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showResume, setShowResume] = useState(false);
  const savedPositionKey = `blog-read-${post.slug}`;

  useEffect(() => {
    const saved = localStorage.getItem(savedPositionKey);
    if (saved) {
      const pct = parseFloat(saved);
      if (pct > 5 && pct < 95) {
        setShowResume(true);
      }
    }
  }, [post.slug, savedPositionKey]);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const scrollTop = window.scrollY || el.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      if (scrollHeight > 0) {
        const pct = Math.min(100, Math.round((scrollTop / scrollHeight) * 100));
        setScrollProgress(pct);
        if (pct > 5) {
          localStorage.setItem(savedPositionKey, String(pct));
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [savedPositionKey]);

  const resumeReading = () => {
    const saved = localStorage.getItem(savedPositionKey);
    if (saved) {
      const pct = parseFloat(saved);
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      window.scrollTo({ top: (pct / 100) * scrollHeight, behavior: "smooth" });
    }
    setShowResume(false);
  };

  const dismissResume = () => {
    setShowResume(false);
  };

  return (
    <div className="w-full flex flex-col">
      {/* Reading progress bar */}
      <div className="sticky top-0 left-0 right-0 z-50 h-[2px] bg-border/30">
        <div
          className="h-full bg-cyan transition-[width] duration-150 ease-out"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>
      <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-b border-border flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-12 sm:text-13 text-subtext hover:text-text transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to blog</span>
        </button>
        <span className="ml-auto text-10 text-subtext/40 font-mono">{scrollProgress}%</span>
      </div>
      {/* Resume reading banner */}
      {showResume && (
        <div className="shrink-0 px-4 sm:px-6 py-2.5 bg-cyan/5 border-b border-cyan/20 flex items-center justify-between gap-3">
          <span className="text-12 text-cyan font-medium">You were reading this — pick up where you left off?</span>
          <div className="flex items-center gap-2">
            <button onClick={dismissResume} className="text-11 text-subtext hover:text-text transition-colors px-2 py-1">Start over</button>
            <button onClick={resumeReading} className="text-11 font-bold text-cyan bg-cyan/10 border border-cyan/20 rounded-md px-3 py-1 hover:bg-cyan/20 transition-colors">Resume</button>
          </div>
        </div>
      )}
      <div ref={contentRef} className="w-full max-w-[720px] mx-auto px-4 sm:px-6 py-5 min-w-0 break-words">
        <h1 className="text-17 sm:text-20 font-bold text-text leading-snug mb-3">{post.title}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-12 text-subtext mb-6">
          <span className="flex items-center gap-1.5">
            <Calendar size={12} />
            {post.date}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={12} />
            {post.readTime}
          </span>
          <div className="flex items-center flex-wrap gap-1.5">
            <Tag size={12} className="shrink-0" />
            {post.tags.map((t) => (
              <span key={t} className="bg-card px-2 py-0.5 rounded-sm text-11 font-mono text-subtext">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="prose prose-invert max-w-none w-full overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

const CATEGORY_ICONS: Record<string, string> = {
  "All": "⊞",
  "API Fundamentals": "◉",
  "Core Concepts": "◆",
  "Testing & Automation": "⚡",
  "Protocols & APIs": "⇄",
  "Collaboration & Workflow": "◎",
  "Developer Experience": "☆",
};

const CATEGORY_COLORS: Record<string, string> = {
  "Comparisons": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Technical deep-dives": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Tutorials & use-cases": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Release narratives": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Philosophy & opinion": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

export function BlogPage({ onBack, initialSlug, onSelectPost, scrollToTop }: { onBack?: () => void; initialSlug?: string; onSelectPost?: (slug: string) => void; scrollToTop?: () => void }) {
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(
    () => initialSlug ? BLOG_POSTS.find(p => p.slug === initialSlug) || null : null
  );
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [readPosts, setReadPosts] = useState<Record<string, number>>(() => {
    try {
      const entries: Record<string, number> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("blog-read-")) {
          const slug = key.replace("blog-read-", "");
          const pct = parseInt(localStorage.getItem(key) || "0", 10);
          entries[slug] = pct;
        }
      }
      return entries;
    } catch { return {}; }
  });

  const sortedPosts = useMemo(() => {
    const pinned = BLOG_POSTS.find(p => p.slug === "explainer-openapi-spec-linking");
    const rest = BLOG_POSTS.filter(p => p.slug !== "explainer-openapi-spec-linking");
    rest.sort((a, b) => b.date.localeCompare(a.date));
    return pinned ? [pinned, ...rest] : rest;
  }, []);

  const filtered = useMemo(() => {
    let posts = sortedPosts.filter((post) => {
      if (activeCategory !== "All" && post.category !== activeCategory) return false;
      return true;
    });
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const words = q.split(/\s+/).filter((w) => w.length >= 2);
      const scored = posts.map((post) => {
        let score = 0;
        score += fuzzyMatch(q, post.title) * 4;
        score += fuzzyMatch(q, post.description) * 2;
        score += fuzzyMatch(q, post.category) * 1.5;
        post.tags.forEach((t) => { score += fuzzyMatch(q, t) * 1.5; });
        const contentLower = post.content.toLowerCase();
        for (const word of words) {
          if (contentLower.includes(word)) score += 5;
          for (const syn of SYNONYMS[word] || []) {
            if (contentLower.includes(syn)) { score += 3; break; }
          }
        }
        for (const word of words) {
          for (const syn of SYNONYMS[word] || []) {
            const titleLower = post.title.toLowerCase();
            if (titleLower.includes(word) || titleLower.includes(syn)) { score += 10; break; }
          }
        }
        return { post, score };
      });
      return scored.filter((s) => s.score > 5).sort((a, b) => b.score - a.score).map((s) => s.post);
    }
    return posts;
  }, [sortedPosts, activeCategory, searchQuery]);

  const handleSelectPost = useCallback((post: BlogPost) => {
    setSelectedPost(post);
    window.history.pushState({ page: "blog", slug: post.slug }, "", `/blog/${post.slug}`);
    if (onSelectPost) onSelectPost(post.slug);
    scrollToTop?.();
  }, [onSelectPost, scrollToTop]);

  const handleBackToList = useCallback(() => {
    setSelectedPost(null);
    window.history.pushState({ page: "blog" }, "", "/blog");
    scrollToTop?.();
  }, [scrollToTop]);

  if (selectedPost) {
    return <BlogContent post={selectedPost} onBack={handleBackToList} />;
  }

  const categoryCounts: Record<string, number> = {};
  BLOG_POSTS.forEach((p) => {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  });

  return (
    <div className="w-full flex flex-col bg-bg">
      <div className="shrink-0 px-4 sm:px-6 lg:px-8 py-5 sm:py-6 border-b border-border">
        <div className="flex items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-[32px] h-[32px] sm:w-[36px] sm:h-[36px] rounded-lg sm:rounded-xl bg-cyan/10 flex items-center justify-center shrink-0">
              <BookOpen size={15} className="text-cyan sm:w-[17px]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-16 sm:text-18 font-bold text-text truncate">Blog & Guides</h1>
              <p className="text-11 sm:text-13 text-subtext mt-0.5 hidden sm:block">Feature explainers, tutorials, and engineering deep-dives</p>
            </div>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="shrink-0 flex items-center gap-1.5 h-[30px] px-2.5 sm:px-3 text-12 sm:text-13 text-subtext hover:text-text bg-card border border-border rounded-lg hover:border-cyan/40 transition-all"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
        </div>

        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtext/40 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Try &quot;link openapi&quot;, &quot;mock server&quot;, &quot;git storage&quot;, &quot;auth&quot;..."
            className="w-full h-[36px] sm:h-[40px] pl-9 sm:pl-10 pr-3 sm:pr-4 bg-card border border-border rounded-lg sm:rounded-xl text-12 sm:text-13 text-text placeholder:text-subtext/30 outline-none focus:border-cyan/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {CATEGORIES.slice(0, 5).map((cat) => {
            const count = cat === "All" ? BLOG_POSTS.length : (categoryCounts[cat] || 0);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 flex items-center gap-1 sm:gap-1.5 h-[26px] sm:h-[30px] px-2.5 sm:px-3.5 text-11 sm:text-12 font-semibold rounded-full border transition-all ${
                  activeCategory === cat
                    ? "bg-cyan/10 text-cyan border-cyan/30"
                    : "bg-card text-subtext border-border hover:border-cyan/30 hover:text-text"
                }`}
              >
                <span className="text-[10px] sm:text-[11px]">{CATEGORY_ICONS[cat] || "⊞"}</span>
                <span className="hidden sm:inline">{cat}</span>
                <span className="sm:hidden text-[10px]">{cat === "All" ? "All" : cat.split(" ")[0]}</span>
                <span className={`text-10 sm:text-11 font-mono ${activeCategory === cat ? "text-cyan/60" : "text-subtext/40"}`}>
                  {count}
                </span>
              </button>
            );
          })}
          {CATEGORIES.length > 5 && (
            <div className="relative group">
              <button
                type="button"
                className="shrink-0 flex items-center gap-1 h-[26px] sm:h-[30px] px-2.5 text-11 sm:text-12 font-semibold rounded-full border border-border text-subtext hover:border-cyan/30 hover:text-text bg-card transition-all"
              >
                <span>...</span>
                <span className="text-10 sm:text-11 font-mono text-subtext/40">{CATEGORIES.slice(5).reduce((s, c) => s + (categoryCounts[c] || 0), 0)}</span>
              </button>
              <div className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-xl shadow-xl p-2 min-w-[160px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                {CATEGORIES.slice(5).map((cat) => {
                  const count = categoryCounts[cat] || 0;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`block w-full text-left px-3 py-1.5 text-12 rounded-lg transition-colors ${
                        activeCategory === cat ? "bg-cyan/10 text-cyan" : "text-subtext hover:text-text hover:bg-surface"
                      }`}
                    >
                      <span className="text-[10px] mr-1.5">{CATEGORY_ICONS[cat] || "⊞"}</span>
                      {cat}
                      <span className="text-10 font-mono text-subtext/40 ml-1">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center">
            <Search size={28} className="text-subtext/20 mb-3" />
            <p className="text-13 sm:text-14 text-subtext font-medium">No posts match "{searchQuery}"</p>
            <p className="text-11 sm:text-12 text-subtext/50 mt-1.5 max-w-[280px]">Try simpler words like "openapi", "mock", "auth", "git", or "graphql"</p>
            <div className="flex items-center gap-2 mt-4">
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-12 sm:text-13 text-cyan hover:underline"
              >
                Clear search
              </button>
              {activeCategory !== "All" && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(""); setActiveCategory("All"); }}
                  className="text-12 sm:text-13 text-subtext hover:text-text hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
            {filtered.map((post) => (
              <button
                key={post.slug}
                type="button"
                onClick={() => handleSelectPost(post)}
                className="text-left bg-card border border-border rounded-xl p-4 sm:p-5 flex flex-col gap-3 hover:border-cyan/30 hover:bg-cardHover hover:shadow-lg hover:shadow-black/5 transition-all group"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${CATEGORY_COLORS[post.category] || "bg-card text-subtext border-border"}`}>
                    <Bookmark size={8} />
                    <span className="hidden sm:inline">{post.category}</span>
                    <span className="sm:hidden">{post.category === "Technical deep-dives" ? "Tech" : post.category === "Tutorials & use-cases" ? "Tutorial" : post.category === "Comparisons" ? "Vs" : post.category === "Release narratives" ? "Release" : post.category === "Philosophy & opinion" ? "Opinion" : post.category.split(" ")[0]}</span>
                  </span>
                  {readPosts[post.slug] !== undefined && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-teal/10 text-teal border border-teal/20">
                      {readPosts[post.slug] >= 90 ? "✓ read" : `${readPosts[post.slug]}%`}
                    </span>
                  )}
                </div>
                <h2 className="text-13 sm:text-14 font-semibold text-text group-hover:text-cyan transition-colors leading-snug">
                  {post.title}
                </h2>
                <p className="text-11 sm:text-12 text-subtext leading-relaxed flex-1 line-clamp-2 sm:line-clamp-3">
                  {post.description}
                </p>
                <div className="flex items-center gap-2 sm:gap-3 text-10 sm:text-11 text-subtext/50 mt-auto pt-0.5">
                  <span className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                    <Calendar size={9} />
                    <span className="hidden sm:inline">{post.date}</span>
                    <span className="sm:hidden">{post.date.slice(5)}</span>
                  </span>
                  <span className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                    <Clock size={9} />
                    {post.readTime.replace(" min read", "m")}
                  </span>
                  <div className="flex gap-1 sm:gap-1.5 ml-auto">
                    {post.tags.slice(0, 1).map((t) => (
                      <span key={t} className="bg-surface px-1.5 py-0.5 rounded-sm text-9 sm:text-10 font-mono text-tertiary">
                        {t}
                      </span>
                    ))}
                    {post.tags.length > 1 && (
                      <span className="text-9 sm:text-10 text-subtext/40">+{post.tags.length - 1}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
