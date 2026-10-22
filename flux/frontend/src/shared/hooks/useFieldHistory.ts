import { useCallback, useRef, useState } from "react";

interface FieldHistoryOptions {
  /** Maximum number of entries kept. Older entries are dropped. */
  limit?: number;
  /**
   * Changes made within this window are treated as one edit, so a single undo
   * removes a burst of typing rather than one character at a time.
   */
  coalesceMs?: number;
}

interface FieldHistory<T> {
  /**
   * Records the value that was current *before* an edit. Consecutive calls
   * inside the coalescing window are ignored, so the first value of a burst
   * stays the undo target.
   */
  push: (previousValue: T) => void;
  /** Returns the value to restore, or undefined when there is nothing to undo. */
  undo: (currentValue: T) => T | undefined;
  /** Returns the value to restore, or undefined when there is nothing to redo. */
  redo: (currentValue: T) => T | undefined;
  canUndo: boolean;
  canRedo: boolean;
  /** Drops all history, e.g. when the field is replaced wholesale. */
  reset: () => void;
}

/**
 * Per-field undo/redo history.
 *
 * Native browser undo is not enough for controlled fields whose displayed
 * value is derived from state: React re-renders the input with a new value,
 * which discards the browser's own undo stack. This hook keeps an explicit
 * history so undo restores exactly what the user had before the change.
 */
export function useFieldHistory<T>(options?: FieldHistoryOptions): FieldHistory<T> {
  const limit = options?.limit ?? 50;
  const coalesceMs = options?.coalesceMs ?? 600;

  const undoStack = useRef<T[]>([]);
  const redoStack = useRef<T[]>([]);
  const lastPushAt = useRef(0);
  // Refs alone do not trigger a re-render, so keep a counter that changes
  // whenever the stacks do. canUndo/canRedo are read during render.
  const [, setVersion] = useState(0);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const push = useCallback(
    (previousValue: T) => {
      const now = Date.now();
      if (now - lastPushAt.current < coalesceMs) return;
      lastPushAt.current = now;
      undoStack.current.push(previousValue);
      if (undoStack.current.length > limit) undoStack.current.shift();
      redoStack.current = [];
      bump();
    },
    [coalesceMs, limit, bump],
  );

  const undo = useCallback(
    (currentValue: T): T | undefined => {
      const previous = undoStack.current.pop();
      if (previous === undefined) return undefined;
      redoStack.current.push(currentValue);
      // Break the coalescing window so the next edit starts a fresh entry.
      lastPushAt.current = 0;
      bump();
      return previous;
    },
    [bump],
  );

  const redo = useCallback(
    (currentValue: T): T | undefined => {
      const next = redoStack.current.pop();
      if (next === undefined) return undefined;
      undoStack.current.push(currentValue);
      lastPushAt.current = 0;
      bump();
      return next;
    },
    [bump],
  );

  const reset = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    lastPushAt.current = 0;
    bump();
  }, [bump]);

  return {
    push,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    reset,
  };
}
