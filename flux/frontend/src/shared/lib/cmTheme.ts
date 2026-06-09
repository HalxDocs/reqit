import { EditorView } from "@codemirror/view";

export const fluxCmTheme = EditorView.theme({
  "&": {
    backgroundColor: "#0F1117",
    fontSize: "12px",
    fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace",
    height: "100%",
  },
  ".cm-gutters": {
    backgroundColor: "#0F1117",
    color: "#6B7280",
    border: "none",
  },
  ".cm-content": {
    caretColor: "#7C3AED",
  },
  ".cm-activeLine": { backgroundColor: "#161B22" },
  ".cm-activeLineGutter": { backgroundColor: "#161B22" },
  ".cm-scroller": { overflow: "auto" },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(124, 58, 237, 0.25)",
  },
});
