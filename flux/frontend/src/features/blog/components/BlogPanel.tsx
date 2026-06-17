import { useState, useMemo, useCallback } from "react";
import { ArrowLeft, BookOpen, Clock, Tag, Calendar, Search, Bookmark } from "lucide-react";
import { BLOG_POSTS, CATEGORIES, type BlogPost } from "@/features/blog/blogData";

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
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "");
}

function renderMarkdown(text: string): string {
  const html = text
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
  return (
    <div className="w-full flex flex-col">
      <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-b border-border flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-12 sm:text-13 text-subtext hover:text-text transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to blog</span>
        </button>
      </div>
      <div className="w-full max-w-[720px] mx-auto px-4 sm:px-6 py-5">
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
  "API Fundamentals": "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  "Core Concepts": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Testing & Automation": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Protocols & APIs": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Collaboration & Workflow": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Developer Experience": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

export function BlogPage({ onBack, initialSlug, onSelectPost, scrollToTop }: { onBack?: () => void; initialSlug?: string; onSelectPost?: (slug: string) => void; scrollToTop?: () => void }) {
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(
    () => initialSlug ? BLOG_POSTS.find(p => p.slug === initialSlug) || null : null
  );
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    return BLOG_POSTS.filter((post) => {
      if (activeCategory !== "All" && post.category !== activeCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          post.title.toLowerCase().includes(q) ||
          post.description.toLowerCase().includes(q) ||
          post.tags.some((t) => t.toLowerCase().includes(q)) ||
          post.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeCategory, searchQuery]);

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
            placeholder="Search posts..."
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
            <p className="text-13 sm:text-14 text-subtext font-medium">No posts match your search</p>
            <button
              type="button"
              onClick={() => { setSearchQuery(""); setActiveCategory("All"); }}
              className="mt-2 sm:mt-3 text-12 sm:text-13 text-cyan hover:underline"
            >
              Clear filters
            </button>
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
                    <span className="sm:hidden">{post.category === "Developer Experience" ? "DX" : post.category.split(" ")[0]}</span>
                  </span>
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
