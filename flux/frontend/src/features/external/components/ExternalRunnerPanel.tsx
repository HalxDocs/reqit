import { useState, useEffect } from "react";
import { Modal } from "@/shared/components/Modal";
import {
  GeneratePlaywrightTest,
  GenerateJestTest,
  GenerateCLIRunner,
  GenerateGitHubAction,
  GenerateGitLabCI,
  SaveGeneratedTest,
} from "../../../../wailsjs/go/main/App";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";
import type { models } from "../../../../wailsjs/go/models";
import { toast } from "@/app/stores/useToastStore";

export function ExternalRunnerPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const collections = useCollectionStore((s) => s.collections);
  const [collID, setCollID] = useState("");
  const [useTS, setUseTS] = useState(true);
  const [generated, setGenerated] = useState("");
  const [output, setOutput] = useState("");
  const [format, setFormat] = useState<"playwright" | "jest" | "cli" | "github" | "gitlab">("playwright");
  const [runnerFilename, setRunnerFilename] = useState("runner.mjs");

  useEffect(() => {
    if (open && collections.length > 0 && !collID) {
      setCollID(collections[0].id);
    }
  }, [open, collections, collID]);

  const handleGenerate = async () => {
    if (!collID) return;
    setOutput("");
    try {
      let code = "";
      switch (format) {
        case "playwright":
          code = await GeneratePlaywrightTest(collID, useTS);
          break;
        case "jest":
          code = await GenerateJestTest(collID, useTS);
          break;
        case "cli":
          code = await GenerateCLIRunner(collID);
          break;
        case "github":
          code = await GenerateGitHubAction(collID, runnerFilename);
          break;
        case "gitlab":
          code = await GenerateGitLabCI(collID, runnerFilename);
          break;
      }
      setGenerated(code);
      setOutput(code);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleSave = async () => {
    if (!generated) return;
    let ext = useTS ? ".ts" : ".js";
    let prefix = `${format}-test`;
    if (format === "cli") { ext = ".mjs"; prefix = "runner"; }
    else if (format === "github") { ext = ".yml"; prefix = "github-workflow"; }
    else if (format === "gitlab") { ext = ".yml"; prefix = "gitlab-ci"; }
    try {
      const path = await SaveGeneratedTest(generated, `${prefix}-${collID.slice(0, 8)}${ext}`);
      toast.success(`Saved to ${path}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Generate External Test">
      <div className="flex flex-col gap-3 min-w-[520px] max-w-[700px]">
        {/* Config */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={collID}
            onChange={(e) => setCollID(e.target.value)}
            className="h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan"
          >
            <option value="">Select collection…</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "cli" | "github" | "playwright" | "jest" | "gitlab")}
            className="h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan"
          >
            <option value="playwright">Playwright</option>
            <option value="jest">Jest</option>
            <option value="cli">Node.js CLI Runner</option>
            <option value="github">GitHub Actions</option>
            <option value="gitlab">GitLab CI</option>
          </select>

          {format !== "cli" && format !== "github" && format !== "gitlab" && (
            <label className="flex items-center gap-1.5 text-12 text-text cursor-pointer">
              <input
                type="checkbox"
                checked={useTS}
                onChange={(e) => setUseTS(e.target.checked)}
                className="rounded"
              />
              TypeScript
            </label>
          )}
          {(format === "github" || format === "gitlab") && (
            <input
              type="text"
              value={runnerFilename}
              onChange={(e) => setRunnerFilename(e.target.value)}
              placeholder="runner filename…"
              className="h-[28px] w-[140px] px-2 bg-surface border border-border rounded text-11 text-text outline-none focus:border-cyan"
              title="Filename of the runner script to execute in CI"
            />
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!collID}
            className="h-[28px] px-3 bg-cyan hover:bg-cyan-hover text-white text-11 font-bold rounded disabled:opacity-60 transition-colors"
          >
            Generate
          </button>
          {generated && (
            <button
              type="button"
              onClick={handleSave}
              className="h-[28px] px-3 bg-teal hover:bg-teal/80 text-white text-11 font-bold rounded transition-colors"
            >
              Save to workspace
            </button>
          )}
        </div>

        {output && (
          <pre className="bg-card border border-border rounded-lg p-3 text-11 font-mono text-text overflow-auto max-h-[360px] whitespace-pre-wrap">
            {output}
          </pre>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-[32px] px-3 text-12 text-subtext hover:text-text rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
