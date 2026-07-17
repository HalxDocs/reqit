import { useMemo, useCallback, useEffect } from "react";
import { Download } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { EditorView } from "@codemirror/view";
import { CopyButton } from "@/features/response/components/CopyButton";
import { JsonTreeView } from "@/features/response/components/JsonTreeView";
import { tryPretty, detectBodyKind } from "@/shared/lib/format";
import { fluxCmTheme } from "@/shared/lib/cmTheme";
import { useThemeStore } from "@/shared/lib/useTheme";
import { useUIStore } from "@/app/stores/useUIStore";
import { cn } from "@/shared/lib/cn";
import { safeFilename } from "@/shared/lib/download";
import { DownloadBinaryResponse } from "../../../../wailsjs/go/main/App";

export function BodyView({
  body,
  contentType,
  bodyIsBase64,
}: {
  body: string;
  contentType: string;
  bodyIsBase64?: boolean;
}) {
  const theme = useThemeStore((s) => s.resolved);
  const responseSearch = useUIStore((s) => s.responseSearch);
  const bodyView = useUIStore((s) => s.responseBodyView);
  const setBodyView = useUIStore((s) => s.setResponseBodyView);

  const { pretty, ok, kind } = useMemo(
    () => tryPretty(body, contentType),
    [body, contentType],
  );

  const kind2 = detectBodyKind(body, contentType);

  const isImage = kind2 === "image";
  const isBinary = kind2 === "binary" && kind !== "json" && kind !== "xml" && kind !== "html";

  const parsedJson = useMemo(() => {
    if (bodyView !== "tree" || kind !== "json") return null;
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }, [body, bodyView, kind]);

  let value: string;
  if (isImage || isBinary) {
    value = bodyView === "hex" ? toHex(body) : bodyView === "raw" ? body : body;
  } else {
    value = bodyView === "pretty" && ok ? pretty : body;
    if (bodyView === "hex") value = toHex(body);
  }

  const cmExtensions = useMemo(() => {
    const base = [fluxCmTheme, EditorView.lineWrapping];
    if (bodyView === "hex" || isImage || bodyView === "tree") return base;
    if (kind === "json") return [json(), ...base];
    if (kind === "xml" || kind === "html") return [xml(), ...base];
    return base;
  }, [kind, bodyView, isImage]);

  const filteredValue = useMemo(() => {
    if (!responseSearch) return value;
    const q = responseSearch.toLowerCase();
    return value.split("\n").filter((l) => l.toLowerCase().includes(q)).join("\n");
  }, [value, responseSearch]);

  const showViewToggle = !isImage;

  const canTree = kind === "json";

  const cycleView = useCallback(() => {
    if (canTree) {
      const order: Array<"pretty" | "raw" | "tree"> = ["tree", "pretty", "raw"];
      const idx = order.indexOf(bodyView as "pretty" | "raw" | "tree");
      setBodyView(order[(idx + 1) % order.length]);
    } else {
      setBodyView(bodyView === "pretty" ? "raw" : "pretty");
    }
  }, [bodyView, setBodyView, canTree]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const parts: string[] = [];
      if (e.metaKey || e.ctrlKey) parts.push(e.metaKey ? "meta" : "ctrl");
      if (e.shiftKey) parts.push("shift");
      const key = e.key.toLowerCase();
      if (key === "control" || key === "alt" || key === "shift" || key === "meta") return;
      parts.push(key);
      const combo = parts.join("+");
      if (combo === "meta+shift+r" || combo === "ctrl+shift+r") {
        e.preventDefault();
        cycleView();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [cycleView]);

  return (
      <div className="flex flex-col flex-1 min-h-0">
      <div className="h-[32px] px-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          {showViewToggle && (
            <>
              {canTree && (
                <button
                  type="button"
                  onClick={() => setBodyView("tree")}
                  className={cn(
                    "h-[20px] px-2 text-11 rounded-sm transition-colors",
                    bodyView === "tree"
                      ? "bg-card text-text"
                      : "text-subtext hover:text-text",
                  )}
                >
                  Tree
                </button>
              )}
              <button
                type="button"
                onClick={() => setBodyView("pretty")}
                disabled={!ok && kind !== "text"}
                className={cn(
                  "h-[20px] px-2 text-11 rounded-sm transition-colors",
                  bodyView === "pretty" && (ok || kind === "text")
                    ? "bg-card text-text"
                    : "text-subtext hover:text-text disabled:opacity-40 disabled:cursor-not-allowed",
                )}
              >
                Pretty
              </button>
              <button
                type="button"
                onClick={() => setBodyView("raw")}
                className={cn(
                  "h-[20px] px-2 text-11 rounded-sm transition-colors",
                  bodyView === "raw" ? "bg-card text-text" : "text-subtext hover:text-text",
                )}
              >
                Raw
              </button>
            </>
          )}
          {(isBinary || isImage) && (
            <button
              type="button"
              onClick={() => setBodyView("hex")}
              className={cn(
                "h-[20px] px-2 text-11 rounded-sm transition-colors",
                bodyView === "hex" ? "bg-card text-text" : "text-subtext hover:text-text",
              )}
            >
              Hex
            </button>
          )}
          <span className="ml-2 text-11 text-subtext uppercase tracking-wider">
            {kind}
          </span>
          {responseSearch && (
            <span className="ml-2 text-11 text-cyan">
              Filtered: {filteredValue.split("\n").filter(Boolean).length} matching lines
            </span>
          )}
        </div>
        {(isImage || bodyIsBase64 || kind === "binary") && (
          <button
            type="button"
            onClick={() => {
              const ext = contentType.split("/").pop() || "bin";
              const data = bodyIsBase64
                ? Array.from(atob(body), (c) => c.charCodeAt(0))
                : Array.from(new TextEncoder().encode(body));
              DownloadBinaryResponse(data, safeFilename(`response.${ext}`));
            }}
            className="h-[28px] px-2 flex items-center gap-1 text-11 text-subtext hover:text-text hover:bg-cardHover rounded-sm transition-colors"
            title="Download response"
          >
            <Download size={12} />
            Download
          </button>
        )}
        <CopyButton text={body} />
      </div>

      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 overflow-auto">
        {isImage ? (
          <div className="flex items-center justify-center h-full p-4">
            <img
              src={`data:${contentType || "image/png"};base64,${bodyIsBase64 ? body : btoa(
                Array.from(new TextEncoder().encode(body))
                  .map((b) => String.fromCharCode(b))
                  .join("")
              )}`}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
              alt="Response image"
              className="max-w-full max-h-full object-contain rounded-md"
            />
          </div>
        ) : bodyView === "tree" && parsedJson !== null ? (
          <div className="h-full overflow-auto p-2">
            <JsonTreeView data={parsedJson} />
          </div>
        ) : body ? (
          <CodeMirror
            value={filteredValue}
            theme={theme}
            extensions={cmExtensions}
            editable={false}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
              highlightActiveLineGutter: true,
              searchKeymap: true,
            }}
          />
        ) : (
          <div className="p-5 text-12 text-subtext">No body returned.</div>
        )}
        </div>
      </div>
    </div>
  );
}

function toHex(s: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(s);
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const hex: string[] = [];
    const ascii: string[] = [];
    for (let j = 0; j < 16 && i + j < bytes.length; j++) {
      const b = bytes[i + j];
      hex.push(b.toString(16).padStart(2, "0"));
      ascii.push(b >= 32 && b <= 126 ? String.fromCharCode(b) : ".");
    }
    lines.push(
      i.toString(16).padStart(8, "0") +
      "  " + hex.slice(0, 8).join(" ") + "  " + hex.slice(8).join(" ") +
      "  |" + ascii.join("") + "|"
    );
  }
  return lines.join("\n");
}
