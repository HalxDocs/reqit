import { useCallback, useRef } from "react";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import type { RequestState } from "@/features/request/types/request";

const MAX_HISTORY = 50;

function snapshot(s: ReturnType<typeof useRequestStore.getState>): RequestState {
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
    timeout: 0,
  };
}

export function useUndoRedo() {
  const undoStack = useRef<RequestState[]>([]);
  const redoStack = useRef<RequestState[]>([]);

  const pushSnapshot = useCallback(() => {
    const s = useRequestStore.getState();
    undoStack.current.push(snapshot(s));
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const undo = useCallback(() => {
    const s = useRequestStore.getState();
    const current = snapshot(s);
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(current);
    useRequestStore.getState().loadState(prev);
  }, []);

  const redo = useCallback(() => {
    const s = useRequestStore.getState();
    const current = snapshot(s);
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(current);
    useRequestStore.getState().loadState(next);
  }, []);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  return { pushSnapshot, undo, redo, canUndo, canRedo };
}
