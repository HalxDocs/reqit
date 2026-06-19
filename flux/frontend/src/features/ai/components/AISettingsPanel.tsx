import { useEffect, useState } from "react";
import { useAIStore } from "../stores/useAIStore";
import { ChevronDown } from "lucide-react";

const PROVIDERS = [
  { id: "openai", label: "OpenAI", placeholder: "sk-...", defaultModel: "gpt-4o" },
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-...", defaultModel: "claude-sonnet-4-20250514" },
  { id: "gemini", label: "Gemini", placeholder: "AI...", defaultModel: "gemini-2.0-flash" },
  { id: "ollama", label: "Ollama (local)", placeholder: "http://localhost:11434", defaultModel: "llama3.2" },
] as const;

const MODELS: Record<string, { id: string; label: string; desc: string }[]> = {
  openai: [
    { id: "gpt-4o", label: "GPT-4o", desc: "Fast, capable, best value" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini", desc: "Faster, cheaper, still smart" },
    { id: "gpt-4-turbo", label: "GPT-4 Turbo", desc: "128K context, reasoning" },
    { id: "o3-mini", label: "o3-mini", desc: "Reasoning model, complex tasks" },
    { id: "o3", label: "o3", desc: "Most capable reasoning" },
    { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", desc: "Legacy, very fast" },
    { id: "custom", label: "Custom model...", desc: "Type any OpenAI model ID" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", desc: "Best balance of speed and intelligence" },
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", desc: "Fast, strong coding" },
    { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", desc: "Fastest, lightweight tasks" },
    { id: "claude-3-opus-20240229", label: "Claude 3 Opus", desc: "Most capable, slower" },
    { id: "custom", label: "Custom model...", desc: "Type any Anthropic model ID" },
  ],
  gemini: [
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", desc: "Fast, multimodal, free tier" },
    { id: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro", desc: "Most capable, thinking model" },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", desc: "1M context window" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", desc: "Fast, cost-effective" },
    { id: "custom", label: "Custom model...", desc: "Type any Gemini model ID" },
  ],
  ollama: [
    { id: "llama3.2", label: "Llama 3.2", desc: "Meta's latest, balanced" },
    { id: "llama3.1", label: "Llama 3.1", desc: "8B/70B/405B sizes" },
    { id: "llama3", label: "Llama 3", desc: "Stable, well-tested" },
    { id: "mistral", label: "Mistral", desc: "Fast, European open-source" },
    { id: "mixtral", label: "Mixtral", desc: "Mixture of experts, smart" },
    { id: "codellama", label: "CodeLlama", desc: "Code-specialized" },
    { id: "deepseek-coder-v2", label: "DeepSeek Coder V2", desc: "Strong coding model" },
    { id: "qwen2.5-coder", label: "Qwen 2.5 Coder", desc: "Alibaba's code model" },
    { id: "phi3", label: "Phi-3", desc: "Microsoft, small but capable" },
    { id: "gemma2", label: "Gemma 2", desc: "Google's open model" },
    { id: "custom", label: "Custom model...", desc: "Type any Ollama model name" },
  ],
};

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
        <ModelSelector
          models={MODELS[localProvider] || []}
          value={localModel}
          onChange={setLocalModel}
          defaultModel={p.defaultModel}
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

function ModelSelector({
  models,
  value,
  onChange,
  defaultModel,
}: {
  models: { id: string; label: string; desc: string }[];
  value: string;
  onChange: (v: string) => void;
  defaultModel: string;
}) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);

  const isCustom = !models.some((m) => m.id === value) && value !== "";
  const current = models.find((m) => m.id === value);
  const displayLabel = current ? current.label : isCustom ? value : defaultModel;

  if (customMode || isCustom) {
    return (
      <div className="flex gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Model ID"
          spellCheck={false}
          className="flex-1 h-[32px] px-3 bg-surface border border-border rounded-md text-12 text-text font-mono outline-none focus:border-cyan focus:ring-2 focus:ring-cyan"
        />
        {models.length > 0 && (
          <button
            type="button"
            onClick={() => { setCustomMode(false); setOpen(true); }}
            className="h-[32px] px-2 text-11 text-subtext hover:text-text border border-border rounded-md hover:border-cyan transition-colors"
          >
            Pick
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-[32px] px-3 bg-surface border border-border rounded-md text-12 text-text flex items-center justify-between gap-2 outline-none focus:border-cyan focus:ring-2 focus:ring-cyan"
      >
        <span className="truncate text-left">
          <span className="font-semibold">{displayLabel}</span>
          {current && <span className="text-subtext ml-1.5">{current.desc}</span>}
        </span>
        <ChevronDown size={12} className={`text-subtext shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-full z-50 bg-card border border-border rounded-lg shadow-xl max-h-[240px] overflow-y-auto">
            {models.filter((m) => m.id !== "custom").map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { onChange(m.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-12 flex flex-col gap-0.5 transition-colors ${
                  value === m.id ? "bg-cyan/10 text-cyan" : "text-text hover:bg-surface"
                }`}
              >
                <span className="font-semibold">{m.label}</span>
                <span className="text-10 text-subtext">{m.desc}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setCustomMode(true); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-12 text-subtext hover:bg-surface border-t border-border transition-colors"
            >
              <span className="font-semibold">Custom model...</span>
              <span className="text-10 ml-1.5">Type any model ID</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
