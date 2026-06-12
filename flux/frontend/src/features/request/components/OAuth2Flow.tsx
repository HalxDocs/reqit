import { useState } from "react";
import { ExternalLink, RefreshCw, Check, X, Shield } from "lucide-react";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { cn } from "@/shared/lib/cn";
import { OAuth2AuthorizeURL, OAuth2Exchange, OAuth2Refresh } from "../../../../wailsjs/go/main/App";
import type { OAuth2Config, OAuth2TokenResponse } from "@/features/request/types/request";

const inputClass =
  "h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text placeholder:text-subtext outline-none focus:border-cyan focus:ring-2 focus:ring-cyan transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-11 text-subtext font-semibold uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

export function OAuth2Flow() {
  const oauth2Config = useRequestStore((s) => s.oauth2Config);
  const setOAuth2Config = useRequestStore((s) => s.setOAuth2Config);
  const authType = useRequestStore((s) => s.authType);
  const setAuthType = useRequestStore((s) => s.setAuthType);

  const [authCode, setAuthCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tokenType, setTokenType] = useState("");

  const cfg: OAuth2Config = oauth2Config ?? {
    authUrl: "",
    tokenUrl: "",
    clientId: "",
    clientSecret: "",
    scopes: "",
    redirectUri: "",
    usePkce: false,
  };

  const updateCfg = (patch: Partial<OAuth2Config>) => {
    setOAuth2Config({ ...cfg, ...patch });
  };

  const handleAuthorize = async () => {
    setError("");
    setLoading(true);
    try {
      const url = await OAuth2AuthorizeURL(
        cfg.authUrl,
        cfg.tokenUrl,
        cfg.clientId,
        cfg.clientSecret,
        cfg.scopes,
        cfg.redirectUri,
        cfg.usePkce,
      );
      window.open(url, "_blank");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleExchange = async () => {
    setError("");
    setLoading(true);
    try {
      const token: OAuth2TokenResponse = await OAuth2Exchange(
        cfg.authUrl,
        cfg.tokenUrl,
        cfg.clientId,
        cfg.clientSecret,
        cfg.scopes,
        cfg.redirectUri,
        authCode,
        cfg.usePkce,
      );
      if (token.error) {
        setError(token.error);
        return;
      }
      setTokenType(token.tokenType);
      updateCfg({
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!cfg.refreshToken) return;
    setError("");
    setLoading(true);
    try {
      const token: OAuth2TokenResponse = await OAuth2Refresh(
        cfg.authUrl,
        cfg.tokenUrl,
        cfg.clientId,
        cfg.clientSecret,
        cfg.scopes,
        cfg.redirectUri,
        cfg.refreshToken,
        cfg.usePkce,
      );
      if (token.error) {
        setError(token.error);
        return;
      }
      setTokenType(token.tokenType);
      updateCfg({
        accessToken: token.accessToken,
        refreshToken: token.refreshToken ?? cfg.refreshToken,
        expiresAt: token.expiresAt,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleUseToken = () => {
    setAuthType("oauth2");
    setOAuth2Config(cfg);
  };

  const handleClearToken = () => {
    updateCfg({
      accessToken: undefined,
      refreshToken: undefined,
      expiresAt: undefined,
    });
    setTokenType("");
    setAuthCode("");
  };

  const hasToken = !!cfg.accessToken;
  const expiresIn = cfg.expiresAt ? Math.max(0, Math.floor((cfg.expiresAt - Date.now()) / 1000)) : 0;

  return (
    <div className="flex flex-col">
      <div className="p-4 border-b border-border">
        <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Grant Type</label>
        <div className="mt-2">
          <span className="inline-flex items-center h-[28px] px-3 bg-cyan text-white rounded-sm text-12 font-medium">
            Authorization Code
          </span>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-3 border-b border-border">
        <Field label="Auth URL">
          <input
            type="text"
            value={cfg.authUrl}
            onChange={(e) => updateCfg({ authUrl: e.target.value })}
            placeholder="https://provider.com/oauth/authorize"
            className={inputClass}
          />
        </Field>
        <Field label="Token URL">
          <input
            type="text"
            value={cfg.tokenUrl}
            onChange={(e) => updateCfg({ tokenUrl: e.target.value })}
            placeholder="https://provider.com/oauth/token"
            className={inputClass}
          />
        </Field>
        <Field label="Client ID">
          <input
            type="text"
            value={cfg.clientId}
            onChange={(e) => updateCfg({ clientId: e.target.value })}
            placeholder="client-id"
            className={inputClass}
          />
        </Field>
        <Field label="Client Secret">
          <input
            type="password"
            value={cfg.clientSecret}
            onChange={(e) => updateCfg({ clientSecret: e.target.value })}
            placeholder="client-secret"
            className={inputClass}
          />
        </Field>
        <Field label="Scopes">
          <input
            type="text"
            value={cfg.scopes}
            onChange={(e) => updateCfg({ scopes: e.target.value })}
            placeholder="openid profile email"
            className={inputClass}
          />
        </Field>
        <Field label="Redirect URI">
          <input
            type="text"
            value={cfg.redirectUri}
            onChange={(e) => updateCfg({ redirectUri: e.target.value })}
            placeholder="https://app.com/callback"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="px-4 py-3 border-b border-border">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={cfg.usePkce}
            onChange={(e) => updateCfg({ usePkce: e.target.checked })}
            className="w-4 h-4 rounded border-border bg-surface text-cyan focus:ring-cyan focus:ring-2"
          />
          <span className="text-12 text-text font-medium">Use PKCE</span>
        </label>
      </div>

      <div className="px-4 py-3 border-b border-border">
        <button
          type="button"
          onClick={handleAuthorize}
          disabled={loading || !cfg.authUrl || !cfg.tokenUrl || !cfg.clientId}
          className="h-[36px] px-6 bg-success hover:opacity-90 active:scale-[0.97] rounded-md font-bold text-13 text-white flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <ExternalLink size={14} />
          <span>{loading ? "Loading..." : "Authorize"}</span>
        </button>
      </div>

      {!hasToken && (
        <div className="p-4 flex flex-col gap-3 border-b border-border">
          <Field label="Authorization Code">
            <input
              type="text"
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              placeholder="Paste the code from redirect URL"
              className={inputClass}
            />
          </Field>
          <button
            type="button"
            onClick={handleExchange}
            disabled={loading || !authCode}
            className="h-[36px] px-4 bg-cyan hover:bg-cyan-hover active:scale-[0.97] rounded-md font-bold text-13 text-white flex items-center gap-2 transition-all disabled:opacity-50 self-start"
          >
            <Shield size={14} />
            <span>Exchange Code for Token</span>
          </button>
        </div>
      )}

      {hasToken && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Check size={14} className="text-success" />
            <span className="text-12 font-semibold text-text">
              Authenticated as {tokenType || "Bearer"}
            </span>
          </div>
          <div className="flex items-center gap-4 text-11 text-subtext mb-3">
            {expiresIn > 0 ? (
              <span>Expires in {expiresIn}s</span>
            ) : (
              <span className="text-danger">Expired</span>
            )}
            {cfg.refreshToken && <span>Refresh token available</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {cfg.refreshToken && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                className="h-[32px] px-3 bg-card border border-border hover:border-cyan rounded-md text-12 text-text flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} />
                <span>Refresh Token</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleClearToken}
              className="h-[32px] px-3 bg-card border border-border hover:border-danger rounded-md text-12 text-text flex items-center gap-1.5 transition-colors"
            >
              <X size={12} />
              <span>Clear Token</span>
            </button>
            <button
              type="button"
              onClick={handleUseToken}
              className={cn(
                "h-[32px] px-3 rounded-md text-12 font-semibold flex items-center gap-1.5 transition-colors",
                authType === "oauth2"
                  ? "bg-cyan text-white"
                  : "bg-card border border-border hover:border-cyan text-text",
              )}
            >
              <Check size={12} />
              <span>Use Token</span>
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 text-12 text-danger">{error}</div>
      )}
    </div>
  );
}
