import { useMemo, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { Modal } from "../shared/Modal";
import { useUIStore } from "../../stores/useUIStore";
import { useRequestStore } from "../../stores/useRequestStore";
import { buildPayload } from "../../lib/buildPayload";
import { toCurl, toJsFetch, toPythonRequests } from "../../lib/codegen";
import { cn } from "../../lib/cn";

type Lang = "curl" | "fetch" | "python";

const LANGS: { id: Lang; label: string }[] = [
  { id: "curl", label: "cURL" },
  { id: "fetch", label: "JavaScript (fetch)" },
  { id: "python", label: "Python (requests)" },
];

function useRequestSnapshot() {
  const method = useRequestStore((s) => s.method);
  const url = useRequestStore((s) => s.url);
  const headers = useRequestStore((s) => s.headers);
  const params = useRequestStore((s) => s.params);
  const bodyType = useRequestStore((s) => s.bodyType);
  const bodyRaw = useRequestStore((s) => s.bodyRaw);
  const bodyForm = useRequestStore((s) => s.bodyForm);
  const authType = useRequestStore((s) => s.authType);
  const authToken = useRequestStore((s) => s.authToken);
  const authUser = useRequestStore((s) => s.authUser);
  const authPass = useRequestStore((s) => s.authPass);
  const authKeyName = useRequestStore((s) => s.authKeyName);
  const authKeyValue = useRequestStore((s) => s.authKeyValue);
  const authKeyIn = useRequestStore((s) => s.authKeyIn);
  const preSetVars = useRequestStore((s) => s.preSetVars);
  const extractRules = useRequestStore((s) => s.extractRules);
  return useMemo(() => ({
    method, url, headers, params, bodyType, bodyRaw, bodyForm,
    authType, authToken, authUser, authPass, authKeyName, authKeyValue, authKeyIn,
    preSetVars, extractRules,
  }), [method, url, headers, params, bodyType, bodyRaw, bodyForm,
      authType, authToken, authUser, authPass, authKeyName, authKeyValue, authKeyIn,
      preSetVars, extractRules]);
}

export function CodeGenModal() {
  const open = useUIStore((s) => s.codeGenModalOpen);
  const close = useUIStore((s) => s.closeCodeGenModal);
  const requestSnapshot = useRequestSnapshot();
  const [lang, setLang] = useState<Lang>("curl");
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();

  const code = useMemo(() => {
    if (!open) return "";
    const payload = buildPayload(requestSnapshot);
    if (lang === "curl") return toCurl(payload);
    if (lang === "fetch") return toJsFetch(payload);
    return toPythonRequests(payload);
  }, [open, lang, requestSnapshot]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      const { toast } = await import("../../stores/useToastStore");
      toast.success("Copied to clipboard");
    } catch {
      // ignore
    }
  };

  return (
    <Modal open={open} onClose={close} title="Generate code">
      <div className="flex flex-col gap-3 w-[600px] max-w-full">
        <div className="flex items-center gap-1 border-b border-border">
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLang(l.id)}
              className={cn(
                "relative px-3 h-[32px] text-12 font-semibold transition-colors",
                lang === l.id ? "text-text" : "text-subtext hover:text-text",
              )}
            >
              {l.label}
              {lang === l.id && (
                <span className="absolute left-3 right-3 bottom-0 h-[2px] bg-blue rounded-full" />
              )}
            </button>
          ))}
        </div>

        <pre className="bg-bg border border-border rounded-md p-3 max-h-[400px] overflow-auto font-mono text-12 text-teal whitespace-pre-wrap break-all">
          {code}
        </pre>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="h-[32px] px-3 text-12 text-subtext hover:text-text rounded-md transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={copy}
            className="h-[32px] px-4 bg-blue hover:bg-blue-hover text-white text-12 font-bold rounded-md flex items-center gap-2 transition-all"
          >
            <Copy size={12} />
            <span>Copy</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
