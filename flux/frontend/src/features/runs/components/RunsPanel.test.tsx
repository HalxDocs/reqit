import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RunsPanel } from "./RunsPanel";
import { listRuns, runKind, runTimingMs, truncateURL } from "../lib/runsApi";
import type { RunReceipt } from "../lib/runsApi";

// The Wails bridge is not present in jsdom, so the panel must show its empty
// state rather than throwing during startup.
describe("run receipts", () => {
  it("returns no runs without the desktop bridge", async () => {
    await expect(listRuns()).resolves.toEqual([]);
  });

  it("renders an empty state with a pointer to the CLI", async () => {
    render(<RunsPanel />);
    await waitFor(() => {
      expect(screen.getByText(/No runs recorded in this workspace yet/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/reqit runs list/i)).toBeInTheDocument();
  });

  it("derives list-row values from a receipt", () => {
    const receipt: RunReceipt = {
      version: 1,
      id: "20260101T000000Z-abc",
      kind: "",
      time: "2026-01-01T00:00:00Z",
      source: "app",
      request: { method: "GET", url: "https://api.example.com/very/long/path/that/should/be/truncated/at/some/point" },
      response: { statusCode: 200 },
      timing: { totalMs: 12.6 },
    };

    expect(runKind(receipt)).toBe("run");
    expect(runTimingMs(receipt)).toBe(13);
    expect(truncateURL(receipt.request.url, 20)).toBe("https://api.example…");  });

  it("uses a load test summary for timing when present", () => {
    const receipt: RunReceipt = {
      version: 1,
      id: "loadtest",
      kind: "loadtest",
      time: "2026-01-01T00:00:00Z",
      source: "loadtest",
      request: { method: "GET", url: "https://api.example.com" },
      response: { statusCode: 0 },
      loadTest: {
        vus: 10,
        totalReqs: 100,
        passed: 99,
        failed: 1,
        avgMs: 42.4,
        p50Ms: 40,
        p95Ms: 60,
        p99Ms: 80,
        durationMs: 30000,
      },
    };

    expect(runKind(receipt)).toBe("loadtest");
    expect(runTimingMs(receipt)).toBe(42);
  });
});
