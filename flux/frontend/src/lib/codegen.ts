import type { WirePayload } from "./buildPayload";

const escapeShell = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;
const escapeJs = (s: string) =>
  '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
const escapePy = (s: string) => {
  if (!s.includes("'") && !s.includes("\n")) return `'${s}'`;
  return `"""${s.replace(/"""/g, '\\"\\"\\"')}"""`;
};

const buildFinalUrl = (p: WirePayload): string => {
  const enabled = p.params.filter((kv) => kv.enabled && kv.key);
  if (enabled.length === 0) return p.url;
  const sep = p.url.includes("?") ? "&" : "?";
  return (
    p.url +
    sep +
    enabled
      .map((kv) => `${encodeURIComponent(kv.key)}=${encodeURIComponent(kv.value)}`)
      .join("&")
  );
};

const finalHeaders = (p: WirePayload): Array<[string, string]> => {
  const out: Array<[string, string]> = [];
  for (const h of p.headers) {
    if (h.enabled && h.key) out.push([h.key, h.value]);
  }
  if (p.authType === "bearer" && p.authValue) {
    out.push(["Authorization", `Bearer ${p.authValue}`]);
  }
  if (p.authType === "basic" && p.authValue) {
    try {
      out.push(["Authorization", `Basic ${btoa(p.authValue)}`]);
    } catch {
      out.push(["Authorization", `Basic ${btoa(unescape(encodeURIComponent(p.authValue)))}`]);
    }
  }
  if (p.bodyType === "json" && p.body && !out.some(([k]) => k.toLowerCase() === "content-type")) {
    out.push(["Content-Type", "application/json"]);
  }
  if ((p.bodyType === "form" || p.bodyType === "urlencoded") && !out.some(([k]) => k.toLowerCase() === "content-type")) {
    out.push(["Content-Type", "application/x-www-form-urlencoded"]);
  }
  return out;
};

const formBody = (p: WirePayload): string => {
  return p.bodyForm
    .filter((kv) => kv.enabled && kv.key)
    .map((kv) => `${encodeURIComponent(kv.key)}=${encodeURIComponent(kv.value)}`)
    .join("&");
};

export function toCurl(p: WirePayload): string {
  const url = buildFinalUrl(p);
  const lines: string[] = [`curl -X ${p.method.toUpperCase()} ${escapeShell(url)}`];

  for (const [k, v] of finalHeaders(p)) {
    lines.push(`  -H ${escapeShell(`${k}: ${v}`)}`);
  }

  if (p.bodyType === "json" && p.body.trim()) {
    lines.push(`  --data ${escapeShell(p.body)}`);
  } else if (p.bodyType === "form" || p.bodyType === "urlencoded") {
    const body = formBody(p);
    if (body) lines.push(`  --data ${escapeShell(body)}`);
  }

  return lines.join(" \\\n");
}

export function toJsFetch(p: WirePayload): string {
  const url = buildFinalUrl(p);
  const headers = finalHeaders(p);

  const init: string[] = [`  method: ${escapeJs(p.method.toUpperCase())},`];
  if (headers.length) {
    const hLines = headers
      .map(([k, v]) => `    ${escapeJs(k)}: ${escapeJs(v)},`)
      .join("\n");
    init.push(`  headers: {\n${hLines}\n  },`);
  }

  if (p.bodyType === "json" && p.body.trim()) {
    init.push(`  body: ${escapeJs(p.body)},`);
  } else if (p.bodyType === "form" || p.bodyType === "urlencoded") {
    const body = formBody(p);
    if (body) init.push(`  body: ${escapeJs(body)},`);
  }

  return `const response = await fetch(${escapeJs(url)}, {\n${init.join("\n")}\n});\nconst data = await response.json();`;
}

export function toPythonRequests(p: WirePayload): string {
  const url = p.url;
  const params = p.params.filter((kv) => kv.enabled && kv.key);
  const headers = finalHeaders(p);

  const lines: string[] = ["import requests", ""];

  if (params.length) {
    lines.push("params = {");
    for (const kv of params) {
      lines.push(`    ${escapePy(kv.key)}: ${escapePy(kv.value)},`);
    }
    lines.push("}");
  }
  if (headers.length) {
    lines.push("headers = {");
    for (const [k, v] of headers) {
      lines.push(`    ${escapePy(k)}: ${escapePy(v)},`);
    }
    lines.push("}");
  }

  let bodyArg = "";
  if (p.bodyType === "json" && p.body.trim()) {
    lines.push(`payload = ${p.body.trim()}`);
    bodyArg = ", json=payload";
  } else if (p.bodyType === "form" || p.bodyType === "urlencoded") {
    const enabled = p.bodyForm.filter((kv) => kv.enabled && kv.key);
    if (enabled.length) {
      lines.push("data = {");
      for (const kv of enabled) {
        lines.push(`    ${escapePy(kv.key)}: ${escapePy(kv.value)},`);
      }
      lines.push("}");
      bodyArg = ", data=data";
    }
  }

  const args = [escapePy(url)];
  if (params.length) args.push("params=params");
  if (headers.length) args.push("headers=headers");
  lines.push("");
  lines.push(`response = requests.request(${escapePy(p.method.toUpperCase())}, ${args.join(", ")}${bodyArg})`);
  lines.push("response.raise_for_status()");
  lines.push("print(response.json())");

  return lines.join("\n");
}
