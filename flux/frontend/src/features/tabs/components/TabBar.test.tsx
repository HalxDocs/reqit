import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useTabsStore } from "../stores/useTabsStore";

const mockRequestStore = vi.hoisted(() => {
  const { create } = require("zustand");
  return create(() => ({ url: "", method: "GET", loadState: vi.fn() }));
});

const mockResponseStore = vi.hoisted(() => {
  const { create } = require("zustand");
  return create(() => ({ response: null, setState: vi.fn() }));
});

vi.mock("@/features/request/stores/useRequestStore", () => ({
  useRequestStore: mockRequestStore,
}));

vi.mock("@/features/request/stores/useResponseStore", () => ({
  useResponseStore: mockResponseStore,
}));

import { TabBar } from "./TabBar";

beforeEach(() => {
  useTabsStore.setState({ tabs: [], activeID: "" });
  mockRequestStore.setState({ url: "", method: "GET" });
});

describe("TabBar", () => {
  it("renders empty state message", () => {
    render(<TabBar />);
    expect(screen.getByText(/No tabs/)).toBeInTheDocument();
  });

  it("renders new tab button", () => {
    render(<TabBar />);
    expect(screen.getByLabelText("New tab")).toBeInTheDocument();
  });

  it("creates new tab on click", () => {
    render(<TabBar />);
    fireEvent.click(screen.getByLabelText("New tab"));
    expect(useTabsStore.getState().tabs.length).toBe(1);
  });

  it("renders tab titles from store", () => {
    useTabsStore.setState({
      tabs: [
        { id: "1", title: "First", pinned: false, request: { method: "GET", url: "https://a.com" } as any, response: null, dirty: false, savedRequestID: null },
        { id: "2", title: "Second", pinned: false, request: { method: "POST", url: "https://b.com" } as any, response: null, dirty: false, savedRequestID: null },
      ],
      activeID: "other",
    });
    render(<TabBar />);
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("shows dirty indicator dot for dirty tabs", () => {
    useTabsStore.setState({
      tabs: [
        { id: "1", title: "MyRequest", pinned: false, request: { method: "GET", url: "" } as any, response: null, dirty: true, savedRequestID: null },
      ],
      activeID: "other",
    });
    render(<TabBar />);
    expect(screen.getByText("MyRequest")).toBeInTheDocument();
    expect(document.querySelector(".bg-amber")).toBeTruthy();
  });

  it("shows pin button with fill for pinned tabs", () => {
    useTabsStore.setState({
      tabs: [
        { id: "1", title: "PinnedTab", pinned: true, request: { method: "GET", url: "" } as any, response: null, dirty: false, savedRequestID: null },
      ],
      activeID: "other",
    });
    render(<TabBar />);
    expect(screen.getByText("PinnedTab")).toBeInTheDocument();
    expect(screen.getByLabelText("Unpin tab")).toBeInTheDocument();
  });
});
