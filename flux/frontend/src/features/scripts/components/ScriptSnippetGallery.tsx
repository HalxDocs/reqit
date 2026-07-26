import { useMemo, useState } from "react";
import { Code, Search, X } from "lucide-react";
import { SNIPPETS } from "@/features/scripts/lib/snippets";
import { cn } from "@/shared/lib/cn";

interface Props {
  scope: "pre" | "post";
  onInsert: (code: string) => void;
}

export function ScriptSnippetGallery({ scope, onInsert }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const s of SNIPPETS) {
      if (s.scope === scope || s.scope === "both") cats.add(s.category);
    }
    return Array.from(cats);
  }, [scope]);

  const filtered = useMemo(() => {
    let list = SNIPPETS.filter((s) => s.scope === scope || s.scope === "both");
    if (selectedCat) list = list.filter((s) => s.category === selectedCat);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((s) => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    }
    return list;
  }, [scope, selectedCat, query]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-11 text-subtext hover:text-text transition-colors"
        title="Insert script snippet"
      >
        <Code size={11} /> Snippets
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl p-3 min-w-[360px] max-h-[400px] overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1 flex-1 bg-bg border border-border rounded px-2 h-[28px]">
                <Search size={11} className="text-subtext" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search snippets..."
                  className="flex-1 bg-transparent text-11 text-text outline-none placeholder:text-tertiary"
                  autoFocus
                />
                {query && <button type="button" onClick={() => setQuery("")} className="text-subtext hover:text-text"><X size={10} /></button>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCat(selectedCat === cat ? null : cat)}
                  className={cn(
                    "px-2 py-0.5 text-10 rounded-full border transition-colors",
                    selectedCat === cat ? "bg-cyan/15 border-cyan/30 text-cyan" : "border-border text-subtext hover:text-text",
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { onInsert(s.code); setOpen(false); }}
                  className="flex flex-col items-start gap-0.5 px-2 py-1.5 rounded-lg hover:bg-cardHover transition-colors text-left"
                >
                  <span className="text-12 font-medium text-text">{s.title}</span>
                  <span className="text-10 text-subtext">{s.description}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-11 text-subtext text-center py-4">No snippets match your search.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
