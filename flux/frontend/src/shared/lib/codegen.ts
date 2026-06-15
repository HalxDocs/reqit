import type { WirePayload } from "@/features/request/lib/buildPayload";

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

export function toGo(p: WirePayload): string {
  const url = buildFinalUrl(p);
  const method = p.method.toUpperCase();
  const hdrs = finalHeaders(p);
  const lines: string[] = [
    'import (',
    '    "bytes"',
    '    "encoding/json"',
    '    "fmt"',
    '    "io"',
    '    "net/http"',
    ')',
    '',
    'func main() {',
    `    url := ${escapeGo(url)}`,
  ];

  let bodyVar = "";
  if (p.bodyType === "json" && p.body.trim()) {
    bodyVar = "    body := []byte(`" + p.body.trim() + "`)";
    lines.push(bodyVar);
  } else if ((p.bodyType === "form" || p.bodyType === "urlencoded") && formBody(p)) {
    bodyVar = `    body := []byte(${escapeGo(formBody(p))})`;
    lines.push(bodyVar);
  }

  lines.push(`    req, err := http.NewRequest("${method}", url, nil)`);
  if (bodyVar) {
    lines[lines.length - 1] = `    req, err := http.NewRequest("${method}", url, bytes.NewReader(body))`;
  }
  lines.push("    if err != nil {");
  lines.push("        panic(err)");
  lines.push("    }");

  for (const [k, v] of hdrs) {
    lines.push(`    req.Header.Set(${escapeGo(k)}, ${escapeGo(v)})`);
  }

  lines.push("");
  lines.push("    resp, err := http.DefaultClient.Do(req)");
  lines.push("    if err != nil {");
  lines.push("        panic(err)");
  lines.push("    }");
  lines.push("    defer resp.Body.Close()");
  lines.push("");
  lines.push('    data, err := io.ReadAll(resp.Body)');
  lines.push("    if err != nil {");
  lines.push("        panic(err)");
  lines.push("    }");
  lines.push("");
  lines.push('    fmt.Println(string(data))');
  lines.push("}");

  return lines.join("\n");
}

const escapeGo = (s: string) => {
  const q = '"';
  return q + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + q;
};

export function toJava(p: WirePayload): string {
  const url = buildFinalUrl(p);
  const method = p.method.toUpperCase();
  const hdrs = finalHeaders(p);
  const lines: string[] = [
    "import java.net.HttpURLConnection;",
    "import java.net.URL;",
    "import java.io.*;",
    "import java.nio.charset.StandardCharsets;",
    "",
    "public class ApiRequest {",
    "    public static void main(String[] args) throws Exception {",
    `        URL url = new URL("${escapeJava(url)}");`,
    `        HttpURLConnection conn = (HttpURLConnection) url.openConnection();`,
    `        conn.setRequestMethod("${method}");`,
  ];

  for (const [k, v] of hdrs) {
    lines.push(`        conn.setRequestProperty("${escapeJava(k)}", "${escapeJava(v)}");`);
  }

  if (p.bodyType === "json" && p.body.trim()) {
    lines.push("        conn.setDoOutput(true);");
    lines.push(`        String jsonBody = "${escapeJava(p.body.trim())}";`);
    lines.push("        try (OutputStream os = conn.getOutputStream()) {");
    lines.push("            byte[] input = jsonBody.getBytes(StandardCharsets.UTF_8);");
    lines.push("            os.write(input, 0, input.length);");
    lines.push("        }");
  } else if ((p.bodyType === "form" || p.bodyType === "urlencoded") && formBody(p)) {
    lines.push("        conn.setDoOutput(true);");
    lines.push(`        String body = "${escapeJava(formBody(p))}";`);
    lines.push("        try (OutputStream os = conn.getOutputStream()) {");
    lines.push("            byte[] input = body.getBytes(StandardCharsets.UTF_8);");
    lines.push("            os.write(input, 0, input.length);");
    lines.push("        }");
  }

  lines.push("");
  lines.push("        int status = conn.getResponseCode();");
  lines.push("        BufferedReader reader = new BufferedReader(");
  lines.push("            new InputStreamReader(status >= 400 ? conn.getErrorStream() : conn.getInputStream())));");
  lines.push("        String line;");
  lines.push("        StringBuilder response = new StringBuilder();");
  lines.push("        while ((line = reader.readLine()) != null) {");
  lines.push("            response.append(line);");
  lines.push("        }");
  lines.push("        reader.close();");
  lines.push("        System.out.println(response.toString());");
  lines.push("        conn.disconnect();");
  lines.push("    }");
  lines.push("}");

  return lines.join("\n");
}

const escapeJava = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

export function toCurlShort(p: WirePayload): string {
  const url = buildFinalUrl(p);
  const method = p.method.toUpperCase();
  const hdrs = finalHeaders(p);
  const parts: string[] = [];

  if (method !== "GET") {
    parts.push(`-X ${method}`);
  }
  for (const [k, v] of hdrs) {
    parts.push(`-H '${k}: ${v}'`);
  }
  if (p.bodyType === "json" && p.body.trim()) {
    parts.push(`-d '${p.body.trim()}'`);
  } else if ((p.bodyType === "form" || p.bodyType === "urlencoded") && formBody(p)) {
    parts.push(`-d '${formBody(p)}'`);
  }
  parts.push(`'${url}'`);

  return `curl ${parts.join(" ")}`;
}

export function toCurlPowerShell(p: WirePayload): string {
  const url = buildFinalUrl(p);
  const hdrs = finalHeaders(p);
  const method = p.method.toUpperCase();
  const lines: string[] = [];

  lines.push(`$headers = @{`);
  for (const [k, v] of hdrs) {
    lines.push(`    "${k}" = "${v}"`);
  }
  lines.push("}");

  let bodyArg = "";
  if (p.bodyType === "json" && p.body.trim()) {
    lines.push(`$body = '${p.body.trim()}'`);
    bodyArg = " -Body $body -ContentType 'application/json'";
  } else if ((p.bodyType === "form" || p.bodyType === "urlencoded") && formBody(p)) {
    bodyArg = ` -Body '${formBody(p)}'`;
  }

  lines.push(`Invoke-RestMethod -Uri '${url}' -Method ${method} -Headers $headers${bodyArg}`);
  return lines.join("\n");
}
