import { useCallback, useEffect, useRef, useState } from "react";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
}

let resolveRef: ((value: boolean) => void) | null = null;
let optionsRef: ConfirmOptions | null = null;

export function showConfirm(opts: ConfirmOptions): Promise<boolean> {
  optionsRef = opts;
  return new Promise((resolve) => {
    resolveRef = resolve;
  });
}

export function ConfirmModal() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (resolveRef && optionsRef) {
        setOptions({ ...optionsRef });
        optionsRef = null;
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const handleClose = useCallback((result: boolean) => {
    setOptions(null);
    resolveRef?.(result);
    resolveRef = null;
  }, []);

  useEffect(() => {
    if (options) {
      requestAnimationFrame(() => btnRef.current?.focus());
    }
  }, [options]);

  useEffect(() => {
    if (!options) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [options, handleClose]);

  if (!options) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => handleClose(false)} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={options.title ?? "Confirm"}
        className="relative bg-card border border-border rounded-lg shadow-2xl w-[380px] p-5 outline-none"
      >
        {options.title && (
          <h3 className="text-14 font-semibold text-text mb-2">{options.title}</h3>
        )}
        <p className="text-13 text-subtext mb-5">{options.message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => handleClose(false)}
            className="px-3 py-1.5 text-13 rounded border border-border text-text hover:bg-hover transition-colors"
          >
            {options.cancelLabel ?? "Cancel"}
          </button>
          <button
            ref={btnRef}
            type="button"
            onClick={() => handleClose(true)}
            className={`px-3 py-1.5 text-13 rounded text-white transition-colors ${
              options.variant === "danger"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-accent hover:bg-accent-hover"
            }`}
          >
            {options.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
