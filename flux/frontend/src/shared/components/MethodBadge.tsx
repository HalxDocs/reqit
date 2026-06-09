import { cn } from "@/shared/lib/cn";
import type { HttpMethod } from "@/features/request/types/request";

const STYLES: Record<string, string> = {
  GET: "bg-get text-black",
  POST: "bg-post text-black",
  PUT: "bg-put text-black",
  PATCH: "bg-patch text-black",
  DELETE: "bg-del text-white",
  HEAD: "bg-border text-subtext",
  OPTIONS: "bg-border text-subtext",
};

const FALLBACK_STYLE = "bg-border text-subtext";

export function MethodBadge({
  method,
  className,
}: {
  method: HttpMethod;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center px-2 h-[20px] rounded-sm font-bold text-11 tracking-wider",
        STYLES[method] ?? FALLBACK_STYLE,
        className,
      )}
    >
      {method}
    </span>
  );
}
