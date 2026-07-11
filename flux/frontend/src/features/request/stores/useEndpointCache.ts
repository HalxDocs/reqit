import { useState, useEffect } from "react";

const STORAGE_KEY = "reqit:endpoint-cache";
const MAX_ENTRIES = 200;

interface CachedResponse {
  statusCode: number;
  timingMs: number;
  status: string;
}

let cache: Record<string, CachedResponse> = {};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) cache = JSON.parse(raw);
  } catch { cache = {}; }
}
load();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}

function cacheKey(method: string, url: string) {
  return `${method.toUpperCase()} ${url}`;
}

export function setEndpointCache(method: string, url: string, statusCode: number, timingMs: number, status: string) {
  cache[cacheKey(method, url)] = { statusCode, timingMs, status };
  const entries = Object.keys(cache);
  if (entries.length > MAX_ENTRIES) {
    const toRemove = entries.slice(0, entries.length - MAX_ENTRIES);
    for (const k of toRemove) delete cache[k];
  }
  persist();
}

export function clearEndpointCache() {
  cache = {};
  persist();
}

export function useEndpointCache(method: string, url: string): CachedResponse | null {
  const [entry, setEntry] = useState<CachedResponse | null>(() => {
    return cache[cacheKey(method, url)] ?? null;
  });

  useEffect(() => {
    setEntry(cache[cacheKey(method, url)] ?? null);
  }, [method, url]);

  return entry;
}
