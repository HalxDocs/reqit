import { AlertCircle, Info, AlertTriangle, Check } from "lucide-react";
import { cn } from "@/shared/lib/cn";

type Variant = "error" | "info" | "warning" | "success";

export function InlineAlert({
  variant = "info",
  children,
  className,
}: {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}) {
  const styles: Record<Variant, string> = {
    error: "bg-danger/10 border-danger/40 text-danger",
    info: "bg-cyan/10 border-cyan/20 text-cyan",
    warning: "bg-warn/10 border-warn/20 text-warn",
    success: "bg-success/10 border-success/20 text-success",
  };
  const Icons: Record<Variant, any> = {
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle,
    success: Check,
  };
  const Icon = Icons[variant];
  return (
    <div className={cn("flex items-start gap-2 px-3 py-2 rounded-md border text-11 leading-relaxed", styles[variant], className)}>
      <Icon size={13} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 break-words">{children}</div>
    </div>
  );
}
