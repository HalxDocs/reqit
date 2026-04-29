import { useEffect, useState } from "react";
import { Modal } from "../shared/Modal";
import { useUIStore } from "../../stores/useUIStore";
import { useProfileStore } from "../../stores/useProfileStore";
import fluxLogo from "../../assets/images/fluxloo.jpeg";

export function WelcomeModal() {
  const profile = useProfileStore((s) => s.profile);
  const loaded = useProfileStore((s) => s.loaded);
  const update = useProfileStore((s) => s.update);
  const open = useUIStore((s) => s.welcomeModalOpen);
  const openWelcome = useUIStore((s) => s.openWelcomeModal);
  const closeWelcome = useUIStore((s) => s.closeWelcomeModal);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  // Pop the welcome modal once when the profile loads with no name set
  // (i.e., first launch — Go side already minted the user ID + timestamps).
  useEffect(() => {
    if (loaded && profile && !profile.name) {
      openWelcome();
    }
  }, [loaded, profile, openWelcome]);

  const handleSave = async () => {
    setBusy(true);
    try {
      await update(name.trim(), email.trim());
      closeWelcome();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={closeWelcome} title="Welcome to Flux">
      <div className="flex flex-col gap-4 w-[400px] max-w-full">
        <img src={fluxLogo} alt="Flux" className="h-[40px] w-auto object-contain self-start" />
        <p className="text-12 text-subtext">
          Flux is local-first: nothing leaves your machine. We just want to know
          what to call you. Both fields are optional and only stored locally.
        </p>

        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            spellCheck={false}
            placeholder="Kamsy"
            className="h-[36px] px-3 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-blue focus:ring-2 focus:ring-blue"
          />
        </Field>

        <Field label="Email (optional)">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="kamsy@example.com"
            className="h-[36px] px-3 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-blue focus:ring-2 focus:ring-blue"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={closeWelcome}
            className="h-[32px] px-3 text-12 text-subtext hover:text-text rounded-md transition-colors"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="h-[32px] px-4 bg-blue hover:bg-blue-hover text-white text-12 font-bold rounded-md disabled:opacity-60 transition-all"
          >
            {busy ? "Saving…" : "Get started"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-11 text-subtext font-semibold uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}
