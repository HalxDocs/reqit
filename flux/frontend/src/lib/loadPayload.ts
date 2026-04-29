import type {
  ApiKeyIn,
  AuthType,
  BodyType,
  HttpMethod,
  KeyValue,
  RequestState,
} from "../types/request";
import { uid } from "./id";

interface WireKV {
  key: string;
  value: string;
  enabled: boolean;
}

interface WirePayload {
  method?: string;
  url?: string;
  headers?: WireKV[];
  params?: WireKV[];
  bodyType?: string;
  body?: string;
  bodyForm?: WireKV[];
  authType?: string;
  authValue?: string;
}

const VALID_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const toRow = (kv: WireKV): KeyValue => ({
  id: uid("kv"),
  key: kv.key ?? "",
  value: kv.value ?? "",
  enabled: kv.enabled !== false,
});

const emptyRow = (): KeyValue => ({
  id: uid("kv"),
  key: "",
  value: "",
  enabled: true,
});

const ensureNonEmpty = (rows: KeyValue[]): KeyValue[] =>
  rows.length ? rows : [emptyRow()];

export function decodePayload(p: WirePayload): RequestState {
  const method: HttpMethod = (
    VALID_METHODS.includes(p.method ?? "") ? p.method : "GET"
  ) as HttpMethod;

  const bodyType = (p.bodyType as BodyType) || "none";
  const authType = (p.authType as AuthType) || "none";

  let authToken = "";
  let authUser = "";
  let authPass = "";
  let authKeyName = "X-API-Key";
  let authKeyValue = "";
  let authKeyIn: ApiKeyIn = "header";

  if (authType === "bearer") {
    authToken = p.authValue ?? "";
  } else if (authType === "basic") {
    const raw = p.authValue ?? "";
    const idx = raw.indexOf(":");
    if (idx === -1) {
      authUser = raw;
    } else {
      authUser = raw.slice(0, idx);
      authPass = raw.slice(idx + 1);
    }
  } else if (authType === "apikey") {
    // format: "header:KeyName:value" or "query:paramName:value"
    const raw = p.authValue ?? "";
    const parts = raw.split(":");
    if (parts.length >= 3) {
      authKeyIn = (parts[0] === "query" ? "query" : "header") as ApiKeyIn;
      authKeyName = parts[1];
      authKeyValue = parts.slice(2).join(":");
    }
  }

  return {
    method,
    url: p.url ?? "",
    headers: ensureNonEmpty((p.headers ?? []).map(toRow)),
    params: ensureNonEmpty((p.params ?? []).map(toRow)),
    bodyType,
    bodyRaw: bodyType === "json" ? p.body ?? "" : "",
    bodyForm: ensureNonEmpty((p.bodyForm ?? []).map(toRow)),
    authType,
    authToken,
    authUser,
    authPass,
    authKeyName,
    authKeyValue,
    authKeyIn,
  };
}
