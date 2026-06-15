import { forwardRef } from "react";
import { cn } from "@/shared/lib/cn";
import type { ReactNode, ButtonHTMLAttributes } from "react";

const variants = {
  primary:
    "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-12 font-medium bg-cyan text-white hover:bg-cyan-hover disabled:opacity-40 disabled:pointer-events-none transition-colors",
  secondary:
    "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-12 font-medium bg-card text-text border border-border hover:bg-cardHover disabled:opacity-40 disabled:pointer-events-none transition-colors",
  ghost:
    "inline-flex items-center justify-center gap-1 text-subtext hover:text-cyan disabled:opacity-40 disabled:pointer-events-none transition-colors",
  danger:
    "inline-flex items-center justify-center gap-1 text-subtext hover:text-danger disabled:opacity-40 disabled:pointer-events-none transition-colors",
  link:
    "inline-flex items-center gap-1 text-cyan hover:underline disabled:opacity-40 disabled:pointer-events-none transition-colors",
  "menu-item":
    "w-full px-3 py-1.5 text-left text-12 text-text hover:bg-cardHover disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 transition-colors",
  "menu-item-danger":
    "w-full px-3 py-1.5 text-left text-12 text-danger hover:bg-cardHover disabled:opacity-40 disabled:pointer-events-none transition-colors",
};

type Variant = keyof typeof variants;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "ghost", className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(variants[variant], className)}
      {...props}
    >
      {children}
    </button>
  ),
);
