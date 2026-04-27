import { useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { CopyButton } from "./CopyButton";
import { tryPrettyJSON } from "../../lib/format";
import { cn } from "../../lib/cn";

const fluxTheme = EditorView.theme({
  "&": {
    backgroundColor: "#0D0D0D",
    fontSize: "12px",
    fontFamily:
      "'JetBrains Mono', ui-monospace, Menlo, monospace",
    height: "100%",
  },
  ".cm-gutters": {
    backgroundColor: "#0D0D0D",
    color: "#888888",
    border: "none",
  },
  ".cm-content": {
    caretColor: "#6C63FF",
  },
  ".cm-activeLine": { backgroundColor: "#141414" },
  ".cm-activeLineGutter": { backgroundColor: "#141414" },
  ".cm-scroller": { overflow: "auto" },
});

export function BodyView({ body }: { body: string }) {
  const [raw, setRaw] = useState(false);
  const { pretty, ok } = useMemo(() => tryPrettyJSON(body), [body]);
  const value = raw || !ok ? body : pretty;

  return (
    <div className="flex flex-col h-full">
      <div className="h-[32px] px-3 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setRaw(false)}
            disabled={!ok}
            className={cn(
              "h-[20px] px-2 text-11 rounded-sm transition-colors",
              !raw && ok
                ? "bg-card text-text"
                : "text-subtext hover:text-text disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            Pretty
          </button>
          <button
            type="button"
            onClick={() => setRaw(true)}
            className={cn(
              "h-[20px] px-2 text-11 rounded-sm transition-colors",
              raw || !ok ? "bg-card text-text" : "text-subtext hover:text-text",
            )}
          >
            Raw
          </button>
        </div>
        <CopyButton text={body} />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {body ? (
          <CodeMirror
            value={value}
            theme={oneDark}
            extensions={[json(), fluxTheme, EditorView.lineWrapping]}
            editable={false}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
              highlightActiveLineGutter: true,
            }}
            height="100%"
            className="h-full"
          />
        ) : (
          <div className="p-5 text-12 text-subtext">No body returned.</div>
        )}
      </div>
    </div>
  );
}
