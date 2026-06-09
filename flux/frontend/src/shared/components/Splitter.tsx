import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/cn";

type Props = {
  onResize: (delta: number) => void;
  className?: string;
};

// Vertical splitter bar — drag horizontally to resize the panel on its left.
// Stays narrow when idle, lights up on hover/drag.
export function Splitter({ onResize, className }: Props) {
  const draggingRef = useRef(false);
  const startXRef = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - startXRef.current;
      startXRef.current = e.clientX;
      onResize(dx);
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onResize]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={(e) => {
        draggingRef.current = true;
        startXRef.current = e.clientX;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
      className={cn(
        "group relative w-[6px] shrink-0 cursor-col-resize select-none",
        "bg-transparent hover:bg-cyan/20 transition-colors",
        className,
      )}
    >
      <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border group-hover:bg-cyan transition-colors" />
    </div>
  );
}
