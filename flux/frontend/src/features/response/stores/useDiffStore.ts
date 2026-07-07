import { create } from "zustand";

export interface ResponseSnapshot {
  url: string;
  method: string;
  statusCode: number;
  body: string;
  headers: Record<string, string>;
  capturedAt: string;
}

const STORAGE_KEY = "reqit:diff_snapshots";

function loadSnapshots(): Record<string, ResponseSnapshot> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveSnapshots(snapshots: Record<string, ResponseSnapshot>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  } catch {}
}

type DiffStore = {
  snapshots: Record<string, ResponseSnapshot>;
  saveSnapshot: (key: string, snap: ResponseSnapshot) => void;
  getSnapshot: (key: string) => ResponseSnapshot | undefined;
  removeSnapshot: (key: string) => void;
};

export const useDiffStore = create<DiffStore>((set, get) => ({
  snapshots: loadSnapshots(),
  saveSnapshot: (key, snap) => {
    const next = { ...get().snapshots, [key]: snap };
    set({ snapshots: next });
    saveSnapshots(next);
  },
  getSnapshot: (key) => get().snapshots[key],
  removeSnapshot: (key) => {
    const next = { ...get().snapshots };
    delete next[key];
    set({ snapshots: next });
    saveSnapshots(next);
  },
}));
