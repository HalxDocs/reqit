import { useCallback, useEffect, useState } from "react";
import { FileCode2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { IconButton } from "@/shared/components/IconButton";
import { toast } from "@/app/stores/useToastStore";
import { cn } from "@/shared/lib/cn";
import { CreateSpec, AddSpecEndpoint, GetSpecEndpoints, RemoveSpecEndpoint } from "../../../../wailsjs/go/main/App";

interface Endpoint {
  method: string;
  path: string;
  summary: string;
  description?: string;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export function SpecEditor() {
  const [specPath, setSpecPath] = useState<string | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!specPath) return;
    GetSpecEndpoints(specPath).then((eps) => setEndpoints(eps ?? [])).catch(() => setEndpoints([]));
  }, [specPath]);

  const createSpec = useCallback(async () => {
    const name = prompt("Spec name:", "My API");
    if (!name) return;
    setCreating(true);
    try {
      const path = await CreateSpec(name, "1.0.0");
      setSpecPath(path);
      setEndpoints([]);
      toast.success(`Created spec "${name}"`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCreating(false);
    }
  }, []);

  const addEndpoint = useCallback(async () => {
    if (!specPath) return;
    const method = prompt("Method (GET, POST, etc.):", "GET");
    if (!method) return;
    const path = prompt("Path (e.g. /users):", "/");
    if (!path) return;
    const summary = prompt("Summary (optional):", "") || "";
    try {
      await AddSpecEndpoint(specPath, method.toUpperCase(), path, summary);
      const eps = await GetSpecEndpoints(specPath);
      setEndpoints(eps ?? []);
      toast.success(`Added ${method.toUpperCase()} ${path}`);
    } catch (e) {
      toast.error(String(e));
    }
  }, [specPath]);

  const removeEndpoint = useCallback(async (method: string, path: string) => {
    if (!specPath) return;
    if (!confirm(`Remove ${method} ${path}?`)) return;
    try {
      await RemoveSpecEndpoint(specPath, method, path);
      setEndpoints((await GetSpecEndpoints(specPath)) ?? []);
      toast.success(`Removed ${method} ${path}`);
    } catch (e) {
      toast.error(String(e));
    }
  }, [specPath]);

  const grouped = (endpoints ?? []).reduce<Record<string, Endpoint[]>>((acc, ep) => {
    (acc[ep.path] ??= []).push(ep);
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      <div className="flex items-center gap-2 px-3 h-[36px] border-b border-border shrink-0 bg-surface">
        <FileCode2 size={13} className="text-cyan" />
        <span className="text-12 font-semibold text-text flex-1">
          {specPath ? `Spec: ${specPath.split("/").pop()}` : "API Designer"}
        </span>
        {specPath && (
          <Button variant="ghost" onClick={addEndpoint}><Plus size={11} />Add endpoint</Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!specPath ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <FileCode2 size={32} className="text-subtext/30" />
            <p className="text-13 text-subtext text-center max-w-[300px]">
              Create a new OpenAPI spec to design your API visually.
            </p>
            <Button variant="primary" onClick={createSpec} disabled={creating}>
              {creating ? "Creating…" : "New Spec"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {Object.entries(grouped).length === 0 && (
              <p className="text-12 text-subtext text-center py-8">
                No endpoints yet. Click "Add endpoint" to get started.
              </p>
            )}
            {Object.entries(grouped).map(([path, eps]) => (
              <div key={path} className="rounded-md border border-border bg-surface overflow-hidden">
                <div className="px-3 py-1.5 text-11 font-mono text-subtext bg-bg border-b border-border">{path}</div>
                {eps.map((ep) => (
                  <div key={ep.method + ep.path}
                    className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-b-0 hover:bg-cardHover transition-colors">
                    <span className={cn(
                      "text-10 font-bold px-1.5 py-0.5 rounded-sm uppercase",
                      ep.method === "GET" ? "bg-get text-black" :
                      ep.method === "POST" ? "bg-post text-black" :
                      ep.method === "PUT" ? "bg-put text-black" :
                      ep.method === "PATCH" ? "bg-patch text-black" :
                      ep.method === "DELETE" ? "bg-del text-white" :
                      "bg-border text-subtext",
                    )}>
                      {ep.method}
                    </span>
                    <span className="text-12 text-text flex-1 truncate">{ep.summary || ep.method + " " + path}</span>
                    <IconButton tone="danger" onClick={() => removeEndpoint(ep.method, path)}><Trash2 size={11} /></IconButton>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
