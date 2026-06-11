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
  minHeight?: string;
};

export function JsonEditor({
  value,
  onChange,
  readOnly = false,
  placeholder,
  minHeight = "240px",
}: Props) {
  const theme = useThemeStore((s) => s.resolved);
  const extensions = useMemo(
    () => [json(), fluxCmTheme, EditorView.lineWrapping],
    [],
  );

  return (
    <div style={{ minHeight }} className="h-full flex flex-col">
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
        className="h-full"
      />
    </div>
  );
}
