import { useEffect, useRef, useState } from "react";
import { SetEnvVar } from "../../../wailsjs/go/main/App";
import { useEnvStore } from "@/features/env/stores/useEnvStore";
import { toast } from "@/app/stores/useToastStore";

interface Props {
  open: boolean;
  value: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function CaptureVarMenu({ open, value, x, y, onClose }: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout>>();
  const loadEnvs = useEnvStore((s) => s.load);

  useEffect(() => {
    if (!open) return;
    setName("");
    setBusy(false);
    focusTimer.current = setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      if (focusTimer.current) clearTimeout(focusTimer.current);
    };
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await SetEnvVar(name.trim(), value);
      await loadEnvs();
      toast.success(`Set {{${name.trim()}}} = ${value.length > 40 ? value.slice(0, 40) + "…" : value}`);
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-card border border-border rounded-lg shadow-xl p-3 min-w-[240px]"
        style={{ left: Math.min(x, window.innerWidth - 260), top: Math.min(y, window.innerHeight - 120) }}
      >
        <div className="text-11 text-subtext mb-2">Set as environment variable</div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }}
            placeholder="Variable name"
            spellCheck={false}
            className="flex-1 h-[32px] px-2 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-cyan focus:ring-2 focus:ring-cyan"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !name.trim()}
            className="h-[32px] px-3 bg-cyan hover:bg-cyan-hover text-white text-12 font-bold rounded-md disabled:opacity-60 transition-all"
          >
            Save
          </button>
        </div>
        <div className="mt-2 text-11 text-subtext/60 truncate" title={value}>
          Value: {value}
        </div>
      </div>
    </>
  );
}
