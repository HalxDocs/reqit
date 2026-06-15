import { useCallback, useEffect, useRef, useState } from "react";
import { useUIStore } from "@/app/stores/useUIStore";
import { GraphqlEditor } from "@/shared/components/GraphqlEditor";
import { GraphQLExecute } from "../../../../wailsjs/go/main/App";
import { Terminal, Play, Square, Loader2, ChevronDown, ChevronRight, Book } from "lucide-react";
import { cn } from "@/shared/lib/cn";

type SubTab = "query" | "subscription";

interface GQLResponse {
  data: unknown;
  errors?: { message: string; locations?: { line: number; column: number }[] }[];
  statusCode: number;
  timingMs: number;
}

interface SubMessage {
  type: string;
  id: string;
  payload: unknown;
}

export function GraphQLPanel() {
  const setView = useUIStore((s) => s.setView);
  const [tab, setTab] = useState<SubTab>("query");
  const [url, setUrl] = useState("https://");
  const [query, setQuery] = useState("# GraphQL query\n{\n  __typename\n}");
  const [variables, setVariables] = useState("{\n  \n}");
  const [headersText, setHeadersText] = useState("{}");
  const [response, setResponse] = useState<GQLResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [subMsg, setSubMsg] = useState<SubMessage[]>([]);
  const [subActive, setSubActive] = useState(false);
  const [schemaVisible, setSchemaVisible] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const parseHeaders = useCallback((): Record<string, string> => {
    try {
      return JSON.parse(headersText);
    } catch {
      return {};
    }
  }, [headersText]);

  const executeQuery = async () => {
    setLoading(true);
    setError("");
    setResponse(null);
    try {
      const raw = await GraphQLExecute(JSON.stringify({
        url,
        query,
        variables,
        headers: parseHeaders(),
      }));
      const parsed = JSON.parse(raw);
      setResponse({
        data: parsed.data,
        errors: parsed.errors,
        statusCode: parsed.statusCode,
        timingMs: parsed.timingMs,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const startSubscription = () => {
    if (subActive) return;
    setSubMsg([]);
    setError("");

    const wsUrl = url.replace(/^http/, "ws");
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl, "graphql-transport-ws");
    } catch (e) {
      setError(`WebSocket connection failed: ${e}`);
      return;
    }

    ws.onopen = () => {
      // Connection init
      ws.send(JSON.stringify({ type: "connection_init" }));
      // Subscribe
      const subPayload: Record<string, unknown> = { query };
      if (variables) {
        try { subPayload.variables = JSON.parse(variables); } catch {}
      }
      ws.send(JSON.stringify({ type: "subscribe", id: "1", payload: subPayload }));
      setSubActive(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg: SubMessage = JSON.parse(event.data);
        setSubMsg((prev) => [...prev, msg]);
        if (msg.type === "complete" || msg.type === "error") {
          ws.close();
          setSubActive(false);
        }
      } catch {}
    };

    ws.onerror = () => {
      setError("WebSocket error");
      setSubActive(false);
    };

    ws.onclose = () => {
      setSubActive(false);
    };

    wsRef.current = ws;
  };

  const stopSubscription = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "complete", id: "1" }));
      wsRef.current.close();
      wsRef.current = null;
      setSubActive(false);
    }
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg">
      <header className="h-[48px] flex items-center gap-3 px-4 border-b border-border shrink-0">
        <button onClick={() => setView("http")} className="text-subtext hover:text-text text-13 transition-colors">&larr; Back</button>
        <h1 className="text-14 font-semibold text-text">GraphQL Client</h1>
      </header>

      <div className="flex gap-1 px-4 py-2 border-b border-border shrink-0">
        {([{ key: "query" as SubTab, label: "Query / Mutation" }, { key: "subscription" as SubTab, label: "Subscription" }]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-12 rounded-md transition-colors ${tab === t.key ? "bg-cyan/10 text-cyan font-semibold" : "text-subtext hover:text-text hover:bg-cardHover"}`}
          >{t.label}</button>
        ))}
        <button onClick={() => setSchemaVisible(!schemaVisible)}
          className="ml-auto px-3 py-1.5 text-12 rounded-md text-subtext hover:text-text hover:bg-cardHover transition-colors flex items-center gap-1"
        >
          <Book size={13} />
          Schema
          {schemaVisible ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          {/* URL bar */}
          <div className="flex items-center gap-2 p-2 border-b border-border shrink-0">
            <input value={url} onChange={(e) => setUrl(e.target.value)}
              className="flex-1 bg-surface border border-border rounded-md px-3 py-1.5 text-12 text-text outline-none focus:border-cyan transition-colors"
              placeholder="GraphQL endpoint URL"
            />
            {tab === "query" ? (
              <button onClick={executeQuery} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan text-bg text-12 font-semibold hover:bg-cyan/90 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                Execute
              </button>
            ) : (
              subActive ? (
                <button onClick={stopSubscription}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-danger text-bg text-12 font-semibold hover:bg-danger/90 transition-colors"
                ><Square size={13} /> Stop</button>
              ) : (
                <button onClick={startSubscription}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan text-bg text-12 font-semibold hover:bg-cyan/90 transition-colors"
                ><Terminal size={13} /> Subscribe</button>
              )
            )}
          </div>

          {/* Headers */}
          <div className="px-2 py-1.5 border-b border-border shrink-0">
            <details className="group">
              <summary className="text-11 text-subtext cursor-pointer hover:text-text transition-colors select-none">Headers</summary>
              <textarea value={headersText} onChange={(e) => setHeadersText(e.target.value)}
                className="w-full mt-1 bg-surface border border-border rounded-md px-3 py-1.5 text-12 text-text outline-none focus:border-cyan transition-colors font-mono resize-none"
                rows={3}
                placeholder='{"Authorization": "Bearer token"}'
              />
            </details>
          </div>

          <div className="flex-1 flex min-h-0">
            {/* Query editor */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-border">
              <div className="flex items-center justify-between px-3 py-1 border-b border-border shrink-0">
                <span className="text-11 text-subtext font-semibold uppercase tracking-wider">Query</span>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <GraphqlEditor value={query} onChange={setQuery} />
              </div>
              <div className="flex items-center justify-between px-3 py-1 border-t border-border shrink-0">
                <span className="text-11 text-subtext font-semibold uppercase tracking-wider">Variables</span>
              </div>
              <div className="h-[120px] shrink-0">
                <textarea value={variables} onChange={(e) => setVariables(e.target.value)}
                  className="w-full h-full bg-surface border-0 px-3 py-1.5 text-12 text-text outline-none font-mono resize-none"
                  placeholder='{"key": "value"}'
                />
              </div>
            </div>

            {/* Response panel */}
            <div className="w-1/2 flex flex-col min-w-0">
              <div className="flex items-center justify-between px-3 py-1 border-b border-border shrink-0">
                <span className="text-11 text-subtext font-semibold uppercase tracking-wider">
                  {tab === "subscription" ? "Live Stream" : "Response"}
                </span>
                {response && (
                  <span className="text-11 text-subtext">
                    {response.statusCode > 0 && <span className={cn("mr-2", response.statusCode < 400 ? "text-green-400" : "text-danger")}>{response.statusCode}</span>}
                    {response.timingMs > 0 && <span>{response.timingMs}ms</span>}
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {error && (
                  <div className="p-3 text-12 text-danger">{error}</div>
                )}
                {response && tab === "query" && (
                  <pre className="text-12 p-3 font-mono whitespace-pre-wrap break-all text-text">
                    <code>{JSON.stringify(response.data ?? response.errors ?? "", null, 2)}</code>
                  </pre>
                )}
                {tab === "subscription" && (
                  <div className="space-y-1 p-2">
                    {subMsg.length === 0 && !subActive && <p className="text-12 text-subtext px-2">Press Subscribe to start listening.</p>}
                    {subMsg.map((m, i) => (
                      <div key={i} className="rounded border border-border p-2 bg-surface">
                        <div className="text-11 text-cyan mb-1">{m.type}{m.id ? ` (id: ${m.id})` : ""}</div>
                        <pre className="text-11 font-mono whitespace-pre-wrap text-text"><code>{JSON.stringify(m.payload, null, 2)}</code></pre>
                      </div>
                    ))}
                    {subActive && <div className="flex items-center gap-2 px-2 text-12 text-cyan"><Loader2 size={12} className="animate-spin" /> Listening...</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Schema sidebar */}
        {schemaVisible && (
          <div className="w-[280px] shrink-0 border-l border-border overflow-y-auto p-3">
            <GraphQLSchemaFetcher url={url} headers={parseHeaders()} />
          </div>
        )}
      </div>
    </div>
  );
}

// Simple schema fetcher and display
function GraphQLSchemaFetcher({ url, headers }: { url: string; headers: Record<string, string> }) {
  const [schema, setSchema] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url || url === "https://") return;
    setLoading(true);
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        query: `
          query IntrospectionQuery {
            __schema {
              queryType { name }
              mutationType { name }
              subscriptionType { name }
              types {
                kind
                name
                description
                fields(includeDeprecated: true) {
                  name
                  description
                  type { kind name ofType { kind name ofType { kind name } } }
                }
              }
            }
          }
        `,
      }),
    })
      .then((r) => r.json())
      .then((d) => setSchema(d))
      .catch(() => setSchema(null))
      .finally(() => setLoading(false));
  }, [url]);

  if (loading) return <div className="text-12 text-subtext">Loading schema...</div>;
  if (!schema) return <div className="text-12 text-subtext">No schema loaded. Execute a query first.</div>;

  const s = (schema as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const types = (s?.__schema as Record<string, unknown>)?.types as Array<Record<string, unknown>> | undefined;
  if (!types) return <div className="text-12 text-subtext">Could not load schema.</div>;

  return (
    <div className="space-y-2">
      <h3 className="text-12 font-semibold text-text mb-2">Schema Types</h3>
      {types.filter((t: Record<string, unknown>) => t.kind === "OBJECT" && !String(t.name).startsWith("__")).slice(0, 30).map((t: Record<string, unknown>) => (
        <details key={String(t.name)} className="group">
          <summary className="text-12 text-cyan cursor-pointer hover:text-cyan/80 transition-colors">{String(t.name)}</summary>
          <div className="pl-3 mt-1 space-y-1">
            {(t.fields as Array<Record<string, unknown>>)?.slice(0, 10).map((f: Record<string, unknown>) => (
              <div key={String(f.name)} className="text-11 text-subtext">
                <span className="text-text">{String(f.name)}</span>
                <span className="text-subtext/50">: {String((f.type as Record<string, unknown>)?.name || (f.type as Record<string, unknown>)?.kind || "?")}</span>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
