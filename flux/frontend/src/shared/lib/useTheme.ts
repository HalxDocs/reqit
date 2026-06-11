import { create } from "zustand";

export type ThemeMode = "dark" | "light" | "system";

const STORAGE_KEY = "flux:theme";

function getStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "dark" || v === "light" || v === "system") return v;
  } catch {}
  return "system";
}

function storeMode(mode: ThemeMode) {
  try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
}

function resolveMode(mode: ThemeMode): "dark" | "light" {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: ThemeMode) {
  const resolved = resolveMode(mode);
  document.documentElement.classList.toggle("light", resolved === "light");
}

type ThemeStore = {
  mode: ThemeMode;
  resolved: "dark" | "light";
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

export function initTheme() {
  applyTheme(getStored());
}

export const useThemeStore = create<ThemeStore>((set, get) => {
  const mode = getStored();
  applyTheme(mode);

  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const listener = () => {
    const m = get().mode;
    if (m === "system") applyTheme(m);
  };
  mql.addEventListener("change", listener);

  return {
    mode,
    resolved: resolveMode(mode),
    setMode: (mode: ThemeMode) => {
      storeMode(mode);
      applyTheme(mode);
      set({ mode, resolved: resolveMode(mode) });
    },
    toggle: () => {
      const next = get().resolved === "dark" ? "light" : "dark";
      get().setMode(next);
    },
  };
});
