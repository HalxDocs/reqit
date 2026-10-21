import { useRequestStore } from "@/features/request/stores/useRequestStore";
import type { RequestState } from "@/features/request/types/request";

/**
 * Capture the parts of a request that undo and redo restore.
 *
 * Kept in one place so the snapshot stays in step with the request shape —
 * a field added here but missing from the snapshot would silently vanish on
 * undo.
 */
export function snapshotRequestState(): RequestState {
  const s = useRequestStore.getState();
  return {
    method: s.method,
    url: s.url,
    params: s.params,
    headers: s.headers,
    bodyType: s.bodyType,
    bodyRaw: s.bodyRaw,
    bodyForm: s.bodyForm,
    authType: s.authType,
    authToken: s.authToken,
    authUser: s.authUser,
    authPass: s.authPass,
    authKeyName: s.authKeyName,
    authKeyValue: s.authKeyValue,
    authKeyIn: s.authKeyIn,
    preSetVars: s.preSetVars,
    extractRules: s.extractRules,
    graphqlQuery: s.graphqlQuery,
    graphqlVariables: s.graphqlVariables,
    preScript: s.preScript,
    postScript: s.postScript,
    notes: s.notes,
    timeout: s.timeout,
  };
}
