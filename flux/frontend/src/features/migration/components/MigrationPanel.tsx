import { useState, useEffect } from "react";
import { useUIStore } from "@/app/stores/useUIStore";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";
import { Button } from "@/shared/components/Button";
import {
  ImportPostman, ImportPostmanFull, ImportPostmanEnvironment,
  ExportPostman, ImportInsomnia, ExportInsomnia,
  ImportHoppscotch, ExportHoppscotch,
  ParseCurl, GenerateCurl,
  PickFile, ReadFileText, SaveGeneratedTest,
} from "../../../../wailsjs/go/main/App";

type SubTab = "import" | "export" | "curl";

export function MigrationPanel() {
  const setView = useUIStore((s) => s.setView);
  const [tab, setTab] = useState<SubTab>("import");
  const [msg, setMsg] = useState("");

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg">
      <header className="h-[48px] flex items-center gap-3 px-4 border-b border-border shrink-0">
        <button onClick={() => setView("http")} className="text-subtext hover:text-text text-13">&larr; Back</button>
        <h1 className="text-14 font-semibold text-text">Migration &amp; Interoperability</h1>
      </header>
      <div className="flex gap-1 px-4 py-2 border-b border-border">
        {[
          { key: "import" as SubTab, label: "Import" },
          { key: "export" as SubTab, label: "Export" },
          { key: "curl" as SubTab, label: "cURL" },
        ].map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setMsg(""); }}
            className={`px-3 py-1.5 text-12 rounded-md transition-colors ${
              tab === t.key ? "bg-cyan/10 text-cyan font-semibold" : "text-subtext hover:text-text hover:bg-cardHover"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-cyan/10 text-cyan text-13 border border-cyan/20">{msg}</div>}
        {tab === "import" && <ImportTab onMsg={setMsg} />}
        {tab === "export" && <ExportTab onMsg={setMsg} />}
        {tab === "curl" && <CurlTab onMsg={setMsg} />}
      </div>
    </div>
  );
}

function ImportTab({ onMsg }: { onMsg: (m: string) => void }) {
  const collections = useCollectionStore((s) => s.collections);
  const loadCollections = useCollectionStore((s) => s.load);
  const [collID, setCollID] = useState("");
  const [envName, setEnvName] = useState("");

  useEffect(() => { if (collections.length > 0 && !collID) setCollID(collections[0].id); }, [collections, collID]);

  const pickAndImport = async (handler: (data: string, collID: string) => Promise<any>, label: string) => {
    if (!collID) { onMsg("Select a target collection first."); return; }
    const path = await PickFile(`Select ${label} file`, "*.json");
    if (!path) return;
    const data = await ReadFileText(path);
    try {
      const count = await handler(data, collID);
      await loadCollections();
      onMsg(`Imported ${count} requests from ${label} into collection.`);
    } catch (e) { onMsg(String(e)); }
  };

  const importPostmanEnv = async () => {
    const path = await PickFile("Select Postman environment file", "*.json");
    if (!path) return;
    const data = await ReadFileText(path);
    try {
      const name = await ImportPostmanEnvironment(data, envName);
      onMsg(`Environment "${name}" imported.`);
    } catch (e) { onMsg(String(e)); }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <label className="text-13 text-subtext block mb-1">Target Collection</label>
        <select value={collID} onChange={(e) => setCollID(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text">
          {collections.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-13 font-semibold text-text mb-2">Postman v2.1+</h3>
          <p className="text-12 text-subtext mb-2">Import collections with full support for folders, auth types, body modes, variables, and pm.* script transpilation.</p>
          <div className="flex gap-2">
            <Button onClick={() => pickAndImport(ImportPostman, "Postman collection")}>Import Collection</Button>
            <Button onClick={() => pickAndImport(ImportPostmanFull as any, "Postman collection")}>Import Full</Button>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-13 font-semibold text-text mb-2">Postman Environment</h3>
          <p className="text-12 text-subtext mb-2">Import environment variables from a Postman environment JSON file.</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-12 text-subtext block">Environment name (optional)</label>
              <input value={envName} onChange={(e) => setEnvName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" />
            </div>
            <Button onClick={importPostmanEnv}>Import Environment</Button>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-13 font-semibold text-text mb-2">Insomnia</h3>
          <p className="text-12 text-subtext mb-2">Import Insomnia export JSON (supports requests, folders, environments, bearer/basic auth).</p>
          <Button onClick={() => pickAndImport(ImportInsomnia, "Insomnia")}>Import Insomnia</Button>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-13 font-semibold text-text mb-2">Hoppscotch</h3>
          <p className="text-12 text-subtext mb-2">Import Hoppscotch export JSON (v4 format with collections, folders, params, auth).</p>
          <Button onClick={() => pickAndImport(ImportHoppscotch as any, "Hoppscotch")}>Import Hoppscotch</Button>
        </div>
      </div>
    </div>
  );
}

function ExportTab({ onMsg }: { onMsg: (m: string) => void }) {
  const collections = useCollectionStore((s) => s.collections);
  const [collID, setCollID] = useState("");

  useEffect(() => { if (collections.length > 0 && !collID) setCollID(collections[0].id); }, [collections, collID]);

  const exportAndSave = async (handler: (collID: string) => Promise<string>, ext: string, label: string) => {
    if (!collID) { onMsg("Select a collection first."); return; }
    try {
      const data = await handler(collID);
      const path = await SaveGeneratedTest(data, `collection.${ext}`);
      if (path) onMsg(`Exported to ${path}`);
    } catch (e) { onMsg(String(e)); }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <label className="text-13 text-subtext block mb-1">Collection to Export</label>
        <select value={collID} onChange={(e) => setCollID(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text">
          {collections.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <p className="text-12 text-subtext">Export your collections to other formats for use in other API tools.</p>
      <div className="grid grid-cols-1 gap-3">
        <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between">
          <div><span className="text-13 font-semibold text-text">Postman v2.1</span><p className="text-12 text-subtext">JSON format compatible with Postman</p></div>
          <Button onClick={() => exportAndSave(ExportPostman, "postman.json", "Postman")}>Export</Button>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between">
          <div><span className="text-13 font-semibold text-text">Insomnia</span><p className="text-12 text-subtext">Insomnia export JSON format</p></div>
          <Button onClick={() => exportAndSave(ExportInsomnia, "insomnia.json", "Insomnia")}>Export</Button>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between">
          <div><span className="text-13 font-semibold text-text">Hoppscotch</span><p className="text-12 text-subtext">Hoppscotch v4 JSON format</p></div>
          <Button onClick={() => exportAndSave(ExportHoppscotch as any, "hoppscotch.json", "Hoppscotch")}>Export</Button>
        </div>
      </div>
    </div>
  );
}

function CurlTab({ onMsg }: { onMsg: (m: string) => void }) {
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<any>(null);
  const [genInput, setGenInput] = useState("");
  const [genOutput, setGenOutput] = useState("");

  const handleParse = async () => {
    if (!input.trim()) { onMsg("Paste a cURL command."); return; }
    try {
      const result = await ParseCurl(input);
      setParsed(JSON.parse(result));
      onMsg("cURL parsed successfully.");
    } catch (e) { onMsg(String(e)); }
  };

  const handleGenerate = async () => {
    try {
      const data = JSON.parse(genInput);
      const curl = await GenerateCurl(data.collId || "", data.reqId || "");
      setGenOutput(curl);
    } catch (e) { onMsg(String(e)); }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="text-13 font-semibold text-text mb-2">Parse cURL</h3>
        <p className="text-12 text-subtext mb-2">Paste any cURL command — handles multi-line, complex headers, cookie chains, @file payloads, and all HTTP methods.</p>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={6}
          placeholder={`curl -X POST 'https://api.example.com/data' \\\n  -H 'Authorization: Bearer tok123' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"key":"value"}'`}
          className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-13 text-text font-mono" />
        <div className="flex gap-2 mt-2">
          <Button onClick={handleParse}>Parse</Button>
        </div>
        {parsed && (
          <div className="mt-3">
            <h4 className="text-12 font-semibold text-text mb-1">Parsed Request</h4>
            <div className="bg-bg border border-border rounded-lg p-3 space-y-1 text-12 font-mono">
              <div><span className="text-subtext">Method:</span> <span className="text-cyan">{parsed.method}</span></div>
              <div><span className="text-subtext">URL:</span> <span className="text-text break-all">{parsed.url}</span></div>
              {parsed.headers?.length > 0 && (
                <div><span className="text-subtext">Headers:</span>
                  {parsed.headers.map((h: any, i: number) => (
                    <div key={i} className="ml-4 text-text">{h.key}: {h.value}</div>
                  ))}
                </div>
              )}
              {parsed.body && <div><span className="text-subtext">Body:</span><pre className="ml-4 text-text whitespace-pre-wrap">{parsed.body}</pre></div>}
            </div>
          </div>
        )}
      </div>
      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="text-13 font-semibold text-text mb-2">Generate cURL</h3>
        <p className="text-12 text-subtext mb-2">Enter a request payload as JSON to generate a cURL command.</p>
        <textarea value={genInput} onChange={(e) => setGenInput(e.target.value)} rows={4}
          placeholder='{"method":"POST","url":"https://api.example.com/data","headers":[{"key":"Content-Type","value":"application/json","enabled":true}],"body":"{\"key\":\"value\"}","bodyType":"json"}'
          className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-13 text-text font-mono" />
        <Button onClick={handleGenerate}>Generate cURL</Button>
        {genOutput && (
          <pre className="mt-2 text-12 text-subtext bg-bg p-3 rounded-lg whitespace-pre-wrap overflow-x-auto">{genOutput}</pre>
        )}
      </div>
    </div>
  );
}
