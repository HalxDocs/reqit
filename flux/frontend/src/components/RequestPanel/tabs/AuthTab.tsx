import { useRequestStore } from "../../../stores/useRequestStore";
import { cn } from "../../../lib/cn";
import type { ApiKeyIn, AuthType } from "../../../types/request";

const TYPES: { id: AuthType; label: string }[] = [
  { id: "none", label: "None" },
  { id: "bearer", label: "Bearer Token" },
  { id: "basic", label: "Basic Auth" },
  { id: "apikey", label: "API Key" },
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
                ? "bg-blue text-white"
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
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">
            Token
          </label>
          <input
            type="text"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            spellCheck={false}
            autoComplete="off"
            className="h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text placeholder:text-subtext outline-none focus:border-blue focus:ring-2 focus:ring-blue transition-colors"
          />
          <p className="text-11 text-subtext mt-1">
            Sent as: <span className="font-mono">Authorization: Bearer ...</span>
          </p>
        </div>
      )}

      {authType === "basic" && (
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-11 text-subtext font-semibold uppercase tracking-wider">
              Username
            </label>
            <input
              type="text"
              value={authUser}
              onChange={(e) => setAuthUser(e.target.value)}
              autoComplete="off"
              className="h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text outline-none focus:border-blue focus:ring-2 focus:ring-blue transition-colors"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-11 text-subtext font-semibold uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={authPass}
              onChange={(e) => setAuthPass(e.target.value)}
              autoComplete="off"
              className="h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text outline-none focus:border-blue focus:ring-2 focus:ring-blue transition-colors"
            />
          </div>
        </div>
      )}

      {authType === "apikey" && (
        <div className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-11 text-subtext font-semibold uppercase tracking-wider">
              Add to
            </label>
            <div className="flex gap-2">
              {API_KEY_IN.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAuthKeyIn(opt.id)}
                  className={cn(
                    "px-3 h-[28px] rounded-sm text-12 font-medium transition-colors",
                    authKeyIn === opt.id
                      ? "bg-blue text-white"
                      : "bg-card text-subtext hover:text-text hover:bg-cardHover",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-11 text-subtext font-semibold uppercase tracking-wider">
                Key
              </label>
              <input
                type="text"
                value={authKeyName}
                onChange={(e) => setAuthKeyName(e.target.value)}
                placeholder="X-API-Key"
                spellCheck={false}
                autoComplete="off"
                className="h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text outline-none focus:border-blue focus:ring-2 focus:ring-blue transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-11 text-subtext font-semibold uppercase tracking-wider">
                Value
              </label>
              <input
                type="text"
                value={authKeyValue}
                onChange={(e) => setAuthKeyValue(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                className="h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text outline-none focus:border-blue focus:ring-2 focus:ring-blue transition-colors"
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
    </div>
  );
}
