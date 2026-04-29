import type { KeyValue, RequestState } from "../types/request";
import { useEnvStore } from "../stores/useEnvStore";

export interface WirePayload {
  method: string;
  url: string;
  headers: { key: string; value: string; enabled: boolean }[];
  params: { key: string; value: string; enabled: boolean }[];
  bodyType: string;
  body: string;
  bodyForm: { key: string; value: string; enabled: boolean }[];
  authType: string;
  authValue: string;
}

const stripId = (kv: KeyValue) => ({
  key: kv.key,
  value: kv.value,
  enabled: kv.enabled,
});

const resolveKV = (kv: KeyValue, resolve: (s: string) => string) => ({
  key: resolve(kv.key),
  value: resolve(kv.value),
  enabled: kv.enabled,
});

export function buildPayload(s: RequestState): WirePayload {
  const resolve = useEnvStore.getState().resolve;

  let authValue = "";
  if (s.authType === "bearer") authValue = resolve(s.authToken);
  if (s.authType === "basic") authValue = `${resolve(s.authUser)}:${resolve(s.authPass)}`;
  if (s.authType === "apikey") authValue = `${s.authKeyIn}:${resolve(s.authKeyName)}:${resolve(s.authKeyValue)}`;

  return {
    method: s.method,
    url: resolve(s.url),
    headers: s.headers.map((kv) => resolveKV(kv, resolve)),
    params: s.params.map((kv) => resolveKV(kv, resolve)),
    bodyType: s.bodyType,
    body: s.bodyType === "json" ? resolve(s.bodyRaw) : "",
    bodyForm: s.bodyForm.map((kv) => resolveKV(kv, resolve)),
    authType: s.authType,
    authValue,
  };
}

// Pre-resolve variant used for the persisted payload when saving a request:
// we want the literal {{var}} placeholders preserved on disk, not the values
// from the active env. Save flow should call this instead of buildPayload.
export function buildPayloadLiteral(s: RequestState): WirePayload {
  let authValue = "";
  if (s.authType === "bearer") authValue = s.authToken;
  if (s.authType === "basic") authValue = `${s.authUser}:${s.authPass}`;
  if (s.authType === "apikey") authValue = `${s.authKeyIn}:${s.authKeyName}:${s.authKeyValue}`;

  return {
    method: s.method,
    url: s.url,
    headers: s.headers.map(stripId),
    params: s.params.map(stripId),
    bodyType: s.bodyType,
    body: s.bodyType === "json" ? s.bodyRaw : "",
    bodyForm: s.bodyForm.map(stripId),
    authType: s.authType,
    authValue,
  };
}
