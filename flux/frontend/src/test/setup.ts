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
