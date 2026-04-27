import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useResponseStore } from "../../stores/useResponseStore";
import { formatTiming } from "../../lib/format";

export function LoadingState() {
  const startedAt = useResponseStore((s) => s.startedAt);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-subtext">
      <Loader2 size={28} className="text-violet animate-spin" />
      <div className="text-12 font-mono">{formatTiming(elapsed)}</div>
    </div>
  );
}
