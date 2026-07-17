import { AlertTriangle, RefreshCw } from "lucide-react";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex-1 p-5">
      <div className="bg-danger/10 border border-danger/40 rounded-md p-4 flex gap-3">
        <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="text-13 font-bold text-danger">Request failed</div>
          <div className="text-12 text-text font-mono break-all">{message}</div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="self-start flex items-center gap-1.5 h-[28px] px-3 text-12 font-semibold text-cyan bg-cyan/10 border border-cyan/20 rounded-md hover:bg-cyan/15 transition-colors"
            >
              <RefreshCw size={11} />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
