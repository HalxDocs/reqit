import { useState } from "react";
import { Save, Clock, RotateCcw, X } from "lucide-react";
import { useUIStore } from "@/app/stores/useUIStore";
import { toast } from "@/app/stores/useToastStore";
import { showConfirm } from "@/shared/components/ConfirmModal";

interface Session {
  id: string;
  name: string;
  createdAt: string;
  state: string; // JSON serialized
}

const STORAGE_KEY = "reqit:sessions";

function loadSessions(): Session[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}

function saveSessions(sessions: Session[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function SessionManager() {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>(loadSessions);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  const captureState = (): string => {
    const ui = useUIStore.getState();
    const state = {
      tabs: localStorage.getItem("flux:tabs"),
      sidebarCollapsed: ui.sidebarCollapsed,
      panelLayout: ui.panelLayout,
      view: ui.view,
      responseBodyView: ui.responseBodyView,
    };
    return JSON.stringify(state);
  };

  const restoreState = (stateStr: string) => {
    try {
      const state = JSON.parse(stateStr);
      if (state.tabs) localStorage.setItem("flux:tabs", state.tabs);
      if (state.sidebarCollapsed !== undefined) useUIStore.setState({ sidebarCollapsed: state.sidebarCollapsed });
      if (state.panelLayout) useUIStore.setState({ panelLayout: state.panelLayout });
      if (state.view) useUIStore.setState({ view: state.view as any });
      if (state.responseBodyView) useUIStore.setState({ responseBodyView: state.responseBodyView });
      // Reload the page to pick up tabs state
      window.location.reload();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleSave = () => {
    if (!saveName.trim()) return;
    const sessions = loadSessions();
    sessions.push({
      id: `session_${Date.now()}`,
      name: saveName.trim(),
      createdAt: new Date().toISOString(),
      state: captureState(),
    });
    saveSessions(sessions);
    setSessions(sessions);
    setSaveName("");
    setSaving(false);
    toast.success("Session saved");
  };

  const handleRestore = async (session: Session) => {
    if (!(await showConfirm({ title: "Restore session", message: `Restore session "${session.name}"? This will reload the app.` }))) return;
    restoreState(session.state);
  };

  const handleDelete = (id: string) => {
    const sessions = loadSessions().filter((s) => s.id !== id);
    saveSessions(sessions);
    setSessions(sessions);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-11 text-subtext hover:text-text transition-colors"
        title="Session manager"
      >
        <Clock size={11} /> Sessions
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl p-3 min-w-[260px] max-h-[360px] overflow-y-auto">
            <div className="text-11 font-semibold text-text mb-2">Workspace Sessions</div>

            {sessions.length > 0 && (
              <div className="flex flex-col gap-1 mb-2 pb-2 border-b border-border">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleRestore(s)}
                      className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-cardHover transition-colors text-left"
                    >
                      <RotateCcw size={10} className="text-subtext" />
                      <div className="flex flex-col">
                        <span className="text-12 text-text">{s.name}</span>
                        <span className="text-10 text-subtext">{new Date(s.createdAt).toLocaleString()}</span>
                      </div>
                    </button>
                    <button type="button" onClick={() => handleDelete(s.id)} className="text-subtext hover:text-danger"><X size={10} /></button>
                  </div>
                ))}
              </div>
            )}

            {saving ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Session name"
                  className="flex-1 h-[24px] px-2 bg-bg border border-border rounded text-11 text-text outline-none focus:border-cyan"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                />
                <button type="button" onClick={handleSave} className="h-[24px] px-2 bg-cyan text-white text-10 rounded font-bold">Save</button>
                <button type="button" onClick={() => setSaving(false)} className="text-subtext hover:text-text"><X size={12} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => setSaving(true)} className="flex items-center gap-1 text-11 text-cyan hover:text-cyan-hover transition-colors">
                <Save size={11} /> Save current session
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
