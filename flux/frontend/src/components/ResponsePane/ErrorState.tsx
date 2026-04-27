import { AlertTriangle } from "lucide-react";

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex-1 p-5">
      <div className="bg-danger/10 border border-danger/40 rounded-md p-4 flex gap-3">
        <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <div className="text-13 font-bold text-danger">Request failed</div>
          <div className="text-12 text-text font-mono break-all">{message}</div>
        </div>
      </div>
    </div>
  );
}
