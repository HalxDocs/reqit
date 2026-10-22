import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingView } from "./LandingView";
import { DocsView } from "./DocsView";
import { WorkspacesView } from "./WorkspacesView";

// The views open links through the Wails runtime, which is not present in a
// browser test.
vi.mock("@/shared/lib/links", () => ({
  GITHUB_URL: "https://github.com/HalxDocs/reqit",
  PORTFOLIO_URL: "https://halxdocs.com",
  openExternal: vi.fn(),
}));

describe("home views", () => {
  it("renders the landing view with its steps and features", () => {
    render(<LandingView onGoToWorkspaces={vi.fn()} onGoDocs={vi.fn()} stars={1234} />);

    expect(screen.getByText(/Create a workspace/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Local-first/i).length).toBeGreaterThan(0);
    // 1234 stars is formatted as 1.2k.
    expect(screen.getByText("1.2k")).toBeInTheDocument();
  });

  it("renders a placeholder when the star count is unknown", () => {
    render(<LandingView onGoToWorkspaces={vi.fn()} onGoDocs={vi.fn()} stars={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the documentation index", () => {
    render(<DocsView />);
    expect(screen.getByRole("heading", { name: /documentation/i })).toBeInTheDocument();
  });

  it("renders an empty state when there are no workspaces", () => {
    render(
      <WorkspacesView
        workspaces={[]}
        switching={null}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onCreate={vi.fn()}
      />,
    );
    expect(screen.getByText(/no workspaces/i)).toBeInTheDocument();
  });
});
