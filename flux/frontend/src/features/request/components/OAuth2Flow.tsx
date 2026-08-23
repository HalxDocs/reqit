import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw, Check, X, Shield, Loader2, Copy, MonitorSmartphone, ClipboardPaste, Wrench, AlertTriangle, KeyRound } from "lucide-react";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { cn } from "@/shared/lib/cn";
import { formatExpiry, getExpiryState, normalizeExpiry } from "@/shared/lib/expiry";
import {
  OAuth2Authorize,
  OAuth2Cancel,
  OAuth2ClientCredentials,
  OAuth2ImplicitAuthorize,
  OAuth2ManualAuthorize,
  OAuth2ManualComplete,
  OAuth2OpenBrowser,
  OAuth2DiagnoseLoopback,
  OAuth2Password,
  OAuth2StartDevice,
  OAuth2PollDevice,
  OAuth2Refresh,
} from "../../../../wailsjs/go/main/App";
import { EventsOn } from "../../../../wailsjs/runtime/runtime";
import { OAuth2DiscoveryField, type OAuth2DiscoveryMeta } from "./OAuth2DiscoveryField";
import type { OAuth2Config, OAuth2TokenResponse } from "@/features/request/types/request";

// Fixed loopback callback used by providers that require an exact
// pre-registered redirect URI (GitHub, Slack, Spotify, GitLab). Everything
// else defaults to an empty redirect URI so the engine auto-assigns an
// ephemeral loopback port per RFC 8252 §7.3.
const REDIRECT = "http://127.0.0.1:7317/callback";
// If the browser launcher succeeded but the app window never lost focus (the
// browser never took over), assume it silently didn't open and auto-switch to
// the paste-back fallback after this grace period.
const NO_OPEN_GRACE_MS = 15_000;

// Provider-aware callback timeouts. MFA-heavy providers need longer windows
// because the user may need to approve a push notification, enter a TOTP
// code, or select a passkey. Fast providers (GitHub, GitLab) use shorter
// timeouts so stale tabs fail fast.
const TIMEOUT_MFA_MS = 10 * 60 * 1000;  // Google, Entra ID, Okta, Auth0
const TIMEOUT_DEFAULT_MS = 5 * 60 * 1000; // everything else
const TIMEOUT_FAST_MS = 3 * 60 * 1000;  // GitHub, GitLab (no MFA redirect)

// Provider patterns that typically show MFA/consent screens.
const MFA_PROVIDER_PATTERNS = [
  /googleapis\.com/i,
  /microsoftonline\.com/i,
  /entra\.microsoft\.com/i,
  /login\.microsoftonline\.com/i,
  /okta\.com/i,
  /auth0\.com/i,
];

// Fast providers that never show MFA pages during the OAuth redirect.
const FAST_PROVIDER_PATTERNS = [
  /github\.com/i,
  /gitlab\.com/i,
];

/** Select the callback timeout for the current provider. */
function providerTimeoutMs(authUrl: string, tokenUrl: string): number {
  const combined = authUrl + tokenUrl;
  if (FAST_PROVIDER_PATTERNS.some((p) => p.test(combined))) return TIMEOUT_FAST_MS;
  if (MFA_PROVIDER_PATTERNS.some((p) => p.test(combined))) return TIMEOUT_MFA_MS;
  return TIMEOUT_DEFAULT_MS;
}

interface OAuth2DeviceStart {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
}

type GrantType = "auth_code" | "device" | "client_credentials" | "password" | "implicit";

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
  { key: "entra", label: "Entra ID", authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token", deviceUrl: "", scopes: "openid profile email offline_access User.Read" },
  { key: "auth0", label: "Auth0", authUrl: "https://YOUR_TENANT.auth0.com/authorize", tokenUrl: "https://YOUR_TENANT.auth0.com/oauth/token", deviceUrl: "https://YOUR_TENANT.auth0.com/oauth/device/code", scopes: "openid profile email" },
  { key: "okta", label: "Okta", authUrl: "https://YOUR_DOMAIN.okta.com/oauth2/default/v1/authorize", tokenUrl: "https://YOUR_DOMAIN.okta.com/oauth2/default/v1/token", deviceUrl: "https://YOUR_DOMAIN.okta.com/oauth2/default/v1/device/authorize", scopes: "openid profile email" },
  { key: "keycloak", label: "Keycloak", authUrl: "http://localhost:8080/realms/reqit-test/protocol/openid-connect/auth", tokenUrl: "http://localhost:8080/realms/reqit-test/protocol/openid-connect/token", deviceUrl: "http://localhost:8080/realms/reqit-test/protocol/openid-connect/auth/device", scopes: "openid profile" },
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
  if (!uri) return "auto";
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
  const [showLegacy, setShowLegacy] = useState(false);
  const [legacyUsername, setLegacyUsername] = useState("");
  const [legacyPassword, setLegacyPassword] = useState("");
  const [flow, setFlow] = useState<"idle" | "waiting" | "polling" | "manual" | "error">("idle");
  const [device, setDevice] = useState<OAuth2DeviceStart | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [pastedUrl, setPastedUrl] = useState("");
  // The exact authorize URL from the backend — "Re-open browser" must reuse
  // it (it carries the state + PKCE params), never rebuild a bare URL.
  const [authUrlState, setAuthUrlState] = useState("");
  // Set when the backend fell back from a busy fixed loopback port to an
  // auto-assigned one — the provider's registered redirect URI may need updating.
  const [portNote, setPortNote] = useState("");
  const [diagBusy, setDiagBusy] = useState(false);
  const [diagFindings, setDiagFindings] = useState<Array<{severity: string; label: string; detail: string}>>([]);
  // Request id of the in-flight loopback diagnostics check; results with a
  // mismatched id are stale (a newer check superseded them).
  const diagReqRef = useRef<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenType, setTokenType] = useState("");
  // Ticks every second when a token with an expiry is present so the
  // "Expires in ..." label stays live without needing a full re-render.
  const [nowTick, setNowTick] = useState(() => Date.now());

  const onCompleteRef = useRef<((p: any) => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Browser-never-opened detection: the no-open watchdog timer, its blur
  // listener, and the flow token used to invalidate stale callbacks.
  const noOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurHandlerRef = useRef<(() => void) | null>(null);
  const flowTokenRef = useRef(0);
  const browserBlurredRef = useRef(false);

  const cfg: OAuth2Config = oauth2Config ?? {
    authUrl: "", tokenUrl: "", deviceUrl: "", clientId: "", clientSecret: "",
    scopes: "", redirectUri: "", usePkce: false,
  };
  // "" means the engine auto-assigns an ephemeral loopback port (RFC 8252 §7.3).
  const redirectUri = cfg.redirectUri ?? "";
  const effectiveRedirect = redirectUri || REDIRECT;

  const updateCfg = useCallback((patch: Partial<OAuth2Config>) => {
    setOAuth2Config({ ...(oauth2Config ?? cfg), ...patch, redirectUri: patch.redirectUri ?? cfg.redirectUri ?? "" });
  }, [oauth2Config, setOAuth2Config]);

  // Listen for the callback server's completion event emitted from Go.
  useEffect(() => {
    const off = EventsOn("oauth2:complete", (p: any) => {
      onCompleteRef.current?.(p);
    });
    return () => { try { off(); } catch {} };
  }, []);

  // The diagnostics binding returns immediately and delivers the outcome on
  // "oauth2:diagnostics" (the check runs on a Go goroutine, so the main
  // thread never blocks for the up-to-12s wait).
  useEffect(() => {
    const off = EventsOn("oauth2:diagnostics", (p: any) => {
      if (diagReqRef.current == null || p?.id !== diagReqRef.current) return; // stale result
      diagReqRef.current = null;
      setDiagBusy(false);
      setDiagFindings(p?.findings ?? []);
      setMessage(p?.success
        ? "Loopback OK — " + (p?.detail || "the browser reached the loopback listener.")
        : "Loopback check failed — " + (p?.detail || "the browser never connected back."));
    });
    return () => { try { off(); } catch {} };
  }, []);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (noOpenTimerRef.current) { clearTimeout(noOpenTimerRef.current); noOpenTimerRef.current = null; }
    if (blurHandlerRef.current) { window.removeEventListener("blur", blurHandlerRef.current); blurHandlerRef.current = null; }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Live tick for the expiry countdown — only runs while a token with an
  // actual expiry exists, otherwise stays dormant (GitHub no-expiry tokens
  // never tick).
  useEffect(() => {
    if (!cfg.accessToken) return;
    if (getExpiryState(cfg.expiresAt) === "no_expiry") return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [cfg.accessToken, cfg.expiresAt]);

  const applyToken = useCallback((token: OAuth2TokenResponse) => {
    clearTimers();
    onCompleteRef.current = null;
    setTokenType(token.tokenType || "Bearer");
    setOAuth2Config({
      ...cfg,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      // Go emits ms; normalize guards against any seconds value slipping in.
      expiresAt: normalizeExpiry(token.expiresAt),
    });
    setAuthType("oauth2");
    setFlow("idle");
    setMessage("");
    setManualUrl("");
    setPastedUrl("");
  }, [cfg, setOAuth2Config, setAuthType, clearTimers]);

  const resetFlow = useCallback(() => {
    clearTimers();
    flowTokenRef.current += 1; // invalidate any pending no-open watchdog
    onCompleteRef.current = null;
    setFlow("idle");
    setMessage("");
    setLoading(false);
    setDevice(null);
    setManualUrl("");
    setPastedUrl("");
    setAuthUrlState("");
    setPortNote("");
    setDiagFindings([]);
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

    // Select a provider-aware callback timeout. MFA providers (Google,
    // Entra) need 10 minutes; fast providers (GitHub) get 3; default 5.
    const timeoutMs = providerTimeoutMs(cfg.authUrl, cfg.tokenUrl);
    const timeoutSec = Math.ceil(timeoutMs / 1000);

    try {
      // Pass the timeout to the backend so the engine's context deadline
      // matches the frontend's UI timer — no mismatch.
      const cfgWithTimeout = { ...(oauth2Config ?? cfg), flowTimeoutSec: timeoutSec };
      const result = await OAuth2Authorize(cfgWithTimeout);
      setAuthUrlState(result.authorizeUrl);
      setPortNote(result.note ?? "");
      const openErr = await openInBrowser(result.authorizeUrl);
      if (openErr) {
        await fallbackToManual(result.authorizeUrl, "Your browser couldn't be opened automatically.");
        return;
      }
      armNoOpenWatchdog(result.authorizeUrl);
    } catch (e) {
      setFlow("error");
      setMessage(String(e));
      setLoading(false);
      onCompleteRef.current = null;
      return;
    }

    const timeoutMin = Math.round(timeoutMs / 60_000);
    timeoutRef.current = setTimeout(() => {
      setFlow("error");
      setMessage(
        `No callback received within ${timeoutMin} minutes — the authorization flow has ended. Click \u201cGet New Access Token\u201d to retry.` +
        (redirectUri ? ` Make sure the redirect URI registered in your app matches ${effectiveRedirect} exactly.` : ""),
      );
      onCompleteRef.current = null;
    }, timeoutMs);
  };

  const writeClipboard = (text: string) => {
    try { navigator.clipboard?.writeText(text).catch(() => {}); } catch {}
  };

  // Opens url via the engine-backed binding so a launcher failure is
  // observable (the Wails runtime BrowserOpenURL is fire-and-forget).
  // Returns null on success, else the launcher error text.
  const openInBrowser = async (url: string): Promise<string | null> => {
    try {
      await OAuth2OpenBrowser(url);
      return null;
    } catch (e) {
      return String(e);
    }
  };

  // Auto-fallback when the browser couldn't be opened (or never visibly
  // opened). With a fixed redirect URI we switch to the paste-back manual
  // flow (no listener needed) and pre-copy the authorize URL; with an
  // ephemeral redirect the loopback listener is still live, so we keep
  // waiting and hand the user the URL to open themselves.
  const fallbackToManual = async (url: string, reason: string) => {
    setLoading(false);
    if (!redirectUri) {
      writeClipboard(url);
      setMessage(reason + " The authorize URL has been copied to your clipboard — open it in your browser yourself. The local callback is still listening, so sign-in will complete normally.");
      return;
    }
    // Stop the loopback flow so the manual flow can start (the engine allows
    // one in-flight flow at a time), then prepare the paste-back flow.
    try { await OAuth2Cancel(); } catch {}
    clearTimers();
    flowTokenRef.current += 1;
    try {
      const result = await OAuth2ManualAuthorize(oauth2Config ?? cfg);
      writeClipboard(result.authorizeUrl);
      setManualUrl(result.authorizeUrl);
      setPastedUrl("");
      setFlow("manual");
      setMessage(reason + " Switched to manual authorization — the authorize URL has been copied to your clipboard. Open it in your browser, then paste the redirect URL back here.");
    } catch (e) {
      setFlow("error");
      setMessage(String(e));
    }
  };

  // Watchdog for the "browser launcher reported success but no tab actually
  // opened" case: if the app window never loses focus (the browser never
  // took over) and no callback arrives within the grace period, auto-switch
  // to the paste-back fallback.
  const armNoOpenWatchdog = (url: string) => {
    const token = ++flowTokenRef.current;
    browserBlurredRef.current = false;
    const onBlur = () => { browserBlurredRef.current = true; };
    blurHandlerRef.current = onBlur;
    window.addEventListener("blur", onBlur);
    noOpenTimerRef.current = setTimeout(() => {
      window.removeEventListener("blur", onBlur);
      blurHandlerRef.current = null;
      noOpenTimerRef.current = null;
      if (flowTokenRef.current !== token) return; // flow moved on
      if (browserBlurredRef.current) return;      // browser took focus — it's open
      if (onCompleteRef.current == null) return;  // no longer waiting
      void fallbackToManual(url, "Your browser didn't seem to open.");
    }, NO_OPEN_GRACE_MS);
  };

  // One-click browser-to-loopback connectivity check: the engine binds a
  // test listener on 127.0.0.1:0, opens it in the default browser, and
  // reports whether the browser reached it — the exact path an OAuth
  // callback takes. Use it when "This site can't be reached" shows up. The
  // binding returns immediately; the result arrives on oauth2:diagnostics.
  const runDiagnostics = async () => {
    setDiagBusy(true);
    setMessage("Running loopback diagnostics — a test page will open in your browser…");
    try {
      diagReqRef.current = await OAuth2DiagnoseLoopback();
    } catch (e) {
      diagReqRef.current = null;
      setDiagBusy(false);
      setMessage("Loopback diagnostics failed: " + String(e));
    }
  };

  const handleCancel = async () => {
    try { await OAuth2Cancel(); } catch {}
    resetFlow();
  };

  // Paste-back fallback (RedirectManual): no loopback listener — the user
  // opens the authorize URL in any browser and pastes the redirect URL back.
  // The engine validates state and exchanges the code with PKCE, exactly like
  // the loopback path.
  const handleManualAuthorize = async () => {
    clearTimers();
    setMessage("");
    // Manual paste-back needs a concrete redirect URI — with no loopback
    // listener, an empty one would produce an authorize URL the provider
    // rejects (missing redirect_uri).
    if (!redirectUri) {
      setFlow("error");
      setMessage("Manual authorization needs a fixed redirect URI. Set the Redirect URI field (e.g. " + REDIRECT + ") and register it in your provider's callback settings, then try again.");
      return;
    }
    setLoading(true);
    try {
      const result = await OAuth2ManualAuthorize(oauth2Config ?? cfg);
      setManualUrl(result.authorizeUrl);
      setPastedUrl("");
      setFlow("manual");
      const openErr = await openInBrowser(result.authorizeUrl);
      if (openErr) {
        setMessage("The browser couldn't be opened automatically — the authorize URL is shown above; open it manually and paste the redirect URL back.");
      }
    } catch (e) {
      setFlow("error");
      setMessage(String(e));
    } finally {
      setLoading(false);
    }
  };

  // Recovery path for a browser that can't reach the local callback (e.g.
  // "This site can't be reached"): cancel the loopback flow and switch to the
  // paste-back fallback, which needs no local listener.
  const switchToManual = async () => {
    try { await OAuth2Cancel(); } catch {}
    clearTimers();
    await handleManualAuthorize();
  };

  const handleManualComplete = async () => {
    const pasted = pastedUrl.trim();
    if (!pasted) return;
    setLoading(true);
    setMessage("");
    try {
      const token = await OAuth2ManualComplete(pasted);
      applyToken(token);
    } catch (e) {
      // Stay in the manual view so the user can fix/paste again — surface the
      // provider's error verbatim.
      setMessage(String(e));
    } finally {
      setLoading(false);
    }
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

  const handleClientCredentials = async () => {
    setMessage("");
    setLoading(true);
    setFlow("waiting");
    try {
      const token = await OAuth2ClientCredentials(oauth2Config ?? cfg);
      applyToken(token);
    } catch (e) {
      setFlow("error");
      setMessage(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handlePassword = async () => {
    if (!legacyUsername || !legacyPassword) {
      setMessage("Username and password are required for this grant.");
      return;
    }
    setMessage("");
    setLoading(true);
    setFlow("waiting");
    try {
      const token = await OAuth2Password(oauth2Config ?? cfg, legacyUsername, legacyPassword);
      applyToken(token);
    } catch (e) {
      setFlow("error");
      setMessage(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleImplicit = async () => {
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
    const timeoutMs = providerTimeoutMs(cfg.authUrl, cfg.tokenUrl);
    const timeoutSec = Math.ceil(timeoutMs / 1000);
    try {
      const cfgWithTimeout = { ...(oauth2Config ?? cfg), flowTimeoutSec: timeoutSec };
      const result = await OAuth2ImplicitAuthorize(cfgWithTimeout);
      setAuthUrlState(result.authorizeUrl);
      setPortNote(result.note ?? "");
      const openErr = await openInBrowser(result.authorizeUrl);
      if (openErr) {
        await fallbackToManual(result.authorizeUrl, "Your browser couldn't be opened automatically.");
        return;
      }
      armNoOpenWatchdog(result.authorizeUrl);
    } catch (e) {
      setFlow("error");
      setMessage(String(e));
      setLoading(false);
      onCompleteRef.current = null;
      return;
    }
    const timeoutMin = Math.round(timeoutMs / 60_000);
    timeoutRef.current = setTimeout(() => {
      setFlow("error");
      setMessage(`No callback received within ${timeoutMin} minutes — the authorization flow has ended.`);
      onCompleteRef.current = null;
    }, timeoutMs);
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

  // Providers that require an exact pre-registered redirect URI (GitHub,
  // Slack, Spotify, GitLab) pin the fixed loopback port; the rest default to
  // an auto-assigned ephemeral port unless the user configures one.
  const REQUIRES_FIXED_REDIRECT = new Set(["github", "slack", "spotify", "gitlab"]);
  const applyPreset = (p: Preset) => {
    updateCfg({
      issuer: "",
      authUrl: p.authUrl,
      tokenUrl: p.tokenUrl,
      deviceUrl: p.deviceUrl,
      scopes: p.scopes,
      redirectUri: redirectUri || (REQUIRES_FIXED_REDIRECT.has(p.key) ? REDIRECT : ""),
    });
  };

  // Discovery autofill (guided setup): fill the endpoints + scopes from one
  // issuer URL. The redirect URI is deliberately left untouched — it must be
  // registered exactly as configured. PKCE (S256) is always re-asserted; the
  // engine enforces it regardless of the legacy checkbox.
  const handleDiscovered = useCallback((meta: OAuth2DiscoveryMeta) => {
    updateCfg({
      issuer: meta.issuer,
      authUrl: meta.authorizationEndpoint,
      tokenUrl: meta.tokenEndpoint,
      deviceUrl: meta.deviceAuthorizationEndpoint || cfg.deviceUrl,
      scopes: (meta.scopesSupported ?? []).join(" "),
      usePkce: true,
    });
  }, [updateCfg, cfg.deviceUrl]);

  const hasToken = !!cfg.accessToken;
  const expiryState = getExpiryState(cfg.expiresAt, nowTick);
  const expiryLabel = formatExpiry(cfg.expiresAt, nowTick);
  const isGithub = cfg.tokenUrl.includes("github.com");
  const displayTokenType = tokenType
    ? tokenType.charAt(0).toUpperCase() + tokenType.slice(1)
    : "Bearer";

  return (
    <div className="flex flex-col max-h-[68vh] overflow-y-auto min-h-0">
      {/* Grant type selector */}
      <div className="p-4 grid grid-cols-3 gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => { setGrantType("auth_code"); resetFlow(); }}
          className={cn(
            "h-[34px] rounded-md text-12 font-medium flex items-center justify-center gap-1.5 transition-colors",
            grantType === "auth_code" ? "bg-cyan text-white" : "bg-card border border-border text-subtext hover:text-text",
          )}
        >
          <Shield size={13} /> Authorization Code
        </button>
        <button
          type="button"
          onClick={() => { setGrantType("client_credentials"); resetFlow(); }}
          className={cn(
            "h-[34px] rounded-md text-12 font-medium flex items-center justify-center gap-1.5 transition-colors",
            grantType === "client_credentials" ? "bg-cyan text-white" : "bg-card border border-border text-subtext hover:text-text",
          )}
        >
          <Shield size={12} /> Client Credentials
        </button>
        <button
          type="button"
          onClick={() => { setGrantType("device"); resetFlow(); }}
          className={cn(
            "h-[34px] rounded-md text-12 font-medium flex items-center justify-center gap-1.5 transition-colors",
            grantType === "device" ? "bg-cyan text-white" : "bg-card border border-border text-subtext hover:text-text",
          )}
        >
          <MonitorSmartphone size={13} /> Device Code
        </button>
      </div>

      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showLegacy} onChange={(e) => setShowLegacy(e.target.checked)} className="w-3.5 h-3.5 rounded border-border bg-surface text-cyan accent-cyan" />
          <span className="text-11 text-subtext">Show legacy grants (password / implicit — deprecated)</span>
        </label>
      </div>

      {showLegacy && (
        <div className="p-4 grid grid-cols-2 gap-2 border-b border-border">
          <button
            type="button"
            onClick={() => { setGrantType("password"); resetFlow(); }}
            className={cn(
              "h-[34px] rounded-md text-12 font-medium flex items-center justify-center gap-1.5 transition-colors",
              grantType === "password" ? "bg-amber-500 text-white" : "bg-card border border-border text-subtext hover:text-text",
            )}
          >
            <KeyRound size={13} /> Password
          </button>
          <button
            type="button"
            onClick={() => { setGrantType("implicit"); resetFlow(); }}
            className={cn(
              "h-[34px] rounded-md text-12 font-medium flex items-center justify-center gap-1.5 transition-colors",
              grantType === "implicit" ? "bg-amber-500 text-white" : "bg-card border border-border text-subtext hover:text-text",
            )}
          >
            <AlertTriangle size={13} /> Implicit
          </button>
        </div>
      )}

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
        <OAuth2DiscoveryField
          issuer={cfg.issuer ?? ""}
          onIssuerChange={(issuer) => updateCfg({ issuer })}
          onDiscovered={handleDiscovered}
        />
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
        {grantType !== "client_credentials" && (
          <Field label={`Redirect URI (port ${redirectPort(redirectUri)})`}>
            <input type="text" value={redirectUri} onChange={(e) => updateCfg({ redirectUri: e.target.value })}
              placeholder={REDIRECT} className={inputClass} />
          </Field>
        )}
      </div>

      {grantType === "client_credentials" && cfg.clientSecret && (
        <div className="px-4 py-3 border-b border-border">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Client Authentication</label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => updateCfg({ clientAuth: "body" })}
              className={cn("h-[28px] px-3 rounded-md text-11 font-medium", (!cfg.clientAuth || cfg.clientAuth === "body") ? "bg-cyan text-white" : "bg-card border border-border text-subtext")}
            >
              Body (default)
            </button>
            <button
              type="button"
              onClick={() => updateCfg({ clientAuth: "basic" })}
              className={cn("h-[28px] px-3 rounded-md text-11 font-medium", cfg.clientAuth === "basic" ? "bg-cyan text-white" : "bg-card border border-border text-subtext")}
            >
              Basic Auth header
            </button>
          </div>
          <p className="text-11 text-subtext mt-1.5 leading-relaxed">
            Some providers reject client_secret in the body — use Basic Auth header instead (Hoppscotch parity).
          </p>
        </div>
      )}

      {grantType === "auth_code" && (
        <div className="px-4 py-3 border-b border-border">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={cfg.usePkce} onChange={(e) => updateCfg({ usePkce: e.target.checked })}
              className="w-4 h-4 rounded border-border bg-surface text-cyan focus:ring-cyan focus:ring-2" />
            <span className="text-12 text-text font-medium">Use PKCE (S256)</span>
          </label>
          <p className="text-11 text-subtext mt-1.5 leading-relaxed">
            {redirectUri ? (
              <>Register <code className="text-cyan bg-surface px-1 rounded">{effectiveRedirect}</code> exactly in your provider&apos;s callback URL settings — matching is strict.</>
            ) : (
              <>Leave the redirect URI empty and reqit auto-assigns a loopback port (RFC 8252) — most providers accept any loopback port. If your provider requires an exact registered callback, set <code className="text-cyan bg-surface px-1 rounded">{REDIRECT}</code> and register it.</>
            )}
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

      {grantType === "password" && (
        <div className="px-4 py-3 border-b border-border bg-amber-500/10 border-amber-500/20">
          <p className="text-11 text-amber-600 leading-relaxed flex items-start gap-2">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <span><span className="font-semibold">Deprecated:</span> Resource Owner Password Credentials is deprecated by RFC 9700 — it exposes the password to the client and must not be used for third-party APIs. Prefer Authorization Code + PKCE.</span>
          </p>
        </div>
      )}

      {grantType === "implicit" && (
        <div className="px-4 py-3 border-b border-border bg-amber-500/10 border-amber-500/20">
          <p className="text-11 text-amber-600 leading-relaxed flex items-start gap-2">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <span><span className="font-semibold">Deprecated:</span> Implicit grant is deprecated by RFC 9700 — the token is returned in the URL fragment and is less secure than Authorization Code + PKCE.</span>
          </p>
        </div>
      )}

      {grantType === "password" && (
        <div className="p-4 grid grid-cols-2 gap-3 border-b border-border">
          <Field label="Username">
            <input type="text" value={legacyUsername} onChange={(e) => setLegacyUsername(e.target.value)} placeholder="username" className={inputClass} />
          </Field>
          <Field label="Password">
            <input type="password" value={legacyPassword} onChange={(e) => setLegacyPassword(e.target.value)} placeholder="password" className={inputClass} />
          </Field>
        </div>
      )}

      {/* Action area */}
      <div className="px-4 py-3 border-b border-border flex flex-col gap-2.5">
        {flow === "idle" && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={
                grantType === "auth_code"
                  ? handleAuthorize
                  : grantType === "client_credentials"
                    ? handleClientCredentials
                    : grantType === "password"
                      ? handlePassword
                      : grantType === "implicit"
                        ? handleImplicit
                        : handleStartDevice
              }
              disabled={
                loading ||
                !cfg.clientId ||
                (grantType === "client_credentials"
                  ? !cfg.tokenUrl
                  : grantType === "password"
                    ? !cfg.tokenUrl || !legacyUsername || !legacyPassword
                    : grantType === "implicit"
                      ? !cfg.authUrl
                      : grantType === "device"
                        ? !cfg.tokenUrl
                        : !cfg.authUrl || !cfg.tokenUrl)
              }
              className="h-[36px] px-6 bg-success hover:opacity-90 active:scale-[0.97] rounded-md font-bold text-13 text-white flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <ExternalLink size={14} />
              <span>
                {loading
                  ? "Starting…"
                  : grantType === "auth_code"
                    ? "Get New Access Token"
                    : grantType === "client_credentials"
                      ? "Get Token"
                      : grantType === "password"
                        ? "Get Token (Password)"
                        : grantType === "implicit"
                          ? "Authorize (Implicit)"
                          : "Start Device Authorization"}
              </span>
            </button>
            {grantType === "auth_code" && (
              <button
                type="button"
                onClick={handleManualAuthorize}
                disabled={loading || !cfg.authUrl || !cfg.clientId}
                className="h-[36px] px-4 bg-card border border-border hover:border-cyan rounded-md text-12 font-semibold text-text flex items-center gap-1.5 transition-colors disabled:opacity-50"
                title="Use when your browser can't reach the local callback (paste the redirect URL back)"
              >
                <ClipboardPaste size={13} className="text-cyan" />
                <span>Authorize Manually</span>
              </button>
            )}
          </div>
        )}

        {flow === "manual" && manualUrl && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-12 text-text">
              <ClipboardPaste size={14} className="text-cyan" />
              <span>Authorize in your browser, then paste the redirect URL back here.</span>
            </div>
            <div className="rounded-md bg-surface border border-border p-2 font-mono text-11 text-subtext break-all max-h-[76px] overflow-y-auto">
              {manualUrl}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { void openInBrowser(manualUrl).then((err) => { if (err) setMessage("Couldn't open the browser: " + err); }); }}
                className="h-[30px] px-3 bg-card border border-border hover:border-cyan rounded-md text-12 text-text flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink size={12} /> Re-open in browser
              </button>
              <button
                type="button"
                onClick={() => copy(manualUrl)}
                className="h-[30px] px-3 bg-card border border-border hover:border-cyan rounded-md text-12 text-text flex items-center gap-1.5 transition-colors"
              >
                <Copy size={12} /> Copy URL
              </button>
            </div>
            <textarea
              value={pastedUrl}
              onChange={(e) => setPastedUrl(e.target.value)}
              rows={3}
              placeholder="Paste the redirect URL from your browser's address bar — it starts with your redirect URI and ends with code=…&state=…"
              className="px-3 py-2 bg-surface border border-border rounded-md font-mono text-12 text-text placeholder:text-subtext outline-none focus:border-cyan focus:ring-2 focus:ring-cyan transition-colors resize-y"
            />
            {message && (
              <p className="text-12 text-danger bg-danger/5 border border-danger/20 rounded-md px-3 py-2 break-all">{message}</p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleManualComplete}
                disabled={loading || !pastedUrl.trim()}
                className="h-[34px] px-4 bg-cyan hover:bg-cyan-hover rounded-md text-12 font-semibold text-white flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Check size={13} /> Complete Authorization
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="h-[34px] px-3 bg-card border border-border hover:border-danger rounded-md text-12 text-text flex items-center gap-1.5 transition-colors"
              >
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
        )}

        {flow === "waiting" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-12 text-text">
              <Loader2 size={14} className="animate-spin text-cyan" />
              <span>Waiting for authorization in your browser…</span>
            </div>
            {message && (
              <p className="text-12 text-cyan bg-cyan/5 border border-cyan/20 rounded-md px-3 py-2 break-all">{message}</p>
            )}
            {portNote && (
              <p className="text-12 text-amber-400 bg-amber-400/5 border border-amber-400/25 rounded-md px-3 py-2 leading-relaxed break-all">
                {portNote}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => { if (authUrlState) { void openInBrowser(authUrlState).then((err) => { if (err) setMessage("Couldn't open the browser: " + err); }); } }}
                className="h-[32px] px-3 bg-card border border-border hover:border-cyan rounded-md text-12 text-text flex items-center gap-1.5 transition-colors"
                title="Reopens the exact authorize URL (with state + PKCE params)"
              >
                <ExternalLink size={12} /> Re-open browser
              </button>
              <button
                type="button"
                onClick={() => authUrlState && copy(authUrlState)}
                className="h-[32px] px-3 bg-card border border-border hover:border-cyan rounded-md text-12 text-text flex items-center gap-1.5 transition-colors"
              >
                <Copy size={12} /> Copy authorize URL
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="h-[32px] px-3 bg-card border border-border hover:border-danger rounded-md text-12 text-text flex items-center gap-1.5 transition-colors"
              >
                <X size={12} /> Cancel
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-11 text-subtext">Browser can&apos;t reach the local callback (&quot;This site can&apos;t be reached&quot;)?</span>
              <button
                type="button"
                onClick={switchToManual}
                className="h-[30px] px-3 bg-card border border-border hover:border-cyan rounded-md text-12 text-text flex items-center gap-1.5 transition-colors"
              >
                <ClipboardPaste size={12} /> Authorize Manually
              </button>
              <button
                type="button"
                onClick={runDiagnostics}
                disabled={diagBusy}
                className="h-[30px] px-3 bg-card border border-border hover:border-cyan rounded-md text-12 text-text flex items-center gap-1.5 transition-colors disabled:opacity-50"
                title="Verify browser → loopback connectivity with a one-click test"
              >
                <Wrench size={12} /> {diagBusy ? "Running…" : "Run loopback diagnostics"}
              </button>
            </div>
            {diagFindings.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {diagFindings.map((f, i) => (
                  <div key={i} className={cn(
                    "text-11 px-3 py-2 rounded-md border break-all leading-relaxed",
                    f.severity === "critical" ? "text-danger bg-danger/5 border-danger/20" :
                    f.severity === "warning" ? "text-amber-400 bg-amber-400/5 border-amber-400/25" :
                    "text-subtext bg-surface border-border",
                  )}>
                    <span className="font-semibold">{f.severity === "critical" ? "🔴" : f.severity === "warning" ? "⚠️" : "ℹ️"} {f.label}</span>
                    <span className="block mt-0.5 text-subtext">{f.detail}</span>
                  </div>
                ))}
              </div>
            )}
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
              onClick={() => {
                const u = device.verificationUriComplete || device.verificationUri;
                if (u) { void openInBrowser(u).then((err) => { if (err) setMessage("Couldn't open the browser: " + err); }); }
              }}
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
          <div className="flex flex-col gap-2">
            <div className="text-12 text-danger bg-danger/5 border border-danger/20 rounded-md px-3 py-2 break-all">{message}</div>
            {diagFindings.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {diagFindings.map((f, i) => (
                  <div key={i} className={cn(
                    "text-11 px-3 py-2 rounded-md border break-all leading-relaxed",
                    f.severity === "critical" ? "text-danger bg-danger/5 border-danger/20" :
                    f.severity === "warning" ? "text-amber-400 bg-amber-400/5 border-amber-400/25" :
                    "text-subtext bg-surface border-border",
                  )}>
                    <span className="font-semibold">{f.severity === "critical" ? "🔴" : f.severity === "warning" ? "⚠️" : "ℹ️"} {f.label}</span>
                    <span className="block mt-0.5 text-subtext">{f.detail}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={runDiagnostics}
              disabled={diagBusy}
              className="self-start h-[30px] px-3 bg-card border border-border hover:border-cyan rounded-md text-12 text-text flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Verify browser → loopback connectivity with a one-click test"
            >
              <Wrench size={12} /> {diagBusy ? "Running…" : "Run loopback diagnostics"}
            </button>
          </div>
        )}
      </div>

      {hasToken && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Check size={14} className="text-success" />
            <span className="text-12 font-semibold text-text">Authenticated as {displayTokenType}</span>
          </div>
          <div className="flex items-center gap-4 text-11 mb-3">
            {expiryState === "no_expiry" ? (
              <span className="text-subtext">No expiry{isGithub ? " \u2022 GitHub tokens do not expire" : ""}</span>
            ) : expiryState === "expired" ? (
              <span className="text-danger">Expired \u2014 refresh or get a new token</span>
            ) : expiryState === "expiring_soon" ? (
              <span className="text-amber-400">{expiryLabel}</span>
            ) : (
              <span className="text-subtext">{expiryLabel}</span>
            )}
            {cfg.refreshToken && <span className="text-subtext">Refresh token available</span>}
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