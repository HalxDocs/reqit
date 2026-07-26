export interface ScriptSnippet {
  id: string;
  title: string;
  description: string;
  category: string;
  code: string;
  scope: "pre" | "post" | "both";
}

export const SNIPPETS: ScriptSnippet[] = [
  {
    id: "uuid",
    title: "Generate UUID",
    description: "Generate a random UUID and store it in an environment variable",
    category: "Utilities",
    scope: "pre",
    code: `const uuid = reqit.utils.uuid();
req.variables.set("myUuid", uuid);
reqit.log("Generated UUID: " + uuid);`,
  },
  {
    id: "timestamp",
    title: "Add Timestamp",
    description: "Add an ISO timestamp as an environment variable",
    category: "Utilities",
    scope: "pre",
    code: `const now = new Date().toISOString();
req.variables.set("timestamp", now);`,
  },
  {
    id: "jwt-decode",
    title: "Decode JWT Token",
    description: "Extract payload from a JWT token in the response",
    category: "Utilities",
    scope: "post",
    code: `const authHeader = req.response.headers["Authorization"];
if (authHeader && authHeader.startsWith("Bearer ")) {
  const token = authHeader.slice(7);
  const parts = token.split(".");
  if (parts.length === 3) {
    const payload = JSON.parse(atob(parts[1]));
    req.variables.set("jwtSub", payload.sub);
    req.variables.set("jwtExp", payload.exp);
    reqit.log("JWT decoded: sub=" + payload.sub);
  }
}`,
  },
  {
    id: "random-email",
    title: "Random Email",
    description: "Generate a random email address",
    category: "Test Data",
    scope: "pre",
    code: `const rand = Math.random().toString(36).substring(2, 8);
const email = rand + "@test.com";
req.variables.set("randomEmail", email);
reqit.log("Using email: " + email);`,
  },
  {
    id: "hash-string",
    title: "SHA256 Hash",
    description: "Compute a SHA256 hash of a value",
    category: "Utilities",
    scope: "pre",
    code: `async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
const hash = await sha256("myValue");
req.variables.set("hash", hash);`,
  },
  {
    id: "assert-status",
    title: "Assert Status Code",
    description: "Assert that the response status code is 200",
    category: "Assertions",
    scope: "post",
    code: `req.assert(req.response.statusCode === 200, "Expected status 200, got " + req.response.statusCode);`,
  },
  {
    id: "assert-json",
    title: "Assert JSON Body",
    description: "Assert that the response contains expected JSON fields",
    category: "Assertions",
    scope: "post",
    code: `const body = req.response.json();
req.assert(body.id !== undefined, "Response must contain id");
req.assert(body.name !== undefined, "Response must contain name");`,
  },
  {
    id: "extract-header",
    title: "Extract Response Header",
    description: "Extract a value from a response header into a variable",
    category: "Data Pipeline",
    scope: "post",
    code: `const token = req.response.headers["X-Session-Token"];
if (token) {
  req.variables.set("sessionToken", token);
  reqit.log("Extracted session token");
}`,
  },
  {
    id: "extract-json",
    title: "Extract JSON Value",
    description: "Extract a value from JSON response into a variable",
    category: "Data Pipeline",
    scope: "post",
    code: `const body = req.response.json();
if (body.data && body.data.id) {
  req.variables.set("resourceId", String(body.data.id));
  reqit.log("Extracted resource ID: " + body.data.id);
}`,
  },
  {
    id: "conditional-skip",
    title: "Conditional Skip",
    description: "Skip subsequent requests if a condition is not met",
    category: "Flow Control",
    scope: "post",
    code: `const body = req.response.json();
if (!body.ready) {
  reqit.log("Not ready yet, skipping remaining requests");
  req.variables.set("__skip", "true");
}`,
  },
  {
    id: "date-offset",
    title: "Date Offset",
    description: "Generate a date relative to today (+N days)",
    category: "Test Data",
    scope: "pre",
    code: `const days = 7;
const future = new Date();
future.setDate(future.getDate() + days);
req.variables.set("futureDate", future.toISOString().split("T")[0]);`,
  },
  {
    id: "sub-request",
    title: "Sub-Request",
    description: "Make an additional HTTP request inside a script",
    category: "Flow Control",
    scope: "pre",
    code: `const authRes = await req.send({
  url: "https://auth.example.com/token",
  method: "POST",
  body: JSON.stringify({ clientId: "abc", secret: "xyz" }),
  headers: { "Content-Type": "application/json" },
});
const authBody = authRes.json();
req.variables.set("accessToken", authBody.access_token);`,
  },
];
