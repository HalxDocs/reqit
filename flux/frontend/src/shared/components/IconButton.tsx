import { forwardRef } from "react";
import { cn } from "@/shared/lib/cn";
import type { ReactNode, ButtonHTMLAttributes } from "react";

type Tone = "neutral" | "danger";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  tooltip?: string;
  children: ReactNode;
}

const toneClass: Record<Tone, string> = {
  neutral: "text-subtext hover:text-text",
  danger: "text-subtext hover:text-danger",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ tone = "neutral", tooltip, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      title={tooltip}
      className={cn(
        "p-0.5 rounded transition-colors",
        toneClass[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
