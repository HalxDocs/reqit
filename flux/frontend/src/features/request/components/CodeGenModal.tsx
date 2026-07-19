import { useMemo, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { Modal } from "@/shared/components/Modal";
import { Button } from "@/shared/components/Button";
import { IconButton } from "@/shared/components/IconButton";
import { useUIStore } from "@/app/stores/useUIStore";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { buildPayload } from "@/features/request/lib/buildPayload";
import { toCurl, toJsFetch, toPythonRequests, toGo, toJava, toCurlShort, toCurlPowerShell } from "@/shared/lib/codegen";
import { cn } from "@/shared/lib/cn";

type Lang = "curl" | "curl-short" | "curl-ps" | "fetch" | "python" | "go" | "java";

const LANGS: { id: Lang; label: string }[] = [
  { id: "curl", label: "cURL" },
  { id: "curl-short", label: "cURL (short)" },
  { id: "curl-ps", label: "cURL (PowerShell)" },
  { id: "fetch", label: "JavaScript (fetch)" },
  { id: "python", label: "Python (requests)" },
  { id: "go", label: "Go (net/http)" },
  { id: "java", label: "Java (HttpURLConnection)" },
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
  const graphqlQuery = useRequestStore((s) => s.graphqlQuery);
  const graphqlVariables = useRequestStore((s) => s.graphqlVariables);
  const preScript = useRequestStore((s) => s.preScript);
  const postScript = useRequestStore((s) => s.postScript);
  const notes = useRequestStore((s) => s.notes);
  return useMemo(() => ({
    method, url, headers, params, bodyType, bodyRaw, bodyForm,
    authType, authToken, authUser, authPass, authKeyName, authKeyValue, authKeyIn,
    preSetVars, extractRules, graphqlQuery, graphqlVariables,
    preScript, postScript, notes,
  }), [method, url, headers, params, bodyType, bodyRaw, bodyForm,
      authType, authToken, authUser, authPass, authKeyName, authKeyValue, authKeyIn,
      preSetVars, extractRules, graphqlQuery, graphqlVariables,
      preScript, postScript, notes]);
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
    switch (lang) {
      case "curl": return toCurl(payload);
      case "curl-short": return toCurlShort(payload);
      case "curl-ps": return toCurlPowerShell(payload);
      case "fetch": return toJsFetch(payload);
      case "python": return toPythonRequests(payload);
      case "go": return toGo(payload);
      case "java": return toJava(payload);
    }
  }, [open, lang, requestSnapshot]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      const { toast } = await import("@/app/stores/useToastStore");
      toast.success("Copied to clipboard");
    } catch {
      // ignore
    }
  };

  return (
    <Modal open={open} onClose={close} title="Generate code">
      <div className="flex flex-col gap-3 w-[680px] max-w-full">
        <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLang(l.id)}
              className={cn(
                "relative px-3 h-[32px] text-12 font-semibold transition-colors whitespace-nowrap shrink-0",
                lang === l.id ? "text-text" : "text-subtext hover:text-text",
              )}
            >
              {l.label}
              {lang === l.id && (
                <span className="absolute left-3 right-3 bottom-0 h-[2px] bg-cyan rounded-full" />
              )}
            </button>
          ))}
        </div>

        <pre className="bg-bg border border-border rounded-md p-3 max-h-[400px] overflow-auto font-mono text-12 text-teal whitespace-pre-wrap break-all">
          {code}
        </pre>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>Close</Button>
          <Button variant="primary" onClick={copy}>
            <Copy size={12} />
            <span>Copy</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
