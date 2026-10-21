import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCommands,
  handleKeyEvent,
  isTextEntry,
  registerCommands,
  resetKeys,
  setActiveScope,
  setUserKeys,
} from "./commands";

function keyEvent(
  key: string,
  opts: { ctrl?: boolean; meta?: boolean; shift?: boolean; target?: HTMLElement } = {},
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    ctrlKey: opts.ctrl ?? false,
    metaKey: opts.meta ?? false,
    shiftKey: opts.shift ?? false,
    cancelable: true,
    bubbles: true,
  });
  if (opts.target) Object.defineProperty(event, "target", { value: opts.target });
  return event;
}

function makeInput(): HTMLInputElement {
  const input = document.createElement("input");
  document.body.appendChild(input);
  return input;
}

describe("commands", () => {
  beforeEach(() => {
    clearCommands();
    setActiveScope("global");
    document.body.innerHTML = "";
  });

  describe("keybinding conflicts", () => {
    it("resolves a shared combo by scope instead of registration order", () => {
      const globalAction = vi.fn();
      const scopedAction = vi.fn();

      // Registered global first, scoped second — the scoped command must not
      // shadow the global one outside its scope.
      registerCommands([
        { id: "request.save", label: "Save", category: "Request", scope: "global", defaultKeys: ["ctrl+s"], action: globalAction },
        { id: "env.save", label: "Save Env", category: "Env", scope: "envEditor", defaultKeys: ["ctrl+s"], action: scopedAction },
      ]);

      setActiveScope("global");
      expect(handleKeyEvent(keyEvent("s", { ctrl: true }))).toBe(true);
      expect(globalAction).toHaveBeenCalledTimes(1);
      expect(scopedAction).not.toHaveBeenCalled();

      setActiveScope("envEditor");
      expect(handleKeyEvent(keyEvent("s", { ctrl: true }))).toBe(true);
      expect(scopedAction).toHaveBeenCalledTimes(1);
      expect(globalAction).toHaveBeenCalledTimes(1);
    });

    it("falls back to a global command when the active scope has no claimant", () => {
      const globalAction = vi.fn();
      registerCommands([
        { id: "request.save", label: "Save", category: "Request", scope: "global", defaultKeys: ["ctrl+s"], action: globalAction },
        { id: "env.save", label: "Save Env", category: "Env", scope: "envEditor", defaultKeys: ["ctrl+s"], action: vi.fn() },
      ]);

      setActiveScope("sidebar");
      expect(handleKeyEvent(keyEvent("s", { ctrl: true }))).toBe(true);
      expect(globalAction).toHaveBeenCalledTimes(1);
    });

    it("does not fire a command whose scope is not active", () => {
      const action = vi.fn();
      registerCommands([
        { id: "sidebar.delete", label: "Delete", category: "Sidebar", scope: "sidebar", defaultKeys: ["ctrl+d"], action },
      ]);

      setActiveScope("global");
      expect(handleKeyEvent(keyEvent("d", { ctrl: true }))).toBe(false);
      expect(action).not.toHaveBeenCalled();
    });

    it("replaces a command re-registered with the same id", () => {
      const first = vi.fn();
      const second = vi.fn();
      registerCommands([
        { id: "request.save", label: "Save", category: "Request", scope: "global", defaultKeys: ["ctrl+s"], action: first },
      ]);
      registerCommands([
        { id: "request.save", label: "Save", category: "Request", scope: "global", defaultKeys: ["ctrl+s"], action: second },
      ]);

      handleKeyEvent(keyEvent("s", { ctrl: true }));
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });
  });

  describe("text entry contexts", () => {
    it("identifies form controls, contenteditable and CodeMirror as text entry", () => {
      const input = makeInput();
      expect(isTextEntry(input)).toBe(true);

      const textarea = document.createElement("textarea");
      expect(isTextEntry(textarea)).toBe(true);

      const editable = document.createElement("div");
      editable.setAttribute("contenteditable", "true");
      expect(isTextEntry(editable)).toBe(true);

      const cm = document.createElement("div");
      cm.className = "cm-editor";
      const cmChild = document.createElement("div");
      cm.appendChild(cmChild);
      expect(isTextEntry(cmChild)).toBe(true);

      const plain = document.createElement("div");
      expect(isTextEntry(plain)).toBe(false);
      expect(isTextEntry(null)).toBe(false);
    });

    it("never intercepts native editing chords while typing", () => {
      const action = vi.fn();
      registerCommands([
        { id: "x.edit", label: "Edit", category: "Edit", scope: "global", defaultKeys: ["ctrl+a", "ctrl+z", "ctrl+y", "ctrl+x", "ctrl+c", "ctrl+v"], action },
      ]);

      const input = makeInput();
      for (const key of ["a", "z", "y", "x", "c", "v"]) {
        expect(handleKeyEvent(keyEvent(key, { ctrl: true, target: input }))).toBe(false);
      }
      expect(action).not.toHaveBeenCalled();
    });

    it("still runs non-editing chords while typing", () => {
      const send = vi.fn();
      const save = vi.fn();
      registerCommands([
        { id: "request.send", label: "Send", category: "Request", scope: "global", defaultKeys: ["ctrl+enter"], action: send },
        { id: "request.save", label: "Save", category: "Request", scope: "global", defaultKeys: ["ctrl+s"], action: save },
      ]);

      const input = makeInput();
      expect(handleKeyEvent(keyEvent("Enter", { ctrl: true, target: input }))).toBe(true);
      expect(send).toHaveBeenCalledTimes(1);
      expect(handleKeyEvent(keyEvent("s", { ctrl: true, target: input }))).toBe(true);
      expect(save).toHaveBeenCalledTimes(1);
    });

    it("does not intercept plain keys while typing", () => {
      const action = vi.fn();
      registerCommands([
        { id: "request.delete", label: "Delete", category: "Request", scope: "global", defaultKeys: ["delete"], action },
      ]);

      const input = makeInput();
      expect(handleKeyEvent(keyEvent("Delete", { target: input }))).toBe(false);
      expect(action).not.toHaveBeenCalled();
    });

    it("does not intercept plain keys inside a CodeMirror editor", () => {
      const action = vi.fn();
      registerCommands([
        { id: "request.delete", label: "Delete", category: "Request", scope: "global", defaultKeys: ["delete"], action },
      ]);

      const cm = document.createElement("div");
      cm.className = "cm-editor";
      const cmChild = document.createElement("div");
      cm.appendChild(cmChild);

      expect(handleKeyEvent(keyEvent("Delete", { target: cmChild }))).toBe(false);
      expect(action).not.toHaveBeenCalled();
    });

    it("fires plain keys outside a text entry", () => {
      const action = vi.fn();
      registerCommands([
        { id: "request.delete", label: "Delete", category: "Request", scope: "global", defaultKeys: ["delete"], action },
      ]);

      expect(handleKeyEvent(keyEvent("Delete", { target: document.createElement("div") }))).toBe(true);
      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  describe("dispatch", () => {
    it("prevents the default browser action when a command fires", () => {
      registerCommands([
        { id: "request.save", label: "Save", category: "Request", scope: "global", defaultKeys: ["ctrl+s"], action: vi.fn() },
      ]);
      const event = keyEvent("s", { ctrl: true });
      handleKeyEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });

    it("ignores modifier keys on their own", () => {
      const action = vi.fn();
      registerCommands([
        { id: "x.any", label: "Any", category: "Test", scope: "global", defaultKeys: ["ctrl+control"], action },
      ]);
      expect(handleKeyEvent(keyEvent("Control", { ctrl: true }))).toBe(false);
      expect(action).not.toHaveBeenCalled();
    });

    it("returns false for an unbound combo", () => {
      expect(handleKeyEvent(keyEvent("q", { ctrl: true }))).toBe(false);
    });

    it("matches user key overrides over defaults", () => {
      const action = vi.fn();
      registerCommands([
        { id: "request.save", label: "Save", category: "Request", scope: "global", defaultKeys: ["ctrl+s"], action },
      ]);
      // The default binding is replaced by the user override.
      setUserKeys("request.save", ["ctrl+shift+s"]);
      expect(handleKeyEvent(keyEvent("s", { ctrl: true }))).toBe(false);
      expect(handleKeyEvent(keyEvent("S", { ctrl: true, shift: true }))).toBe(true);
      expect(action).toHaveBeenCalledTimes(1);
      resetKeys("request.save");
    });
  });
});
