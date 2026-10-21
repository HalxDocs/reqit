// Measurement harness for the request body editor's scroll behaviour.
//
// Renders the real JsonEditor inside the real layout chain and reports the
// geometry that decides whether the editor scrolls internally or the whole
// panel grows without bound. Used to verify the fix for large JSON payloads.
//
// Run:  npx vite   then open /scripts/json-scroll-harness.html

import { createRoot } from "react-dom/client";
import { JsonEditor } from "@/shared/components/JsonEditor";
import "@/style.css";
import "@/App.css";

const BIG_LINE_COUNT = 60000;
const bigJson = JSON.stringify(
  Array.from({ length: BIG_LINE_COUNT }, (_, i) => ({
    id: i,
    name: `item-${i}`,
    nested: { value: "x".repeat(40), flag: i % 2 === 0 },
  })),
  null,
  2,
);

const host = document.getElementById("editor-host");
if (!host) throw new Error("editor-host missing");

const root = createRoot(host);
root.render(<JsonEditor value={bigJson} onChange={() => {}} />);

// Expose the measurement so the browser driver can read it.
(window as unknown as { __measure: () => unknown }).__measure = () => {
  const scroller = document.querySelector(".cm-scroller") as HTMLElement | null;
  const editor = document.querySelector(".cm-editor") as HTMLElement | null;
  const scrollHost = document.getElementById("scroll-host") as HTMLElement;
  const panel = document.getElementById("panel") as HTMLElement;

  return {
    bytes: bigJson.length,
    lines: bigJson.split("\n").length,
    editorClientHeight: editor?.clientHeight ?? 0,
    editorScrollHeight: editor?.scrollHeight ?? 0,
    scrollerClientHeight: scroller?.clientHeight ?? 0,
    scrollerScrollHeight: scroller?.scrollHeight ?? 0,
    // The editor scrolls internally when its scroller overflows.
    editorScrollsInternally: (scroller?.scrollHeight ?? 0) > (scroller?.clientHeight ?? 0),
    // The panel must not grow past its own height because of the editor.
    panelClientHeight: panel.clientHeight,
    panelScrollHeight: scrollHost.scrollHeight,
    panelScrolls: scrollHost.scrollHeight > scrollHost.clientHeight + 1,
  };
};
