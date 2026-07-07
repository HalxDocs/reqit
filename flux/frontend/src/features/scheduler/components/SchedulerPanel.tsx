import { useState, useEffect, useCallback } from "react";
import { useUIStore } from "@/app/stores/useUIStore";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";
import { Button } from "@/shared/components/Button";
import { GetSchedules, CreateSchedule, UpdateSchedule, DeleteSchedule } from "../../../../wailsjs/go/main/App";
import { EventsOn } from "../../../../wailsjs/runtime/runtime";
import { nanoid } from "nanoid";
import { Clock, Plus, Trash2, Play, Pause, Edit2, Check, X } from "lucide-react";
import type { scheduler } from "../../../../wailsjs/go/models";

export function SchedulerPanel() {
  const setView = useUIStore((s) => s.setView);
  const collections = useCollectionStore((s) => s.collections);
  const [schedules, setSchedules] = useState<scheduler.ScheduledRun[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCron, setNewCron] = useState("* * * * *");
  const [newCollID, setNewCollID] = useState("");
  const [error, setError] = useState("");
  const [editingID, setEditingID] = useState<string | null>(null);
  const [editCron, setEditCron] = useState("");

  const load = useCallback(async () => {
    try {
      const s = await GetSchedules();
      setSchedules(s);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const off = EventsOn("scheduler:run", () => { load(); });
    return () => off();
  }, [load]);

  const handleCreate = async () => {
    if (!newName.trim() || !newCollID) { setError("Name and collection required"); return; }
    setError("");
    try {
      await CreateSchedule(nanoid(), newCollID, newName.trim(), newCron, true);
      setShowCreate(false);
      setNewName("");
      setNewCron("* * * * *");
      setNewCollID("");
      await load();
    } catch (e) { setError(String(e)); }
  };

  const toggleEnabled = async (s: scheduler.ScheduledRun) => {
    try {
      await UpdateSchedule(s.id, null, null, !s.enabled);
      await load();
    } catch (e) { setError(String(e)); }
  };

  const saveEdit = async (id: string) => {
    try {
      await UpdateSchedule(id, null, editCron, null);
      setEditingID(null);
      await load();
    } catch (e) { setError(String(e)); }
  };

  const handleDelete = async (id: string) => {
    try {
      await DeleteSchedule(id);
      await load();
    } catch (e) { setError(String(e)); }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg">
      <header className="h-[48px] flex items-center gap-3 px-4 border-b border-border shrink-0">
        <button onClick={() => setView("http")} className="text-subtext hover:text-text text-13">&larr; Back</button>
        <h1 className="text-14 font-semibold text-text flex items-center gap-2"><Clock size={14} /> Scheduler</h1>
        <div className="ml-auto">
          <Button variant="primary" onClick={() => setShowCreate(!showCreate)}><Plus size={12} /> New Schedule</Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-danger/10 text-danger text-13 border border-danger/20">{error}</div>
        )}

        {showCreate && (
          <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-13 font-semibold text-text">New Schedule</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-11 text-subtext block mb-1">Name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-bg border border-border text-13 text-text" />
              </div>
              <div>
                <label className="text-11 text-subtext block mb-1">Cron Expression</label>
                <input value={newCron} onChange={(e) => setNewCron(e.target.value)}
                  placeholder="* * * * *"
                  className="w-full px-3 py-1.5 rounded-lg bg-bg border border-border text-13 text-text font-mono" />
              </div>
              <div>
                <label className="text-11 text-subtext block mb-1">Collection</label>
                <select value={newCollID} onChange={(e) => setNewCollID(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-bg border border-border text-13 text-text">
                  <option value="">Select…</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-11 text-subtext">Format: minute hour day-of-month month day-of-week (e.g. <code className="text-cyan">*/5 * * * *</code> = every 5 min)</p>
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleCreate}>Create</Button>
              <Button onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {schedules.length === 0 && !showCreate && (
          <div className="flex flex-col items-center justify-center h-full text-subtext text-13 gap-2">
            <Clock size={32} className="opacity-30" />
            <p>No schedules yet. Create one to run collections automatically.</p>
          </div>
        )}

        {schedules.map((s) => (
          <div key={s.id} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
            <button onClick={() => toggleEnabled(s)} className="shrink-0" title={s.enabled ? "Pause" : "Enable"}>
              {s.enabled ? <Play size={16} className="text-green-400" /> : <Pause size={16} className="text-subtext" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-13 font-medium text-text">{s.name}</span>
                <span className={`text-11 px-2 py-0.5 rounded-full ${s.enabled ? "bg-green-500/10 text-green-400" : "bg-subtext/10 text-subtext"}`}>
                  {s.enabled ? "Active" : "Paused"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-11 text-subtext mt-1">
                {editingID === s.id ? (
                  <span className="flex items-center gap-1">
                    <input value={editCron} onChange={(e) => setEditCron(e.target.value)}
                      className="w-32 px-2 py-0.5 rounded bg-bg border border-border text-12 font-mono text-text" />
                    <button onClick={() => saveEdit(s.id)} className="text-green-400 hover:text-green-300"><Check size={12} /></button>
                    <button onClick={() => setEditingID(null)} className="text-subtext hover:text-text"><X size={12} /></button>
                  </span>
                ) : (
                  <span className="font-mono">{s.cronExpr}
                    <button onClick={() => { setEditingID(s.id); setEditCron(s.cronExpr); }} className="ml-1 text-subtext hover:text-cyan"><Edit2 size={10} /></button>
                  </span>
                )}
                <span>Collection: {collections.find((c) => c.id === s.collectionId)?.name ?? s.collectionId}</span>
                {s.lastRunAt && <span>Last: {new Date(s.lastRunAt).toLocaleString()}</span>}
                {s.nextRunAt && <span>Next: {new Date(s.nextRunAt).toLocaleString()}</span>}
              </div>
            </div>
            <button onClick={() => handleDelete(s.id)} className="text-subtext hover:text-danger transition-colors" title="Delete schedule">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
