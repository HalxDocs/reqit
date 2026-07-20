import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { ChevronRight, ChevronDown, Copy, Check } from "lucide-react";
import { cn } from "@/shared/lib/cn";

interface TreeNode {
  key: string | number;
  value: unknown;
  type: "object" | "array" | "string" | "number" | "boolean" | "null";
  path: string;
  childCount?: number;
}

interface JsonTreeViewProps {
  data: unknown;
  className?: string;
  searchQuery?: string;
}

const LARGE_ARRAY_THRESHOLD = 100;
const INITIAL_VISIBLE = 50;

function parseJsonToTree(data: unknown, parentPath = "$"): TreeNode[] {
  if (Array.isArray(data)) {
    return data.map((item, i) => ({
      key: i,
      value: item,
      type: getItemType(item),
      path: `${parentPath}[${i}]`,
      childCount: getItemCount(item),
    }));
  }
  if (data !== null && typeof data === "object") {
    return Object.entries(data).map(([key, value]) => ({
      key,
      value,
      type: getItemType(value),
      path: `${parentPath}.${key}`,
      childCount: getItemCount(value),
    }));
  }
  return [];
}

function getItemType(value: unknown): TreeNode["type"] {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value as "object" | "string" | "number" | "boolean";
}

function getItemCount(value: unknown): number | undefined {
  if (Array.isArray(value)) return value.length;
  if (value !== null && typeof value === "object") return Object.keys(value).length;
  return undefined;
}

function JsonValue({ value, type }: { value: unknown; type: TreeNode["type"] }) {
  if (type === "null") {
    return <span className="text-tertiary italic">null</span>;
  }
  if (type === "string") {
    const s = String(value);
    const display = s.length > 120 ? s.slice(0, 120) + "…" : s;
    return <span className="text-teal">"{display}"</span>;
  }
  if (type === "number") {
    return <span className="text-cyan">{String(value)}</span>;
  }
  if (type === "boolean") {
    return <span className="text-amber">{String(value)}</span>;
  }
  return null;
}

function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query) return <>{text}</>;
  const q = query.toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-cyan/30 rounded-sm">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

function TreeNodeComponent({
  node,
  depth,
  expandedPaths,
  togglePath,
  selectedPath,
  setSelectedPath,
  searchQuery,
}: {
  node: TreeNode;
  depth: number;
  expandedPaths: Set<string>;
  togglePath: (path: string) => void;
  selectedPath: string | null;
  setSelectedPath: (path: string) => void;
  searchQuery?: string;
}) {
  const isExpandable = node.type === "object" || node.type === "array";
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;

  const handleClick = useCallback(() => {
    setSelectedPath(node.path);
    if (isExpandable) {
      togglePath(node.path);
    }
  }, [node.path, isExpandable, togglePath, setSelectedPath]);

  const children = useMemo(() => {
    if (!isExpandable || !isExpanded) return [];
    if (node.type === "array" && Array.isArray(node.value)) {
      return parseJsonToTree(node.value, node.path);
    }
    if (node.type === "object" && node.value !== null && typeof node.value === "object") {
      return parseJsonToTree(node.value, node.path);
    }
    return [];
  }, [isExpandable, isExpanded, node]);

  const isLargeArray = node.type === "array" && Array.isArray(node.value) && node.value.length > LARGE_ARRAY_THRESHOLD;
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const visibleChildren = isLargeArray ? children.slice(0, visibleCount) : children;
  const hasMore = isLargeArray && visibleCount < children.length;

  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + INITIAL_VISIBLE, children.length));
  }, [children.length]);

  return (
    <div data-scope="responseTree" tabIndex={-1}>
      <div
        className={cn(
          "flex items-center gap-1 py-[3px] px-1 rounded-sm cursor-pointer hover:bg-card/50 transition-colors group",
          isSelected && "bg-cardHover",
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={handleClick}
        data-shortcut={isExpandable ? (isExpanded ? "tree.collapse" : "tree.expand") : undefined}
      >
        {isExpandable ? (
          <span className="w-4 h-4 flex items-center justify-center text-subtext shrink-0">
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        ) : (
          <span className="w-4 h-4 shrink-0" />
        )}

        <span className="font-mono text-12 text-subtext mr-1 shrink-0">
          <Highlight text={String(node.key)} query={searchQuery} />
          {isExpandable ? "" : ":"}
        </span>

        {!isExpandable && <JsonValue value={node.value} type={node.type} />}

        {isExpandable && (
          <span className="text-11 text-tertiary">
            {node.type === "array" ? `[${node.childCount}]` : `{${node.childCount}}`}
          </span>
        )}

        {!isExpandable && (
          <CopyNodeButton path={node.path} value={node.value} />
        )}
      </div>

      {isExpanded && (
        <>
          {visibleChildren.map((child) => (
            <TreeNodeComponent
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              togglePath={togglePath}
              selectedPath={selectedPath}
              setSelectedPath={setSelectedPath}
              searchQuery={searchQuery}
            />
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              className="text-11 text-cyan hover:underline ml-6 py-1"
            >
              Show {Math.min(INITIAL_VISIBLE, children.length - visibleCount)} more of {children.length - visibleCount}…
            </button>
          )}
        </>
      )}
    </div>
  );
}

function CopyNodeButton({ path, value }: { path: string; value: unknown }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const text = typeof value === "string" ? value : JSON.stringify(value);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      data-shortcut="tree.copy"
      className="ml-auto opacity-0 group-hover:opacity-100 text-subtext hover:text-text transition-opacity"
      title="Copy value"
    >
      {copied ? <Check size={10} className="text-teal" /> : <Copy size={10} />}
    </button>
  );
}

export function JsonTreeView({ data, className, searchQuery }: JsonTreeViewProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(["$"]));
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const togglePath = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allPaths = new Set<string>();
    const walk = (val: unknown, path: string) => {
      allPaths.add(path);
      if (Array.isArray(val)) {
        val.forEach((item, i) => walk(item, `${path}[${i}]`));
      } else if (val !== null && typeof val === "object") {
        Object.entries(val).forEach(([k, v]) => walk(v, `${path}.${k}`));
      }
    };
    walk(data, "$");
    setExpandedPaths(allPaths);
  }, [data]);

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set(["$"]));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!document.activeElement?.closest("[data-scope='responseTree']")) return;

      const parts: string[] = [];
      if (e.metaKey || e.ctrlKey) parts.push(e.metaKey ? "meta" : "ctrl");
      if (e.shiftKey) parts.push("shift");
      const key = e.key.toLowerCase();
      parts.push(key);
      const combo = parts.join("+");

      if (combo === "meta+arrowdown" || combo === "ctrl+arrowdown") {
        e.preventDefault();
        expandAll();
      } else if (combo === "meta+arrowup" || combo === "ctrl+arrowup") {
        e.preventDefault();
        collapseAll();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [expandAll, collapseAll]);

  const tree = useMemo(() => parseJsonToTree(data), [data]);

  const matchingPaths = useMemo(() => {
    if (!searchQuery) return new Set<string>();
    const q = searchQuery.toLowerCase();
    const paths = new Set<string>();
    const walk = (val: unknown, path: string) => {
      if (val !== null && typeof val === "object" && !Array.isArray(val)) {
        for (const [k, v] of Object.entries(val)) {
          const childPath = `${path}.${k}`;
          if (k.toLowerCase().includes(q)) {
            paths.add(childPath);
            let p = path;
            while (p !== "$") { paths.add(p); p = p.substring(0, p.lastIndexOf(".", p.length - 1) === -1 ? 0 : p.lastIndexOf(".")); }
          }
          if (typeof v === "string" && v.toLowerCase().includes(q)) {
            paths.add(childPath);
            let p = path;
            while (p !== "$") { paths.add(p); p = p.substring(0, p.lastIndexOf(".", p.length - 1) === -1 ? 0 : p.lastIndexOf(".")); }
          }
          walk(v, childPath);
        }
      } else if (Array.isArray(val)) {
        val.forEach((item, i) => {
          const childPath = `${path}[${i}]`;
          if (typeof item === "string" && item.toLowerCase().includes(q)) {
            paths.add(childPath);
            let p = path;
            while (p !== "$") { paths.add(p); p = p.substring(0, p.lastIndexOf(".", p.length - 1) === -1 ? 0 : p.lastIndexOf(".")); }
          }
          walk(item, childPath);
        });
      }
    };
    walk(data, "$");
    return paths;
  }, [data, searchQuery]);

  useEffect(() => {
    if (matchingPaths.size > 0) {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        for (const p of matchingPaths) next.add(p);
        return next;
      });
    }
  }, [matchingPaths]);

  return (
    <div className={cn("overflow-auto h-full font-mono text-12 select-text", className)}>
      {tree.map((node) => (
        <TreeNodeComponent
          key={node.path}
          node={node}
          depth={0}
          expandedPaths={expandedPaths}
          togglePath={togglePath}
          selectedPath={selectedPath}
          setSelectedPath={setSelectedPath}
          searchQuery={searchQuery}
        />
      ))}
      <button type="button" data-shortcut="tree.expandAll" onClick={expandAll} style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
      <button type="button" data-shortcut="tree.collapseAll" onClick={collapseAll} style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
    </div>
  );
}
