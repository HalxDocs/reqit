import { cn } from "../../lib/cn";

export type TabItem<T extends string> = { id: T; label: string };

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex border-b border-border">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative px-4 h-[36px] text-12 font-semibold transition-colors",
              isActive ? "text-text" : "text-subtext hover:text-text",
            )}
          >
            {tab.label}
            {isActive && (
              <span className="absolute left-3 right-3 -bottom-px h-[2px] bg-violet rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
