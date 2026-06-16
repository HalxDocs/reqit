import { useState, useMemo } from "react";
import { ArrowLeft, BookOpen, Clock, Tag, Calendar, Search, Bookmark } from "lucide-react";
import { BLOG_POSTS, CATEGORIES, type BlogPost } from "@/features/blog/blogData";

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-text">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-card px-1.5 py-0.5 rounded-sm text-12 font-mono text-cyan">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-cyan underline hover:brightness-110">$1</a>')
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
}

export function BlogContent({ post, onBack }: { post: BlogPost; onBack: () => void }) {
  const html = renderMarkdown(post.content);
  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="shrink-0 px-6 py-4 border-b border-border flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-12 text-subtext hover:text-text transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to blog</span>
        </button>
      </div>
      <div className="flex-1 px-6 py-5 max-w-[720px]">
        <h1 className="text-20 font-bold text-text leading-snug mb-3">{post.title}</h1>
        <div className="flex items-center gap-4 text-12 text-subtext mb-6">
          <span className="flex items-center gap-1.5">
            <Calendar size={12} />
            {post.date}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={12} />
            {post.readTime}
          </span>
          <div className="flex items-center gap-1.5">
            <Tag size={12} />
            {post.tags.map((t) => (
              <span key={t} className="bg-card px-2 py-0.5 rounded-sm text-11 font-mono text-subtext">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

const CATEGORY_ICONS: Record<string, string> = {
  "All": "⊞",
  "Core Concepts": "◆",
  "Testing & Automation": "⚡",
  "Protocols & APIs": "⇄",
  "Collaboration & Workflow": "◎",
  "Developer Experience": "☆",
  "Engineering": "⚙",
  "Tutorials": "⊳",
  "Philosophy": "◈",
};

const CATEGORY_COLORS: Record<string, string> = {
  "Core Concepts": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Testing & Automation": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Protocols & APIs": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Collaboration & Workflow": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Developer Experience": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "Engineering": "bg-rose-500/10 text-rose-400 border-rose-500/20",
  "Tutorials": "bg-violet-500/10 text-violet-400 border-violet-500/20",
  "Philosophy": "bg-sky-500/10 text-sky-400 border-sky-500/20",
};

export function BlogPage({ onBack }: { onBack?: () => void }) {
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
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

  if (selectedPost) {
    return <BlogContent post={selectedPost} onBack={() => setSelectedPost(null)} />;
  }

  const categoryCounts: Record<string, number> = {};
  BLOG_POSTS.forEach((p) => {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  });

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="shrink-0 px-6 sm:px-8 lg:px-10 py-6 sm:py-7 border-b border-border">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-[36px] h-[36px] rounded-xl bg-cyan/10 flex items-center justify-center shrink-0">
              <BookOpen size={17} className="text-cyan" />
            </div>
            <div>
              <h1 className="text-17 sm:text-18 font-bold text-text">Blog & Guides</h1>
              <p className="text-12 sm:text-13 text-subtext mt-0.5">Feature explainers, tutorials, and engineering deep-dives</p>
            </div>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 h-[32px] px-3 text-12 text-subtext hover:text-text bg-card border border-border rounded-lg hover:border-cyan/40 transition-all"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
          )}
        </div>

        <div className="relative mb-5">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtext/40 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search posts by title, description, or tag..."
            className="w-full h-[40px] pl-10 pr-4 bg-card border border-border rounded-xl text-13 text-text placeholder:text-subtext/30 outline-none focus:border-cyan/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const count = cat === "All" ? BLOG_POSTS.length : (categoryCounts[cat] || 0);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 flex items-center gap-1.5 h-[30px] px-3.5 text-12 font-semibold rounded-full border transition-all ${
                  activeCategory === cat
                    ? "bg-cyan/10 text-cyan border-cyan/30"
                    : "bg-card text-subtext border-border hover:border-cyan/30 hover:text-text"
                }`}
              >
                <span className="text-[11px]">{CATEGORY_ICONS[cat] || "⊞"}</span>
                <span>{cat}</span>
                <span className={`text-11 font-mono ml-0.5 ${activeCategory === cat ? "text-cyan/60" : "text-subtext/40"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 sm:px-8 lg:px-10 py-5 sm:py-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search size={32} className="text-subtext/20 mb-4" />
            <p className="text-14 text-subtext font-medium">No posts match your search</p>
            <button
              type="button"
              onClick={() => { setSearchQuery(""); setActiveCategory("All"); }}
              className="mt-3 text-13 text-cyan hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
            {filtered.map((post) => (
              <button
                key={post.slug}
                type="button"
                onClick={() => setSelectedPost(post)}
                className="text-left bg-card border border-border rounded-xl p-5 sm:p-6 flex flex-col gap-3.5 hover:border-cyan/30 hover:bg-cardHover hover:shadow-lg hover:shadow-black/5 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${CATEGORY_COLORS[post.category] || "bg-card text-subtext border-border"}`}>
                    <Bookmark size={9} />
                    {post.category}
                  </span>
                </div>
                <h2 className="text-14 sm:text-15 font-semibold text-text group-hover:text-cyan transition-colors leading-snug">
                  {post.title}
                </h2>
                <p className="text-12 sm:text-13 text-subtext leading-relaxed flex-1 line-clamp-3">
                  {post.description}
                </p>
                <div className="flex items-center gap-3 text-11 text-subtext/50 mt-auto pt-1">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={10} />
                    {post.date}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={10} />
                    {post.readTime}
                  </span>
                  <div className="flex gap-1.5 ml-auto">
                    {post.tags.slice(0, 2).map((t) => (
                      <span key={t} className="bg-surface px-2 py-0.5 rounded-sm text-10 font-mono text-tertiary">
                        {t}
                      </span>
                    ))}
                    {post.tags.length > 2 && (
                      <span className="text-10 text-subtext/40">+{post.tags.length - 2}</span>
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
