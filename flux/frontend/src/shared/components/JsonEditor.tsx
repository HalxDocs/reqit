import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import { fluxCmTheme } from "@/shared/lib/cmTheme";
import { useThemeStore } from "@/shared/lib/useTheme";

type Props = {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
};

export function JsonEditor({ value, onChange, readOnly = false, placeholder }: Props) {
  const theme = useThemeStore((s) => s.resolved);
  const extensions = useMemo(
    () => [
      json(),
      fluxCmTheme,
      EditorView.lineWrapping,
      // The editor has to own its scrolling, otherwise a large document makes
      // the editor grow to the full document height and pushes the rest of the
      // request panel out of view. Pinning the height to the container and
      // letting the scroller overflow keeps a multi-megabyte payload inside
      // the panel and scrolls internally.
      EditorView.theme({
        "&": { height: "100%", minHeight: "0" },
        ".cm-scroller": { overflow: "auto" },
      }),
    ],
    [],
  );

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <CodeMirror
        value={value}
        theme={theme}
        extensions={extensions}
        editable={!readOnly}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(val) => onChange?.(val)}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: !readOnly,
          highlightActiveLineGutter: !readOnly,
          autocompletion: false,
        }}
        height="100%"
        className="h-full min-h-0 overflow-hidden"
      />
    </div>
  );
}
