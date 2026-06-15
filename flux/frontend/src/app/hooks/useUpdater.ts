import { useEffect, useState } from "react";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { InstallUpdate, CheckForUpdates } from "../../../wailsjs/go/main/App";
import type { updater } from "../../../wailsjs/go/models";

export function useUpdater() {
  const [update, setUpdate] = useState<updater.UpdateManifest | null>(null);
  const [installing, setInstalling] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    CheckForUpdates().then((m) => {
      if (m) {
        const dismissed = localStorage.getItem("dismissed-version");
        if (dismissed !== m.version) setUpdate(m);
      }
    });
    const off = EventsOn("update:available", (m: updater.UpdateManifest) => {
      const dismissed = localStorage.getItem("dismissed-version");
      if (dismissed !== m.version) setUpdate(m);
    });
    return () => { if (typeof off === "function") off(); };
  }, []);

  const install = async () => {
    if (!update) return;
    setInstalling(true);
    setError(null);
    try {
      await InstallUpdate(update);
      setDone(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setInstalling(false);
    }
  };

  const dismiss = () => {
    if (update) localStorage.setItem("dismissed-version", update.version);
    setUpdate(null);
  };

  return { update, installing, done, error, install, dismiss };
}
