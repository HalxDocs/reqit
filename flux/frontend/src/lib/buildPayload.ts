import type { KeyValue, RequestState } from "../types/request";

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

export function buildPayload(s: RequestState): WirePayload {
  let authValue = "";
  if (s.authType === "bearer") authValue = s.authToken;
  if (s.authType === "basic") authValue = `${s.authUser}:${s.authPass}`;

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
