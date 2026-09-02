function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function matchPath(key: string, pattern: string): boolean {
  if (pattern === key) return true;
  if (pattern.includes("*")) {
    return globToRegex(pattern).test(key);
  }
  return false;
}

export function removePaths(obj: any, patterns: string[]): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((v) => removePaths(v, patterns));

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const shouldIgnore = patterns.some((p) => matchPath(k, p));
    if (!shouldIgnore) {
      out[k] = removePaths(v, patterns);
    }
  }
  return out;
}

export function filterIgnoredFields(json: string, patterns: string[]): string {
  if (patterns.length === 0) return json;
  try {
    const obj = JSON.parse(json);
    const filtered = removePaths(obj, patterns);
    return JSON.stringify(filtered, null, 2);
  } catch {
    return json;
  }
}