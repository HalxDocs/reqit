import type { RequestState } from "@/features/request/types/request";

export interface SecurityWarning {
  level: "warn" | "error";
  message: string;
  detail: string;
}

const API_KEY_PARAMS = ["apikey", "api_key", "api-key", "token", "secret", "key", "auth"];
const AUTH_PATH_HINTS = ["login", "signin", "auth", "token", "oauth", "authorize"];

function isJWT(s: string): boolean {
  return /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(s.trim());
}

function decodeJWTPayload(s: string): Record<string, unknown> | null {
  try {
    const parts = s.trim().split(".");
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

function isEnvVarRef(s: string): boolean {
  return /\{\{.*?\}\}/.test(s);
}

export function runSecurityChecks(state: RequestState): SecurityWarning[] {
  const warnings: SecurityWarning[] = [];

  // 1. HTTP + sensitive data
  if (state.url.startsWith("http://")) {
    if (state.authType === "bearer" && state.authToken) {
      warnings.push({
        level: "error",
        message: "Sending auth token over HTTP",
        detail: "Your Bearer token will be sent in plaintext. Use HTTPS instead.",
      });
    }
    if (state.authType === "basic" && (state.authUser || state.authPass)) {
      warnings.push({
        level: "error",
        message: "Sending Basic auth over HTTP",
        detail: "Basic auth credentials will be base64-encoded but sent in plaintext. Use HTTPS.",
      });
    }
  }

  // 2. Auth hints in URL but auth type is none
  if (state.authType === "none") {
    const urlLower = state.url.toLowerCase();
    for (const hint of AUTH_PATH_HINTS) {
      if (urlLower.includes(hint)) {
        warnings.push({
          level: "warn",
          message: "Auth required endpoint has no auth configured",
          detail: `URL contains "${hint}" but auth type is set to None. Add Bearer Token or another auth method.`,
        });
        break;
      }
    }
  }

  // 3. Hardcoded JWT / token (not using env var)
  if (state.authType === "bearer" && state.authToken && !isEnvVarRef(state.authToken)) {
    if (isJWT(state.authToken)) {
      const payload = decodeJWTPayload(state.authToken);
      if (payload && payload.exp) {
        const exp = Number(payload.exp) * 1000;
        if (Date.now() > exp) {
          warnings.push({
            level: "error",
            message: "JWT token has expired",
            detail: `Token expired ${new Date(exp).toLocaleString()}. Refresh your token before sending.`,
          });
        } else if (Date.now() + 300000 > exp) {
          warnings.push({
            level: "warn",
            message: "JWT token expires soon",
            detail: `Token expires ${new Date(exp).toLocaleString()}. Consider refreshing it.`,
          });
        }
      }
      warnings.push({
        level: "warn",
        message: "Hardcoded JWT in request",
        detail: `Use an environment variable like {{JWT_TOKEN}} instead of pasting the raw JWT. Keeps it out of git.`,
      });
    } else if (state.authToken.length > 20) {
      warnings.push({
        level: "warn",
        message: "Hardcoded auth token",
        detail: `Use an environment variable like {{API_TOKEN}} instead of hardcoding the token value.`,
      });
    }
  }

  // 4. Basic auth over non-HTTPS (already covered in #1, but add extra for Basic)
  if (state.authType === "basic" && state.url.startsWith("http://") && (state.authUser || state.authPass)) {
    // already added above
  }

  // 5. Hardcoded env values in headers (not using {{VAR}})
  for (const h of state.headers) {
    if (!h.enabled) continue;
    const lowerKey = h.key.toLowerCase();
    if (lowerKey === "authorization" || lowerKey === "x-api-key" || lowerKey === "api-key" || lowerKey === "token") {
      if (h.value.length > 20 && !isEnvVarRef(h.value)) {
        warnings.push({
          level: "warn",
          message: `Hardcoded ${h.key} header value`,
          detail: `Use {{VAR}} to reference an environment variable instead of hardcoding the value.`,
        });
      }
    }
  }

  // 6. API key in query params
  try {
    const url = new URL(state.url);
    for (const [key] of url.searchParams) {
      if (API_KEY_PARAMS.includes(key.toLowerCase())) {
        warnings.push({
          level: "warn",
          message: "API key in URL query parameter",
          detail: `Query param "${key}" looks like an API key. URLs are logged by proxies, browsers, and servers. Use a header instead.`,
        });
        break;
      }
    }
  } catch {
    // invalid URL, skip
  }

  // 7. Body without Content-Type
  const hasBody = state.bodyType === "json" || state.bodyType === "form" || state.bodyType === "urlencoded" || state.bodyType === "graphql" || state.bodyType === "grpc" || state.bodyType === "soap";
  const hasContentType = state.headers.some((h) => h.enabled && h.key.toLowerCase() === "content-type");
  if (hasBody && (state.bodyRaw || state.bodyForm.some((f) => f.enabled && f.value)) && !hasContentType) {
    warnings.push({
      level: "warn",
      message: "No Content-Type header",
      detail: `Request has a body but no Content-Type header. The server may reject it.`,
    });
  }

  // 8. POST/PUT/PATCH with no body
  if ((state.method === "POST" || state.method === "PUT" || state.method === "PATCH") && state.bodyType === "none") {
    warnings.push({
      level: "warn",
      message: `${state.method} request has no body`,
      detail: `${state.method} typically sends data. Check the Body tab if you meant to include one.`,
    });
  }

  return warnings;
}
