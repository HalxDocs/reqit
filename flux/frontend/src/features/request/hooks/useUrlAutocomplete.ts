import { useMemo } from "react";
import { useHistoryStore } from "@/features/history/stores/useHistoryStore";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";

export interface UrlSuggestion {
  url: string;
  method: string;
  source: "history" | "saved";
  label: string;
}

export function useUrlAutocomplete(query: string): UrlSuggestion[] {
  const historyEntries = useHistoryStore((s) => s.entries);
  const collections = useCollectionStore((s) => s.collections);

  return useMemo(() => {
    if (!query.trim() || query.length < 2) return [];

    const q = query.toLowerCase();
    const seen = new Set<string>();
    const results: UrlSuggestion[] = [];

    // From history
    for (const entry of historyEntries) {
      const url = entry.payload?.url ?? "";
      const method = (entry.payload?.method ?? "GET").toUpperCase();
      if (!url) continue;
      const key = `${method} ${url}`;
      if (seen.has(key)) continue;
      if (url.toLowerCase().includes(q)) {
        seen.add(key);
        results.push({ url, method, source: "history", label: url });
      }
    }

    // From saved requests
    for (const col of collections) {
      for (const req of col.requests ?? []) {
        const url = req.payload?.url ?? "";
        const method = (req.payload?.method ?? "GET").toUpperCase();
        if (!url) continue;
        const key = `${method} ${url}`;
        if (seen.has(key)) continue;
        if (url.toLowerCase().includes(q)) {
          seen.add(key);
          results.push({ url, method, source: "saved", label: `${url} (${col.name})` });
        }
      }
    }

    return results.slice(0, 12);
  }, [query, historyEntries, collections]);
}
