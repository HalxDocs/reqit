import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable in some contexts; fail silently
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!text}
      className="flex items-center gap-1 h-[24px] px-2 text-11 text-subtext hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {copied ? (
        <>
          <Check size={12} className="text-teal" />
          <span className="text-teal">Copied!</span>
        </>
      ) : (
        <>
          <Copy size={12} />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}
