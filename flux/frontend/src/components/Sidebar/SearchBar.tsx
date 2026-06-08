import { Search, X } from "lucide-react";
import { useUIStore } from "../../stores/useUIStore";

export function SearchBar() {
  const value = useUIStore((s) => s.sidebarFilter);
  const setValue = useUIStore((s) => s.setSidebarFilter);

  return (
    <div className="relative">
      <Search
        size={12}
        className="absolute left-2 top-1/2 -translate-y-1/2 text-subtext pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search collections, history…"
        spellCheck={false}
        className="w-full h-[28px] pl-7 pr-7 bg-bg border border-border rounded-md text-12 text-text placeholder:text-subtext outline-none focus:border-cyan focus:ring-2 focus:ring-cyan transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-subtext hover:text-text transition-colors"
          aria-label="Clear search"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
