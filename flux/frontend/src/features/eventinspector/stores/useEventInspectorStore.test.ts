import { describe, it, expect, beforeEach, vi } from "vitest";
import { useEventInspectorStore } from "./useEventInspectorStore";

const { mockStatus, mockRecord } = vi.hoisted(() => ({
  mockStatus: (over: any = {}) => ({
    running: false,
    port: 0,
    count: 0,
    hasSecret: false,
    ...over,
    convertValues: (a: any) => a,
  }),
  mockRecord: (over: any = {}) => ({
    id: "evt-1",
    receivedAt: "2026-01-01T00:00:00Z",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    verifyStatus: "verified",
    ...over,
    convertValues: (a: any) => a,
  }),
}));

vi.mock("../../../../wailsjs/go/main/App", () => ({
  EventInspectorStart: vi.fn().mockResolvedValue(7888),
  EventInspectorStop: vi.fn().mockResolvedValue(undefined),
  EventInspectorStatus: vi.fn().mockResolvedValue(mockStatus()),
  EventInspectorGetEvents: vi.fn().mockResolvedValue([]),
  EventInspectorClear: vi.fn().mockResolvedValue(undefined),
  EventInspectorDelete: vi.fn().mockResolvedValue(undefined),
  EventInspectorSetSecret: vi.fn().mockResolvedValue(undefined),
  EventInspectorHasSecret: vi.fn().mockResolvedValue(false),
  EventInspectorReplay: vi.fn().mockResolvedValue({
    statusCode: 200,
    timingMs: 12,
    body: "",
    error: "",
  }),
}));

vi.mock("../../../../wailsjs/runtime", () => ({
  EventsOn: vi.fn(),
  EventsOff: vi.fn(),
}));

vi.mock("@/app/stores/useToastStore", () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import {
  EventInspectorStatus,
  EventInspectorGetEvents,
  EventInspectorDelete,
  EventInspectorReplay,
} from "../../../../wailsjs/go/main/App";
import { toast } from "@/app/stores/useToastStore";

describe("useEventInspectorStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEventInspectorStore.setState(useEventInspectorStore.getInitialState());
  });

  it("refresh loads status and events", async () => {
    vi.mocked(EventInspectorStatus).mockResolvedValueOnce(mockStatus({ running: true, port: 7888, count: 1, hasSecret: true }) as any);
    vi.mocked(EventInspectorGetEvents).mockResolvedValueOnce([mockRecord()] as any);

    await useEventInspectorStore.getState().refresh();

    const s = useEventInspectorStore.getState();
    expect(s.running).toBe(true);
    expect(s.port).toBe(7888);
    expect(s.hasSecret).toBe(true);
    expect(s.events).toHaveLength(1);
  });

  it("toggle starts capture and shows toast", async () => {
    await useEventInspectorStore.getState().toggle();
    const s = useEventInspectorStore.getState();
    expect(s.running).toBe(false); // status mock returns not running
    expect(toast.success).toHaveBeenCalled();
  });

  it("remove filters event out of local state", async () => {
    useEventInspectorStore.setState({ events: [mockRecord()] as any });
    await useEventInspectorStore.getState().remove("evt-1");
    expect(EventInspectorDelete).toHaveBeenCalledWith("evt-1");
    expect(useEventInspectorStore.getState().events).toHaveLength(0);
  });

  it("replay calls the binding and returns the result", async () => {
    const res = await useEventInspectorStore.getState().replay("evt-1", "https://target.test/hook", false);
    expect(EventInspectorReplay).toHaveBeenCalledWith("evt-1", "https://target.test/hook", false);
    expect(res?.statusCode).toBe(200);
  });
});
