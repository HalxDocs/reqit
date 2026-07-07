import { useState } from "react";
import { ChevronDown, ChevronRight, Shield, Upload, X } from "lucide-react";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { cn } from "@/shared/lib/cn";
import { OAuth2Flow } from "./OAuth2Flow";
import type { ApiKeyIn, AuthType } from "@/features/request/types/request";

const TYPES: { id: AuthType; label: string }[] = [
  { id: "none", label: "None" },
  { id: "bearer", label: "Bearer Token" },
  { id: "token", label: "Token Auth" },
  { id: "basic", label: "Basic Auth" },
  { id: "digest", label: "Digest Auth" },
  { id: "ntlm", label: "NTLM Auth" },
  { id: "apikey", label: "API Key" },
  { id: "oauth2", label: "OAuth 2.0" },
];

const API_KEY_IN: { id: ApiKeyIn; label: string }[] = [
  { id: "header", label: "Header" },
  { id: "query", label: "Query param" },
];

export function AuthTab() {
  const authType = useRequestStore((s) => s.authType);
  const setAuthType = useRequestStore((s) => s.setAuthType);
  const authToken = useRequestStore((s) => s.authToken);
  const setAuthToken = useRequestStore((s) => s.setAuthToken);
  const authUser = useRequestStore((s) => s.authUser);
  const setAuthUser = useRequestStore((s) => s.setAuthUser);
  const authPass = useRequestStore((s) => s.authPass);
  const setAuthPass = useRequestStore((s) => s.setAuthPass);

  const authUsername = useRequestStore((s) => s.authUsername);
  const setAuthUsername = useRequestStore((s) => s.setAuthUsername);
  const authPassword = useRequestStore((s) => s.authPassword);
  const setAuthPassword = useRequestStore((s) => s.setAuthPassword);

  const authKeyName = useRequestStore((s) => s.authKeyName);
  const setAuthKeyName = useRequestStore((s) => s.setAuthKeyName);
  const authKeyValue = useRequestStore((s) => s.authKeyValue);
  const setAuthKeyValue = useRequestStore((s) => s.setAuthKeyValue);
  const authKeyIn = useRequestStore((s) => s.authKeyIn);
  const setAuthKeyIn = useRequestStore((s) => s.setAuthKeyIn);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border flex-wrap">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setAuthType(t.id)}
            className={cn(
              "px-3 h-[28px] rounded-sm text-12 font-medium transition-colors",
              authType === t.id
                ? "bg-cyan text-white"
                : "bg-card text-subtext hover:text-text hover:bg-cardHover",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {authType === "none" && (
        <div className="px-4 py-6 text-12 text-subtext">
          No authentication will be sent.
        </div>
      )}

      {authType === "bearer" && (
        <div className="p-4 flex flex-col gap-2">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Token</label>
          <input
            type="text" value={authToken} onChange={(e) => setAuthToken(e.target.value)}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            spellCheck={false} autoComplete="off"
            className="h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text placeholder:text-subtext outline-none focus:border-cyan focus:ring-2 focus:ring-cyan transition-colors"
          />
          <p className="text-11 text-subtext mt-1">
            Sent as: <span className="font-mono">Authorization: Bearer ...</span>
          </p>
        </div>
      )}

      {authType === "token" && (
        <div className="p-4 flex flex-col gap-2">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Token</label>
          <input
            type="text" value={authToken} onChange={(e) => setAuthToken(e.target.value)}
            placeholder="your-api-token"
            spellCheck={false} autoComplete="off"
            className="h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text placeholder:text-subtext outline-none focus:border-cyan focus:ring-2 focus:ring-cyan transition-colors"
          />
          <p className="text-11 text-subtext mt-1">
            Sent as: <span className="font-mono">Authorization: Token ...</span>
          </p>
        </div>
      )}

      {authType === "basic" && (
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Username</label>
            <input type="text" value={authUser} onChange={(e) => setAuthUser(e.target.value)}
              autoComplete="off"
              className="h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text outline-none focus:border-cyan focus:ring-2 focus:ring-cyan transition-colors"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Password</label>
            <input type="password" value={authPass} onChange={(e) => setAuthPass(e.target.value)}
              autoComplete="off"
              className="h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text outline-none focus:border-cyan focus:ring-2 focus:ring-cyan transition-colors"
            />
          </div>
        </div>
      )}

      {(authType === "digest" || authType === "ntlm") && (
        <div className="p-4 flex flex-col gap-3">
          <p className="text-11 text-subtext mb-1">
            {authType === "digest" ? "Digest Access Authentication" : "NTLM Authentication"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Username</label>
              <input type="text" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)}
                autoComplete="off"
                className="h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text outline-none focus:border-cyan focus:ring-2 focus:ring-cyan transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Password</label>
              <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)}
                autoComplete="off"
                className="h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text outline-none focus:border-cyan focus:ring-2 focus:ring-cyan transition-colors"
              />
            </div>
          </div>
          <p className="text-11 text-subtext mt-1">
            Uses challenge-response handshake. The server must support {authType === "digest" ? "Digest" : "NTLM"} auth.
          </p>
        </div>
      )}

      {authType === "apikey" && (
        <div className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Add to</label>
            <div className="flex gap-2">
              {API_KEY_IN.map((opt) => (
                <button key={opt.id} type="button" onClick={() => setAuthKeyIn(opt.id)}
                  className={cn(
                    "px-3 h-[28px] rounded-sm text-12 font-medium transition-colors",
                    authKeyIn === opt.id ? "bg-cyan text-white" : "bg-card text-subtext hover:text-text hover:bg-cardHover",
                  )}
                >{opt.label}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Key</label>
              <input type="text" value={authKeyName} onChange={(e) => setAuthKeyName(e.target.value)}
                placeholder="X-API-Key" spellCheck={false} autoComplete="off"
                className="h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text outline-none focus:border-cyan focus:ring-2 focus:ring-cyan transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Value</label>
              <input type="text" value={authKeyValue} onChange={(e) => setAuthKeyValue(e.target.value)}
                spellCheck={false} autoComplete="off"
                className="h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text outline-none focus:border-cyan focus:ring-2 focus:ring-cyan transition-colors"
              />
            </div>
          </div>
          <p className="text-11 text-subtext">
            {authKeyIn === "header"
              ? <>Sent as a request header: <span className="font-mono">{authKeyName || "X-API-Key"}: ...</span></>
              : <>Appended to the URL: <span className="font-mono">?{authKeyName || "api_key"}=...</span></>
            }
          </p>
        </div>
      )}

      {authType === "oauth2" && <OAuth2Flow />}

      {/* mTLS Client Certificate */}
      <MTLSection />
    </div>
  );
}

function MTLSection() {
  const clientCert = useRequestStore((s) => s.clientCert);
  const clientKey = useRequestStore((s) => s.clientKey);
  const setClientCert = useRequestStore((s) => s.setClientCert);
  const setClientKey = useRequestStore((s) => s.setClientKey);
  const [open, setOpen] = useState(!!clientCert);

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-11 text-subtext hover:text-text transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Shield size={12} />
        <span className="font-semibold">Client Certificate (mTLS)</span>
        {clientCert && <span className="ml-auto text-10 text-green-500">Configured</span>}
      </button>
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          <label className="text-10 text-subtext uppercase tracking-wider font-semibold">Certificate (PEM)</label>
          <div className="relative">
            <textarea
              value={clientCert ?? ""}
              onChange={(e) => setClientCert(e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              spellCheck={false}
              rows={4}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded-md text-11 font-mono text-text outline-none focus:border-cyan transition-colors placeholder:text-tertiary resize-none"
            />
            {clientCert && (
              <button type="button" onClick={() => setClientCert("")}
                className="absolute top-1 right-1 text-subtext hover:text-danger transition-colors p-0.5">
                <X size={10} />
              </button>
            )}
          </div>
          <label className="text-10 text-subtext uppercase tracking-wider font-semibold">Private Key (PEM)</label>
          <div className="relative">
            <textarea
              value={clientKey ?? ""}
              onChange={(e) => setClientKey(e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
              spellCheck={false}
              rows={4}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded-md text-11 font-mono text-text outline-none focus:border-cyan transition-colors placeholder:text-tertiary resize-none"
            />
            {clientKey && (
              <button type="button" onClick={() => setClientKey("")}
                className="absolute top-1 right-1 text-subtext hover:text-danger transition-colors p-0.5">
                <X size={10} />
              </button>
            )}
          </div>
          <p className="text-10 text-subtext">Sent during TLS handshake when the server requests a client certificate.</p>
        </div>
      )}
    </div>
  );
}
