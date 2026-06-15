import { useState } from "react";
import { useUIStore } from "@/app/stores/useUIStore";
import { Button } from "@/shared/components/Button";
import {
  GetTelemetryConfig, SetTelemetryEnabled, GetTelemetryPreview, GetTelemetryEvents,
  PushToSwaggerHub, PullFromSwaggerHub, PushToStoplight, PullFromStoplight,
  GenerateJenkins, GenerateGitHubAction, GenerateGitLabCI, GenerateCLIRunnerScript,
  SaveGeneratedTest, SendNotification,
} from "../../../../wailsjs/go/main/App";
import type { telemetry } from "../../../../wailsjs/go/models";

type SubTab = "cicd" | "registry" | "telemetry" | "cli";

export function IntegrationsPanel() {
  const setView = useUIStore((s) => s.setView);
  const [tab, setTab] = useState<SubTab>("cicd");
  const [msg, setMsg] = useState("");

  const tabs: { key: SubTab; label: string }[] = [
    { key: "cicd", label: "CI/CD Pipelines" },
    { key: "registry", label: "API Registries" },
    { key: "telemetry", label: "Telemetry" },
    { key: "cli", label: "CLI Runner" },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg">
      <header className="h-[48px] flex items-center gap-3 px-4 border-b border-border shrink-0">
        <button onClick={() => setView("http")} className="text-subtext hover:text-text text-13">&larr; Back</button>
        <h1 className="text-14 font-semibold text-text">Integrations &amp; Extensibility</h1>
      </header>
      <div className="flex gap-1 px-4 py-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setMsg(""); }}
            className={`px-3 py-1.5 text-12 rounded-md transition-colors ${
              tab === t.key ? "bg-cyan/10 text-cyan font-semibold" : "text-subtext hover:text-text hover:bg-cardHover"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {msg && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-cyan/10 text-cyan text-13 border border-cyan/20">{msg}</div>
        )}
        {tab === "cicd" && <CICDTab onMsg={setMsg} />}
        {tab === "registry" && <RegistryTab onMsg={setMsg} />}
        {tab === "telemetry" && <TelemetryTab onMsg={setMsg} />}
        {tab === "cli" && <CLITab onMsg={setMsg} />}
      </div>
    </div>
  );
}

function CICDTab({ onMsg }: { onMsg: (m: string) => void }) {
  const [runnerFile, setRunnerFile] = useState("runner.js");
  const handleGen = async (fn: (collID: string, runner: string) => Promise<string>) => {
    const { GenerateCLIRunner } = await import("../../../../wailsjs/go/main/App");
    const { useCollectionStore } = await import("@/features/collections/stores/useCollectionStore");
    const colls = useCollectionStore.getState().collections;
    if (colls.length === 0) { onMsg("No collections available. Create one first."); return; }
    const collID = colls[0].id;
    try {
      const content = await fn(collID, runnerFile);
      const path = await SaveGeneratedTest(content, runnerFile);
      if (path) onMsg(`Saved: ${path}`);
    } catch (e) { onMsg(String(e)); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-13 text-subtext block mb-1">Runner filename</label>
        <input value={runnerFile} onChange={(e) => setRunnerFile(e.target.value)}
          className="w-full max-w-sm px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" />
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-lg">
        <Button onClick={() => handleGen(GenerateGitHubAction)}>Generate GitHub Actions</Button>
        <Button onClick={() => handleGen(GenerateGitLabCI)}>Generate GitLab CI</Button>
        <Button onClick={() => handleGen(GenerateJenkins)}>Generate Jenkins Pipeline</Button>
      </div>
      <p className="text-12 text-subtext mt-1">Generates a pipeline file for the first collection in your workspace. Use the runner file name above as the script path.</p>
    </div>
  );
}

function RegistryTab({ onMsg }: { onMsg: (m: string) => void }) {
  const [apiKey, setApiKey] = useState("");
  const [owner, setOwner] = useState("");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [projectSlug, setProjectSlug] = useState("");
  const [specJSON, setSpecJSON] = useState("");

  const pushSH = async () => {
    if (!specJSON) { onMsg("Paste a spec JSON first."); return; }
    try {
      const r = await PushToSwaggerHub(specJSON, apiKey, owner, name, version);
      onMsg(`Pushed to SwaggerHub: ${r.url}`);
    } catch (e) { onMsg(String(e)); }
  };
  const pullSH = async () => {
    try {
      const data = await PullFromSwaggerHub(apiKey, owner, name, version);
      setSpecJSON(data);
      onMsg("Pulled from SwaggerHub.");
    } catch (e) { onMsg(String(e)); }
  };
  const pushSL = async () => {
    if (!specJSON) { onMsg("Paste a spec JSON first."); return; }
    try {
      const r = await PushToStoplight(specJSON, apiKey, projectSlug);
      onMsg(`Pushed to Stoplight: ${r.url}`);
    } catch (e) { onMsg(String(e)); }
  };
  const pullSL = async () => {
    try {
      const data = await PullFromStoplight(apiKey, projectSlug);
      setSpecJSON(data);
      onMsg("Pulled from Stoplight.");
    } catch (e) { onMsg(String(e)); }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-12 text-subtext block">API Key / Token</label>
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
        <div><label className="text-12 text-subtext block">Version</label>
          <input value={version} onChange={(e) => setVersion(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-12 text-subtext block">SwaggerHub Owner</label>
          <input value={owner} onChange={(e) => setOwner(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
        <div><label className="text-12 text-subtext block">SwaggerHub API Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
      </div>
      <div><label className="text-12 text-subtext block">Stoplight Project Slug</label>
        <input value={projectSlug} onChange={(e) => setProjectSlug(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
      <div><label className="text-12 text-subtext block">Spec JSON</label>
        <textarea value={specJSON} onChange={(e) => setSpecJSON(e.target.value)} rows={4} className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text font-mono" /></div>
      <div className="flex gap-2 flex-wrap">
        <Button onClick={pushSH}>Push to SwaggerHub</Button>
        <Button onClick={pullSH}>Pull from SwaggerHub</Button>
        <Button onClick={pushSL}>Push to Stoplight</Button>
        <Button onClick={pullSL}>Pull from Stoplight</Button>
      </div>
    </div>
  );
}

function TelemetryTab({ onMsg }: { onMsg: (m: string) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [preview, setPreview] = useState("");
  const [events, setEvents] = useState<telemetry.Event[]>([]);

  const refresh = async () => {
    const cfg = await GetTelemetryConfig();
    setEnabled(cfg.enabled);
  };
  useState(() => { refresh(); });

  const toggle = async () => {
    await SetTelemetryEnabled(!enabled);
    setEnabled(!enabled);
    onMsg(`Telemetry ${!enabled ? "enabled" : "disabled"}.`);
  };
  const showPreview = async () => {
    setPreview(await GetTelemetryPreview());
  };
  const showEvents = async () => {
    setEvents(await GetTelemetryEvents(50));
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center gap-3">
        <span className="text-13 text-text">Telemetry is <strong>{enabled ? "ON" : "OFF"}</strong></span>
        <Button onClick={toggle}>{enabled ? "Disable" : "Enable"}</Button>
      </div>
      {!enabled && (
        <p className="text-12 text-subtext">No data is collected. Enable above to help guide product decisions.</p>
      )}
      <div className="flex gap-2">
        <Button onClick={showPreview}>Preview what is tracked</Button>
        <Button onClick={showEvents}>View recent events</Button>
      </div>
      {preview && (
        <pre className="text-12 text-subtext bg-surface p-3 rounded-lg whitespace-pre-wrap max-h-[300px] overflow-y-auto">{preview}</pre>
      )}
      {events.length > 0 && (
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {events.map((e, i) => (
            <div key={i} className="text-12 text-subtext bg-surface px-3 py-1.5 rounded-lg">
              <span className="text-cyan">{e.type}</span> &mdash; {e.name}
              <span className="text-10 text-subtext/50 ml-2">{new Date(e.ts).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CLITab({ onMsg }: { onMsg: (m: string) => void }) {
  const [collName, setCollName] = useState("my-collection");
  const [script, setScript] = useState("");
  const genScript = async () => {
    const s = await GenerateCLIRunnerScript(collName);
    setScript(s);
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div><label className="text-13 text-subtext block mb-1">Collection name</label>
        <input value={collName} onChange={(e) => setCollName(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
      <Button onClick={genScript}>Generate CLI Runner Script</Button>
      {script && (
        <>
          <h3 className="text-13 font-semibold text-text mt-3">Shell runner script</h3>
          <pre className="text-12 text-subtext bg-surface p-3 rounded-lg whitespace-pre-wrap overflow-x-auto max-h-[300px]">{script}</pre>
          <p className="text-12 text-subtext">Save this as <code className="text-cyan">{collName}.sh</code> and run with <code className="text-cyan">sh {collName}.sh</code>.</p>
        </>
      )}
    </div>
  );
}
