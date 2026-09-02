import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const DEFAULT_GLOBAL_PATTERNS = [
  "timestamp",
  "requestId",
  "traceId",
  "spanId",
  "createdAt",
  "updatedAt",
  "*Id",
];

const STORAGE_KEY = "reqit:diff_ignore";

export interface DiffIgnoreState {
  globalPatterns: string[];
  perRequestPatterns: Record<string, string[]>;
  ignoreHeaders: boolean;
  headerPatterns: string[];

  addGlobalPattern: (pattern: string) => void;
  removeGlobalPattern: (pattern: string) => void;
  reorderGlobalPatterns: (fromIndex: number, toIndex: number) => void;
  resetGlobalPatterns: () => void;

  addPerRequestPattern: (key: string, pattern: string) => void;
  removePerRequestPattern: (key: string, pattern: string) => void;
  clearPerRequestPatterns: (key: string) => void;

  setIgnoreHeaders: (enabled: boolean) => void;
  addHeaderPattern: (pattern: string) => void;
  removeHeaderPattern: (pattern: string) => void;
  resetHeaderPatterns: () => void;

  getEffectivePatterns: (snapshotKey: string) => string[];
  getEffectiveHeaderPatterns: () => string[];
}

const DEFAULT_HEADER_PATTERNS = [
  "Date",
  "X-Request-Id",
  "X-Correlation-Id",
  "ETag",
  "X-Trace-Id",
  "X-Span-Id",
];

export const useDiffIgnoreStore = create<DiffIgnoreState>()(
  persist(
    (set, get) => ({
      globalPatterns: DEFAULT_GLOBAL_PATTERNS,
      perRequestPatterns: {},
      ignoreHeaders: true,
      headerPatterns: DEFAULT_HEADER_PATTERNS,

      addGlobalPattern: (pattern) =>
        set((s) => ({
          globalPatterns: [...s.globalPatterns, pattern.trim()].filter(Boolean),
        })),
      removeGlobalPattern: (pattern) =>
        set((s) => ({
          globalPatterns: s.globalPatterns.filter((p) => p !== pattern),
        })),
      reorderGlobalPatterns: (fromIndex, toIndex) =>
        set((s) => {
          const arr = [...s.globalPatterns];
          const [removed] = arr.splice(fromIndex, 1);
          arr.splice(toIndex, 0, removed);
          return { globalPatterns: arr };
        }),
      resetGlobalPatterns: () => set({ globalPatterns: DEFAULT_GLOBAL_PATTERNS }),

      addPerRequestPattern: (key, pattern) =>
        set((s) => {
          const existing = s.perRequestPatterns[key] || [];
          if (existing.includes(pattern.trim())) return s;
          return {
            perRequestPatterns: {
              ...s.perRequestPatterns,
              [key]: [...existing, pattern.trim()].filter(Boolean),
            },
          };
        }),
      removePerRequestPattern: (key, pattern) =>
        set((s) => {
          const existing = s.perRequestPatterns[key] || [];
          const next = existing.filter((p) => p !== pattern);
          const { [key]: _, ...rest } = s.perRequestPatterns;
          return {
            perRequestPatterns: next.length ? { ...rest, [key]: next } : rest,
          };
        }),
      clearPerRequestPatterns: (key) =>
        set((s) => {
          const { [key]: _, ...rest } = s.perRequestPatterns;
          return { perRequestPatterns: rest };
        }),

      setIgnoreHeaders: (enabled) => set({ ignoreHeaders: enabled }),
      addHeaderPattern: (pattern) =>
        set((s) => ({
          headerPatterns: [...s.headerPatterns, pattern.trim()].filter(Boolean),
        })),
      removeHeaderPattern: (pattern) =>
        set((s) => ({
          headerPatterns: s.headerPatterns.filter((p) => p !== pattern),
        })),
      resetHeaderPatterns: () => set({ headerPatterns: DEFAULT_HEADER_PATTERNS }),

      getEffectivePatterns: (snapshotKey) => {
        const { globalPatterns, perRequestPatterns } = get();
        const override = perRequestPatterns[snapshotKey] || [];
        return [...globalPatterns, ...override];
      },
      getEffectiveHeaderPatterns: () => {
        const { ignoreHeaders, headerPatterns } = get();
        return ignoreHeaders ? headerPatterns : [];
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        globalPatterns: s.globalPatterns,
        perRequestPatterns: s.perRequestPatterns,
        ignoreHeaders: s.ignoreHeaders,
        headerPatterns: s.headerPatterns,
      }),
      version: 1,
      migrate: (persisted: any) => {
        if (!persisted) return { globalPatterns: DEFAULT_GLOBAL_PATTERNS, perRequestPatterns: {}, ignoreHeaders: true, headerPatterns: DEFAULT_HEADER_PATTERNS };
        return {
          globalPatterns: persisted.globalPatterns || DEFAULT_GLOBAL_PATTERNS,
          perRequestPatterns: persisted.perRequestPatterns || {},
          ignoreHeaders: persisted.ignoreHeaders ?? true,
          headerPatterns: persisted.headerPatterns || DEFAULT_HEADER_PATTERNS,
        };
      },
    }
  )
);