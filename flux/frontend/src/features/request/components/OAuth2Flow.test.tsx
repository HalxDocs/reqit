import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { OAuth2Flow } from "./OAuth2Flow";
import { useRequestStore } from "@/features/request/stores/useRequestStore";

// Captured "oauth2:*" event handlers so tests can fire Go-side events
// (oauth2:complete, oauth2:diagnostics) like the real runtime would.
const { eventHandlers } = vi.hoisted(() => ({ eventHandlers: {} as Record<string, (p: any) => void> }));

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  cancel: vi.fn(),
  manualAuthorize: vi.fn(),
  manualComplete: vi.fn(),
  openBrowser: vi.fn(),
  diagnose: vi.fn(),
  startDevice: vi.fn(),
  pollDevice: vi.fn(),
  refresh: vi.fn(),
  discover: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock("../../../../wailsjs/go/main/App", () => ({
  OAuth2Authorize: (...a: unknown[]) => mocks.authorize(...a),
  OAuth2Cancel: (...a: unknown[]) => mocks.cancel(...a),
  OAuth2ManualAuthorize: (...a: unknown[]) => mocks.manualAuthorize(...a),
  OAuth2ManualComplete: (...a: unknown[]) => mocks.manualComplete(...a),
  OAuth2OpenBrowser: (...a: unknown[]) => mocks.openBrowser(...a),
  OAuth2DiagnoseLoopback: (...a: unknown[]) => mocks.diagnose(...a),
  OAuth2StartDevice: (...a: unknown[]) => mocks.startDevice(...a),
  OAuth2PollDevice: (...a: unknown[]) => mocks.pollDevice(...a),
  OAuth2Refresh: (...a: unknown[]) => mocks.refresh(...a),
  OAuth2Discover: (...a: unknown[]) => mocks.discover(...a),
}));

vi.mock("../../../../wailsjs/runtime/runtime", () => ({
  BrowserOpenURL: vi.fn(),
  EventsOn: (name: string, cb: (p: any) => void) => {
    eventHandlers[name] = cb;
    return () => {};
  },
}));

const FIXED_CFG = {
  authUrl: "https://idp.test/authorize",
  tokenUrl: "https://idp.test/token",
  deviceUrl: "",
  clientId: "client",
  clientSecret: "",
  scopes: "openid",
  redirectUri: "http://127.0.0.1:7317/callback",
  usePkce: true,
};

const loopbackResult = {
  authorizeUrl: "https://idp.test/authorize?response_type=code&redirect_uri=http%3A%2F%2F127.0.0.1%3A7317%2Fcallback",
  redirectUri: FIXED_CFG.redirectUri,
  state: "state-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(eventHandlers).forEach((k) => delete eventHandlers[k]);
  useRequestStore.setState({ oauth2Config: FIXED_CFG, authType: "none" });
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: mocks.writeText },
    configurable: true,
  });
  mocks.writeText.mockResolvedValue(undefined);
  mocks.authorize.mockResolvedValue(loopbackResult);
  mocks.cancel.mockResolvedValue(undefined);
  mocks.manualAuthorize.mockResolvedValue({ authorizeUrl: "https://idp.test/authorize?manual=1", state: "state-2" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("OAuth2Flow browser-open fallback", () => {
  it("switches to manual paste-back with the URL copied when the launcher fails", async () => {
    mocks.openBrowser.mockRejectedValue(new Error("launcher failed"));

    render(<OAuth2Flow />);
    fireEvent.click(screen.getByRole("button", { name: /Get New Access Token/i }));

    expect(await screen.findByText(/couldn't be opened automatically/i)).toBeTruthy();
    // The loopback flow was cancelled so the manual flow could start.
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalled());
    await waitFor(() => expect(mocks.manualAuthorize).toHaveBeenCalled());
    // The manual flow's authorize URL was pre-copied to the clipboard.
    await waitFor(() => expect(mocks.writeText).toHaveBeenCalledWith("https://idp.test/authorize?manual=1"));
    // Manual paste-back UI is visible.
    expect(screen.getByPlaceholderText(/Paste the redirect URL/)).toBeTruthy();
  });

  it("keeps waiting and copies the loopback URL when there is no fixed redirect URI", async () => {
    useRequestStore.setState({ oauth2Config: { ...FIXED_CFG, redirectUri: "" }, authType: "none" });
    mocks.openBrowser.mockRejectedValue(new Error("launcher failed"));

    render(<OAuth2Flow />);
    fireEvent.click(screen.getByRole("button", { name: /Get New Access Token/i }));

    expect(await screen.findByText(/copied to your clipboard/i)).toBeTruthy();
    // Ephemeral loopback: no manual flow is started, the listener stays up.
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.manualAuthorize).not.toHaveBeenCalled();
    expect(mocks.writeText).toHaveBeenCalledWith(loopbackResult.authorizeUrl);
    expect(screen.getByText(/Waiting for authorization in your browser/i)).toBeTruthy();
  });

  it("auto-falls back when the browser never opens (no window blur within the grace period)", async () => {
    mocks.openBrowser.mockResolvedValue(undefined);

    vi.useFakeTimers();
    render(<OAuth2Flow />);
    fireEvent.click(screen.getByRole("button", { name: /Get New Access Token/i }));

    // Flush the authorize → openBrowser promise chain.
    await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });
    expect(mocks.openBrowser).toHaveBeenCalledWith(loopbackResult.authorizeUrl);

    // No blur fired — after the grace period the watchdog auto-falls back.
    act(() => { vi.advanceTimersByTime(15_000); });
    // Flush the watchdog's async fallback chain (cancel → manual → state).
    await act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); });

    expect(mocks.cancel).toHaveBeenCalled();
    expect(mocks.manualAuthorize).toHaveBeenCalled();
    expect(screen.getByText(/didn't seem to open/i)).toBeTruthy();
  });

  it("does not fall back when the browser visibly opened (blur observed)", async () => {
    mocks.openBrowser.mockResolvedValue(undefined);

    vi.useFakeTimers();
    render(<OAuth2Flow />);
    fireEvent.click(screen.getByRole("button", { name: /Get New Access Token/i }));

    await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });
    expect(mocks.openBrowser).toHaveBeenCalled();

    // The browser took focus, then the user is still signing in.
    act(() => { window.dispatchEvent(new Event("blur")); });
    act(() => { vi.advanceTimersByTime(15_000); });
    await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.manualAuthorize).not.toHaveBeenCalled();
    expect(screen.getByText(/Waiting for authorization in your browser/i)).toBeTruthy();
  });

  it("runs loopback diagnostics from the waiting state and reports the outcome", async () => {
    mocks.openBrowser.mockResolvedValue(undefined);
    mocks.diagnose.mockResolvedValue("diag-1");

    vi.useFakeTimers();
    render(<OAuth2Flow />);
    fireEvent.click(screen.getByRole("button", { name: /Get New Access Token/i }));
    await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

    fireEvent.click(screen.getByRole("button", { name: /Run loopback diagnostics/i }));
    await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });
    expect(mocks.diagnose).toHaveBeenCalled();

    // The binding returned immediately — the outcome arrives on the event.
    act(() => {
      eventHandlers["oauth2:diagnostics"]?.({
        id: "diag-1",
        url: "http://127.0.0.1:41234/diagnose",
        success: true,
        detail: "The browser reached the loopback listener — OAuth callbacks will work.",
      });
    });

    expect(screen.getByText(/Loopback OK — The browser reached the loopback listener/)).toBeTruthy();
    // The "Running…" busy state cleared once the event arrived.
    expect(screen.queryByRole("button", { name: /Running…/ })).toBeNull();
  });

  it("surfaces a failed diagnostics result verbatim", async () => {
    mocks.openBrowser.mockResolvedValue(undefined);
    mocks.diagnose.mockResolvedValue("diag-2");

    vi.useFakeTimers();
    render(<OAuth2Flow />);
    fireEvent.click(screen.getByRole("button", { name: /Get New Access Token/i }));
    await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

    fireEvent.click(screen.getByRole("button", { name: /Run loopback diagnostics/i }));
    await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

    act(() => {
      eventHandlers["oauth2:diagnostics"]?.({
        id: "diag-2",
        url: "http://127.0.0.1:41234/diagnose",
        success: false,
        detail: "The browser never connected back to the loopback listener. Check your proxy or firewall settings.",
      });
    });

    expect(screen.getByText(/Loopback check failed — The browser never connected back/)).toBeTruthy();
  });

  it("ignores stale diagnostics results from a superseded run", async () => {
    mocks.openBrowser.mockResolvedValue(undefined);
    mocks.diagnose.mockResolvedValue("diag-3");

    vi.useFakeTimers();
    render(<OAuth2Flow />);
    fireEvent.click(screen.getByRole("button", { name: /Get New Access Token/i }));
    await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

    fireEvent.click(screen.getByRole("button", { name: /Run loopback diagnostics/i }));
    await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

    act(() => {
      eventHandlers["oauth2:diagnostics"]?.({ id: "diag-OLD", success: true, detail: "stale" });
    });
    expect(screen.queryByText(/Loopback OK/)).toBeNull();
    expect(screen.getByText(/Running loopback diagnostics/)).toBeTruthy(); // still busy, still waiting
  });
});
