import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";

const items: ContextMenuItem[] = [
  { label: "Copy", action: vi.fn() },
  { label: "Delete", action: vi.fn(), danger: true },
  { divider: true, label: "", action: vi.fn() },
  { label: "Disabled", action: vi.fn(), disabled: true },
];

describe("ContextMenu", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <ContextMenu open={false} x={0} y={0} items={items} onClose={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders items when open", () => {
    render(<ContextMenu open={true} x={10} y={10} items={items} onClose={vi.fn()} />);
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("calls action and closes on click", () => {
    const onClose = vi.fn();
    const action = vi.fn();
    render(
      <ContextMenu
        open={true}
        x={10}
        y={10}
        items={[{ label: "Test", action }]}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByText("Test"));
    expect(action).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call action for disabled items", () => {
    const action = vi.fn();
    render(
      <ContextMenu
        open={true}
        x={10}
        y={10}
        items={[{ label: "Nope", action, disabled: true }]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("Nope"));
    expect(action).not.toHaveBeenCalled();
  });

  it("renders dividers", () => {
    const { container } = render(
      <ContextMenu
        open={true}
        x={10}
        y={10}
        items={[
          { label: "A", action: vi.fn() },
          { divider: true, label: "", action: vi.fn() },
          { label: "B", action: vi.fn() },
        ]}
        onClose={vi.fn()}
      />
    );
    const dividers = container.querySelectorAll(".border-t.border-border");
    expect(dividers.length).toBe(1);
  });
});
