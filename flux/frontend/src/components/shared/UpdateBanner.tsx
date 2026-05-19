import { useEffect, useState } from "react";
import { Download, X, ArrowUpCircle } from "lucide-react";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { BrowserOpenURL } from "../../../wailsjs/runtime/runtime";

interface UpdateInfo {
  version: string;
  downloadUrl: string;
  releaseUrl: string;
}

export function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const off = EventsOn("update:available", (info: UpdateInfo) => {
      setUpdate(info);
      setDismissed(false);
    });
    return () => { if (typeof off === "function") off(); };
  }, []);

  if (!update || dismissed) return null;

  const openDownload = () => {
    BrowserOpenURL(update.downloadUrl || update.releaseUrl);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-blue/10 border-b border-blue/20 shrink-0">
      <ArrowUpCircle size={14} className="text-blue shrink-0" />
      <span className="text-12 text-text flex-1">
        <span className="font-semibold text-blue">reqit {update.version}</span> is available —
        you're on an older version.
      </span>
      <button
        type="button"
        onClick={openDownload}
        className="flex items-center gap-1.5 h-[24px] px-3 text-11 font-semibold bg-blue text-white rounded-lg hover:bg-blue-hover transition-colors shrink-0"
      >
        <Download size={11} />
        Download
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-subtext hover:text-text transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  );
}
