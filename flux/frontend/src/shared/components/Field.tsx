import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

/**
 * A labelled form field. Used by the OAuth2 panel, the welcome modal and the
 * save-request dialog, which each had their own copy.
 */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label className="text-11 text-subtext font-semibold uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
