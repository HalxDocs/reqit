import { useState, useEffect, useCallback } from "react";
import { useUIStore } from "@/app/stores/useUIStore";
import { Button } from "@/shared/components/Button";
import { GetPlugins, InstallPlugin, RemovePlugin, PickFolder } from "../../../../wailsjs/go/main/App";
import { EventsOn } from "../../../../wailsjs/runtime/runtime";
import { Puzzle, FolderOpen, Trash2, ExternalLink } from "lucide-react";
import { toast } from "@/app/stores/useToastStore";

interface PluginInfo {
  manifest: {
    name: string;
    version: string;
    description: string;
    author: string;
    hooks: Record<string, string>;
  };
  dir: string;
}

export function PluginManager() {
  const setView = useUIStore((s) => s.setView);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);

  const load = useCallback(async () => {
    try {
      const p = await GetPlugins();
      setPlugins((p ?? []) as unknown as PluginInfo[]);
    } catch (e) {
      console.error("Failed to load plugins:", e);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const off = EventsOn("plugins:changed", () => { load(); });
    return () => off();
  }, [load]);

  const handleInstall = async () => {
    try {
      const path = await PickFolder("Select plugin folder");
      if (!path) return;
      await InstallPlugin(path);
      toast.success("Plugin installed");
      await load();
    } catch (e) {
      console.error("Install failed:", e);
    }
  };

  const handleRemove = async (name: string) => {
    try {
      await RemovePlugin(name);
      toast.success(`Removed ${name}`);
      await load();
    } catch (e) {
      console.error("Remove failed:", e);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg">
      <header className="h-[48px] flex items-center gap-3 px-4 border-b border-border shrink-0">
        <button onClick={() => setView("http")} className="text-subtext hover:text-text text-13">&larr; Back</button>
        <h1 className="text-14 font-semibold text-text flex items-center gap-2"><Puzzle size={14} /> Plugins</h1>
        <div className="ml-auto">
          <Button variant="primary" onClick={handleInstall}><FolderOpen size={12} /> Install from Folder</Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {plugins.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-subtext text-13 gap-2">
            <Puzzle size={32} className="opacity-30" />
            <p>No plugins installed. Click "Install from Folder" to add one.</p>
          </div>
        )}

        {plugins.map((p) => (
          <div key={p.manifest.name} className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-13 font-medium text-text">{p.manifest.name}</span>
                  <span className="text-11 text-subtext bg-bg px-2 py-0.5 rounded-full border border-border">v{p.manifest.version}</span>
                </div>
                {p.manifest.description && (
                  <p className="text-12 text-subtext mt-1">{p.manifest.description}</p>
                )}
                <div className="flex items-center gap-3 text-11 text-subtext mt-1.5">
                  {p.manifest.author && <span>By {p.manifest.author}</span>}
                  <span className="font-mono text-10">{p.dir}</span>
                </div>
                {Object.keys(p.manifest.hooks).length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {Object.entries(p.manifest.hooks).map(([hook, file]) => (
                      <span key={hook} className="text-10 px-2 py-0.5 rounded-full bg-cyan/10 text-cyan border border-cyan/20">
                        {hook}: {file}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={() => handleRemove(p.manifest.name)} variant="danger" className="shrink-0 ml-3">
                <Trash2 size={12} />
              </Button>
            </div>
          </div>
        ))}

        <div className="mt-6 pt-4 border-t border-border">
          <h3 className="text-13 font-semibold text-text mb-2">Plugin Store</h3>
          <div className="bg-surface border border-border rounded-xl p-6 flex flex-col items-center gap-3 text-subtext">
            <ExternalLink size={24} className="opacity-30" />
            <p className="text-13">The reqit plugin marketplace is coming soon.</p>
            <p className="text-12">Check back for community plugins for auth, codegen, visualizers, and more.</p>
            <a href="https://reqit.app/plugins" target="_blank" rel="noopener noreferrer" className="text-12 text-cyan hover:underline">
              Learn more about plugins →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
