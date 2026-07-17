import { Plus, X, MousePointer2 } from "lucide-react";
import { useRef, useState } from "react";
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
  const moveTab = useTabsStore((s) => s.moveTab);

  const liveUrl = useRequestStore((s) => s.url);
  const liveMethod = useRequestStore((s) => s.method);

  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragRef = useRef<string | null>(null);

  if (tabs.length === 0) {
    return (
      <div className="h-[34px] flex items-center gap-2 bg-surface border-b border-border px-3 text-12 text-subtext">
        <MousePointer2 size={11} />
        <span>No tabs — open a request from the sidebar or click +</span>
        <button
          type="button"
          onClick={() => newTab()}
          className="ml-auto shrink-0 flex items-center gap-1 px-2 h-[22px] text-11 text-cyan hover:bg-cyan/10 rounded-sm transition-colors"
          aria-label="New tab"
          title="New tab (Ctrl+T)"
        >
          <Plus size={11} />
          New tab
        </button>
      </div>
    );
  }

  return (
    <div className="h-[34px] flex items-stretch bg-surface overflow-x-auto border-b border-border">
      <div className="flex items-stretch">
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeID;
          const method = (isActive ? liveMethod : tab.request.method) as HttpMethod;
          const title =
            isActive && !tab.savedRequestID
              ? deriveTitle({ ...tab.request, url: liveUrl })
              : tab.title;
          return (
            <div
              key={tab.id}
              draggable
              onClick={() => setActive(tab.id)}
              onDragStart={() => { dragRef.current = tab.id; setDragOverIdx(null); }}
              onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
              onDragLeave={() => setDragOverIdx(null)}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragRef.current;
                if (from && from !== tab.id) moveTab(from, idx);
                dragRef.current = null;
                setDragOverIdx(null);
              }}
              onDragEnd={() => { dragRef.current = null; setDragOverIdx(null); }}
              className={cn(
                "group flex items-center gap-2 px-3 max-w-[200px] min-w-[100px] border-r border-border cursor-pointer transition-all relative shrink-0 select-none",
                isActive
                  ? "bg-bg text-text shadow-[inset_0_-1px_0_0_rgb(8,145,178)]"
                  : "bg-surface text-subtext hover:text-text hover:bg-cardHover",
                dragOverIdx === idx && "bg-cyan/10",
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-3 right-3 h-[2px] bg-cyan rounded-full" />
              )}
              <MethodBadge method={method} className="text-[9px] h-[15px] px-[5px]" />
              <span className="flex-1 truncate text-12 font-mono leading-none flex items-center gap-1">
                {tab.dirty && <span className="w-[6px] h-[6px] rounded-full bg-amber shrink-0" />}
                {title}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className={cn(
                  "shrink-0 rounded-sm transition-all",
                  isActive
                    ? "text-subtext hover:text-text opacity-60 hover:opacity-100"
                    : "opacity-0 group-hover:opacity-60 hover:opacity-100 text-subtext hover:text-text",
                )}
                aria-label="Close tab"
                title="Close tab (Ctrl+W)"
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => newTab()}
        className="shrink-0 px-3 flex items-center text-subtext hover:text-cyan hover:bg-cardHover transition-colors border-r border-border"
        aria-label="New tab"
        title="New tab (Ctrl+T)"
      >
        <Plus size={13} />
      </button>
    </div>
  );
}
