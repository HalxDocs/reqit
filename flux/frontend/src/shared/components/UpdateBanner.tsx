import { Download, X, ArrowUpCircle, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useUpdater } from "@/app/hooks/useUpdater";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

export function UpdateBanner() {
  const { update, installing, done, error, install, dismiss } = useUpdater();

  if (done) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-teal/10 border-b border-teal/20 shrink-0">
        <CheckCircle2 size={14} className="text-teal shrink-0" />
        <span className="text-12 text-text flex-1">
          Update installed. Please restart reqit to apply the changes.
        </span>
        <IconButton onClick={dismiss} tooltip="Dismiss"><X size={13} /></IconButton>
      </div>
    );
  }

  if (!update) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-cyan/10 border-b border-cyan/20 shrink-0">
      <ArrowUpCircle size={14} className="text-cyan shrink-0" />
      <span className="text-12 text-text flex-1">
        <span className="font-semibold text-cyan">reqit {update.version}</span> is available —
        you're on an older version.
        {error && (
          <span className="ml-2 text-11 text-danger">
            <AlertCircle size={11} className="inline mr-1" />{error}
          </span>
        )}
      </span>
      <Button variant="primary" onClick={install} disabled={installing}>
        {installing ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
        {installing ? "Installing…" : "Install"}
      </Button>
      <IconButton onClick={dismiss} tooltip="Dismiss"><X size={13} /></IconButton>
    </div>
  );
}
