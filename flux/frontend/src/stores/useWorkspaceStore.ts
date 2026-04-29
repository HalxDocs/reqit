import { create } from "zustand";
import {
  CreateWorkspace,
  DeleteWorkspace,
  GetActiveWorkspace,
  GetWorkspaces,
  OpenWorkspaceFromFolder,
  RelocateWorkspace,
  RenameWorkspace,
  SwitchWorkspace,
} from "../../wailsjs/go/main/App";
import type { workspaces } from "../../wailsjs/go/models";

type WorkspaceStore = {
  workspaces: workspaces.Info[];
  activeID: string | null;
  loaded: boolean;

  load: () => Promise<void>;
  create: (name: string, description: string, color: string) => Promise<workspaces.Info>;
  switch: (id: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  relocate: (id: string, dir: string) => Promise<void>;
  openFromFolder: (dir: string) => Promise<workspaces.Info>;
};

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: [],
  activeID: null,
  loaded: false,

  load: async () => {
    const [all, active] = await Promise.all([GetWorkspaces(), GetActiveWorkspace()]);
    set({
      workspaces: all,
      activeID: active?.id ?? null,
      loaded: true,
    });
  },

  create: async (name, description, color) => {
    const info = await CreateWorkspace(name, description, color);
    await get().load();
    return info;
  },

  switch: async (id) => {
    await SwitchWorkspace(id);
    await get().load();
  },

  rename: async (id, name) => {
    await RenameWorkspace(id, name);
    await get().load();
  },

  remove: async (id) => {
    await DeleteWorkspace(id);
    await get().load();
  },

  relocate: async (id, dir) => {
    await RelocateWorkspace(id, dir);
    await get().load();
  },

  openFromFolder: async (dir) => {
    const info = await OpenWorkspaceFromFolder(dir);
    await get().load();
    return info;
  },
}));
