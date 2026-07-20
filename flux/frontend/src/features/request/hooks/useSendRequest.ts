import { useCallback } from "react";
import { SendRequest, SetEnvVar, UpdateSavedRequest } from "../../../../wailsjs/go/main/App";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { useResponseStore } from "@/features/request/stores/useResponseStore";
import { useHistoryStore } from "@/features/history/stores/useHistoryStore";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";
import { useEnvStore } from "@/features/env/stores/useEnvStore";
import { useUIStore } from "@/app/stores/useUIStore";
import { useTabsStore } from "@/features/tabs/stores/useTabsStore";
import { buildPayload, buildPayloadLiteral } from "@/features/request/lib/buildPayload";
import { runSecurityChecks } from "@/features/request/lib/securityCheck";
import { setEndpointCache } from "@/features/request/stores/useEndpointCache";
import type { ResponseResult } from "@/features/request/types/request";

export function useSendRequest() {
  const setResponse = useResponseStore((s) => s.setResponse);
  const setLoading = useResponseStore((s) => s.setLoading);
  const setSecurityWarnings = useResponseStore((s) => s.setSecurityWarnings);
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

    // Resolve spec path and collection vars from the loaded request's collection.
    const loadedID = useUIStore.getState().loadedRequestID;
    let specPath: string | undefined;
    let collVars: Map<string, string> | undefined;
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
          break;
        }
      }
    }

    // Resolve PreSetVars into the active environment (request chaining data pipeline)
    const preSetVars = requestState.preSetVars?.filter((v) => v.key);
    if (preSetVars?.length) {
      const resolve = useEnvStore.getState().resolve;
      for (const v of preSetVars) {
        const resolved = resolve(v.value, collVars);
        try { await SetEnvVar(v.key, resolved); } catch { /* best-effort */ }
      }
    }

    setLoading(true);
    try {
      const payload = buildPayload(requestState, collVars);
      if (specPath) (payload as typeof payload & { specPath: string }).specPath = specPath;
      const result = (await SendRequest(payload as never)) as ResponseResult;
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
      refreshHistory().catch(() => undefined);
    }
  }, [setLoading, setResponse, setSecurityWarnings, refreshHistory]);
}
