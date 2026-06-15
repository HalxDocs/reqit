import { cn } from "@/shared/lib/cn";

export type TabItem<T extends string> = { id: T; label: string };

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex border-b border-border bg-surface", className)}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative px-4 h-[34px] text-12 font-medium transition-all",
              isActive
                ? "text-cyan"
                : "text-subtext hover:text-text",
            )}
          >
            <span className={isActive ? "text-cyan" : undefined}>
              {tab.label}
            </span>
            {isActive && (
              <span className="absolute left-3 right-3 bottom-0 h-[2px] bg-cyan rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
