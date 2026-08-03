import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw, Check, X, Shield, Loader2, Copy, MonitorSmartphone } from "lucide-react";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { cn } from "@/shared/lib/cn";
import {
  OAuth2Authorize,
  OAuth2Cancel,
  OAuth2StartDevice,
  OAuth2PollDevice,
  OAuth2Refresh,
} from "../../../../wailsjs/go/main/App";
import { BrowserOpenURL, EventsOn } from "../../../../wailsjs/runtime/runtime";
import type { OAuth2Config, OAuth2TokenResponse } from "@/features/request/types/request";

const REDIRECT = "http://127.0.0.1:7317/callback";
const FLOW_TIMEOUT_MS = 120000;

interface OAuth2DeviceStart {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
}

type GrantType = "auth_code" | "device";

interface Preset {
  key: string;
  label: string;
  authUrl: string;
  tokenUrl: string;
  deviceUrl: string;
  scopes: string;
}

const PRESETS: Preset[] = [
  { key: "github", label: "GitHub", authUrl: "https://github.com/login/oauth/authorize", tokenUrl: "https://github.com/login/oauth/access_token", deviceUrl: "https://github.com/login/device/code", scopes: "repo user gist" },
  { key: "google", label: "Google", authUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", deviceUrl: "https://oauth2.googleapis.com/device/code", scopes: "openid email profile" },
  { key: "spotify", label: "Spotify", authUrl: "https://accounts.spotify.com/authorize", tokenUrl: "https://accounts.spotify.com/api/token", deviceUrl: "", scopes: "user-read-email" },
  { key: "slack", label: "Slack", authUrl: "https://slack.com/oauth/v2/authorize", tokenUrl: "https://slack.com/api/oauth.v2.access", deviceUrl: "", scopes: "chat:write" },
  { key: "gitlab", label: "GitLab", authUrl: "https://gitlab.com/oauth/authorize", tokenUrl: "https://gitlab.com/oauth/token", deviceUrl: "https://gitlab.com/oauth/device/code", scopes: "api read_user" },
  { key: "custom", label: "Custom", authUrl: "", tokenUrl: "", deviceUrl: "", scopes: "" },
];

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

function redirectPort(uri: string): string {
  try {
    const p = new URL(uri).port;
    return p || "?";
  } catch {
    return "?";
  }
}

export function OAuth2Flow() {
  const oauth2Config = useRequestStore((s) => s.oauth2Config);
  const setOAuth2Config = useRequestStore((s) => s.setOAuth2Config);
  const authType = useRequestStore((s) => s.authType);
  const setAuthType = useRequestStore((s) => s.setAuthType);

  const [grantType, setGrantType] = useState<GrantType>("auth_code");
  const [flow, setFlow] = useState<"idle" | "waiting" | "polling" | "error">("idle");
  const [device, setDevice] = useState<OAuth2DeviceStart | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenType, setTokenType] = useState("");

  const onCompleteRef = useRef<((p: any) => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cfg: OAuth2Config = oauth2Config ?? {
    authUrl: "", tokenUrl: "", deviceUrl: "", clientId: "", clientSecret: "",
    scopes: "", redirectUri: REDIRECT, usePkce: false,
  };
  const redirectUri = cfg.redirectUri || REDIRECT;

  const updateCfg = useCallback((patch: Partial<OAuth2Config>) => {
    setOAuth2Config({ ...(oauth2Config ?? cfg), ...patch, redirectUri: patch.redirectUri ?? cfg.redirectUri ?? REDIRECT });
  }, [oauth2Config, setOAuth2Config]);

  // Listen for the callback server's completion event emitted from Go.
  useEffect(() => {
    const off = EventsOn("oauth2:complete", (p: any) => {
      onCompleteRef.current?.(p);
    });
    return () => { try { off(); } catch {} };
  }, []);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const applyToken = useCallback((token: OAuth2TokenResponse) => {
    setTokenType(token.tokenType || "Bearer");
    setOAuth2Config({
      ...cfg,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
    });
    setAuthType("oauth2");
    setFlow("idle");
    setMessage("");
  }, [cfg, setOAuth2Config, setAuthType]);

  const resetFlow = useCallback(() => {
    clearTimers();
    onCompleteRef.current = null;
    setFlow("idle");
    setMessage("");
    setLoading(false);
    setDevice(null);
  }, [clearTimers]);

  const handleAuthorize = async () => {
    clearTimers();
    setMessage("");
    setLoading(true);
    setFlow("waiting");

    onCompleteRef.current = (p: any) => {
      if (p?.success && p?.token) {
        applyToken(p.token);
      } else {
        clearTimers();
        setFlow("error");
        setMessage(p?.errorDescription || p?.error || "Authorization failed.");
      }
    };

    try {
      const result = await OAuth2Authorize(oauth2Config ?? cfg);
      BrowserOpenURL(result.authorizeUrl);
    } catch (e) {
      setFlow("error");
      setMessage(String(e));
      setLoading(false);
      onCompleteRef.current = null;
      return;
    }

    timeoutRef.current = setTimeout(() => {
      setFlow("error");
      setMessage("No callback received. Make sure the redirect URI registered in your app matches " + redirectUri);
      onCompleteRef.current = null;
    }, FLOW_TIMEOUT_MS);
  };

  const handleCancel = async () => {
    try { await OAuth2Cancel(); } catch {}
    resetFlow();
  };

  const handleStartDevice = async () => {
    clearTimers();
    setMessage("");
    setLoading(true);
    setFlow("idle");
    try {
      const dev = await OAuth2StartDevice(oauth2Config ?? cfg);
      setDevice(dev);
      setFlow("polling");
      setLoading(false);
      startPolling(dev);
    } catch (e) {
      setFlow("error");
      setMessage(String(e));
      setLoading(false);
    }
  };

  const startPolling = (dev: OAuth2DeviceStart) => {
    let intervalMs = Math.max(dev.interval, 1) * 1000;
    const deadline = Date.now() + Math.max(dev.expiresIn, 60) * 1000;

    const tick = async () => {
      if (Date.now() > deadline) {
        clearTimers();
        setFlow("error");
        setMessage("Device flow expired. Start again to get a new code.");
        return;
      }
      let res;
      try {
        res = (await OAuth2PollDevice(dev.deviceCode)) as { status: string; token?: OAuth2TokenResponse; message?: string };
      } catch (e) {
        setMessage(String(e));
        return;
      }
      if (res.status === "success" && res.token) {
        clearTimers();
        applyToken(res.token);
      } else if (res.status === "denied") {
        clearTimers();
        setFlow("error");
        setMessage(res.message || "Access was denied.");
      } else if (res.status === "expired" || res.status === "error") {
        clearTimers();
        setFlow("error");
        setMessage(res.message || "Device flow failed.");
      } else if (res.status === "slow_down") {
        intervalMs += 5000;
        clearInterval(pollRef.current!);
        pollRef.current = setInterval(tick, intervalMs);
      }
    };

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(tick, intervalMs);
  };

  const handleRefresh = async () => {
    setMessage("");
    setLoading(true);
    try {
      const token = await OAuth2Refresh(oauth2Config ?? cfg, cfg.refreshToken!);
      applyToken(token);
    } catch (e) {
      setMessage(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleUseToken = () => {
    setAuthType("oauth2");
    setOAuth2Config(cfg);
  };

  const handleClearToken = () => {
    setOAuth2Config({
      ...cfg,
      accessToken: undefined,
      refreshToken: undefined,
      expiresAt: undefined,
    });
    setTokenType("");
    setMessage("");
    resetFlow();
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setMessage("Copied to clipboard.");
    setTimeout(() => setMessage((m) => (m === "Copied to clipboard." ? "" : m)), 1500);
  };

  const applyPreset = (p: Preset) => {
    updateCfg({
      authUrl: p.authUrl,
      tokenUrl: p.tokenUrl,
      deviceUrl: p.deviceUrl,
      scopes: p.scopes,
      redirectUri: redirectUri,
    });
  };

  const hasToken = !!cfg.accessToken;
  const expiresIn = cfg.expiresAt ? Math.max(0, Math.floor((cfg.expiresAt - Date.now()) / 1000)) : 0;
  const isGithub = cfg.tokenUrl.includes("github.com");

  return (
    <div className="flex flex-col max-h-[68vh] overflow-y-auto min-h-0">
      {/* Grant type selector */}
      <div className="p-4 grid grid-cols-2 gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => { setGrantType("auth_code"); resetFlow(); }}
          className={cn(
            "h-[34px] rounded-md text-12 font-medium flex items-center justify-center gap-2 transition-colors",
            grantType === "auth_code" ? "bg-cyan text-white" : "bg-card border border-border text-subtext hover:text-text",
          )}
        >
          <Shield size={13} /> Authorization Code
        </button>
        <button
          type="button"
          onClick={() => { setGrantType("device"); resetFlow(); }}
          className={cn(
            "h-[34px] rounded-md text-12 font-medium flex items-center justify-center gap-2 transition-colors",
            grantType === "device" ? "bg-cyan text-white" : "bg-card border border-border text-subtext hover:text-text",
          )}
        >
          <MonitorSmartphone size={13} /> Device Code
        </button>
      </div>

      {/* Provider presets */}
      <div className="px-4 py-3 border-b border-border">
        <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Provider</label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const active = p.key !== "custom" && cfg.authUrl === p.authUrl && cfg.tokenUrl === p.tokenUrl;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p)}
                className={cn(
                  "h-[26px] px-2.5 rounded-md text-11 font-medium transition-colors",
                  active ? "bg-cyan/15 text-cyan" : "bg-card border border-border text-subtext hover:text-text",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Config fields */}
      <div className="p-4 grid grid-cols-2 gap-3 border-b border-border">
        <Field label="Auth URL">
          <input type="text" value={cfg.authUrl} onChange={(e) => updateCfg({ authUrl: e.target.value })}
            placeholder="https://provider.com/oauth/authorize" className={inputClass} />
        </Field>
        <Field label="Token URL">
          <input type="text" value={cfg.tokenUrl} onChange={(e) => updateCfg({ tokenUrl: e.target.value })}
            placeholder="https://provider.com/oauth/token" className={inputClass} />
        </Field>
        {grantType === "device" && (
          <Field label="Device URL">
            <input type="text" value={cfg.deviceUrl} onChange={(e) => updateCfg({ deviceUrl: e.target.value })}
              placeholder="https://provider.com/oauth/device/code" className={inputClass} />
          </Field>
        )}
        <Field label="Client ID">
          <input type="text" value={cfg.clientId} onChange={(e) => updateCfg({ clientId: e.target.value })}
            placeholder="client-id" className={inputClass} />
        </Field>
        <Field label="Client Secret">
          <input type="password" value={cfg.clientSecret} onChange={(e) => updateCfg({ clientSecret: e.target.value })}
            placeholder="client-secret" className={inputClass} />
        </Field>
        <Field label="Scopes">
          <input type="text" value={cfg.scopes} onChange={(e) => updateCfg({ scopes: e.target.value })}
            placeholder="openid profile email" className={inputClass} />
        </Field>
        <Field label={`Redirect URI (port ${redirectPort(redirectUri)})`}>
          <input type="text" value={redirectUri} onChange={(e) => updateCfg({ redirectUri: e.target.value })}
            placeholder={REDIRECT} className={inputClass} />
        </Field>
      </div>

      {grantType === "auth_code" && (
        <div className="px-4 py-3 border-b border-border">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={cfg.usePkce} onChange={(e) => updateCfg({ usePkce: e.target.checked })}
              className="w-4 h-4 rounded border-border bg-surface text-cyan focus:ring-cyan focus:ring-2" />
            <span className="text-12 text-text font-medium">Use PKCE (S256)</span>
          </label>
          <p className="text-11 text-subtext mt-1.5 leading-relaxed">
            Register <code className="text-cyan bg-surface px-1 rounded">{redirectUri}</code> exactly in your provider&apos;s
            callback URL settings — matching is strict.
          </p>
        </div>
      )}

      {isGithub && (
        <div className="px-4 py-3 border-b border-border bg-cyan/5">
          <p className="text-11 text-subtext leading-relaxed">
            <span className="text-cyan font-medium">GitHub note:</span> OAuth apps never return a refresh token — use
            &ldquo;Get New Access Token&rdquo; again when one expires.
          </p>
        </div>
      )}

      {/* Action area */}
      <div className="px-4 py-3 border-b border-border flex flex-col gap-2.5">
        {flow === "idle" && (
          <button
            type="button"
            onClick={grantType === "auth_code" ? handleAuthorize : handleStartDevice}
            disabled={loading || !cfg.authUrl || !cfg.tokenUrl || !cfg.clientId}
            className="h-[36px] px-6 bg-success hover:opacity-90 active:scale-[0.97] rounded-md font-bold text-13 text-white flex items-center gap-2 transition-all disabled:opacity-50 self-start"
          >
            <ExternalLink size={14} />
            <span>{loading ? "Starting…" : grantType === "auth_code" ? "Get New Access Token" : "Start Device Authorization"}</span>
          </button>
        )}

        {flow === "waiting" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-12 text-text">
              <Loader2 size={14} className="animate-spin text-cyan" />
              <span>Waiting for authorization in your browser…</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => BrowserOpenURL(cfg.authUrl + (cfg.authUrl.includes("?") ? "&" : "?") + "prompt=select_account")}
                className="h-[32px] px-3 bg-card border border-border hover:border-cyan rounded-md text-12 text-text flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink size={12} /> Re-open browser
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="h-[32px] px-3 bg-card border border-border hover:border-danger rounded-md text-12 text-text flex items-center gap-1.5 transition-colors"
              >
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
        )}

        {flow === "polling" && device && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-12 text-text">
              <Loader2 size={14} className="animate-spin text-cyan" />
              <span>Waiting for you to authorize on another device…</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-surface border border-border p-3">
              <div className="text-24 font-bold tracking-widest text-text font-mono">{device.userCode}</div>
              <button
                type="button"
                onClick={() => copy(device.userCode)}
                className="h-[28px] px-2 bg-card border border-border hover:border-cyan rounded-md text-11 text-subtext flex items-center gap-1 transition-colors"
                title="Copy code"
              >
                <Copy size={11} /> Copy
              </button>
            </div>
            <button
              type="button"
              onClick={() => BrowserOpenURL(device.verificationUriComplete || device.verificationUri)}
              className="h-[36px] px-4 bg-cyan hover:bg-cyan-hover rounded-md text-12 font-semibold text-white flex items-center gap-2 transition-colors self-start"
            >
              <MonitorSmartphone size={13} /> Open verification URL
            </button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleCancel}
                className="h-[32px] px-3 bg-card border border-border hover:border-danger rounded-md text-12 text-text flex items-center gap-1.5 transition-colors">
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
        )}

        {flow === "error" && (
          <div className="text-12 text-danger bg-danger/5 border border-danger/20 rounded-md px-3 py-2">{message}</div>
        )}
      </div>

      {hasToken && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Check size={14} className="text-success" />
            <span className="text-12 font-semibold text-text">Authenticated as {tokenType || "Bearer"}</span>
          </div>
          <div className="flex items-center gap-4 text-11 text-subtext mb-3">
            {expiresIn > 0 ? <span>Expires in {expiresIn}s</span> : <span className="text-danger">No expiry / expired</span>}
            {cfg.refreshToken && <span>Refresh token available</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {cfg.refreshToken && (
              <button type="button" onClick={handleRefresh} disabled={loading}
                className="h-[32px] px-3 bg-card border border-border hover:border-cyan rounded-md text-12 text-text flex items-center gap-1.5 transition-colors disabled:opacity-50">
                <RefreshCw size={12} /> Refresh Token
              </button>
            )}
            <button type="button" onClick={handleUseToken}
              className={cn("h-[32px] px-3 rounded-md text-12 font-semibold flex items-center gap-1.5 transition-colors",
                authType === "oauth2" ? "bg-cyan text-white" : "bg-card border border-border hover:border-cyan text-text")}>
              <Check size={12} /> Use Token
            </button>
            <button type="button" onClick={handleClearToken}
              className="h-[32px] px-3 bg-card border border-border hover:border-danger rounded-md text-12 text-text flex items-center gap-1.5 transition-colors">
              <X size={12} /> Clear Token
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 px-4 py-1.5 border-t border-border text-10 text-subtext/70">
        <Shield size={11} />
        <span>State + loopback secured; tokens stay local to this request.</span>
      </div>
    </div>
  );
}