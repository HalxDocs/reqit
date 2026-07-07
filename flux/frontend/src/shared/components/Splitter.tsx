import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/cn";

type Props = {
  onResize: (delta: number) => void;
  direction?: "col" | "row";
  className?: string;
};

// Drag bar to resize the panel before it — "col" drags horizontally (resizes width),
// "row" drags vertically (resizes height, used in stacked/vertical layout).
export function Splitter({ onResize, direction = "col", className }: Props) {
  const draggingRef = useRef(false);
  const startRef = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const pos = direction === "col" ? e.clientX : e.clientY;
      const delta = pos - startRef.current;
      startRef.current = pos;
      onResize(delta);
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
  }, [onResize, direction]);

  return (
    <div
      role="separator"
      aria-orientation={direction === "col" ? "vertical" : "horizontal"}
      onMouseDown={(e) => {
        draggingRef.current = true;
        startRef.current = direction === "col" ? e.clientX : e.clientY;
        document.body.style.cursor = direction === "col" ? "col-resize" : "row-resize";
        document.body.style.userSelect = "none";
      }}
      className={cn(
        "group relative shrink-0 select-none",
        direction === "col" ? "w-[6px] h-full cursor-col-resize" : "h-[6px] w-full cursor-row-resize",
        "bg-transparent hover:bg-cyan/20 transition-colors",
        className,
      )}
    >
      <span
        className={cn(
          "absolute bg-border group-hover:bg-cyan transition-colors",
          direction === "col"
            ? "inset-y-0 left-1/2 -translate-x-1/2 w-px"
            : "inset-x-0 top-1/2 -translate-y-1/2 h-px",
        )}
      />
    </div>
  );
}
