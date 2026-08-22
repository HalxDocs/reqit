import { useCallback, useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { OAuth2Discover } from "../../../../wailsjs/go/main/App";
import { cn } from "@/shared/lib/cn";

export interface OAuth2DiscoveryMeta {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  deviceAuthorizationEndpoint?: string;
  scopesSupported?: string[];
}

interface OAuth2DiscoveryFieldProps {
  issuer: string;
  onIssuerChange: (issuer: string) => void;
  /** Called with the discovered metadata so the parent can autofill the form. */
  onDiscovered: (meta: OAuth2DiscoveryMeta) => void;
}

type DiscoveryState = "idle" | "fetching" | "success" | "error";

const inputClass =
  "h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text placeholder:text-subtext outline-none focus:border-cyan focus:ring-2 focus:ring-cyan transition-colors";

/**
 * OAuth2DiscoveryField is the guided-setup entry point: paste one issuer URL
 * (RFC 8414 / OIDC Discovery) and it fetches {issuer}/.well-known/
 * openid-configuration to autofill the authorize/token/device endpoints and
 * scopes. PKCE (S256) is the engine's default and is always re-asserted on
 * discovery — a missing code_challenge_methods_supported list (Entra) is not
 * treated as "PKCE unsupported".
 */
export function OAuth2DiscoveryField({ issuer, onIssuerChange, onDiscovered }: OAuth2DiscoveryFieldProps) {
  const [state, setState] = useState<DiscoveryState>("idle");
  const [message, setMessage] = useState("");

  const handleDiscover = useCallback(async () => {
    const target = issuer.trim();
    if (!target) return;
    setState("fetching");
    setMessage("");
    try {
      const meta = await OAuth2Discover(target);
      onDiscovered({
        issuer: meta.issuer || target,
        authorizationEndpoint: meta.authorizationEndpoint,
        tokenEndpoint: meta.tokenEndpoint,
        deviceAuthorizationEndpoint: meta.deviceAuthorizationEndpoint,
        scopesSupported: meta.scopesSupported,
      });
      setState("success");
      setMessage("Endpoints + scopes autofilled. PKCE (S256) stays on.");
    } catch (e) {
      setState("error");
      setMessage(String(e));
    }
  }, [issuer, onDiscovered]);

  const busy = state === "fetching";

  return (
    <div className="flex flex-col gap-1.5 col-span-2">
      <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Issuer URL (autofill)</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={issuer}
          onChange={(e) => {
            onIssuerChange(e.target.value);
            if (state !== "idle") { setState("idle"); setMessage(""); }
          }}
          placeholder="https://login.microsoftonline.com/your-tenant/v2.0"
          className={cn(inputClass, "flex-1")}
          aria-label="Issuer URL"
        />
        <button
          type="button"
          onClick={handleDiscover}
          disabled={busy || !issuer.trim()}
          className="h-[36px] px-3 bg-card border border-border hover:border-cyan rounded-md text-12 font-semibold text-text flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
        >
          {busy ? <Loader2 size={13} className="animate-spin text-cyan" /> : <Sparkles size={13} className="text-cyan" />}
          <span>{busy ? "Fetching…" : "Autofill"}</span>
        </button>
      </div>
      {state === "success" && (
        <p className="text-11 text-success flex items-center gap-1 leading-relaxed">
          <Check size={11} /> {message}
        </p>
      )}
      {state === "error" && (
        <p className="text-11 text-danger flex items-start gap-1 leading-relaxed">
          <X size={11} className="mt-0.5 shrink-0" /> {message}
        </p>
      )}
      {state === "idle" && (
        <p className="text-11 text-subtext leading-relaxed">
          Works with any OpenID Connect provider — also Keycloak, Auth0, Okta. No redirect URI is touched (register it exactly as-is).
        </p>
      )}
    </div>
  );
}
