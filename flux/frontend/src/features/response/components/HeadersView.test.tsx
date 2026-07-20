import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HeadersView } from "./HeadersView";

const mockWriteText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.stubGlobal("navigator", {
    clipboard: { writeText: mockWriteText },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HeadersView", () => {
  it("renders empty state", () => {
    render(<HeadersView headers={{}} />);
    expect(screen.getByText("No response headers.")).toBeInTheDocument();
  });

  it("renders headers sorted by name", () => {
    render(<HeadersView headers={{ "Content-Type": "application/json", "Cache-Control": "no-cache" }} />);
    expect(screen.getByText("Cache-Control")).toBeInTheDocument();
    expect(screen.getByText("Content-Type")).toBeInTheDocument();
  });

  it("renders header values", () => {
    render(<HeadersView headers={{ "X-Request-Id": "abc-123" }} />);
    expect(screen.getByText("abc-123")).toBeInTheDocument();
  });

  it("renders Name and Value columns", () => {
    render(<HeadersView headers={{ "Accept": "text/html" }} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
  });

  it("copies all headers to clipboard on click", async () => {
    render(<HeadersView headers={{ "A": "1", "B": "2" }} />);
    fireEvent.click(screen.getByText("Copy all"));
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith("A: 1\nB: 2");
    });
  });

  it("shows Copied feedback after copy", async () => {
    render(<HeadersView headers={{ "X": "y" }} />);
    fireEvent.click(screen.getByText("Copy all"));
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });
});
