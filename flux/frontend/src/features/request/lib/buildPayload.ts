import type { KeyValue, RequestState } from "@/features/request/types/request";
import { useEnvStore } from "@/features/env/stores/useEnvStore";
import { vaultRefName } from "@/features/env/lib/vaultRefs";

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
  notes: string;
  timeout: number;
  grpcService?: string;
  grpcMethod?: string;
  grpcBody?: string;
  mqttTopic?: string;
  soapAction?: string;
  soapVersion?: string;
  clientCert?: string;
  clientKey?: string;
  /**
   * The request as the user wrote it, before variable substitution, plus the
   * source of each placeholder. The backend records this in the run receipt so
   * the receipt describes the request without holding a resolved secret.
   */
  origin?: WireOrigin;
}

export interface WireOrigin {
  url: string;
  headers: { key: string; value: string; enabled: boolean }[];
  params: { key: string; value: string; enabled: boolean }[];
  body: string;
  bodyForm: { key: string; value: string; enabled: boolean }[];
  varSources?: Record<string, string>;
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

export function buildPayload(s: RequestState, extraVars?: Map<string, string>): WirePayload {
  const resolve = (text: string) => useEnvStore.getState().resolve(text, extraVars);

  let authValue = "";
  if (s.authType === "bearer") authValue = resolve(s.authToken);
  if (s.authType === "token") authValue = resolve(s.authToken);
  if (s.authType === "basic") authValue = `${resolve(s.authUser)}:${resolve(s.authPass)}`;
  if (s.authType === "digest" || s.authType === "ntlm") authValue = `${resolve(s.authUsername ?? "")}:${resolve(s.authPassword ?? "")}`;
  if (s.authType === "apikey") authValue = `${s.authKeyIn}:${resolve(s.authKeyName)}:${resolve(s.authKeyValue)}`;
  if (s.authType === "oauth2" && s.oauth2Config) {
    // Secrets (accessToken/refreshToken) are transient here: the Go backend
    // strips them and migrates them to the OS keychain before anything is
    // written to a git-tracked file. tokenRef + config round-trip on disk.
    // clientSecret is deliberately never included.
    authValue = JSON.stringify({
      tokenRef: s.oauth2Config.tokenRef,
      accessToken: s.oauth2Config.accessToken,
      refreshToken: s.oauth2Config.refreshToken,
      expiresAt: s.oauth2Config.expiresAt,
      tokenType: "Bearer",
      authUrl: s.oauth2Config.authUrl,
      tokenUrl: s.oauth2Config.tokenUrl,
      deviceUrl: s.oauth2Config.deviceUrl,
      clientId: s.oauth2Config.clientId,
      scopes: s.oauth2Config.scopes,
      redirectUri: s.oauth2Config.redirectUri,
      usePkce: s.oauth2Config.usePkce,
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
    notes: s.notes ?? "",
    timeout: s.timeout ?? 0,
    grpcService: s.bodyType === "grpc" ? s.grpcService : undefined,
    grpcMethod: s.bodyType === "grpc" ? s.grpcMethod : undefined,
    grpcBody: s.bodyType === "grpc" ? s.grpcBody : undefined,
    soapAction: s.bodyType === "soap" ? s.soapAction : undefined,
    soapVersion: s.bodyType === "soap" ? s.soapVersion : undefined,
    clientCert: s.clientCert ?? "",
    clientKey: s.clientKey ?? "",
  };
}

// Pre-resolve variant used for the persisted payload when saving a request:
// we want the literal {{var}} placeholders preserved on disk, not the values
// from the active env. Save flow should call this instead of buildPayload.
export function buildPayloadLiteral(s: RequestState): WirePayload {
  let authValue = "";
  if (s.authType === "bearer") authValue = s.authToken;
  if (s.authType === "token") authValue = s.authToken;
  if (s.authType === "basic") authValue = `${s.authUser}:${s.authPass}`;
  if (s.authType === "digest" || s.authType === "ntlm") authValue = `${s.authUsername}:${s.authPassword}`;
  if (s.authType === "apikey") authValue = `${s.authKeyIn}:${s.authKeyName}:${s.authKeyValue}`;
  if (s.authType === "oauth2" && s.oauth2Config) {
    // Same transient shape as buildPayload — the Go backend migrates secrets
    // to the keychain before persisting; only config + tokenRef reach disk.
    authValue = JSON.stringify({
      tokenRef: s.oauth2Config.tokenRef,
      accessToken: s.oauth2Config.accessToken,
      refreshToken: s.oauth2Config.refreshToken,
      expiresAt: s.oauth2Config.expiresAt,
      tokenType: "Bearer",
      authUrl: s.oauth2Config.authUrl,
      tokenUrl: s.oauth2Config.tokenUrl,
      deviceUrl: s.oauth2Config.deviceUrl,
      clientId: s.oauth2Config.clientId,
      scopes: s.oauth2Config.scopes,
      redirectUri: s.oauth2Config.redirectUri,
      usePkce: s.oauth2Config.usePkce,
    });
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
    notes: s.notes ?? "",
    timeout: s.timeout ?? 0,
    grpcService: s.bodyType === "grpc" ? s.grpcService : undefined,
    grpcMethod: s.bodyType === "grpc" ? s.grpcMethod : undefined,
    grpcBody: s.bodyType === "grpc" ? s.grpcBody : undefined,
    soapAction: s.bodyType === "soap" ? s.soapAction : undefined,
    soapVersion: s.bodyType === "soap" ? s.soapVersion : undefined,
    clientCert: s.clientCert ?? "",
    clientKey: s.clientKey ?? "",
  };
}

const VAR_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

function collectVarNames(text: string, into: Set<string>) {
  for (const match of text.matchAll(VAR_PATTERN)) into.add(match[1]);
}

/**
 * buildOrigin returns the request before substitution plus the source of every
 * placeholder. The values are deliberately absent: the backend stores the
 * names and their origin, never the resolved secret.
 */
export function buildOrigin(
  requestState: RequestState,
  collVars: Map<string, string> | undefined,
): WireOrigin {
  const literal = buildPayloadLiteral(requestState);
  const envVars = useEnvStore.getState().activeVars();
  const names = new Set<string>();
  collectVarNames(literal.url, names);
  collectVarNames(literal.body, names);
  for (const h of literal.headers) collectVarNames(h.value, names);
  for (const p of literal.params) collectVarNames(p.value, names);
  for (const f of literal.bodyForm) collectVarNames(f.value, names);

  // Same precedence as payloadForSend/mergeVars: a collection variable wins
  // over a vault reference, which wins over a plain environment variable.
  const varSources: Record<string, string> = {};
  for (const name of names) {
    if (collVars?.has(name)) {
      varSources[name] = "collection";
    } else if (vaultRefName(envVars.get(name))) {
      varSources[name] = "vault";
    } else if (envVars.has(name)) {
      varSources[name] = "environment";
    } else {
      varSources[name] = "unresolved";
    }
  }

  return {
    url: literal.url,
    headers: literal.headers,
    params: literal.params,
    body: literal.body,
    bodyForm: literal.bodyForm,
    varSources,
  };
}
