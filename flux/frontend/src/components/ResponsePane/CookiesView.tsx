import { useEffect, useState } from "react";
import { Cookie, Trash2, RefreshCw } from "lucide-react";
import { GetCookies, ClearCookiesForDomain, ClearAllCookies } from "../../../wailsjs/go/main/App";
import { useToastStore } from "../../stores/useToastStore";

interface CookieInfo {
  domain: string;
  name: string;
  value: string;
  expires: string;
  httpOnly: boolean;
  secure: boolean;
}

interface Props {
  /** Hostname of the current request — used to highlight matching cookies. */
  currentDomain?: string;
}

export function CookiesView({ currentDomain }: Props) {
  const toast = useToastStore((s) => s.push);
  const [cookies, setCookies] = useState<CookieInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const all = await GetCookies();
      setCookies((all ?? []) as CookieInfo[]);
    } catch { /* no workspace */ }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const clearDomain = async (domain: string) => {
    await ClearCookiesForDomain(domain);
    toast("success", `Cleared cookies for ${domain}`);
    void load();
  };

  const clearAll = async () => {
    await ClearAllCookies();
    toast("success", "All cookies cleared");
    void load();
  };

  // Group by domain
  const byDomain = cookies.reduce<Record<string, CookieInfo[]>>((acc, c) => {
    (acc[c.domain] ??= []).push(c);
    return acc;
  }, {});

  const domains = Object.keys(byDomain).sort((a, b) =>
    a === currentDomain ? -1 : b === currentDomain ? 1 : a.localeCompare(b),
  );

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border sticky top-0 bg-bg z-10">
        <Cookie size={12} className="text-subtext" />
        <span className="text-11 text-subtext flex-1">
          {cookies.length} cookie{cookies.length !== 1 ? "s" : ""} stored
        </span>
        <button
          type="button"
          onClick={load}
          className="p-1 text-subtext hover:text-text transition-colors"
          title="Refresh"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
        </button>
        {cookies.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 text-11 text-danger hover:text-danger/80 transition-colors"
          >
            <Trash2 size={11} />
            Clear all
          </button>
        )}
      </div>

      {cookies.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
          <Cookie size={24} className="text-subtext/30" />
          <div className="text-12 text-subtext">No cookies stored yet.</div>
          <div className="text-11 text-subtext/60 max-w-[280px] leading-relaxed">
            When a response sets cookies (e.g. after login), reqit stores them here and
            sends them automatically on every subsequent request to the same domain.
          </div>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {domains.map((domain) => (
            <div key={domain} className="px-4 py-3">
              {/* Domain header */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-11 font-semibold font-mono truncate flex-1 ${
                    domain === currentDomain ? "text-blue" : "text-subtext"
                  }`}
                >
                  {domain}
                  {domain === currentDomain && (
                    <span className="ml-2 text-10 font-normal text-blue/60 normal-case tracking-normal">
                      current
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => clearDomain(domain)}
                  className="text-10 text-subtext hover:text-danger transition-colors flex items-center gap-1 shrink-0"
                >
                  <Trash2 size={10} />
                  Clear
                </button>
              </div>

              {/* Cookie rows */}
              <div className="flex flex-col gap-1">
                {byDomain[domain].map((c) => (
                  <div
                    key={c.name}
                    className="flex items-start gap-2 p-2 rounded-lg bg-card border border-border"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-12 font-semibold text-text font-mono">{c.name}</span>
                        {c.httpOnly && (
                          <span className="text-10 bg-subtext/10 text-subtext px-1.5 rounded">HttpOnly</span>
                        )}
                        {c.secure && (
                          <span className="text-10 bg-blue/10 text-blue px-1.5 rounded">Secure</span>
                        )}
                      </div>
                      <div className="text-11 text-subtext font-mono mt-0.5 break-all">
                        {c.value.length > 60 ? c.value.slice(0, 60) + "…" : c.value}
                      </div>
                      {c.expires && (
                        <div className="text-10 text-subtext/60 mt-0.5">
                          Expires: {new Date(c.expires).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
