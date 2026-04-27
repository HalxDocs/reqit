import { useRequestStore } from "../../../stores/useRequestStore";
import { cn } from "../../../lib/cn";
import type { AuthType } from "../../../types/request";

const TYPES: { id: AuthType; label: string }[] = [
  { id: "none", label: "None" },
  { id: "bearer", label: "Bearer Token" },
  { id: "basic", label: "Basic Auth" },
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

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setAuthType(t.id)}
            className={cn(
              "px-3 h-[28px] rounded-sm text-12 font-medium transition-colors",
              authType === t.id
                ? "bg-violet text-white"
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
            className="h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text placeholder:text-subtext outline-none focus:border-violet focus:ring-2 focus:ring-violet transition-colors"
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
              className="h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text outline-none focus:border-violet focus:ring-2 focus:ring-violet transition-colors"
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
              className="h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text outline-none focus:border-violet focus:ring-2 focus:ring-violet transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  );
}
