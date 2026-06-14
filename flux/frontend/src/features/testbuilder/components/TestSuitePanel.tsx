import { useState, useEffect, useCallback } from "react";
import { Play, Plus, Trash2, ChevronRight, ChevronDown, GripVertical } from "lucide-react";
import { Modal } from "@/shared/components/Modal";
import { AssertionEditor } from "@/features/assertions/components/AssertionEditor";
import {
  CreateTestSuite,
  GetTestSuites,
  UpdateTestSuite,
  DeleteTestSuite,
  AddTestGroup,
  UpdateTestGroup,
  DeleteTestGroup,
  RunCollection,
} from "../../../../wailsjs/go/main/App";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";
import { models } from "../../../../wailsjs/go/models";
import { toast } from "@/app/stores/useToastStore";

export function TestSuitePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const collections = useCollectionStore((s) => s.collections);
  const [suites, setSuites] = useState<any[]>([]);
  const [selected, setSelected] = useState<models.TestSuite | null>(null);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCollID, setNewCollID] = useState("");

  const load = useCallback(async () => {
    try {
      const list = await GetTestSuites();
      setSuites(list);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await CreateTestSuite(newName.trim(), "", newCollID);
      setNewName("");
      await load();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete test suite?")) return;
    try {
      await DeleteTestSuite(id);
      if (selected?.id === id) setSelected(null);
      await load();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleUpdate = async () => {
    if (!selected) return;
    try {
      await UpdateTestSuite(selected);
      toast.success("Test suite saved");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleAddGroup = async () => {
    if (!selected) return;
    const group: any = {
      id: crypto.randomUUID(),
      name: "New Group",
      requestId: "",
      assertions: [],
    };
    try {
      await AddTestGroup(selected.id, "", group);
      await load();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleUpdateGroup = async (group: models.TestGroup) => {
    if (!selected) return;
    try {
      await UpdateTestGroup(selected.id, group);
      await load();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleDeleteGroup = async (groupID: string) => {
    if (!selected) return;
    try {
      await DeleteTestGroup(selected.id, groupID);
      await load();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<models.CollectionRunResult | null>(null);

  const handleRun = async () => {
    if (!selected) return;
    const reqs: models.RunnerRequest[] = [];
    const collectReqs = (groups: models.TestGroup[]) => {
      for (const g of groups) {
        if (g.requestId) {
          for (const c of collections) {
            const found = c.requests.find((r) => r.id === g.requestId);
            if (found) {
              reqs.push(models.RunnerRequest.createFrom({
                id: found.id,
                name: found.name,
                payload: found.payload,
                preSetVars: found.preSetVars ?? [],
                extractRules: found.extractRules ?? [],
                condition: "",
                retries: 0,
                assertions: g.assertions,
              }));
              break;
            }
          }
        }
        if (g.children) collectReqs(g.children);
      }
    };
    collectReqs(selected.groups);
    if (reqs.length === 0) { toast.error("No requests selected in suite"); return; }
    setRunning(true);
    setRunResult(null);
    try {
      const res = await RunCollection(reqs, {} as any);
      setRunResult(res);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setRunning(false);
    }
  };

  // @ts-ignore
  const suite = selected ?? suites.find((s: any) => s?.id === selected?.id) ?? null;

  return (
    <Modal open={open} onClose={onClose} title="Test Suites">
      <div className="flex gap-4 min-w-[640px] max-w-[800px] min-h-[400px]">
        {/* Sidebar: suite list */}
        <div className="w-[200px] shrink-0 flex flex-col gap-2 border-r border-border pr-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Suite name…"
              className="h-[28px] flex-1 px-2 bg-surface border border-border rounded text-11 text-text outline-none focus:border-cyan"
            />
            <select
              value={newCollID}
              onChange={(e) => setNewCollID(e.target.value)}
              className="h-[28px] px-1 bg-surface border border-border rounded text-11 text-text outline-none focus:border-cyan"
            >
              <option value="">All</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCreate}
              className="flex items-center justify-center w-[28px] h-[28px] bg-cyan hover:bg-cyan-hover text-white rounded transition-colors"
            >
              <Plus size={12} />
            </button>
          </div>
          <div className="flex flex-col gap-1 overflow-y-auto max-h-[320px]">
            {suites.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer text-12 transition-colors ${
                  selected?.id === s.id ? "bg-cyan/10 text-cyan" : "text-text hover:bg-card"
                }`}
                onClick={() => setSelected(s)}
              >
                <span className="flex-1 truncate">{s.name}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                  className="text-subtext hover:text-danger transition-colors"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Main: selected suite editor */}
        <div className="flex-1 flex flex-col gap-3">
          {suite ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={suite.name}
                  onChange={(e) => setSelected({ ...suite, name: e.target.value } as any)}
                  className="h-[28px] flex-1 px-2 bg-surface border border-border rounded text-12 text-text font-semibold outline-none focus:border-cyan"
                />
                  <button
                    type="button"
                    onClick={handleUpdate}
                    className="h-[28px] px-3 bg-cyan hover:bg-cyan-hover text-white text-11 font-bold rounded transition-colors"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleRun}
                    disabled={running}
                    className="h-[28px] px-3 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-11 font-bold rounded transition-colors"
                  >
                    <Play size={11} />
                    {running ? "Running…" : "Run"}
                  </button>
                </div>

                {/* Run results */}
                {runResult && (
                  <div className="bg-card border border-border rounded-lg p-3 flex flex-col gap-2">
                    <div className={`text-12 font-semibold ${runResult.failed === 0 ? "text-teal" : "text-danger"}`}>
                      {runResult.passed}/{runResult.total} passed · {runResult.durationMs}ms
                      {runResult.failed > 0 && <span> · {runResult.failed} failed</span>}
                      {runResult.skipped > 0 && <span> · {runResult.skipped} skipped</span>}
                    </div>
                    {runResult.results.map((res, i) => (
                      <div key={i} className="flex items-center gap-2 text-11">
                        <span className={`font-bold ${res.skipped ? "text-subtext" : res.passed ? "text-teal" : "text-danger"}`}>
                          {res.skipped ? "SKIP" : res.passed ? "PASS" : "FAIL"}
                        </span>
                        <span className="text-text">{res.requestName}</span>
                        <span className="text-subtext">{res.statusCode} · {res.timingMs}ms</span>
                        {res.error && <span className="text-danger/80">{res.error}</span>}
                        {res.assertionErrors?.map((err, j) => <span key={j} className="text-amber-400">{err}</span>)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Groups */}
              <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto">
                {suite?.groups?.map((group: any) => (
                  <GroupEditor
                    key={group.id}
                    group={group}
                    collections={collections}
                    onChange={handleUpdateGroup}
                    onDelete={handleDeleteGroup}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddGroup}
                className="flex items-center gap-1 text-11 text-cyan hover:text-cyan-hover transition-colors"
              >
                <Plus size={12} />
                Add group
              </button>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-13 text-subtext">
              Select or create a test suite
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function GroupEditor({
  group,
  collections,
  onChange,
  onDelete,
}: {
  group: models.TestGroup;
  collections: models.Collection[];
  onChange: (g: any) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const allRequests = collections.flatMap((c) =>
    (c.requests || []).map((r) => ({ ...r, collName: c.name }))
  );

  return (
    <div className="bg-card border border-border rounded-lg p-2">
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-subtext hover:text-text transition-colors"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <input
          type="text"
          value={group.name}
          onChange={(e) => onChange({ ...group, name: e.target.value } as any)}
          className="h-[24px] flex-1 px-2 bg-transparent border border-transparent hover:border-border rounded text-12 text-text outline-none focus:border-cyan"
        />
        <select
          value={group.requestId}
          onChange={(e) => onChange({ ...group, requestId: e.target.value } as any)}
          className="h-[24px] max-w-[160px] px-1 bg-surface border border-border rounded text-11 text-text outline-none focus:border-cyan"
        >
          <option value="">Select request…</option>
          {allRequests.map((r) => (
            <option key={r.id} value={r.id}>{r.collName} / {r.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onDelete(group.id)}
          className="text-subtext hover:text-danger transition-colors"
        >
          <Trash2 size={10} />
        </button>
      </div>
      {expanded && (
        <div className="pl-5">
          <AssertionEditor
            assertions={group.assertions}
            onChange={(assertions) => onChange({ ...group, assertions } as any)}
          />
        </div>
      )}
    </div>
  );
}
