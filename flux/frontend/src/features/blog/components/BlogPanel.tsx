import { useState } from "react";
import { ArrowLeft, BookOpen, Clock, Tag, Calendar } from "lucide-react";
import { BLOG_POSTS, type BlogPost } from "@/features/blog/blogData";
import { cn } from "@/shared/lib/cn";

function renderMarkdown(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-text">$1</strong>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-card px-1.5 py-0.5 rounded-sm text-12 font-mono text-cyan">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-cyan underline hover:brightness-110">$1</a>')
    // Headers (##)
    .replace(/^## (.+)$/gm, '<h2 class="text-16 font-bold text-text mt-6 mb-2">$1</h2>')
    // Bold list items with dash
    .replace(/^- \*\*(.+?)\*\*(.*)$/gm, '<li class="ml-4 text-13 text-text list-disc"><strong class="font-semibold">$1</strong>$2</li>')
    // Regular list items with dash
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-13 text-text list-disc">$1</li>')
    // Numbered list items
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 text-13 text-text list-decimal">$1. $2</li>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p class="text-13 text-subtext leading-relaxed mb-3">')
    // Single newlines within paragraphs
    .replace(/\n/g, '<br />')
    // Wrap in paragraph
    .replace(/^/, '<p class="text-13 text-subtext leading-relaxed mb-3">')
    .replace(/$/, "</p>")
    // Clean up nested
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
          <span>Back</span>
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

export function BlogPanel() {
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  if (selectedPost) {
    return <BlogContent post={selectedPost} onBack={() => setSelectedPost(null)} />;
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="shrink-0 px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-[28px] h-[28px] rounded-lg bg-cyan/10 flex items-center justify-center">
            <BookOpen size={14} className="text-cyan" />
          </div>
          <div>
            <h1 className="text-14 font-bold text-text">Blog</h1>
            <p className="text-11 text-subtext">Stories, guides, and engineering deep-dives</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="flex flex-col gap-3 max-w-[640px]">
          {BLOG_POSTS.map((post) => (
            <button
              key={post.slug}
              type="button"
              onClick={() => setSelectedPost(post)}
              className="text-left bg-surface border border-border rounded-xl p-4 hover:border-cyan/30 hover:bg-cardHover transition-all group"
            >
              <h2 className="text-14 font-semibold text-text group-hover:text-cyan transition-colors mb-1.5">
                {post.title}
              </h2>
              <p className="text-12 text-subtext leading-relaxed mb-3">{post.description}</p>
              <div className="flex items-center gap-3 text-11 text-subtext">
                <span className="flex items-center gap-1">
                  <Calendar size={10} />
                  {post.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {post.readTime}
                </span>
                <div className="flex gap-1.5 ml-auto">
                  {post.tags.map((t) => (
                    <span key={t} className="bg-card px-2 py-0.5 rounded-sm text-10 font-mono text-tertiary">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
