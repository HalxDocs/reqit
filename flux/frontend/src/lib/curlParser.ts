// Parses a cURL command string into a Flux request payload. Handles the most
// common flag forms users actually paste from API docs / browser DevTools:
//
//   curl -X POST 'https://api.example.com/users?x=1' \
//     -H 'Authorization: Bearer abc' \
//     -H 'Content-Type: application/json' \
//     -d '{"name":"alice"}'
//
// Not a full bash parser — supports single/double quotes, backslash line
// continuations, and the flag set Postman / Insomnia recognize.

import type {
  AuthType,
  BodyType,
  HttpMethod,
  KeyValue,
  RequestState,
} from "../types/request";
import { uid } from "./id";

const VALID_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

const emptyRow = (): KeyValue => ({
  id: uid("kv"),
  key: "",
  value: "",
  enabled: true,
});

function tokenize(input: string): string[] {
  // Strip backslash line continuations.
  const cleaned = input.replace(/\\\r?\n/g, " ").trim();
  const tokens: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const ch = cleaned[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      let buf = "";
      while (i < cleaned.length && cleaned[i] !== quote) {
        if (cleaned[i] === "\\" && i + 1 < cleaned.length) {
          buf += cleaned[i + 1];
          i += 2;
          continue;
        }
        buf += cleaned[i];
        i++;
      }
      i++; // consume closing quote (or end)
      tokens.push(buf);
      continue;
    }
    let buf = "";
    while (
      i < cleaned.length &&
      cleaned[i] !== " " &&
      cleaned[i] !== "\t" &&
      cleaned[i] !== "\n" &&
      cleaned[i] !== "\r"
    ) {
      if (cleaned[i] === "\\" && i + 1 < cleaned.length) {
        buf += cleaned[i + 1];
        i += 2;
        continue;
      }
      buf += cleaned[i];
      i++;
    }
    tokens.push(buf);
  }
  return tokens;
}

function expectsValue(flag: string): boolean {
  return [
    "-X",
    "--request",
    "-H",
    "--header",
    "-d",
    "--data",
    "--data-raw",
    "--data-binary",
    "--data-urlencode",
    "-u",
    "--user",
    "--url",
    "-A",
    "--user-agent",
    "-b",
    "--cookie",
    "-F",
    "--form",
  ].includes(flag);
}

interface Parsed {
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  body: string;
  bodyType: BodyType;
  bodyForm: KeyValue[];
  authValue: string;
  authType: AuthType;
}

export function parseCurl(input: string): RequestState {
  const tokens = tokenize(input);
  if (tokens.length === 0) throw new Error("Empty input");

  // Must start with `curl` (case-insensitive). Skip it.
  let start = 0;
  if (tokens[0].toLowerCase() === "curl") start = 1;

  const out: Parsed = {
    method: "GET",
    url: "",
    headers: [],
    body: "",
    bodyType: "none",
    bodyForm: [],
    authValue: "",
    authType: "none",
  };

  let methodExplicit = false;

  for (let i = start; i < tokens.length; i++) {
    const tok = tokens[i];
    const next = () => tokens[++i];

    if (!tok.startsWith("-")) {
      // Positional URL.
      if (!out.url) out.url = tok;
      continue;
    }

    // Combined form like `-Hkey: value` is rare with quoted args, skip.
    if (tok === "-X" || tok === "--request") {
      const m = next();
      if (m && VALID_METHODS.includes(m.toUpperCase() as HttpMethod)) {
        out.method = m.toUpperCase() as HttpMethod;
        methodExplicit = true;
      }
      continue;
    }
    if (tok === "-H" || tok === "--header") {
      const h = next();
      if (h) {
        const idx = h.indexOf(":");
        if (idx > 0) {
          const key = h.slice(0, idx).trim();
          const value = h.slice(idx + 1).trim();
          if (key.toLowerCase() === "authorization") {
            const lower = value.toLowerCase();
            if (lower.startsWith("bearer ")) {
              out.authType = "bearer";
              out.authValue = value.slice(7).trim();
              continue;
            }
            if (lower.startsWith("basic ")) {
              try {
                const decoded = atob(value.slice(6).trim());
                out.authType = "basic";
                out.authValue = decoded;
                continue;
              } catch {
                // fall through and store as a literal header
              }
            }
          }
          out.headers.push({ id: uid("kv"), key, value, enabled: true });
        }
      }
      continue;
    }
    if (
      tok === "-d" ||
      tok === "--data" ||
      tok === "--data-raw" ||
      tok === "--data-binary"
    ) {
      const body = next() ?? "";
      const trimmed = body.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        out.bodyType = "json";
        out.body = body;
      } else if (body.includes("=")) {
        out.bodyType = "urlencoded";
        out.bodyForm = body
          .split("&")
          .map((kv) => {
            const eq = kv.indexOf("=");
            if (eq === -1) return null;
            return {
              id: uid("kv"),
              key: decodeURIComponent(kv.slice(0, eq)),
              value: decodeURIComponent(kv.slice(eq + 1)),
              enabled: true,
            };
          })
          .filter(Boolean) as KeyValue[];
      } else {
        out.bodyType = "json";
        out.body = body;
      }
      if (!methodExplicit) out.method = "POST";
      continue;
    }
    if (tok === "-F" || tok === "--form") {
      const v = next();
      if (v) {
        const eq = v.indexOf("=");
        if (eq > 0) {
          out.bodyType = "form";
          out.bodyForm.push({
            id: uid("kv"),
            key: v.slice(0, eq),
            value: v.slice(eq + 1),
            enabled: true,
          });
        }
      }
      if (!methodExplicit) out.method = "POST";
      continue;
    }
    if (tok === "-u" || tok === "--user") {
      const v = next();
      if (v) {
        out.authType = "basic";
        out.authValue = v;
      }
      continue;
    }
    if (tok === "--url") {
      const v = next();
      if (v) out.url = v;
      continue;
    }
    // Flags that take a value but we don't store — consume + skip.
    if (expectsValue(tok)) {
      next();
      continue;
    }
    // Boolean flags like -k, -L, --compressed — skip silently.
  }

  if (!out.url) throw new Error("Could not find a URL in the cURL command");

  return {
    method: out.method,
    url: out.url,
    params: [emptyRow()],
    headers: out.headers.length
      ? out.headers
      : [
          {
            id: uid("kv"),
            key: "Content-Type",
            value: "application/json",
            enabled: false,
          },
          emptyRow(),
        ],
    bodyType: out.bodyType,
    bodyRaw: out.bodyType === "json" ? out.body : "",
    bodyForm: out.bodyForm.length ? out.bodyForm : [emptyRow()],
    authType: out.authType,
    authToken: out.authType === "bearer" ? out.authValue : "",
    authUser:
      out.authType === "basic"
        ? out.authValue.includes(":")
          ? out.authValue.slice(0, out.authValue.indexOf(":"))
          : out.authValue
        : "",
    authPass:
      out.authType === "basic" && out.authValue.includes(":")
        ? out.authValue.slice(out.authValue.indexOf(":") + 1)
        : "",
  };
}
