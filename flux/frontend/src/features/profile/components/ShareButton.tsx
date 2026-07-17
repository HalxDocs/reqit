import { useState } from "react";
import { Share2, Copy, Check, Globe, Lock } from "lucide-react";

interface ShareButtonProps {
  collectionId: string;
  collectionName: string;
  isPublic: boolean;
  onTogglePublic: (public_: boolean) => void;
}

export function ShareButton({ collectionId, collectionName, isPublic, onTogglePublic }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = isPublic
    ? `${window.location.origin}/share/${collectionId}`
    : "";

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API failed — ignore
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onTogglePublic(!isPublic)}
        className={`flex items-center gap-1.5 px-2 py-1 text-[10px] rounded border transition-all ${
          isPublic
            ? "border-green-500/30 bg-green-500/10 text-green-400"
            : "border-border text-subtext hover:border-cyan/30"
        }`}
        title={isPublic ? "Public — anyone with the link can view" : "Private — only you can see this"}
      >
        {isPublic ? <Globe size={10} /> : <Lock size={10} />}
        {isPublic ? "Public" : "Private"}
      </button>
      {isPublic && (
        <button
          onClick={copyLink}
          className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-border text-subtext hover:border-cyan/30 hover:text-text transition-all"
          title="Copy share link"
        >
          {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
          {copied ? "Copied" : "Copy Link"}
        </button>
      )}
    </div>
  );
}
