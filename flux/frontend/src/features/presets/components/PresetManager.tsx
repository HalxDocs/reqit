import { useState } from "react";
import { Bookmark, BookmarkPlus, Trash2, X } from "lucide-react";
import { usePresetStore, type HeaderPreset, type AuthPreset } from "@/features/presets/stores/usePresetStore";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { uid } from "@/shared/lib/id";

export function HeaderPresetButtons() {
  const presets = usePresetStore((s) => s.headerPresets);
  const saveHeaderPreset = usePresetStore((s) => s.saveHeaderPreset);
  const deleteHeaderPreset = usePresetStore((s) => s.deleteHeaderPreset);
  const headers = useRequestStore((s) => s.headers);
  const addHeader = useRequestStore((s) => s.addHeader);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");

  const applyPreset = (p: HeaderPreset) => {
    const s = useRequestStore.getState();
    const rows = p.headers.map((h) => ({ id: uid("kv"), key: h.key, value: h.value, enabled: h.enabled }));
    useRequestStore.setState({ headers: [...s.headers, ...rows] });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 text-11 text-subtext hover:text-text transition-colors" title="Header presets">
        <Bookmark size={11} /> Presets{presets.length > 0 && <span className="text-10 text-cyan">({presets.length})</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl p-3 min-w-[220px] max-h-[300px] overflow-y-auto">
            {presets.length > 0 && (
              <div className="flex flex-col gap-1 mb-2 pb-2 border-b border-border">
                <div className="text-10 text-subtext uppercase tracking-wider">Saved presets</div>
                {presets.map((p) => (
                  <div key={p.id} className="flex items-center gap-1">
                    <button type="button" onClick={() => applyPreset(p)} className="flex-1 text-left px-2 py-1 text-11 text-text hover:bg-cardHover rounded transition-colors truncate">
                      {p.name}
                    </button>
                    <button type="button" onClick={() => deleteHeaderPreset(p.id)} className="text-subtext hover:text-danger"><X size={10} /></button>
                  </div>
                ))}
              </div>
            )}
            {saving ? (
              <div className="flex items-center gap-1">
                <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Preset name" className="flex-1 h-[24px] px-2 bg-bg border border-border rounded text-11 text-text outline-none focus:border-cyan" autoFocus />
                <button type="button" onClick={() => { if (saveName.trim()) { saveHeaderPreset(saveName.trim(), headers); setSaveName(""); setSaving(false); } }} className="h-[24px] px-2 bg-cyan text-white text-10 rounded font-bold">Save</button>
                <button type="button" onClick={() => setSaving(false)} className="text-subtext hover:text-text"><X size={12} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => setSaving(true)} className="flex items-center gap-1 text-11 text-cyan hover:text-cyan-hover transition-colors">
                <BookmarkPlus size={11} /> Save current headers
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function AuthPresetButtons() {
  const presets = usePresetStore((s) => s.authPresets);
  const saveAuthPreset = usePresetStore((s) => s.saveAuthPreset);
  const deleteAuthPreset = usePresetStore((s) => s.deleteAuthPreset);
  const s = useRequestStore.getState();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");

  const applyPreset = (p: AuthPreset) => {
    useRequestStore.setState({
      authType: p.authType,
      authToken: p.authToken ?? "",
      authUser: p.authUser ?? "",
      authPass: p.authPass ?? "",
      authKeyName: p.authKeyName ?? "X-API-Key",
      authKeyValue: p.authKeyValue ?? "",
      authKeyIn: p.authKeyIn ?? "header",
      authUsername: p.authUsername ?? "",
      authPassword: p.authPassword ?? "",
      oauth2Config: p.oauth2Config,
    });
    setOpen(false);
  };

  const handleSave = () => {
    if (!saveName.trim()) return;
    const store = useRequestStore.getState();
    saveAuthPreset(saveName.trim(), {
      authType: store.authType,
      authToken: store.authToken,
      authUser: store.authUser,
      authPass: store.authPass,
      authKeyName: store.authKeyName,
      authKeyValue: store.authKeyValue,
      authKeyIn: store.authKeyIn,
      oauth2Config: store.oauth2Config,
      authUsername: store.authUsername,
      authPassword: store.authPassword,
    });
    setSaveName("");
    setSaving(false);
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 text-11 text-subtext hover:text-text transition-colors" title="Auth presets">
        <Bookmark size={11} /> Presets{presets.length > 0 && <span className="text-10 text-cyan">({presets.length})</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl p-3 min-w-[220px] max-h-[300px] overflow-y-auto">
            {presets.length > 0 && (
              <div className="flex flex-col gap-1 mb-2 pb-2 border-b border-border">
                <div className="text-10 text-subtext uppercase tracking-wider">Saved auth</div>
                {presets.map((p) => (
                  <div key={p.id} className="flex items-center gap-1">
                    <button type="button" onClick={() => applyPreset(p)} className="flex-1 text-left px-2 py-1 text-11 text-text hover:bg-cardHover rounded transition-colors truncate">
                      {p.name}
                    </button>
                    <button type="button" onClick={() => deleteAuthPreset(p.id)} className="text-subtext hover:text-danger"><X size={10} /></button>
                  </div>
                ))}
              </div>
            )}
            {saving ? (
              <div className="flex items-center gap-1">
                <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Preset name" className="flex-1 h-[24px] px-2 bg-bg border border-border rounded text-11 text-text outline-none focus:border-cyan" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }} />
                <button type="button" onClick={handleSave} className="h-[24px] px-2 bg-cyan text-white text-10 rounded font-bold">Save</button>
                <button type="button" onClick={() => setSaving(false)} className="text-subtext hover:text-text"><X size={12} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => setSaving(true)} className="flex items-center gap-1 text-11 text-cyan hover:text-cyan-hover transition-colors">
                <BookmarkPlus size={11} /> Save current auth
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
