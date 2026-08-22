import { useState } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OAuth2DiscoveryField, type OAuth2DiscoveryMeta } from "./OAuth2DiscoveryField";

// The field is a controlled component — the parent owns the issuer value, so
// tests drive it through a small stateful harness.
function Harness({ onDiscovered }: { onDiscovered: (m: OAuth2DiscoveryMeta) => void }) {
  const [issuer, setIssuer] = useState("");
  return <OAuth2DiscoveryField issuer={issuer} onIssuerChange={setIssuer} onDiscovered={onDiscovered} />;
}

const discoverMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../wailsjs/go/main/App", () => ({
  OAuth2Discover: (...args: unknown[]) => discoverMock(...args),
}));

describe("OAuth2DiscoveryField", () => {
  beforeEach(() => {
    discoverMock.mockReset();
  });

  const entrameta = {
    issuer: "https://login.microsoftonline.com/organizations/v2.0",
    authorizationEndpoint: "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
    tokenEndpoint: "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
    deviceAuthorizationEndpoint: "",
    codeChallengeMethods: [] as string[],
    scopesSupported: ["openid", "profile", "email", "offline_access"],
  };

  it("autofills endpoints and scopes on success", async () => {
    discoverMock.mockResolvedValue(entrameta);
    const holder: { meta: OAuth2DiscoveryMeta | null } = { meta: null };
    render(<Harness onDiscovered={(m) => { holder.meta = m; }} />);

    fireEvent.change(screen.getByLabelText("Issuer URL"), {
      target: { value: "https://login.microsoftonline.com/organizations/v2.0" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Autofill/i }));

    await waitFor(() => expect(holder.meta).not.toBeNull());
    expect(discoverMock).toHaveBeenCalledWith("https://login.microsoftonline.com/organizations/v2.0");
    expect(holder.meta?.authorizationEndpoint).toContain("/authorize");
    expect(holder.meta?.tokenEndpoint).toContain("/token");
    expect(holder.meta?.scopesSupported).toEqual(["openid", "profile", "email", "offline_access"]);
    expect(await screen.findByText(/Endpoints \+ scopes autofilled/)).toBeTruthy();
  });

  it("surfaces the provider/binding error verbatim", async () => {
    discoverMock.mockRejectedValue(new Error("discovery https://x/.well-known/openid-configuration returned Not Found"));
    render(
      <OAuth2DiscoveryField
        issuer="https://x.example.test"
        onIssuerChange={() => {}}
        onDiscovered={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Autofill/i }));
    expect(await screen.findByText(/returned Not Found/)).toBeTruthy();
  });

  it("shows a busy state while fetching and disables the button", async () => {
    let resolve: (v: unknown) => void;
    discoverMock.mockImplementation(() => new Promise((r) => { resolve = r; }));
    render(
      <OAuth2DiscoveryField
        issuer="https://idp.example.test"
        onIssuerChange={() => {}}
        onDiscovered={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Autofill/i }));
    const busy = await screen.findByRole("button", { name: /Fetching/ });
    expect(busy).toBeDisabled();
    resolve!(entrameta);
    await waitFor(() => expect(screen.queryByRole("button", { name: /Fetching/ })).toBeNull());
  });
});
