import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useUIStore } from "@/app/stores/useUIStore";

export function SearchBar() {
  const storeValue = useUIStore((s) => s.sidebarFilter);
  const setStoreValue = useUIStore((s) => s.setSidebarFilter);
  const [local, setLocal] = useState(storeValue);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { setLocal(storeValue); }, [storeValue]);

  const update = (val: string) => {
    setLocal(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStoreValue(val), 300);
  };

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    setLocal("");
    setStoreValue("");
  };

  return (
    <div className="relative">
      <Search
        size={12}
        className="absolute left-2 top-1/2 -translate-y-1/2 text-subtext pointer-events-none"
      />
      <input
        type="text"
        value={local}
        onChange={(e) => update(e.target.value)}
        placeholder="Search collections, history…"
        spellCheck={false}
        data-shortcut="sidebar.search"
        className="w-full h-[28px] pl-7 pr-7 bg-bg border border-border rounded-md text-12 text-text placeholder:text-subtext outline-none focus:border-cyan focus:ring-2 focus:ring-cyan transition-colors"
      />
      {local && (
        <button type="button" onClick={clear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-subtext hover:text-text transition-colors"
          aria-label="Clear search">
          <X size={12} />
        </button>
      )}
    </div>
  );
}
