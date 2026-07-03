import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ChevronRight, ChevronDown, Search, FileText, ExternalLink, X, ArrowLeft, BookOpen } from "lucide-react";
import { DOC_CATEGORIES, type DocCategory, type DocPage, type DocContent } from "@/shared/lib/docs";
import { cn } from "@/shared/lib/cn";

function DocCode({ code }: { code: string }) {
  return (
    <pre className="my-4 bg-card border border-border rounded-lg p-4 text-[13px] font-mono text-text overflow-x-auto whitespace-pre-wrap leading-relaxed">
      {code.split("\n").map((line, i) => (
        <div key={i} className={line.startsWith("#") || line.startsWith("//") ? "text-subtext/50" : ""}>
          {line || "\u00A0"}
        </div>
      ))}
    </pre>
  );
}

function ResourceLink({ title, url, desc }: { title: string; url: string; desc: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-[13px] text-[#0070F3] hover:underline"
    >
      {title}
      <ExternalLink size={11} />
    </a>
  );
}

function ContentBlock({ content }: { content: DocContent }) {
  return (
    <div className="mb-8">
      <h3 className="text-[18px] font-semibold text-text mb-3 leading-snug tracking-tight">{content.heading}</h3>
      <p className="text-[15px] text-[#5a5a5a] leading-[1.7] mb-0">{content.body}</p>
      {content.code && <DocCode code={content.code} />}
      {content.resources && content.resources.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {content.resources.map((r) => (
            <ResourceLink key={r.url} title={r.title} url={r.url} desc={r.desc} />
          ))}
        </div>
      )}
    </div>
  );
}

function OnThisPage({ page }: { page: DocPage | null }) {
  const headings = useMemo(() => {
    if (!page) return [];
    return page.content.map((c, i) => ({ id: `heading-${i}`, label: c.heading }));
  }, [page]);

  if (!page || headings.length === 0) return null;

  return (
    <nav className="w-[200px] shrink-0 hidden xl:block">
      <div className="sticky top-[108px] flex flex-col gap-3">
        <div className="text-[11px] font-semibold text-[#8f8f8f] uppercase tracking-[0.08em]">On this page</div>
        <div className="flex flex-col gap-1">
          {headings.map((h) => (
            <a
              key={h.id}
              href={`#${h.id}`}
              className="text-[13px] text-[#8f8f8f] hover:text-text transition-colors leading-relaxed py-0.5"
            >
              {h.label}
            </a>
          ))}
        </div>
        <div className="pt-4 mt-4 border-t border-border">
          <a
            href={`https://github.com/HalxDocs/reqit/edit/main/flux/frontend/src/shared/lib/docs.ts`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-[#8f8f8f] hover:text-[#0070F3] transition-colors flex items-center gap-1"
          >
            <ExternalLink size={11} />
            Edit on GitHub
          </a>
        </div>
      </div>
    </nav>
  );
}

function Sidebar({
  categories,
  activeCategory,
  activePage,
  onSelectPage,
}: {
  categories: DocCategory[];
  activeCategory: string | null;
  activePage: string | null;
  onSelectPage: (catId: string, pageId: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([categories[0]?.id].filter(Boolean)));

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeCat = categories.find((c) => c.id === activeCategory);

  return (
    <nav className="w-[260px] shrink-0 hidden md:block border-r border-border bg-[#fafafa]">
      <div className="sticky top-[108px] overflow-y-auto max-h-[calc(100vh-108px)] p-4">
        <div className="flex items-center gap-2 px-1 mb-4">
          <BookOpen size={14} className="text-[#0070F3]" />
          <span className="text-[13px] font-semibold text-text">Documentation</span>
        </div>
        <div className="flex flex-col gap-0.5">
          {categories.map((cat) => {
            const isExpanded = expanded.has(cat.id);
            const isActive = activeCategory === cat.id;
            return (
              <div key={cat.id}>
                <button
                  type="button"
                  onClick={() => toggle(cat.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded-md transition-colors text-left",
                    isActive ? "text-text font-semibold" : "text-[#5a5a5a] hover:text-text hover:bg-white/50",
                  )}
                >
                  {isExpanded ? <ChevronDown size={12} className="shrink-0 text-[#8f8f8f]" /> : <ChevronRight size={12} className="shrink-0 text-[#8f8f8f]" />}
                  <span className="truncate">{cat.title}</span>
                </button>
                {isExpanded && (
                  <div className="ml-3 pl-2 border-l border-border/60 flex flex-col gap-0.5 mt-0.5">
                    {cat.pages.map((page) => (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => onSelectPage(cat.id, page.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2.5 py-1.5 text-[13px] rounded-md transition-colors text-left border-l-2",
                          activePage === page.id
                            ? "border-[#0070F3] text-[#0070F3] font-medium bg-[#0070F3]/5"
                            : "border-transparent text-[#5a5a5a] hover:text-text hover:border-[#8f8f8f]/30",
                        )}
                      >
                        <FileText size={12} className={cn("shrink-0", activePage === page.id ? "text-[#0070F3]" : "text-[#8f8f8f]")} />
                        <span className="truncate">{page.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function SearchModal({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (catId: string, pageId: string) => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const r: { catId: string; catTitle: string; page: DocPage }[] = [];
    for (const cat of DOC_CATEGORIES) {
      for (const page of cat.pages) {
        const inTitle = page.title.toLowerCase().includes(q);
        const inSubtitle = page.subtitle?.toLowerCase().includes(q);
        const inContent = page.content.some((c) => c.heading.toLowerCase().includes(q) || c.body.toLowerCase().includes(q));
        if (inTitle || inSubtitle || inContent) {
          r.push({ catId: cat.id, catTitle: cat.title, page });
        }
      }
    }
    return r;
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[selectedIdx]) {
      onSelect(results[selectedIdx].catId, results[selectedIdx].page.id);
      onClose();
    }
    if (e.key === "Escape") onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-[560px] bg-white rounded-xl shadow-2xl border border-[#e6e6e6] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 px-4 h-[52px] border-b border-[#e6e6e6]">
          <Search size={15} className="text-[#8f8f8f] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documentation..."
            spellCheck={false}
            className="flex-1 text-[14px] text-text outline-none placeholder:text-[#8f8f8f] bg-transparent"
          />
          <button onClick={onClose} className="text-[#8f8f8f] hover:text-text p-1">
            <X size={14} />
          </button>
        </div>
        <div className="max-h-[360px] overflow-y-auto p-2">
          {query && results.length === 0 && (
            <p className="text-[13px] text-[#8f8f8f] text-center py-8">No results found.</p>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.catId}-${r.page.id}`}
              type="button"
              onClick={() => { onSelect(r.catId, r.page.id); onClose(); }}
              onMouseEnter={() => setSelectedIdx(i)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                i === selectedIdx ? "bg-[#f5f5f5]" : "",
              )}
            >
              <FileText size={13} className="shrink-0 text-[#8f8f8f]" />
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-text truncate">{r.page.title}</div>
                <div className="text-[11px] text-[#8f8f8f] truncate">{r.catTitle}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 px-4 h-[36px] border-t border-[#e6e6e6] text-[11px] text-[#8f8f8f]">
          <span><kbd className="px-1 py-0.5 bg-[#f5f5f5] border border-[#e6e6e6] rounded text-[10px] font-mono">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1 py-0.5 bg-[#f5f5f5] border border-[#e6e6e6] rounded text-[10px] font-mono">↵</kbd> Open</span>
          <span><kbd className="px-1 py-0.5 bg-[#f5f5f5] border border-[#e6e6e6] rounded text-[10px] font-mono">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}

export function WebDocsPage({ goHome }: { goHome: () => void }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(DOC_CATEGORIES[0]?.id ?? null);
  const [activePage, setActivePage] = useState<string | null>(DOC_CATEGORIES[0]?.pages[0]?.id ?? null);
  const [searchOpen, setSearchOpen] = useState(false);

  const activeDocPage = useMemo(() => {
    if (!activeCategory || !activePage) return null;
    const cat = DOC_CATEGORIES.find((c) => c.id === activeCategory);
    if (!cat) return null;
    return cat.pages.find((p) => p.id === activePage) ?? null;
  }, [activeCategory, activePage]);

  const activeCatTitle = useMemo(() => {
    const cat = DOC_CATEGORIES.find((c) => c.id === activeCategory);
    return cat?.title ?? "";
  }, [activeCategory]);

  const handleSelectPage = useCallback((catId: string, pageId: string) => {
    setActiveCategory(catId);
    setActivePage(pageId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="min-h-screen bg-white text-text">
      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[#e6e6e6]">
        <div className="max-w-[1400px] mx-auto px-5 h-[56px] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/reqitlogo.jpeg" alt="reqit" className="h-[28px] w-auto object-contain" />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 h-[32px] px-3 text-[13px] text-[#8f8f8f] bg-[#f5f5f5] border border-[#e6e6e6] rounded-lg hover:border-[#0070F3]/40 transition-colors min-w-[200px]"
            >
              <Search size={13} />
              <span>Search docs...</span>
              <kbd className="ml-auto text-[10px] text-[#8f8f8f] font-mono bg-white border border-[#e6e6e6] rounded px-1.5 py-0.5">Ctrl+K</kbd>
            </button>
            <a
              href="https://github.com/HalxDocs/reqit"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 h-[32px] px-3 text-[13px] text-[#5a5a5a] hover:text-text border border-[#e6e6e6] rounded-lg hover:border-[#0070F3]/40 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              <span>GitHub</span>
            </a>
            <button
              type="button"
              onClick={goHome}
              className="flex items-center gap-1.5 h-[32px] px-3 text-[13px] text-[#5a5a5a] hover:text-text border border-[#e6e6e6] rounded-lg hover:border-[#0070F3]/40 transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Home</span>
            </button>
          </div>
        </div>
      </header>

      {/* Three-column layout */}
      <div className="flex max-w-[1400px] mx-auto">
        <Sidebar categories={DOC_CATEGORIES} activeCategory={activeCategory} activePage={activePage} onSelectPage={handleSelectPage} />
        <main className="flex-1 min-w-0">
          <div className="max-w-[720px] mx-auto px-8 py-10">
            {activeDocPage ? (
              <>
                {/* Breadcrumb */}
                <div className="flex items-center gap-1.5 text-[13px] text-[#8f8f8f] mb-6">
                  <button onClick={goHome} className="hover:text-[#0070F3] transition-colors">Docs</button>
                  <ChevronRight size={11} />
                  <span className="text-[#5a5a5a]">{activeCatTitle}</span>
                  <ChevronRight size={11} />
                  <span className="text-text font-medium">{activeDocPage.title}</span>
                </div>

                {/* Title */}
                <h1 className="text-[32px] font-bold text-text tracking-tight leading-tight mb-2">{activeDocPage.title}</h1>
                {activeDocPage.subtitle && (
                  <p className="text-[15px] text-[#5a5a5a] mb-8 leading-relaxed">{activeDocPage.subtitle}</p>
                )}

                {/* Content */}
                {activeDocPage.content.map((c, i) => (
                  <section key={i} id={`heading-${i}`}>
                    <ContentBlock content={c} />
                  </section>
                ))}

                {/* Footer */}
                <div className="mt-12 pt-6 border-t border-[#e6e6e6]">
                  <a
                    href={`https://github.com/HalxDocs/reqit/edit/main/flux/frontend/src/shared/lib/docs.ts`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-[#8f8f8f] hover:text-[#0070F3] transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink size={12} />
                    Edit this page on GitHub
                  </a>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[60vh] text-[15px] text-[#8f8f8f]">
                Select a page from the sidebar
              </div>
            )}
          </div>
        </main>
        <OnThisPage page={activeDocPage} />
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={handleSelectPage} />
    </div>
  );
}
