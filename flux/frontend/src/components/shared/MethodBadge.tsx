import { cn } from "../../lib/cn";
import type { HttpMethod } from "../../types/request";

const STYLES: Record<HttpMethod, string> = {
  GET: "bg-teal text-black",
  POST: "bg-violet text-white",
  PUT: "bg-warn text-black",
  PATCH: "bg-violet text-white",
  DELETE: "bg-danger text-white",
  HEAD: "bg-border text-subtext",
  OPTIONS: "bg-border text-subtext",
};

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
        STYLES[method],
        className,
      )}
    >
      {method}
    </span>
  );
}
