import { EditorView } from "@codemirror/view";

export const fluxCmTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--cm-bg)",
    fontSize: "12px",
    fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace",
    height: "100%",
  },
  ".cm-gutters": {
    backgroundColor: "var(--cm-gutter-bg)",
    color: "var(--cm-gutter-color)",
    border: "none",
  },
  ".cm-content": {
    caretColor: "var(--cm-caret)",
  },
  ".cm-activeLine": { backgroundColor: "var(--cm-active-line)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--cm-active-line)" },
  ".cm-scroller": { overflow: "auto" },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "var(--cm-selection)",
  },
});
