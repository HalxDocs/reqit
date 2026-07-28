import { useState } from "react";
import { LayoutTemplate, Plus, X } from "lucide-react";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";
import { buildPayloadLiteral } from "@/features/request/lib/buildPayload";
import { toast } from "@/app/stores/useToastStore";

interface TemplateRequest {
  name: string;
  method: string;
  url: string;
  bodyType?: string;
  bodyRaw?: string;
  graphqlQuery?: string;
  graphqlVariables?: string;
  headers?: { key: string; value: string }[];
}

interface Template {
  id: string;
  name: string;
  description: string;
  collections: { name: string; description: string; requests: TemplateRequest[] }[];
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
          { name: "Create Post", method: "POST", url: "https://jsonplaceholder.typicode.com/posts", bodyType: "json", bodyRaw: JSON.stringify({ title: "foo", body: "bar", userId: 1 }, null, 2) },
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
    description: "Real public GraphQL endpoints with live queries",
    collections: [
      {
        name: "Countries GraphQL",
        description: "Query real country data via countries.trevorblades.com",
        requests: [
          {
            name: "All Countries",
            method: "POST",
            url: "https://countries.trevorblades.com/graphql",
            bodyType: "graphql",
            graphqlQuery: "# Get all countries and their continents\n{\n  countries {\n    name\n    capital\n    currency\n    continent {\n      name\n    }\n  }\n}",
            graphqlVariables: "{}",
            headers: [{ key: "Content-Type", value: "application/json" }],
          },
          {
            name: "Country by Code",
            method: "POST",
            url: "https://countries.trevorblades.com/graphql",
            bodyType: "graphql",
            graphqlQuery: "# Get a single country by its ISO code\nquery Country($code: ID!) {\n  country(code: $code) {\n    name\n    native\n    phone\n    capital\n    currency\n    languages {\n      name\n    }\n    states {\n      name\n    }\n  }\n}",
            graphqlVariables: JSON.stringify({ code: "US" }, null, 2),
            headers: [{ key: "Content-Type", value: "application/json" }],
          },
        ],
      },
      {
        name: "Rick & Morty GraphQL",
        description: "Query characters from Rick and Morty API",
        requests: [
          {
            name: "List Characters",
            method: "POST",
            url: "https://rickandmortyapi.com/graphql",
            bodyType: "graphql",
            graphqlQuery: "# Get first 20 characters\n{\n  characters(page: 1) {\n    results {\n      name\n      status\n      species\n      gender\n      origin { name }\n      location { name }\n      image\n    }\n  }\n}",
            graphqlVariables: "{}",
            headers: [{ key: "Content-Type", value: "application/json" }],
          },
          {
            name: "Filter by Status",
            method: "POST",
            url: "https://rickandmortyapi.com/graphql",
            bodyType: "graphql",
            graphqlQuery: "# Filter characters by status and species\nquery FilterChars($status: String, $species: String) {\n  characters(filter: { status: $status, species: $species }) {\n    results {\n      name\n      status\n      species\n      type\n    }\n  }\n}",
            graphqlVariables: JSON.stringify({ status: "alive", species: "Human" }, null, 2),
            headers: [{ key: "Content-Type", value: "application/json" }],
          },
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
        description: "GitHub API and auth test endpoints",
        requests: [
          { name: "GitHub User", method: "GET", url: "https://api.github.com/user", headers: [{ key: "Authorization", value: "Bearer YOUR_TOKEN_HERE" }] },
          { name: "Bearer Test", method: "GET", url: "https://httpbin.org/bearer", headers: [{ key: "Authorization", value: "Bearer test123" }] },
          { name: "Basic Auth", method: "GET", url: "https://httpbin.org/basic-auth/user/pass" },
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
          { name: "POST JSON", method: "POST", url: "https://httpbin.org/post", bodyType: "json", bodyRaw: JSON.stringify({ key: "value", hello: "world" }, null, 2) },
          { name: "PUT", method: "PUT", url: "https://httpbin.org/put" },
          { name: "PATCH", method: "PATCH", url: "https://httpbin.org/patch" },
          { name: "DELETE", method: "DELETE", url: "https://httpbin.org/delete" },
          { name: "Status 200", method: "GET", url: "https://httpbin.org/status/200" },
          { name: "Status 404", method: "GET", url: "https://httpbin.org/status/404" },
          { name: "Delay 2s", method: "GET", url: "https://httpbin.org/delay/2" },
          { name: "Stream 10 lines", method: "GET", url: "https://httpbin.org/stream/10" },
          { name: "Image PNG", method: "GET", url: "https://httpbin.org/image/png" },
          { name: "Cookies", method: "GET", url: "https://httpbin.org/cookies" },
          { name: "Response Headers", method: "GET", url: "https://httpbin.org/response-headers?key=val" },
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
          const hs = (req.headers ?? [{ key: "Content-Type", value: "application/json" }]).map((h, i) => ({
            id: `h${i}`,
            key: h.key,
            value: h.value,
            enabled: true,
          }));
          const payload = buildPayloadLiteral({
            method: req.method as any,
            url: req.url,
            params: [],
            headers: hs,
            bodyType: (req.bodyType as any) ?? "none",
            bodyRaw: req.bodyRaw ?? "",
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
            graphqlQuery: req.graphqlQuery ?? "",
            graphqlVariables: req.graphqlVariables ?? "",
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
