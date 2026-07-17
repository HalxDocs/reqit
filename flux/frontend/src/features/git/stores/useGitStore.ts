import { create } from "zustand";
import { GetGitStatus, GetLocks, GitPull, CommitAndPush, SetAutoSync } from "../../../../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../../../../wailsjs/runtime/runtime";

interface GitSyncStatus {
  initialised: boolean;
  hasChanges: boolean;
  currentBranch: string;
  remoteUrl: string;
  autoSync: boolean;
}

interface LockInfo {
  user: string;
  email: string;
  since: string;
}

interface GitStore {
  status: GitSyncStatus | null;
  syncing: boolean;
  lastSyncResult: "success" | "error" | null;
  locks: Record<string, LockInfo>;
  loadStatus: () => Promise<void>;
  syncNow: () => Promise<void>;
  setAutoSync: (enabled: boolean) => Promise<void>;
  loadLocks: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

export const useGitStore = create<GitStore>((set, get) => {
  let interval: ReturnType<typeof setInterval> | null = null;

  const loadStatus = async () => {
    try {
      const s = await GetGitStatus();
      set({ status: s as unknown as GitSyncStatus });
    } catch { /* noop */ }
  };

  const loadLocks = async () => {
    try {
      const l = await GetLocks();
      set({ locks: l as unknown as Record<string, LockInfo> });
    } catch { /* noop */ }
  };

  EventsOn("git:pull:complete", () => { loadStatus(); });
  EventsOn("git:sync:complete", () => { loadStatus(); set({ syncing: false, lastSyncResult: "success" }); });
  EventsOn("lock:changed", () => { loadLocks(); });

  return {
    status: null,
    syncing: false,
    lastSyncResult: null,
    locks: {},

    loadStatus,
    loadLocks,

    cleanup: () => {
      EventsOff("git:pull:complete");
      EventsOff("git:sync:complete");
      EventsOff("lock:changed");
    },

    syncNow: async () => {
      set({ syncing: true });
      try {
        await GitPull();
        const s = get().status;
        if (s?.hasChanges) {
          await CommitAndPush("sync");
        }
        set({ syncing: false, lastSyncResult: "success" });
      } catch {
        set({ syncing: false, lastSyncResult: "error" });
      }
      await loadStatus();
    },

    setAutoSync: async (enabled: boolean) => {
      await SetAutoSync(enabled);
      set((prev) => ({
        status: prev.status ? { ...prev.status, autoSync: enabled } : null,
      }));
    },

    startPolling: () => {
      loadStatus();
      loadLocks();
      if (!interval) {
        interval = setInterval(() => { loadStatus(); loadLocks(); }, 30000);
      }
    },

    stopPolling: () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    },
  };
});
