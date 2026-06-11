import { useEffect, useRef, useState } from "react";
import { Modal } from "@/shared/components/Modal";
import { useUIStore } from "@/app/stores/useUIStore";
import { useProfileStore } from "@/app/stores/useProfileStore";
import { useThemeStore } from "@/shared/lib/useTheme";
import { getCommands, setUserKeys, resetKeys, getActiveKeys } from "@/shared/lib/commands";
import { GetVersion } from "../../../wailsjs/go/main/App";

export function SettingsModal() {
  const open = useUIStore((s) => s.settingsModalOpen);
  const close = useUIStore((s) => s.closeSettingsModal);
  const profile = useProfileStore((s) => s.profile);
  const appDataDir = useProfileStore((s) => s.appDataDir);
  const update = useProfileStore((s) => s.update);
  const [version, setVersion] = useState("");
  useEffect(() => { GetVersion().then(setVersion).catch(() => {}); }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open || !profile) return;
    setName(profile.name ?? "");
    setEmail(profile.email ?? "");
    setSaved(false);
  }, [open, profile]);

  const handleSave = async () => {
    setBusy(true);
    try {
      await update(name.trim(), email.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Settings">
      <div className="flex flex-col gap-5 w-[440px] max-w-full">
        <Section title="Profile">
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              spellCheck={false}
              className="h-[32px] px-3 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-cyan focus:ring-2 focus:ring-cyan"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              className="h-[32px] px-3 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-cyan focus:ring-2 focus:ring-cyan"
            />
          </Field>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="h-[28px] px-3 bg-cyan hover:bg-cyan-hover text-white text-12 font-bold rounded-md disabled:opacity-60 transition-all"
            >
              {busy ? "Saving…" : "Save profile"}
            </button>
            {saved && <span className="text-11 text-teal">Saved</span>}
          </div>
        </Section>

        <Section title="Theme">
          <ThemeSelector />
        </Section>

        <Section title="Shortcuts">
          <ShortcutList />
        </Section>

        <Section title="Activity">
          <Stat label="First launch" value={fmtDate(profile?.createdAt)} />
          <Stat label="Last active" value={fmtDate(profile?.lastSeenAt)} />
          <Stat label="App launches" value={String(profile?.launchCount ?? 0)} />
          <Stat label="Requests sent" value={String(profile?.requestCount ?? 0)} />
        </Section>

        <Section title="Storage">
          <Stat label="Data directory" value={appDataDir || "—"} mono />
          <p className="text-11 text-subtext">
            Collections, environments, history, and your profile live here as
            plain JSON. Back it up or commit it to git — reqit is local-first.
          </p>
        </Section>

        <Section title="About">
          <Stat label="Version" value={version ? `reqit ${version}` : "reqit"} />
          <Stat label="Repository" value="github.com/HalxDocs/reqit" mono />
        </Section>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={close}
            className="h-[32px] px-3 text-12 text-subtext hover:text-text rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-11 text-subtext font-semibold uppercase tracking-wider">
        {title}
      </h3>
      <div className="flex flex-col gap-2 pl-1">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-11 text-subtext">{label}</label>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3 text-12">
      <span className="text-subtext min-w-[110px]">{label}</span>
      <span className={mono ? "font-mono text-text break-all" : "text-text"}>{value}</span>
    </div>
  );
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function ShortcutList() {
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 50);
  }, [editing]);

  const cmds = getCommands().filter((c) => c.defaultKeys.length > 0 || c.userKeys);

  return (
    <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
      {cmds.map((cmd) => (
        <div key={cmd.id} className="flex items-center justify-between py-1 px-1 rounded-sm hover:bg-cardHover group">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-11 text-tertiary uppercase tracking-wider w-[70px] shrink-0">{cmd.category}</span>
            <span className="text-12 text-text truncate">{cmd.label}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {editing === cmd.id ? (
              <div className="flex items-center gap-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const keys = editValue.split(",").map((s) => s.trim()).filter(Boolean);
                      setUserKeys(cmd.id, keys);
                      setEditing(null);
                      forceUpdate((n) => n + 1);
                    } else if (e.key === "Escape") {
                      setEditing(null);
                    }
                  }}
                  placeholder="meta+k, ctrl+k"
                  spellCheck={false}
                  className="w-[140px] h-[22px] px-2 bg-surface border border-border rounded text-11 font-mono text-text outline-none focus:border-cyan"
                />
                <button type="button" onClick={() => setEditing(null)} className="text-11 text-subtext hover:text-text">✓</button>
              </div>
            ) : (
              <>
                <span className="text-11 text-tertiary font-mono">
                  {getActiveKeys(cmd.id).map(formatKeyBadge).join(" ")}
                </span>
                <button
                  type="button"
                  onClick={() => { setEditValue(getActiveKeys(cmd.id).join(", ")); setEditing(cmd.id); }}
                  className="text-11 text-subtext hover:text-cyan opacity-0 group-hover:opacity-100 transition-all"
                >
                  Edit
                </button>
                {cmd.userKeys && (
                  <button
                    type="button"
                    onClick={() => { resetKeys(cmd.id); forceUpdate((n) => n + 1); }}
                    className="text-11 text-subtext hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                  >
                    Reset
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatKeyBadge(k: string): string {
  return k
    .replace("meta", "⌘")
    .replace("ctrl", "⌃")
    .replace("alt", "⌥")
    .replace("shift", "⇧")
    .toUpperCase();
}

function ThemeSelector() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const options: { value: typeof mode; label: string }[] = [
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
    { value: "system", label: "System" },
  ];
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setMode(o.value)}
          className={`h-[28px] px-3 text-12 rounded-md border transition-colors ${
            mode === o.value
              ? "bg-cyan text-white border-cyan"
              : "bg-card text-subtext border-border hover:text-text hover:border-cyan"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
