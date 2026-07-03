export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "QUERY",
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface KeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  valueType?: "text" | "file";
}

export type BodyType = "none" | "json" | "form" | "urlencoded" | "graphql" | "grpc" | "soap";
export type AuthType = "none" | "bearer" | "basic" | "apikey" | "digest" | "ntlm" | "oauth2" | "token";
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
  // OAuth2
  oauth2Config?: OAuth2Config;
  // Digest / NTLM
  authUsername?: string;
  authPassword?: string;
  // gRPC
  grpcService?: string;
  grpcMethod?: string;
  grpcBody?: string;
  // SOAP
  soapAction?: string;
  soapVersion?: string;
  soapBody?: string;
  // MQTT
  mqttTopic?: string;
  mqttPayload?: string;
  mqttQoS?: number;
  // GraphQL
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

export interface OAuth2Config {
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  redirectUri: string;
  usePkce: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface OAuth2TokenResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: number;
  error?: string;
}

export interface JWTDecoded {
  header: Record<string, unknown>;
  claims: Record<string, unknown>;
  valid: boolean;
  expired: boolean;
  error?: string;
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

export interface GRPCResponse {
  statusCode: number;
  body: string;
  error?: string;
  durationMs: number;
  headers: Record<string, string>;
}

export interface TimingBreakdown {
  dnsLookupMs: number;
  tcpConnectMs: number;
  tlsHandshakeMs: number;
  ttfbMs: number;
  downloadMs: number;
  totalMs: number;
}

export interface ResponseResult {
  status: string;
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  bodyIsBase64?: boolean;
  timingMs: number;
  timing?: TimingBreakdown;
  sizeBytes: number;
  error: string;
  cookies: CookieSummary[];
  validation?: ValidationResult;
}
