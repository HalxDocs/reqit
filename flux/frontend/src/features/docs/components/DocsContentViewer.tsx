import { useMemo, useState } from "react";
import { Book, ChevronDown, ChevronRight, Search, ExternalLink, FileText } from "lucide-react";
import { DOC_CATEGORIES, type DocCategory, type DocPage, type DocContent } from "@/shared/lib/docs";
import { useUIStore } from "@/app/stores/useUIStore";
import { cn } from "@/shared/lib/cn";

function DocCode({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <pre className="bg-bg border border-border rounded-lg p-3 text-12 font-mono text-text overflow-x-auto whitespace-pre-wrap">
      {lines.map((line, i) => (
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
      className="flex items-start gap-2 p-2 rounded-lg border border-border bg-surface hover:border-cyan/30 hover:bg-cardHover transition-all group"
    >
      <ExternalLink size={11} className="mt-0.5 shrink-0 text-subtext group-hover:text-cyan" />
      <div className="min-w-0">
        <div className="text-12 font-semibold text-text group-hover:text-cyan transition-colors truncate">{title}</div>
        {desc && <div className="text-11 text-subtext mt-0.5 line-clamp-2">{desc}</div>}
      </div>
    </a>
  );
}

function ContentBlock({ content }: { content: DocContent }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-13 font-semibold text-text">{content.heading}</h3>
      <p className="text-12 text-subtext leading-relaxed">{content.body}</p>
      {content.code && <DocCode code={content.code} />}
      {content.resources && content.resources.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          {content.resources.map((r) => (
            <ResourceLink key={r.url} title={r.title} url={r.url} desc={r.desc} />
          ))}
        </div>
      )}
    </div>
  );
}

function PageView({ page }: { page: DocPage }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-16 font-bold text-text" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>{page.title}</h2>
        {page.subtitle && <p className="text-12 text-subtext mt-1">{page.subtitle}</p>}
      </div>
      {page.content.map((c, i) => (
        <ContentBlock key={i} content={c} />
      ))}
    </div>
  );
}

function SidebarTree({
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
  const [expandedCats, setExpandedCats] = useState<Set<string>>(() => new Set([categories[0]?.id].filter(Boolean)));

  const toggleCat = (id: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <nav className="flex flex-col gap-0.5">
      {categories.map((cat) => {
        const isExpanded = expandedCats.has(cat.id);
        const isActiveCat = activeCategory === cat.id;
        return (
          <div key={cat.id}>
            <button
              type="button"
              onClick={() => toggleCat(cat.id)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-12 rounded-md transition-colors text-left",
                isActiveCat ? "text-text font-semibold" : "text-subtext hover:text-text hover:bg-cardHover",
              )}
            >
              {isExpanded ? <ChevronDown size={11} className="shrink-0" /> : <ChevronRight size={11} className="shrink-0" />}
              <span className="truncate">{cat.title}</span>
              <span className="ml-auto text-10 text-subtext/50">{cat.pages.length}</span>
            </button>
            {isExpanded && (
              <div className="ml-2 flex flex-col gap-0.5 mt-0.5 border-l border-border pl-2">
                {cat.pages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => onSelectPage(cat.id, page.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-1 text-11 rounded-md transition-colors text-left",
                      activePage === page.id
                        ? "bg-cyan/10 text-cyan font-semibold"
                        : "text-subtext hover:text-text hover:bg-cardHover",
                    )}
                  >
                    <FileText size={10} className="shrink-0 opacity-60" />
                    <span className="truncate">{page.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function DocsContentViewer() {
  const setView = useUIStore((s) => s.setView);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(DOC_CATEGORIES[0]?.id ?? null);
  const [activePage, setActivePage] = useState<string | null>(DOC_CATEGORIES[0]?.pages[0]?.id ?? null);

  const activeDocPage = useMemo(() => {
    if (!activeCategory || !activePage) return null;
    const cat = DOC_CATEGORIES.find((c) => c.id === activeCategory);
    if (!cat) return null;
    return cat.pages.find((p) => p.id === activePage) ?? null;
  }, [activeCategory, activePage]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const results: { catId: string; catTitle: string; page: DocPage }[] = [];
    for (const cat of DOC_CATEGORIES) {
      for (const page of cat.pages) {
        const inTitle = page.title.toLowerCase().includes(q);
        const inSubtitle = page.subtitle?.toLowerCase().includes(q);
        const inContent = page.content.some(
          (c) => c.heading.toLowerCase().includes(q) || c.body.toLowerCase().includes(q),
        );
        if (inTitle || inSubtitle || inContent) {
          results.push({ catId: cat.id, catTitle: cat.title, page });
        }
      }
    }
    return results;
  }, [search]);

  const handleSelectPage = (catId: string, pageId: string) => {
    setActiveCategory(catId);
    setActivePage(pageId);
    setSearch("");
  };

  const handleSelectSearchResult = (catId: string, pageId: string) => {
    handleSelectPage(catId, pageId);
  };

  return (
    <div className="flex-1 flex min-w-0 bg-bg">
      {/* Sidebar */}
      <div className="w-[240px] shrink-0 border-r border-border flex flex-col bg-surface">
        <div className="flex items-center gap-2 px-3 h-[48px] border-b border-border shrink-0">
          <Book size={14} className="text-cyan" />
          <span className="text-13 font-semibold text-text">Documentation</span>
        </div>
        <div className="px-3 py-2 border-b border-border shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-subtext pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search docs…"
              spellCheck={false}
              className="w-full h-[28px] pl-7 pr-2 bg-bg border border-border rounded-md text-12 text-text outline-none focus:border-cyan"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {search ? (
            <div className="flex flex-col gap-1">
              <p className="text-10 text-subtext/50 px-2 py-1">
                {searchResults?.length ?? 0} result{(searchResults?.length ?? 0) !== 1 ? "s" : ""}
              </p>
              {searchResults && searchResults.length > 0 ? (
                searchResults.map((r) => (
                  <button
                    key={`${r.catId}-${r.page.id}`}
                    type="button"
                    onClick={() => handleSelectSearchResult(r.catId, r.page.id)}
                    className="flex flex-col gap-0.5 px-2.5 py-1.5 text-12 rounded-md hover:bg-cardHover transition-colors text-left"
                  >
                    <span className="font-medium text-text truncate">{r.page.title}</span>
                    <span className="text-10 text-subtext/50 truncate">{r.catTitle}</span>
                  </button>
                ))
              ) : (
                <p className="text-12 text-subtext/50 text-center py-6">No results found.</p>
              )}
            </div>
          ) : (
            <SidebarTree
              categories={DOC_CATEGORIES}
              activeCategory={activeCategory}
              activePage={activePage}
              onSelectPage={handleSelectPage}
            />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[48px] flex items-center gap-3 px-4 border-b border-border shrink-0">
          <button onClick={() => setView("http")} className="text-subtext hover:text-text text-13">&larr; Back</button>
          <h1 className="text-14 font-semibold text-text">Documentation</h1>
        </header>
        <div className="flex-1 overflow-y-auto">
          {activeDocPage ? (
            <div className="max-w-[720px] p-6">
              <PageView page={activeDocPage} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-13 text-subtext/50">
              Select a page from the sidebar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
