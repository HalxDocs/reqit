import { useState, useEffect } from "react";
import { Settings, Plus, Trash2, GripVertical, Check, X, HelpCircle } from "lucide-react";
import { useDiffIgnoreStore } from "@/features/response/stores/useDiffIgnoreStore";
import { cn } from "@/shared/lib/cn";

interface DiffIgnoreModalProps {
  open: boolean;
  onClose: () => void;
  snapshotKey: string;
}

type Tab = "global" | "perRequest" | "headers";

function PatternRow({
  pattern,
  index,
  patterns,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  pattern: string;
  index: number;
  patterns: string[];
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg">
      <button
        type="button"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        className="text-subtext/50 hover:text-text transition-colors p-1"
        aria-label="Move up"
      >
        <GripVertical size={14} />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        className="text-subtext/50 hover:text-text transition-colors p-1"
        aria-label="Move down"
      >
        <GripVertical size={14} />
      </button>
      <code className="flex-1 text-12 font-mono text-text bg-card px-2 py-1 rounded border border-border/30 truncate">
        {pattern}
      </code>
      <button
        type="button"
        onClick={onRemove}
        className="text-subtext/50 hover:text-danger transition-colors p-1"
        aria-label="Remove pattern"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function PatternList({
  patterns,
  onAdd,
  onRemove,
  onMoveUp,
  onMoveDown,
  inputValue,
  onInputChange,
  placeholder,
  helpText,
}: {
  patterns: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  inputValue: string;
  onInputChange: (v: string) => void;
  placeholder: string;
  helpText: string;
}) {
  return (
    <div className="space-y-2">
      {patterns.length === 0 ? (
        <p className="text-12 text-subtext/60 italic text-center py-4">No patterns yet</p>
      ) : (
        patterns.map((p, i) => (
          <PatternRow
            key={p}
            pattern={p}
            index={i}
            patterns={patterns}
            onRemove={() => onRemove(i)}
            onMoveUp={() => onMoveUp(i)}
            onMoveDown={() => onMoveDown(i)}
            canMoveUp={i > 0}
            canMoveDown={i < patterns.length - 1}
          />
        ))
      )}
      <div className="flex gap-2 pt-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          placeholder={placeholder}
          className="flex-1 px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!inputValue.trim()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan text-white text-12 font-medium hover:bg-cyan-hover transition-colors disabled:opacity-50"
        >
          <Plus size={14} /> Add
        </button>
      </div>
      <p className="text-10 text-subtext/60 mt-2">{helpText}</p>
    </div>
  );
}

export function DiffIgnoreModal({ open, onClose, snapshotKey }: DiffIgnoreModalProps) {
  const {
    globalPatterns,
    perRequestPatterns,
    ignoreHeaders,
    headerPatterns,
    addGlobalPattern,
    removeGlobalPattern,
    reorderGlobalPatterns,
    resetGlobalPatterns,
    addPerRequestPattern,
    removePerRequestPattern,
    clearPerRequestPatterns,
    setIgnoreHeaders,
    addHeaderPattern,
    removeHeaderPattern,
    resetHeaderPatterns,
  } = useDiffIgnoreStore();

  const [activeTab, setActiveTab] = useState<Tab>("global");
  const [globalInput, setGlobalInput] = useState("");
  const [perRequestInput, setPerRequestInput] = useState("");
  const [headerInput, setHeaderInput] = useState("");

  const overridePatterns = perRequestPatterns[snapshotKey] || [];

  useEffect(() => {
    if (open) {
      setGlobalInput("");
      setPerRequestInput("");
      setHeaderInput("");
      setActiveTab("global");
    }
  }, [open]);

  const handleGlobalAdd = () => {
    if (globalInput.trim()) {
      addGlobalPattern(globalInput.trim());
      setGlobalInput("");
    }
  };
  const handleGlobalRemove = (index: number) => removeGlobalPattern(globalPatterns[index]);
  const handleGlobalMoveUp = (index: number) => reorderGlobalPatterns(index, index - 1);
  const handleGlobalMoveDown = (index: number) => reorderGlobalPatterns(index, index + 1);

  const handlePerRequestAdd = () => {
    if (perRequestInput.trim()) {
      addPerRequestPattern(snapshotKey, perRequestInput.trim());
      setPerRequestInput("");
    }
  };
  const handlePerRequestRemove = (index: number) => removePerRequestPattern(snapshotKey, overridePatterns[index]);
  const handlePerRequestMoveUp = (index: number) => {
    const next = [...overridePatterns];
    const [removed] = next.splice(index, 1);
    next.splice(index - 1, 0, removed);
    useDiffIgnoreStore.setState({
      perRequestPatterns: { ...perRequestPatterns, [snapshotKey]: next },
    });
  };
  const handlePerRequestMoveDown = (index: number) => {
    const next = [...overridePatterns];
    const [removed] = next.splice(index, 1);
    next.splice(index + 1, 0, removed);
    useDiffIgnoreStore.setState({
      perRequestPatterns: { ...perRequestPatterns, [snapshotKey]: next },
    });
  };

  const handleHeaderAdd = () => {
    if (headerInput.trim()) {
      addHeaderPattern(headerInput.trim());
      setHeaderInput("");
    }
  };
  const handleHeaderRemove = (index: number) => removeHeaderPattern(headerPatterns[index]);
  const handleHeaderMoveUp = (index: number) => {
    const next = [...headerPatterns];
    const [removed] = next.splice(index, 1);
    next.splice(index - 1, 0, removed);
    useDiffIgnoreStore.setState({ headerPatterns: next });
  };
  const handleHeaderMoveDown = (index: number) => {
    const next = [...headerPatterns];
    const [removed] = next.splice(index, 1);
    next.splice(index + 1, 0, removed);
    useDiffIgnoreStore.setState({ headerPatterns: next });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-[560px] max-h-[70vh] bg-surface border border-border rounded-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-14 font-semibold text-text flex items-center gap-2">
            <Settings size={16} /> Diff Ignore Patterns
          </h2>
          <button onClick={onClose} className="text-subtext hover:text-text p-1" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-border overflow-x-auto">
          {(["global", "perRequest", "headers"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-12 font-medium transition-colors whitespace-nowrap border-b-2",
                activeTab === tab
                  ? "border-cyan text-cyan"
                  : "border-transparent text-subtext hover:text-text"
              )}
            >
              {tab === "global" && "Global Patterns"}
              {tab === "perRequest" && "Per-Request Override"}
              {tab === "headers" && "Headers"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "global" && (
            <PatternList
              patterns={globalPatterns}
              onAdd={handleGlobalAdd}
              onRemove={handleGlobalRemove}
              onMoveUp={handleGlobalMoveUp}
              onMoveDown={handleGlobalMoveDown}
              inputValue={globalInput}
              onInputChange={setGlobalInput}
              placeholder="e.g., timestamp, *.id, meta.*"
              helpText="Applied to all diffs. Order matters — first match wins. Supports exact match and glob (*)."
            />
          )}

          {activeTab === "perRequest" && (
            <div className="space-y-4">
              <PatternList
                patterns={overridePatterns}
                onAdd={handlePerRequestAdd}
                onRemove={handlePerRequestRemove}
                onMoveUp={handlePerRequestMoveUp}
                onMoveDown={handlePerRequestMoveDown}
                inputValue={perRequestInput}
                onInputChange={setPerRequestInput}
                placeholder="e.g., payment.intent.id, data.*.traceId"
                helpText={`Only applies to this request (${snapshotKey}). Combined with global patterns.`}
              />
              {overridePatterns.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearPerRequestPatterns(snapshotKey)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-danger/10 text-danger text-12 hover:bg-danger/20 transition-colors"
                >
                  <Trash2 size={14} /> Clear all override patterns
                </button>
              )}
            </div>
          )}

          {activeTab === "headers" && (
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ignoreHeaders}
                  onChange={(e) => setIgnoreHeaders(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-cyan"
                />
                <span className="text-13 text-text">Ignore header patterns in header diff</span>
              </label>
              {ignoreHeaders && (
                <PatternList
                  patterns={headerPatterns}
                  onAdd={handleHeaderAdd}
                  onRemove={handleHeaderRemove}
                  onMoveUp={handleHeaderMoveUp}
                  onMoveDown={handleHeaderMoveDown}
                  inputValue={headerInput}
                  onInputChange={setHeaderInput}
                  placeholder="e.g., Date, X-Request-Id, ETag"
                  helpText="Applied to header diff when enabled. Case-insensitive match."
                />
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-bg">
          <button
            type="button"
            onClick={() => {
              if (activeTab === "global") resetGlobalPatterns();
              else if (activeTab === "headers") resetHeaderPatterns();
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface border border-border text-12 text-subtext hover:bg-cardHover transition-colors"
          >
            <Check size={12} /> Reset to defaults
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan text-white text-12 font-medium hover:bg-cyan-hover transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}