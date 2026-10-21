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
// A combo can be claimed by more than one command (e.g. request.save and
// env.save both want ctrl+s). Every claimant is kept so dispatch can pick the
// one that is valid for the active scope, instead of the last one registered
// silently shadowing the others.
let keyBindings: Map<string, Command[]> = new Map();
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
      const combo = normalizeKey(k);
      const claimants = keyBindings.get(combo);
      if (claimants) claimants.push(cmd);
      else keyBindings.set(combo, [cmd]);
    }
  }
  warnOnConflicts();
}

// Two commands in the same scope claiming one combo is always a mistake: only
// one of them can ever fire. Different scopes sharing a combo is legitimate
// (ctrl+s saves a request globally, but saves an environment inside the
// environment editor) and is resolved at dispatch time.
function warnOnConflicts() {
  if (!import.meta.env?.DEV) return;
  for (const [combo, claimants] of keyBindings) {
    const seen = new Set<string>();
    for (const cmd of claimants) {
      if (seen.has(cmd.scope)) {
        console.warn(
          `[commands] conflicting keybinding "${combo}" in scope "${cmd.scope}" — only one command can fire`,
        );
      }
      seen.add(cmd.scope);
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
  for (const cmd of cmds) {
    const existing = commands.findIndex((c) => c.id === cmd.id);
    if (existing >= 0) {
      // Replace in place. Re-registering the same id happens on hot reload, and
      // pushing duplicates would make a keybinding fire twice.
      commands[existing] = cmd;
    } else {
      commands.push(cmd);
    }
  }
  rebuildBindings();
}

/**
 * Removes every registered command and binding.
 * Used by tests to isolate state, and by hot reload to drop stale commands.
 */
export function clearCommands(): void {
  commands = [];
  keyBindings.clear();
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

const TEXT_ENTRY_TAGS = new Set(["input", "textarea", "select"]);

// Chords the browser (or CodeMirror) implements natively. While the user is
// typing, these must never be intercepted: select-all, undo, redo, cut, copy
// and paste all have to keep working inside text fields.
const NATIVE_EDIT_KEYS = new Set(["a", "z", "y", "x", "c", "v"]);

/**
 * True when the event target is a place where the user is entering text:
 * a form control, a contenteditable region, or a CodeMirror editor.
 */
export function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  const tag = el.tagName.toLowerCase();
  if (TEXT_ENTRY_TAGS.has(tag)) return true;
  if (el.isContentEditable) return true;
  // CodeMirror renders into a contenteditable div but also marks its wrapper,
  // so check the closest editor explicitly.
  if (typeof el.closest === "function" && el.closest(".cm-editor")) return true;
  return false;
}

export function handleKeyEvent(e: KeyboardEvent): boolean {
  const inTextEntry = isTextEntry(e.target);
  const hasModifier = e.metaKey || e.ctrlKey;

  // Never intercept plain typing: a bare "delete" or "enter" while the user is
  // in a text field must reach the field, not a global command.
  if (inTextEntry && !hasModifier) return false;

  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push(e.metaKey ? "meta" : "ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  const key = e.key.toLowerCase();
  if (key === "control" || key === "alt" || key === "shift" || key === "meta") return false;
  parts.push(key);
  const combo = parts.join("+");

  // Native editing chords belong to the text field while the user is typing.
  if (inTextEntry && hasModifier && NATIVE_EDIT_KEYS.has(key)) return false;

  const claimants = keyBindings.get(combo);
  if (!claimants || claimants.length === 0) return false;

  // Prefer a command scoped to the active context; fall back to a global one.
  const cmd = claimants.find((c) => c.scope === activeScope) ?? claimants.find((c) => c.scope === "global");
  if (!cmd) return false;

  e.preventDefault();
  e.stopPropagation();
  cmd.action();
  return true;
}

loadOverrides();
rebuildBindings();
