import { Plus, X } from "lucide-react";
import { deriveTitle, useTabsStore } from "@/features/tabs/stores/useTabsStore";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { MethodBadge } from "@/shared/components/MethodBadge";
import { cn } from "@/shared/lib/cn";
import type { HttpMethod } from "@/features/request/types/request";

export function TabBar() {
  const tabs = useTabsStore((s) => s.tabs);
  const activeID = useTabsStore((s) => s.activeID);
  const setActive = useTabsStore((s) => s.setActive);
  const closeTab = useTabsStore((s) => s.closeTab);
  const newTab = useTabsStore((s) => s.newTab);

  // For the active tab, render the title and method from the live request store
  // so they update as the user types — avoids snapshot polling.
  const liveUrl = useRequestStore((s) => s.url);
  const liveMethod = useRequestStore((s) => s.method);

  return (
    <div className="h-[36px] flex items-stretch border-b border-border bg-surface overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeID;
        const method = (isActive ? liveMethod : tab.request.method) as HttpMethod;
        const title =
          isActive && !tab.savedRequestID
            ? deriveTitle({ ...tab.request, url: liveUrl })
            : tab.title;
        return (
          <div
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "group flex items-center gap-2 px-3 max-w-[220px] min-w-[120px] border-r border-border cursor-pointer transition-colors relative shrink-0",
              isActive
                ? "bg-bg text-text"
                : "bg-surface text-subtext hover:text-text hover:bg-cardHover",
            )}
          >
            {isActive && (
              <span className="absolute top-0 left-0 right-0 h-[2px] bg-cyan" />
            )}
            <MethodBadge method={method} className="text-[10px] h-[16px] px-1" />
            <span className="flex-1 truncate text-12 font-mono">{title}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className={cn(
                "shrink-0 p-1 rounded-sm transition-all",
                isActive
                  ? "text-subtext hover:text-text"
                  : "opacity-0 group-hover:opacity-100 text-subtext hover:text-text",
              )}
              aria-label="Close tab"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => newTab()}
        className="shrink-0 px-3 flex items-center text-subtext hover:text-cyan hover:bg-cardHover transition-colors"
        aria-label="New tab"
        title="New tab (Ctrl+T)"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
