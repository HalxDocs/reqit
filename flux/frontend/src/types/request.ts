export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface KeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export type BodyType = "none" | "json" | "form" | "urlencoded";
export type AuthType = "none" | "bearer" | "basic" | "apikey";
export type ApiKeyIn = "header" | "query";

export interface RequestState {
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  bodyType: BodyType;
  bodyRaw: string;
  bodyForm: KeyValue[];
  authType: AuthType;
  authToken: string;
  authUser: string;
  authPass: string;
  authKeyName: string;
  authKeyValue: string;
  authKeyIn: ApiKeyIn;
}

export interface ResponseResult {
  status: string;
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  timingMs: number;
  sizeBytes: number;
  error: string;
}
