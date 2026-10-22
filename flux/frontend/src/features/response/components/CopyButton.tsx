import { Check, Copy } from "lucide-react";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

export function CopyButton({ text }: { text: string }) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <button
      type="button"
      onClick={() => void copy(text)}
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
