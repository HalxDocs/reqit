import type { KeyValue } from "../types/request";
import { uid } from "./id";

export function buildQueryString(params: KeyValue[]): string {
  const sp = new URLSearchParams();
  for (const p of params) {
    if (p.enabled && p.key) sp.append(p.key, p.value);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function parseQueryString(qs: string): KeyValue[] {
  const sp = new URLSearchParams(qs);
  const rows: KeyValue[] = [];
  sp.forEach((value, key) => {
    rows.push({ id: uid("kv"), key, value, enabled: true });
  });
  return rows;
}

export function splitUrl(input: string): { base: string; query: string } {
  const idx = input.indexOf("?");
  if (idx === -1) return { base: input, query: "" };
  return { base: input.slice(0, idx), query: input.slice(idx + 1) };
}
