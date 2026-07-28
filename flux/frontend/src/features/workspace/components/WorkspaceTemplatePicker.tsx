import { useState } from "react";
import { LayoutTemplate, Plus, X } from "lucide-react";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";
import { buildPayloadLiteral } from "@/features/request/lib/buildPayload";
import { toast } from "@/app/stores/useToastStore";

interface Template {
  id: string;
  name: string;
  description: string;
  collections: { name: string; description: string; requests: { name: string; method: string; url: string }[] }[];
}

const TEMPLATES: Template[] = [
  {
    id: "rest-api",
    name: "RESTful API",
    description: "Real JSONPlaceholder CRUD endpoints",
    collections: [
      {
        name: "JSONPlaceholder",
        description: "Free fake REST API for testing (by typicode)",
        requests: [
          { name: "List Posts", method: "GET", url: "https://jsonplaceholder.typicode.com/posts" },
          { name: "Get Post", method: "GET", url: "https://jsonplaceholder.typicode.com/posts/1" },
          { name: "Create Post", method: "POST", url: "https://jsonplaceholder.typicode.com/posts" },
          { name: "List Comments", method: "GET", url: "https://jsonplaceholder.typicode.com/posts/1/comments" },
          { name: "List Users", method: "GET", url: "https://jsonplaceholder.typicode.com/users" },
        ],
      },
    ],
  },
  {
    id: "websocket-demo",
    name: "WebSocket Live Demo",
    description: "Pre-configured WebSocket echo + real-time feed",
    collections: [
      {
        name: "WebSocket Playground",
        description: "Connect to free echo servers and real streams",
        requests: [
          { name: "Echo Server", method: "GET", url: "wss://echo.websocket.org" },
          { name: "Real-time Feed", method: "GET", url: "wss://ws.postman-echo.com/raw" },
        ],
      },
    ],
  },
  {
    id: "graphql",
    name: "GraphQL API",
    description: "Real public GraphQL endpoints",
    collections: [
      {
        name: "GraphQL Playground",
        description: "Public GraphQL APIs for testing",
        requests: [
          { name: "GitHub GraphQL", method: "POST", url: "https://api.github.com/graphql" },
          { name: "Countries API", method: "POST", url: "https://countries.trevorblades.com/graphql" },
          { name: "Rick & Morty API", method: "POST", url: "https://rickandmortyapi.com/graphql" },
        ],
      },
    ],
  },
  {
    id: "auth-flow",
    name: "OAuth2 & Auth Flow",
    description: "Real authentication endpoint patterns",
    collections: [
      {
        name: "Authentication",
        description: "Auth0 and real OAuth2 flows",
        requests: [
          { name: "Auth0 Token", method: "POST", url: "https://dev-xxx.us.auth0.com/oauth/token" },
          { name: "GitHub User", method: "GET", url: "https://api.github.com/user" },
          { name: "JWT Decode Test", method: "GET", url: "https://httpbin.org/bearer" },
        ],
      },
    ],
  },
  {
    id: "httpbin",
    name: "HTTPBin Playground",
    description: "Every HTTP method and feature, live",
    collections: [
      {
        name: "HTTPBin",
        description: "Request/response inspection service (by kong)",
        requests: [
          { name: "GET", method: "GET", url: "https://httpbin.org/get" },
          { name: "POST JSON", method: "POST", url: "https://httpbin.org/post" },
          { name: "PUT", method: "PUT", url: "https://httpbin.org/put" },
          { name: "PATCH", method: "PATCH", url: "https://httpbin.org/patch" },
          { name: "DELETE", method: "DELETE", url: "https://httpbin.org/delete" },
          { name: "Status 200", method: "GET", url: "https://httpbin.org/status/200" },
          { name: "Status 404", method: "GET", url: "https://httpbin.org/status/404" },
          { name: "Delay 2s", method: "GET", url: "https://httpbin.org/delay/2" },
          { name: "Stream 10 lines", method: "GET", url: "https://httpbin.org/stream/10" },
          { name: "Image PNG", method: "GET", url: "https://httpbin.org/image/png" },
          { name: "Basic Auth", method: "GET", url: "https://httpbin.org/basic-auth/user/pass" },
          { name: "Bearer Auth", method: "GET", url: "https://httpbin.org/bearer" },
          { name: "Cookies", method: "GET", url: "https://httpbin.org/cookies" },
          { name: "Response Headers", method: "GET", url: "https://httpbin.org/response-headers?key=val" },
        ],
      },
    ],
  },
  {
    id: "webhook",
    name: "Webhook & SSE Demo",
    description: "SSE streams and webhook test endpoints",
    collections: [
      {
        name: "Real-time Streams",
        description: "Server-Sent Events and webhook simulators",
        requests: [
          { name: "Coinbase SSE Feed", method: "GET", url: "https://ws-feed.exchange.coinbase.com" },
          { name: "Webhook Test", method: "POST", url: "https://webhook.site/token" },
        ],
      },
    ],
  },
];

export function WorkspaceTemplatePicker() {
  const createCollection = useCollectionStore((s: any) => s.createCollection);
  const addRequest = useCollectionStore((s: any) => s.addRequest);
  const [open, setOpen] = useState(false);

  const applyTemplate = async (tpl: Template) => {
    try {
      for (const col of tpl.collections) {
        const coll = await createCollection(col.name);
        for (const req of col.requests) {
          const payload = buildPayloadLiteral({
            method: req.method as any,
            url: req.url,
            params: [],
            headers: [{ id: "h1", key: "Content-Type", value: "application/json", enabled: true }],
            bodyType: "none",
            bodyRaw: "",
            bodyForm: [],
            authType: "none",
            authToken: "",
            authUser: "",
            authPass: "",
            authUsername: "",
            authPassword: "",
            authKeyName: "",
            authKeyValue: "",
            authKeyIn: "header",
            preSetVars: [],
            extractRules: [],
            graphqlQuery: "",
            graphqlVariables: "",
            preScript: "",
            postScript: "",
            notes: "",
            timeout: 0,
          });
          await addRequest(coll.id, req.name, payload);
        }
      }
      toast.success(`Created workspace from template "${tpl.name}"`);
      setOpen(false);
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-11 text-subtext hover:text-text transition-colors"
        title="Create from template"
      >
        <LayoutTemplate size={11} /> Templates
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl p-3 min-w-[280px]">
            <div className="text-11 font-semibold text-text mb-2">Workspace Templates</div>
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="flex flex-col items-start w-full gap-0.5 px-2 py-1.5 rounded-lg hover:bg-cardHover transition-colors text-left mb-1"
              >
                <span className="text-12 font-medium text-text">{tpl.name}</span>
                <span className="text-10 text-subtext">{tpl.description}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
