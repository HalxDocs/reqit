import { useCallback } from "react";
import { SendRequestStream, SetEnvVar, UpdateSavedRequest, VaultGetSecret } from "../../../../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../../../../wailsjs/runtime/runtime";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { useResponseStore, type SSEStreamEvent } from "@/features/request/stores/useResponseStore";
import { useHistoryStore } from "@/features/history/stores/useHistoryStore";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";
import { useEnvStore } from "@/features/env/stores/useEnvStore";
import { useUIStore } from "@/app/stores/useUIStore";
import { useTabsStore } from "@/features/tabs/stores/useTabsStore";
import { buildPayload, buildPayloadLiteral } from "@/features/request/lib/buildPayload";
import { runSecurityChecks } from "@/features/request/lib/securityCheck";
import { setEndpointCache } from "@/features/request/stores/useEndpointCache";
import { vaultRefName, containsVaultRef } from "@/features/env/lib/vaultRefs";
import { toast } from "@/app/stores/useToastStore";
import type { ResponseResult } from "@/features/request/types/request";

/**
 * Fetch the secrets that the active environment refers to.
 *
 * An environment value of "{{VAULT_STRIPE_KEY}}" means "ask the configured
 * vault for STRIPE_KEY when a request is sent". The secret is fetched here,
 * held in memory for the length of the request, and never written to disk.
 *
 * The returned map is keyed by the environment variable name, so the usual
 * substitution resolves the request field to the secret. A collection variable
 * of the same name wins, and the vault is not consulted for it.
 */
async function resolveVaultVars(overrides: Map<string, string> | undefined): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  const envVars = useEnvStore.getState().activeVars();

  // Which environment variables point at the vault, and at which secret.
  const wanted = new Map<string, string>();
  for (const [key, value] of envVars) {
    if (overrides?.has(key)) continue;
    const secretName = vaultRefName(value);
    if (secretName) wanted.set(key, secretName);
  }
  if (wanted.size === 0) return resolved;

  for (const [key, secretName] of wanted) {
    try {
      resolved.set(key, await VaultGetSecret(secretName));
    } catch (e) {
      // Leave the reference in place so the failure is visible in the request
      // rather than sending an empty credential.
      toast.error(
        `Could not read ${secretName} from the vault: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return resolved;
}

function makeSessionID(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sse_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function useSendRequest() {
  const setResponse = useResponseStore((s) => s.setResponse);
  const setLoading = useResponseStore((s) => s.setLoading);
  const setSecurityWarnings = useResponseStore((s) => s.setSecurityWarnings);
  const appendStreamEvent = useResponseStore((s) => s.appendStreamEvent);
  const setStreaming = useResponseStore((s) => s.setStreaming);
  const refreshHistory = useHistoryStore((s) => s.load);

  return useCallback(async () => {
    const requestState = useRequestStore.getState();
    if (!requestState.url.trim()) {
      setResponse({
        status: "",
        statusCode: 0,
        headers: {},
        body: "",
        timingMs: 0,
        sizeBytes: 0,
        error: "URL is required",
        cookies: [],
      });
      return;
    }

    // Run security checks before sending
    const warnings = runSecurityChecks(requestState);
    setSecurityWarnings(warnings);

    // Resolve spec path, collection vars, and collection scripts from the loaded request's collection.
    const loadedID = useUIStore.getState().loadedRequestID;
    let specPath: string | undefined;
    let collVars: Map<string, string> | undefined;
    let collPreScript = "";
    let collPostScript = "";
    if (loadedID) {
      const colls = useCollectionStore.getState().collections;
      for (const col of colls) {
        if (col.requests.some((r) => r.id === loadedID)) {
          if (col.spec) specPath = col.spec;
          if (col.variables?.length) {
            collVars = new Map();
            for (const v of col.variables) {
              if (v.enabled !== false && v.key) collVars.set(v.key, v.value ?? "");
            }
          }
          collPreScript = col.preScript ?? "";
          collPostScript = col.postScript ?? "";
          break;
        }
      }
    }

    // Fetch any secrets the environment refers to. The values are held in
    // memory for this request only — they are never written to disk.
    const vaultVars = await resolveVaultVars(collVars);

    // Resolve PreSetVars into the active environment (request chaining data pipeline)
    const preSetVars = requestState.preSetVars?.filter((v) => v.key);
    if (preSetVars?.length) {
      const resolve = useEnvStore.getState().resolve;
      for (const v of preSetVars) {
        // Resolve without the vault values here. This result is persisted to
        // the environment, and a secret must never be written to disk. A value
        // that still refers to the vault is left alone rather than stored as a
        // reference that would never resolve.
        const resolved = resolve(v.value, collVars);
        if (containsVaultRef(resolved)) continue;
        try { await SetEnvVar(v.key, resolved); } catch { /* best-effort */ }
      }
    }

    setLoading(true);
    const sessionID = makeSessionID();

    try {
      // Stream through SendRequestStream so SSE responses are shown live while
      // non-stream responses arrive atomically via the sse:done event.
      const result = await new Promise<ResponseResult>((resolve, reject) => {
        const onEvent = (payload: { sessionId: string; event: SSEStreamEvent }) => {
          if (payload?.sessionId !== sessionID) return;
          appendStreamEvent(payload.event);
          setStreaming(true);
        };
        const onDone = (payload: { sessionId: string; result: ResponseResult }) => {
          if (payload?.sessionId !== sessionID) return;
          EventsOff("sse:event");
          EventsOff("sse:done");
          resolve(payload.result);
        };
        EventsOn("sse:event", onEvent);
        EventsOn("sse:done", onDone);
        SendRequestStream(sessionID, payloadForSend(vaultVars) as never).catch((err: unknown) => {
          EventsOff("sse:event");
          EventsOff("sse:done");
          reject(err);
        });
      });

      setResponse(result);

      // Auto-save request back to collection if it's a saved request
      const tabsState = useTabsStore.getState();
      const activeTab = tabsState.tabs.find((t) => t.id === tabsState.activeID);
      if (activeTab?.savedRequestID) {
        const colls = useCollectionStore.getState().collections;
        for (const col of colls) {
          const saved = col.requests.find((r) => r.id === activeTab.savedRequestID);
          if (saved) {
            const literal = buildPayloadLiteral(requestState);
            UpdateSavedRequest(activeTab.savedRequestID, saved.name, literal as never).catch(() => {});
            break;
          }
        }
      }

      if (result && result.statusCode > 0) {
        setEndpointCache(requestState.method, requestState.url, result.statusCode, result.timingMs, result.status);
      }

      // Apply ExtractRules to save response values into the environment (data pipeline)
      const extractRules = requestState.extractRules?.filter((r) => r.target && r.source);
      if (extractRules?.length && result) {
        for (const rule of extractRules) {
          let value = "";
          if (rule.type === "header" && result.headers) {
            const lower = rule.source.toLowerCase();
            for (const [k, v] of Object.entries(result.headers)) {
              if (k.toLowerCase() === lower) { value = v; break; }
            }
          } else if (rule.type === "body_json" && result.body) {
            try {
              const obj = JSON.parse(result.body);
              const parts = rule.source.split(".");
              let cur: unknown = obj;
              for (const part of parts) {
                if (cur && typeof cur === "object" && part in cur) {
                  cur = (cur as Record<string, unknown>)[part];
                } else { cur = undefined; break; }
              }
              if (typeof cur === "string" || typeof cur === "number" || typeof cur === "boolean") {
                value = String(cur);
              }
            } catch {}
          }
          if (value) {
            try { await SetEnvVar(rule.target, value); } catch { /* best-effort */ }
          }
        }
      }
    } catch (err) {
      setResponse({
        status: "",
        statusCode: 0,
        headers: {},
        body: "",
        timingMs: 0,
        sizeBytes: 0,
        error: err instanceof Error ? err.message : String(err),
        cookies: [],
      });
    } finally {
      EventsOff("sse:event");
      EventsOff("sse:done");
      refreshHistory().catch(() => undefined);
    }
  }, [setLoading, setResponse, setSecurityWarnings, appendStreamEvent, setStreaming, refreshHistory]);
}

// payloadForSend builds the payload at send time from the current request
// state. The vault values are folded in last so a secret always wins over the
// reference it came from.
function payloadForSend(vaultVars: Map<string, string>): unknown {
  const requestState = useRequestStore.getState();
  const loadedID = useUIStore.getState().loadedRequestID;
  let collVars: Map<string, string> | undefined;
  if (loadedID) {
    const colls = useCollectionStore.getState().collections;
    for (const col of colls) {
      if (col.requests.some((r) => r.id === loadedID)) {
        if (col.variables?.length) {
          collVars = new Map();
          for (const v of col.variables) {
            if (v.enabled !== false && v.key) collVars.set(v.key, v.value ?? "");
          }
        }
        const payload = buildPayload(requestState, mergeVars(collVars, vaultVars));
        if (col.preScript) payload.preScript = col.preScript + "\n\n" + (payload.preScript ?? "");
        if (col.postScript) payload.postScript = col.postScript + "\n\n" + (payload.postScript ?? "");
        if (col.spec) (payload as typeof payload & { specPath: string }).specPath = col.spec;
        return payload;
      }
    }
  }
  return buildPayload(requestState, mergeVars(collVars, vaultVars));
}

// mergeVars combines the collection variables with the vault values. The
// collection variables win, because a collection that defines a variable
// means to use its own value rather than the vault.
function mergeVars(
  collVars: Map<string, string> | undefined,
  vaultVars: Map<string, string>,
): Map<string, string> | undefined {
  if (vaultVars.size === 0) return collVars;
  return new Map([...vaultVars, ...(collVars ?? [])]);
}
