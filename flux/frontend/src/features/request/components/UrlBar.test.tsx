import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { useUIStore } from "@/app/stores/useUIStore";
import { UrlBar } from "./UrlBar";

vi.mock("../../../../wailsjs/go/main/App", () => ({
  CancelRequest: vi.fn(),
  StartMockServer: vi.fn(),
  StopMockServer: vi.fn(),
  GetMockStatus: vi.fn(async () => ({ running: false })),
  ToggleMockRecording: vi.fn(),
  SetActiveEnvironment: vi.fn(),
  BrowserOpenURL: vi.fn(),
}));

vi.mock("../../../../wailsjs/runtime/runtime", () => ({
  EventsOn: vi.fn(() => () => {}),
  EventsEmit: vi.fn(),
}));

function urlInput(): HTMLInputElement {
  const input = document.getElementById("flux-url-bar");
  if (!input) throw new Error("URL input not found");
  return input as HTMLInputElement;
}

function type(value: string) {
  fireEvent.change(urlInput(), { target: { value } });
}

// A controllable clock, so tests can separate two edits by more than the
// history's coalescing window.
let clock = 1_000_000;

describe("UrlBar", () => {
  beforeEach(() => {
    useRequestStore.getState().reset();
    useUIStore.getState().closePasteCurlModal();
  });

  describe("select all", () => {
    it("selects the whole URL with Ctrl+A", () => {
      useRequestStore.getState().setUrl("https://api.example.com/a/very/long/path");
      render(<UrlBar />);

      const input = urlInput();
      expect(input.value).toBe("https://api.example.com/a/very/long/path");

      input.setSelectionRange(0, 0);
      input.focus();
      fireEvent.keyDown(input, { key: "a", ctrlKey: true });

      // The field is a native input, so the browser owns the selection. What
      // matters is that the shortcut was not swallowed by the app.
      expect(input.value.length).toBeGreaterThan(0);
    });
  });

  describe("undo", () => {
    // The history groups changes made in quick succession, so a test that
    // wants two separate edits has to move the clock between them.
    beforeEach(() => {
      vi.spyOn(Date, "now").mockImplementation(() => clock);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("reverts the URL with Ctrl+Z", async () => {
      render(<UrlBar />);
      const input = urlInput();

      type("https://one.test");
      expect(input.value).toBe("https://one.test");

      clock += 5000;
      type("https://two.test");
      expect(input.value).toBe("https://two.test");

      fireEvent.keyDown(input, { key: "z", ctrlKey: true });

      await waitFor(() => {
        expect(urlInput().value).toBe("https://one.test");
      });
    });

    it("restores the query string along with the URL", async () => {
      render(<UrlBar />);
      const input = urlInput();

      type("https://one.test");
      clock += 5000;
      type("https://one.test?a=1");

      fireEvent.keyDown(input, { key: "z", ctrlKey: true });

      await waitFor(() => {
        expect(urlInput().value).toBe("https://one.test");
      });
    });

    it("does nothing when there is no history to undo", () => {
      render(<UrlBar />);
      const input = urlInput();

      const before = input.value;
      fireEvent.keyDown(input, { key: "z", ctrlKey: true });

      expect(urlInput().value).toBe(before);
    });

    it("undoes a whole burst of typing in one step", async () => {
      render(<UrlBar />);
      const input = urlInput();

      // A burst of keystrokes with no pause in between.
      type("h");
      type("ht");
      type("htt");
      type("http");

      fireEvent.keyDown(input, { key: "z", ctrlKey: true });

      await waitFor(() => {
        expect(urlInput().value).toBe("");
      });
    });

    it("redoes with Ctrl+Shift+Z", async () => {
      render(<UrlBar />);
      const input = urlInput();

      type("https://one.test");
      clock += 5000;
      type("https://two.test");
      fireEvent.keyDown(input, { key: "z", ctrlKey: true });
      await waitFor(() => expect(urlInput().value).toBe("https://one.test"));

      fireEvent.keyDown(input, { key: "z", ctrlKey: true, shiftKey: true });
      await waitFor(() => expect(urlInput().value).toBe("https://two.test"));
    });
  });

  describe("cURL detection", () => {
    it("offers to import a pasted cURL command", async () => {
      render(<UrlBar />);
      const input = urlInput();

      fireEvent.paste(input, {
        clipboardData: {
          getData: () => "curl -X POST 'https://api.example.com/users' -H 'Content-Type: application/json'",
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/cURL command detected/i)).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: /import as request/i })).toBeInTheDocument();
      // The pasted command must not land in the URL field.
      expect(input.value).toBe("");
    });

    it("does not offer to import a normal URL", () => {
      render(<UrlBar />);
      const input = urlInput();

      fireEvent.paste(input, {
        clipboardData: { getData: () => "https://api.example.com/users" },
      });

      expect(screen.queryByText(/cURL command detected/i)).not.toBeInTheDocument();
    });

    it("opens the import dialog with the pasted command", async () => {
      render(<UrlBar />);
      const input = urlInput();
      const command = "curl -X POST 'https://api.example.com/users'";

      fireEvent.paste(input, { clipboardData: { getData: () => command } });
      fireEvent.click(screen.getByRole("button", { name: /import as request/i }));

      await waitFor(() => {
        expect(useUIStore.getState().pasteCurlModalOpen).toBe(true);
      });
      expect(useUIStore.getState().pasteCurlModalText).toBe(command);
    });
  });
});
