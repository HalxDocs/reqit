export type CommandScope = "global" | "responseTree" | "sidebar" | "envEditor";

export interface Command {
  id: string;
  label: string;
  category: string;
  scope: CommandScope;
  defaultKeys: string[];
  userKeys?: string[];
  action: () => void;
}

let commands: Command[] = [];
let keyBindings: Map<string, string> = new Map();
let activeScope: CommandScope = "global";

const STORAGE_KEY = "flux:keybindings";

function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const overrides = JSON.parse(raw) as Record<string, string[]>;
      for (const [id, keys] of Object.entries(overrides)) {
        const cmd = commands.find((c) => c.id === id);
        if (cmd) cmd.userKeys = keys;
      }
    }
  } catch {}
}

function saveKeyBindings() {
  const overrides: Record<string, string[]> = {};
  for (const cmd of commands) {
    if (cmd.userKeys) overrides[cmd.id] = cmd.userKeys;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {}
  rebuildBindings();
}

function rebuildBindings() {
  keyBindings.clear();
  for (const cmd of commands) {
    const keys = cmd.userKeys || cmd.defaultKeys;
    for (const k of keys) {
      keyBindings.set(normalizeKey(k), cmd.id);
    }
  }
}

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/\s+/g, "").replace(/cmd/g, "meta");
}

export function registerCommand(cmd: Omit<Command, "action"> & { action?: () => void }): void {
  if (cmd.action) {
    commands.push(cmd as Command);
  }
}

export function registerCommands(cmds: Command[]): void {
  commands.push(...cmds);
  rebuildBindings();
}

export function getCommands(): Command[] {
  return commands;
}

export function getCommandsByScope(scope: CommandScope): Command[] {
  return commands.filter((c) => c.scope === scope);
}

export function getCommand(id: string): Command | undefined {
  return commands.find((c) => c.id === id);
}

export function setActiveScope(scope: CommandScope): void {
  activeScope = scope;
}

export function getActiveScope(): CommandScope {
  return activeScope;
}

export function setUserKeys(id: string, keys: string[]) {
  const cmd = commands.find((c) => c.id === id);
  if (cmd) {
    cmd.userKeys = keys;
    saveKeyBindings();
  }
}

export function resetKeys(id: string) {
  const cmd = commands.find((c) => c.id === id);
  if (cmd) {
    cmd.userKeys = undefined;
    saveKeyBindings();
  }
}

export function getActiveKeys(id: string): string[] {
  const cmd = commands.find((c) => c.id === id);
  if (!cmd) return [];
  return cmd.userKeys || cmd.defaultKeys;
}

export function handleKeyEvent(e: KeyboardEvent): boolean {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push(e.metaKey ? "meta" : "ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  const key = e.key.toLowerCase();
  if (key === "control" || key === "alt" || key === "shift" || key === "meta") return false;
  parts.push(key);
  const combo = parts.join("+");
  const cmdId = keyBindings.get(combo);
  if (cmdId) {
    const cmd = commands.find((c) => c.id === cmdId);
    if (cmd) {
      if (cmd.scope === "global" || cmd.scope === activeScope) {
        e.preventDefault();
        e.stopPropagation();
        cmd.action();
        return true;
      }
    }
  }
  return false;
}

loadOverrides();
rebuildBindings();
