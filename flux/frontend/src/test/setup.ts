import "@testing-library/jest-dom";
import { vi } from "vitest";

Object.defineProperty(window, "runtime", {
  value: {
    EventsOnMultiple: vi.fn(),
    EventsOn: vi.fn(),
    EventsOff: vi.fn(),
    EventsEmit: vi.fn(),
    WindowSetDarkTheme: vi.fn(),
    WindowSetLightTheme: vi.fn(),
  },
  writable: true,
});

vi.mock("../../../wailsjs/runtime/runtime", () => ({
  EventsOnMultiple: vi.fn(),
  EventsOn: vi.fn(),
  EventsOff: vi.fn(),
  EventsEmit: vi.fn(),
}));

// showConfirm() returns a promise that only settles when a real modal renders and
// the user clicks. Without a rendered modal that promise never settles, so any
// test touching a confirm-guarded action (closeTab, delete, …) deadlocks instead
// of failing. Default to "confirmed"; individual tests can override the impl to
// exercise the cancel path.
const confirmState = vi.hoisted(() => ({ showConfirmMock: vi.fn(async () => true) }));

vi.mock("@/shared/components/ConfirmModal", async () => {
  const actual = (await vi.importActual("@/shared/components/ConfirmModal")) as Record<string, unknown>;
  return { ...actual, showConfirm: confirmState.showConfirmMock };
});
