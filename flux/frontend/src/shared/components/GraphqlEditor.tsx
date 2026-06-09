import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import type { GraphQLSchema, GraphQLSchemaType } from "@/features/request/types/request";

interface AutocompleteItem {
  label: string;
  insert: string;
  type: "type" | "field" | "keyword";
}

const GRAPHQL_KEYWORDS: AutocompleteItem[] = [
  { label: "query", insert: "query", type: "keyword" },
  { label: "mutation", insert: "mutation", type: "keyword" },
  { label: "subscription", insert: "subscription", type: "keyword" },
  { label: "fragment", insert: "fragment", type: "keyword" },
  { label: "on", insert: "on", type: "keyword" },
];

function buildSuggestions(
  schema: GraphQLSchema | null,
  prefix: string,
): AutocompleteItem[] {
  const out: AutocompleteItem[] = [];
  const lower = prefix.toLowerCase();

  if (schema) {
    for (const t of schema.types) {
      if (t.name.toLowerCase().includes(lower)) {
        out.push({ label: t.name, insert: t.name, type: "type" });
      }
      if (t.fields) {
        for (const f of t.fields) {
          if (f.name.toLowerCase().includes(lower)) {
            out.push({ label: `${t.name}.${f.name}`, insert: f.name, type: "field" });
          }
        }
      }
    }
  }

  for (const kw of GRAPHQL_KEYWORDS) {
    if (kw.label.toLowerCase().includes(lower)) {
      out.push(kw);
    }
  }

  out.sort((a, b) => a.label.localeCompare(b.label));
  return out.slice(0, 30);
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  schema?: GraphQLSchema | null;
  schemaLoading?: boolean;
}

export function GraphqlEditor({ value, onChange, schema, schemaLoading }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPos, setCursorPos] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);

  const currentWord = useMemo(() => {
    if (cursorPos === null) return { word: "", start: 0, end: 0 };
    let start = cursorPos;
    while (start > 0 && /[a-zA-Z_]/.test(value[start - 1])) start--;
    let end = cursorPos;
    while (end < value.length && /[a-zA-Z_]/.test(value[end])) end++;
    return { word: value.slice(start, end), start, end };
  }, [value, cursorPos]);

  const suggestions = useMemo(
    () => buildSuggestions(schema ?? null, currentWord.word),
    [schema, currentWord.word],
  );

  const hasSuggestions = showDropdown && suggestions.length > 0 && currentWord.word.length > 0;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!hasSuggestions) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const item = suggestions[selectedIndex];
        if (item) {
          const before = value.slice(0, currentWord.start);
          const after = value.slice(currentWord.end);
          onChange(before + item.insert + after);
          setShowDropdown(false);
        }
      } else if (e.key === "Escape") {
        setShowDropdown(false);
      }
    },
    [hasSuggestions, suggestions, selectedIndex, value, currentWord, onChange],
  );

  const handleSelect = useCallback(
    (item: AutocompleteItem) => {
      const before = value.slice(0, currentWord.start);
      const after = value.slice(currentWord.end);
      onChange(before + item.insert + after);
      setShowDropdown(false);
      textareaRef.current?.focus();
    },
    [value, currentWord, onChange],
  );

  const handleCursor = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      const pos = ta.selectionStart;
      setCursorPos(pos);
      // only show dropdown if there's a word at cursor
      let start = pos;
      while (start > 0 && /[a-zA-Z_]/.test(value[start - 1])) start--;
      const hasWord = pos > start;
      setShowDropdown(hasWord);
      setSelectedIndex(0);
    }
  }, [value]);

  return (
    <div className="relative w-full h-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onSelect={handleCursor}
        onClick={handleCursor}
        placeholder={`query {\n  users {\n    id\n    name\n    email\n  }\n}`}
        spellCheck={false}
        className="w-full h-full resize-none bg-transparent text-12 text-text font-mono p-3 outline-none placeholder:text-subtext/30"
      />
      {hasSuggestions && (
        <div
          className="absolute left-0 top-full mt-0.5 w-[280px] max-h-[240px] overflow-y-auto bg-surface border border-border rounded-lg shadow-xl z-50 py-1"
        >
          {suggestions.map((item, i) => (
            <button
              key={item.label + item.type}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`w-full flex items-center gap-2 px-3 py-[5px] text-12 text-left transition-colors ${
                i === selectedIndex
                  ? "bg-cyan/15 text-text"
                  : "text-subtext hover:bg-cardHover"
              }`}
            >
              <span className={`w-[10px] h-[10px] rounded-sm shrink-0 ${
                item.type === "type" ? "bg-cyan" :
                item.type === "field" ? "bg-post" :
                "bg-tertiary"
              }`} />
              <span className="font-mono">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
