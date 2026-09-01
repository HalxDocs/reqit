import { ArrowLeft } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export function PanelHeader({
  title,
  onBack,
  statusDot,
  actions,
  className,
}: {
  title: string;
  onBack?: () => void;
  statusDot?: "green" | "amber" | "red" | "gray";
  actions?: React.ReactNode;
  className?: string;
}) {
  const dotColor: Record<string, string> = {
    green: "bg-success",
    amber: "bg-warn",
    red: "bg-danger",
    gray: "bg-tertiary",
  };
  return (
    <div className={cn("h-[48px] px-4 flex items-center gap-3 border-b border-border bg-card/50 shrink-0", className)}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="w-[28px] h-[28px] flex items-center justify-center rounded-md text-subtext hover:text-text hover:bg-cardHover transition-colors shrink-0"
          aria-label="Back"
        >
          <ArrowLeft size={14} />
        </button>
      )}
      <h2 className="text-13 font-semibold text-text truncate flex items-center gap-2">
        {statusDot && <span className={cn("w-[8px] h-[8px] rounded-full shrink-0", dotColor[statusDot])} />}
        {title}
      </h2>
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
