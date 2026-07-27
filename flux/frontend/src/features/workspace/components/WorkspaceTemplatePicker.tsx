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
    description: "Standard REST API collection with CRUD endpoints",
    collections: [
      {
        name: "Users API",
        description: "User management endpoints",
        requests: [
          { name: "List Users", method: "GET", url: "https://api.example.com/users" },
          { name: "Get User", method: "GET", url: "https://api.example.com/users/{{userId}}" },
          { name: "Create User", method: "POST", url: "https://api.example.com/users" },
          { name: "Update User", method: "PUT", url: "https://api.example.com/users/{{userId}}" },
          { name: "Delete User", method: "DELETE", url: "https://api.example.com/users/{{userId}}" },
        ],
      },
    ],
  },
  {
    id: "graphql",
    name: "GraphQL API",
    description: "GraphQL queries and mutations collection",
    collections: [
      {
        name: "GraphQL Playground",
        description: "GraphQL endpoint with sample queries",
        requests: [
          { name: "Get Users", method: "POST", url: "https://api.example.com/graphql" },
          { name: "Create Record", method: "POST", url: "https://api.example.com/graphql" },
        ],
      },
    ],
  },
  {
    id: "auth-flow",
    name: "OAuth2 Auth Flow",
    description: "Collection demonstrating OAuth2 authentication flow",
    collections: [
      {
        name: "Authentication",
        description: "OAuth2 token acquisition and API access",
        requests: [
          { name: "Get Access Token", method: "POST", url: "https://auth.example.com/oauth/token" },
          { name: "Get Me", method: "GET", url: "https://api.example.com/me" },
          { name: "Refresh Token", method: "POST", url: "https://auth.example.com/oauth/token" },
        ],
      },
    ],
  },
  {
    id: "webhook",
    name: "Webhook Receiver",
    description: "Collection for testing webhook endpoints",
    collections: [
      {
        name: "Webhooks",
        description: "Webhook event simulations",
        requests: [
          { name: "Send Ping Event", method: "POST", url: "https://hooks.example.com/ping" },
          { name: "Send Created Event", method: "POST", url: "https://hooks.example.com/created" },
          { name: "Send Deleted Event", method: "POST", url: "https://hooks.example.com/deleted" },
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
