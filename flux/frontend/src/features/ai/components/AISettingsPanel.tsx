import { useEffect, useState } from "react";
import { useAIStore } from "../stores/useAIStore";

const PROVIDERS = [
  { id: "openai", label: "OpenAI", placeholder: "sk-...", defaultModel: "gpt-4o" },
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-...", defaultModel: "claude-sonnet-4-20250514" },
  { id: "gemini", label: "Gemini", placeholder: "AI...", defaultModel: "gemini-2.0-flash" },
  { id: "ollama", label: "Ollama (local)", placeholder: "http://localhost:11434", defaultModel: "llama3.2" },
] as const;

export function AISettingsPanel() {
  const { enabled, provider, apiKey, baseUrl, model, load, save } = useAIStore();
  const [localProvider, setLocalProvider] = useState(provider);
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localBaseUrl, setLocalBaseUrl] = useState(baseUrl);
  const [localModel, setLocalModel] = useState(model);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    setLocalProvider(provider);
    setLocalApiKey(apiKey);
    setLocalBaseUrl(baseUrl);
    setLocalModel(model);
  }, [provider, apiKey, baseUrl, model]);

  const p = PROVIDERS.find((x) => x.id === localProvider) || PROVIDERS[0];

  const handleSave = async () => {
    setBusy(true);
    try {
      await save(localProvider, localApiKey, localBaseUrl, localModel);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan/10 text-cyan font-semibold border border-cyan/20">NEW</span>
        <span className="text-11 text-subtext">BYOK — your key, your data, zero telemetry</span>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-11 text-subtext">Provider</label>
        <div className="flex gap-1.5">
          {PROVIDERS.map((pr) => (
            <button
              key={pr.id}
              type="button"
              onClick={() => {
                setLocalProvider(pr.id);
                if (!localBaseUrl || localBaseUrl === "http://localhost:11434") {
                  setLocalBaseUrl(pr.id === "ollama" ? "http://localhost:11434" : "");
                }
                if (!localModel || localModel === "llama3.2" || localModel === "gpt-4o" || localModel === "claude-sonnet-4-20250514" || localModel === "gemini-2.0-flash") {
                  setLocalModel(pr.defaultModel);
                }
              }}
              className={`h-[26px] px-2.5 text-11 font-semibold rounded-md border transition-colors ${
                localProvider === pr.id
                  ? "bg-cyan text-white border-cyan"
                  : "bg-card text-subtext border-border hover:text-text hover:border-cyan"
              }`}
            >
              {pr.label}
            </button>
          ))}
        </div>
      </div>

      {localProvider !== "ollama" && (
        <div className="flex flex-col gap-1">
          <label className="text-11 text-subtext">API Key</label>
          <input
            type="password"
            value={localApiKey}
            onChange={(e) => setLocalApiKey(e.target.value)}
            placeholder={p.placeholder}
            spellCheck={false}
            autoComplete="off"
            className="h-[32px] px-3 bg-surface border border-border rounded-md text-12 text-text font-mono outline-none focus:border-cyan focus:ring-2 focus:ring-cyan"
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-11 text-subtext">{localProvider === "ollama" ? "Server URL" : "Base URL (optional)"}</label>
        <input
          type="text"
          value={localBaseUrl}
          onChange={(e) => setLocalBaseUrl(e.target.value)}
          placeholder={p.id === "ollama" ? "http://localhost:11434" : "Leave empty for default"}
          spellCheck={false}
          className="h-[32px] px-3 bg-surface border border-border rounded-md text-12 text-text font-mono outline-none focus:border-cyan focus:ring-2 focus:ring-cyan"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-11 text-subtext">Model</label>
        <input
          type="text"
          value={localModel}
          onChange={(e) => setLocalModel(e.target.value)}
          placeholder={p.defaultModel}
          spellCheck={false}
          className="h-[32px] px-3 bg-surface border border-border rounded-md text-12 text-text font-mono outline-none focus:border-cyan focus:ring-2 focus:ring-cyan"
        />
      </div>

      <div className="flex items-center gap-3 mt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || (localProvider !== "ollama" && !localApiKey)}
          className="h-[28px] px-3 bg-cyan hover:bg-cyan-hover text-white text-12 font-bold rounded-md disabled:opacity-60 transition-all"
        >
          {busy ? "Saving…" : "Save AI settings"}
        </button>
        {saved && <span className="text-11 text-teal">Saved</span>}
        {enabled && <span className="text-11 text-teal">✓ Configured</span>}
      </div>

      <p className="text-10 text-subtext/50 mt-1 leading-relaxed">
        Your API key stays on this machine. AI calls go directly from your computer to the provider. No reqit servers, no telemetry, no logging.
      </p>
    </div>
  );
}
