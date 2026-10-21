import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFieldHistory } from "./useFieldHistory";

describe("useFieldHistory", () => {
  it("starts with nothing to undo or redo", () => {
    const { result } = renderHook(() => useFieldHistory<string>());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("restores the value from before the last edit", () => {
    const { result } = renderHook(() => useFieldHistory<string>({ coalesceMs: 0 }));
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    // Each push records the value that was current before that edit.
    act(() => result.current.push("first"));
    now += 5000;
    act(() => result.current.push("second"));

    let restored: string | undefined;
    act(() => {
      restored = result.current.undo("second");
    });
    expect(restored).toBe("second");
    expect(result.current.canRedo).toBe(true);

    act(() => {
      restored = result.current.undo("second");
    });
    expect(restored).toBe("first");
  });

  it("redoes a value that was undone", () => {
    const { result } = renderHook(() => useFieldHistory<string>({ coalesceMs: 0 }));
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    act(() => result.current.push("first"));
    now += 5000;
    act(() => result.current.push("second"));

    act(() => {
      result.current.undo("second");
    });
    let redone: string | undefined;
    act(() => {
      redone = result.current.redo("first");
    });
    expect(redone).toBe("second");
  });

  it("coalesces a burst of changes into a single undo entry", () => {
    const { result } = renderHook(() => useFieldHistory<string>({ coalesceMs: 600 }));
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    // A burst of keystrokes: each pushes the value from before the edit.
    act(() => result.current.push("a"));
    now += 50;
    act(() => result.current.push("ab"));
    now += 50;
    act(() => result.current.push("abc"));

    // One undo should return to the value before the whole burst.
    let restored: string | undefined;
    act(() => {
      restored = result.current.undo("abc");
    });
    expect(restored).toBe("a");
    expect(result.current.canUndo).toBe(false);
  });

  it("starts a new entry once the burst window has passed", () => {
    const { result } = renderHook(() => useFieldHistory<string>({ coalesceMs: 600 }));
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    act(() => result.current.push("a"));
    now += 5000;
    act(() => result.current.push("b"));
    now += 5000;
    act(() => result.current.push("c"));

    let restored: string | undefined;
    act(() => {
      restored = result.current.undo("c");
    });
    expect(restored).toBe("c");
    act(() => {
      restored = result.current.undo("c");
    });
    expect(restored).toBe("b");
    act(() => {
      restored = result.current.undo("b");
    });
    expect(restored).toBe("a");
  });

  it("drops the redo stack when a new change is recorded", () => {
    const { result } = renderHook(() => useFieldHistory<string>({ coalesceMs: 0 }));
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    act(() => result.current.push("first"));
    now += 5000;
    act(() => result.current.push("second"));
    act(() => {
      result.current.undo("second");
    });
    expect(result.current.canRedo).toBe(true);

    now += 5000;
    act(() => result.current.push("third"));
    expect(result.current.canRedo).toBe(false);
  });

  it("drops the oldest entries beyond the limit", () => {
    const { result } = renderHook(() => useFieldHistory<string>({ limit: 3, coalesceMs: 0 }));
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    for (let i = 0; i < 6; i++) {
      act(() => result.current.push(`v${i}`));
      now += 5000;
    }

    // Six pushes with a limit of three keeps the three most recent.
    const restored: string[] = [];
    for (let i = 0; i < 3; i++) {
      act(() => {
        const value = result.current.undo("v5");
        if (value !== undefined) restored.push(value);
      });
    }
    expect(restored).toEqual(["v5", "v4", "v3"]);
    expect(result.current.canUndo).toBe(false);
  });

  it("returns undefined when there is nothing to undo", () => {
    const { result } = renderHook(() => useFieldHistory<string>());
    let restored: string | undefined;
    act(() => {
      restored = result.current.undo("current");
    });
    expect(restored).toBeUndefined();
  });

  it("clears all history on reset", () => {
    const { result } = renderHook(() => useFieldHistory<string>({ coalesceMs: 0 }));
    vi.spyOn(Date, "now").mockImplementation(() => 1000);

    act(() => result.current.push("first"));
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.reset());
    expect(result.current.canUndo).toBe(false);
  });
});
