import { useCallback } from "react";
import { SendRequest } from "../../../../wailsjs/go/main/App";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { useResponseStore } from "@/features/request/stores/useResponseStore";
import { useHistoryStore } from "@/features/history/stores/useHistoryStore";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";
import { useUIStore } from "@/app/stores/useUIStore";
import { buildPayload } from "@/features/request/lib/buildPayload";
import type { ResponseResult } from "@/features/request/types/request";

export function useSendRequest() {
  const setResponse = useResponseStore((s) => s.setResponse);
  const setLoading = useResponseStore((s) => s.setLoading);
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

    // Resolve spec path from the loaded request's collection (for contract testing).
    const loadedID = useUIStore.getState().loadedRequestID;
    let specPath: string | undefined;
    if (loadedID) {
      const colls = useCollectionStore.getState().collections;
      for (const col of colls) {
        if (col.requests.some((r) => r.id === loadedID) && col.spec) {
          specPath = col.spec;
          break;
        }
      }
    }

    setLoading(true);
    try {
      const payload = buildPayload(requestState);
      if (specPath) (payload as typeof payload & { specPath: string }).specPath = specPath;
      const result = (await SendRequest(payload as never)) as ResponseResult;
      setResponse(result);
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
  }, [setLoading, setResponse, refreshHistory]);
}
