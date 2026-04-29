import { useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { CopyButton } from "./CopyButton";
import { tryPretty } from "../../lib/format";
import { fluxCmTheme } from "../../lib/cmTheme";
import { cn } from "../../lib/cn";

export function BodyView({
  body,
  contentType,
}: {
  body: string;
  contentType: string;
}) {
  const [raw, setRaw] = useState(false);
  const { pretty, ok, kind } = useMemo(
    () => tryPretty(body, contentType),
    [body, contentType],
  );
  const value = raw || !ok ? body : pretty;

  // CodeMirror only highlights JSON natively in our deps. For XML/HTML/text we
  // still benefit from the editor's gutter/fold/find-with-Cmd-F but skip the
  // language extension.
  const extensions = useMemo(() => {
    const base = [fluxCmTheme, EditorView.lineWrapping];
    return kind === "json" ? [json(), ...base] : base;
  }, [kind]);

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
          <span className="ml-2 text-11 text-subtext uppercase tracking-wider">
            {kind}
          </span>
          <span className="ml-2 text-11 text-subtext hidden sm:inline">
            Press <kbd className="font-mono bg-card px-1 rounded-sm">⌘F</kbd> to search
          </span>
        </div>
        <CopyButton text={body} />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {body ? (
          <CodeMirror
            value={value}
            theme={oneDark}
            extensions={extensions}
            editable={false}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
              highlightActiveLineGutter: true,
              searchKeymap: true,
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
