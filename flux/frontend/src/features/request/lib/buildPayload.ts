import type { KeyValue, RequestState } from "@/features/request/types/request";
import { useEnvStore } from "@/features/env/stores/useEnvStore";

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
  specPath?: string;
  graphqlQuery: string;
  graphqlVariables: string;
  preScript: string;
  postScript: string;
  grpcService?: string;
  grpcMethod?: string;
  mqttTopic?: string;
  soapAction?: string;
  soapVersion?: string;
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
  if (s.authType === "digest" || s.authType === "ntlm") authValue = `${resolve(s.authUsername ?? "")}:${resolve(s.authPassword ?? "")}`;
  if (s.authType === "apikey") authValue = `${s.authKeyIn}:${resolve(s.authKeyName)}:${resolve(s.authKeyValue)}`;
  if (s.authType === "oauth2" && s.oauth2Config) {
    authValue = JSON.stringify({
      accessToken: s.oauth2Config.accessToken,
      tokenType: "Bearer",
    });
  }

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
    graphqlQuery: s.bodyType === "graphql" ? resolve(s.graphqlQuery) : "",
    graphqlVariables: s.bodyType === "graphql" ? resolve(s.graphqlVariables) : "",
    preScript: s.preScript ?? "",
    postScript: s.postScript ?? "",
    grpcService: s.bodyType === "grpc" ? s.grpcService : undefined,
    grpcMethod: s.bodyType === "grpc" ? s.grpcMethod : undefined,
    soapAction: s.bodyType === "soap" ? s.soapAction : undefined,
    soapVersion: s.bodyType === "soap" ? s.soapVersion : undefined,
  };
}

// Pre-resolve variant used for the persisted payload when saving a request:
// we want the literal {{var}} placeholders preserved on disk, not the values
// from the active env. Save flow should call this instead of buildPayload.
export function buildPayloadLiteral(s: RequestState): WirePayload {
  let authValue = "";
  if (s.authType === "bearer") authValue = s.authToken;
  if (s.authType === "basic") authValue = `${s.authUser}:${s.authPass}`;
  if (s.authType === "digest" || s.authType === "ntlm") authValue = `${s.authUsername}:${s.authPassword}`;
  if (s.authType === "apikey") authValue = `${s.authKeyIn}:${s.authKeyName}:${s.authKeyValue}`;
  if (s.authType === "oauth2" && s.oauth2Config) {
    authValue = JSON.stringify({ accessToken: s.oauth2Config.accessToken, tokenType: "Bearer" });
  }

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
    graphqlQuery: s.bodyType === "graphql" ? s.graphqlQuery : "",
    graphqlVariables: s.bodyType === "graphql" ? s.graphqlVariables : "",
    preScript: s.preScript ?? "",
    postScript: s.postScript ?? "",
    grpcService: s.bodyType === "grpc" ? s.grpcService : undefined,
    grpcMethod: s.bodyType === "grpc" ? s.grpcMethod : undefined,
    soapAction: s.bodyType === "soap" ? s.soapAction : undefined,
    soapVersion: s.bodyType === "soap" ? s.soapVersion : undefined,
  };
}
