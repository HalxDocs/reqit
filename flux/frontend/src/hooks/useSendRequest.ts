import { useCallback } from "react";
import { SendRequest } from "../../wailsjs/go/main/App";
import { useRequestStore } from "../stores/useRequestStore";
import { useResponseStore } from "../stores/useResponseStore";
import { buildPayload } from "../lib/buildPayload";
import type { ResponseResult } from "../types/request";

export function useSendRequest() {
  const setResponse = useResponseStore((s) => s.setResponse);
  const setLoading = useResponseStore((s) => s.setLoading);

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
      });
      return;
    }

    setLoading(true);
    try {
      const payload = buildPayload(requestState);
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
      });
    }
  }, [setLoading, setResponse]);
}
