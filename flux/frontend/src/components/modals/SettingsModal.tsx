import { useEffect, useState } from "react";
import { Modal } from "../shared/Modal";
import { useUIStore } from "../../stores/useUIStore";
import { useProfileStore } from "../../stores/useProfileStore";

const VERSION = "0.1.0";

export function SettingsModal() {
  const open = useUIStore((s) => s.settingsModalOpen);
  const close = useUIStore((s) => s.closeSettingsModal);
  const profile = useProfileStore((s) => s.profile);
  const appDataDir = useProfileStore((s) => s.appDataDir);
  const update = useProfileStore((s) => s.update);

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
              className="h-[32px] px-3 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-blue focus:ring-2 focus:ring-blue"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              className="h-[32px] px-3 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-blue focus:ring-2 focus:ring-blue"
            />
          </Field>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="h-[28px] px-3 bg-blue hover:bg-blue-hover text-white text-12 font-bold rounded-md disabled:opacity-60 transition-all"
            >
              {busy ? "Saving…" : "Save profile"}
            </button>
            {saved && <span className="text-11 text-teal">Saved</span>}
          </div>
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
            plain JSON. Back it up or commit it to git — Flux is local-first.
          </p>
        </Section>

        <Section title="About">
          <Stat label="Version" value={`Flux ${VERSION}`} />
          <Stat label="Repository" value="github.com/HalxDocs/flux" mono />
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
