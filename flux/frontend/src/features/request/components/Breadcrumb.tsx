import { useMemo } from "react";
import { ChevronRight, FolderOpen } from "lucide-react";
import { useTabsStore } from "@/features/tabs/stores/useTabsStore";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";

export function Breadcrumb() {
  const tabs = useTabsStore((s) => s.tabs);
  const activeID = useTabsStore((s) => s.activeID);
  const collections = useCollectionStore((s) => s.collections);

  const path = useMemo(() => {
    const active = tabs.find((t) => t.id === activeID);
    if (!active?.savedRequestID) return null;
    for (const col of collections) {
      const req = col.requests.find((r) => r.id === active.savedRequestID);
      if (req) return { collection: col.name, request: req.name };
    }
    return null;
  }, [tabs, activeID, collections]);

  if (!path) return null;

  return (
    <div className="flex items-center gap-1 px-4 pt-1.5 pb-0.5 text-11 text-subtext/60">
      <FolderOpen size={10} />
      <span className="hover:text-text transition-colors">{path.collection}</span>
      <ChevronRight size={10} />
      <span className="text-text/70 font-medium">{path.request}</span>
    </div>
  );
}
