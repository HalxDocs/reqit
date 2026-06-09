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

export type BodyType = "none" | "json" | "form" | "urlencoded" | "graphql";
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
  preSetVars: PreSetVar[];
  extractRules: ExtractRule[];
  graphqlQuery: string;
  graphqlVariables: string;
  preScript: string;
  postScript: string;
}

export interface CookieSummary {
  name: string;
  value: string;
  domain: string;
  expires: string;
  httpOnly: boolean;
  secure: boolean;
}

export interface ValidationError {
  layer: string;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  skipReason: string;
  endpoint: string;
  method: string;
}

export interface SavedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  capturedAt: string;
}

export interface PreSetVar {
  id: string;
  key: string;
  value: string;
}

export interface ExtractRule {
  id: string;
  type: "body_json" | "header";
  source: string;
  target: string;
}

export interface MockOverride {
  enabled: boolean;
  statusCode: number;
  delayMs: number;
  body: string;
}

export interface GraphQLFieldTypeRef {
  name: string;
  kind: string;
  ofType?: GraphQLFieldTypeRef | null;
}

export interface GraphQLSchemaField {
  name: string;
  description?: string;
  type: GraphQLFieldTypeRef | null;
}

export interface GraphQLSchemaType {
  name: string;
  kind: string;
  description?: string;
  fields?: GraphQLSchemaField[];
}

export interface GraphQLSchema {
  types: GraphQLSchemaType[];
}

export interface ResponseResult {
  status: string;
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  timingMs: number;
  sizeBytes: number;
  error: string;
  cookies: CookieSummary[];
  validation?: ValidationResult;
}
