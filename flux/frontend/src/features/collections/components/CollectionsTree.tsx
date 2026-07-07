import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckSquare, ChevronDown, ChevronRight, Copy,
  FileCode2, Lock, Pencil, Plus, Square, Trash2,
} from "lucide-react";
import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";
import { useUIStore } from "@/app/stores/useUIStore";
import { useTabsStore } from "@/features/tabs/stores/useTabsStore";
import { useGitStore } from "@/features/git/stores/useGitStore";
import { decodePayload } from "@/shared/lib/loadPayload";
import { MethodBadge } from "@/shared/components/MethodBadge";
import { CollectionMenu } from "./CollectionMenu";
import { cn } from "@/shared/lib/cn";
import { downloadText, safeFilename } from "@/shared/lib/download";
import { toast } from "@/app/stores/useToastStore";
import {
  ExportCollectionMarkdown,
  ExportCollectionHTML,
  ExportOpenAPI,
  PreviewOpenAPI,
  GetActiveWorkspace,
  LinkCollectionSpec,
  InvalidateSpec,
  PickFile,
  FetchSpecFromURL,
} from "../../../../wailsjs/go/main/App";
import type { main, models } from "../../../../wailsjs/go/models";
import type { HttpMethod, PreSetVar, ExtractRule } from "@/features/request/types/request";

const COLL_H = 32;
const REQ_H = 28;
const EMPTY_H = 28;
const OVERSCAN = 10;

type Row =
  | { type: "coll"; id: string; coll: models.Collection; requests: models.SavedRequest[]; hasSpec: boolean; isOpen: boolean }
  | { type: "req"; id: string; collID: string; req: models.SavedRequest; method: HttpMethod }
  | { type: "empty" };

interface DragItem {
  type: "coll" | "req";
  id: string;
  collID?: string;
}

interface DropTarget {
  id: string;
  pos: "before" | "after";
}

export function CollectionsTree() {
  const collections = useCollectionStore((s) => s.collections);
  const expanded = useCollectionStore((s) => s.expanded);
  const toggleExpanded = useCollectionStore((s) => s.toggleExpanded);
  const createCollection = useCollectionStore((s) => s.createCollection);
  const renameCollection = useCollectionStore((s) => s.renameCollection);
  const deleteCollection = useCollectionStore((s) => s.deleteCollection);
  const loadCollections = useCollectionStore((s) => s.load);
  const deleteRequest = useCollectionStore((s) => s.deleteRequest);
  const deleteRequests = useCollectionStore((s) => s.deleteRequests);
  const renameRequest = useCollectionStore((s) => s.renameRequest);
  const duplicateRequest = useCollectionStore((s) => s.duplicateRequest);
  const reorderCollection = useCollectionStore((s) => s.reorderCollection);
  const reorderRequest = useCollectionStore((s) => s.reorderRequest);
  const moveRequest = useCollectionStore((s) => s.moveRequest);
  const updateCollectionVariables = useCollectionStore((s) => s.updateCollectionVariables);
  const newTab = useTabsStore((s) => s.newTab);
  const setLoadedRequestID = useUIStore((s) => s.setLoadedRequestID);
  const loadedRequestID = useUIStore((s) => s.loadedRequestID);
  const filter = useUIStore((s) => s.sidebarFilter);
  const openRunner = useUIStore((s) => s.openRunner);

  const [renamingID, setRenamingID] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renamingReqID, setRenamingReqID] = useState<string | null>(null);
  const [renameReqValue, setRenameReqValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveTargetOpen, setMoveTargetOpen] = useState(false);
  const [mdExportColl, setMdExportColl] = useState<models.Collection | null>(null);
  const [varsEditorColl, setVarsEditorColl] = useState<models.Collection | null>(null);
  const [varsEditorDraft, setVarsEditorDraft] = useState<models.EnvVar[]>([]);
  const [mdOpts, setMdOpts] = useState<main.ExportMarkdownOpts>({
    includeHeaders: true, includeBody: true, includeExamples: true, baseUrl: "", timestamp: true,
  });
  const [htmlExportColl, setHtmlExportColl] = useState<models.Collection | null>(null);
  const [htmlOpts, setHtmlOpts] = useState<main.ExportHTMLDocsOpts>({
    includeHeaders: true, includeBody: true, includeExamples: true, baseUrl: "", timestamp: true, darkMode: true,
  });
  const renameReqRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerH, setContainerH] = useState(400);
  const dragItem = useRef<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerH(e.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return collections.map((c) => ({ coll: c, requests: c.requests }));
    return collections
      .map((c) => {
        const cm = c.name.toLowerCase().includes(q);
        return { coll: c, requests: cm ? c.requests : c.requests.filter((r) => r.name.toLowerCase().includes(q)), cm };
      })
      .filter((x) => x.cm || x.requests.length > 0);
  }, [collections, filter]);

  const rows = useMemo((): Row[] => {
    const r: Row[] = [];
    for (const { coll: c, requests: reqs } of visible) {
      const isOpen = expanded[c.id] !== false || !!filter;
      r.push({ type: "coll", id: c.id, coll: c, requests: reqs, hasSpec: !!c.spec, isOpen });
      if (isOpen) {
        if (reqs.length === 0) r.push({ type: "empty" });
        else for (const req of reqs) r.push({ type: "req", id: req.id, collID: c.id, req, method: (req.payload.method as HttpMethod) || "GET" });
      }
    }
    return r;
  }, [visible, expanded, filter]);

  const { totalH, offsets } = useMemo(() => {
    const o: number[] = [];
    let acc = 0;
    for (const row of rows) {
      o.push(acc);
      acc += row.type === "coll" ? COLL_H : EMPTY_H;
    }
    return { totalH: acc, offsets: o };
  }, [rows]);

  const { startIdx, endIdx } = useMemo(() => {
    if (rows.length === 0) return { startIdx: 0, endIdx: 0 };
    const s = search(offsets, scrollTop - OVERSCAN * REQ_H);
    const e = search(offsets, scrollTop + containerH + OVERSCAN * REQ_H);
    return { startIdx: Math.max(0, s - 1), endIdx: Math.min(rows.length, e + 1) };
  }, [offsets, scrollTop, containerH]);

  const visibleRows = rows.slice(startIdx, endIdx);
  const topPad = offsets[startIdx] || 0;
  const bottomPad = totalH - (offsets[endIdx - 1] || 0) - (rows[endIdx - 1]?.type === "coll" ? COLL_H : EMPTY_H);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop);
  }, []);

  const handleCreate = async () => {
    const t = newName.trim();
    if (!t) { setCreating(false); return; }
    await createCollection(t);
    setNewName(""); setCreating(false);
  };

  const handleRename = async (id: string) => {
    const t = renameValue.trim();
    if (t) await renameCollection(id, t);
    setRenamingID(null);
  };

  const handleRenameReq = async (id: string) => {
    const t = renameReqValue.trim();
    if (t) await renameRequest(id, t);
    setRenamingReqID(null);
  };

  const handleLinkSpec = async (collID: string) => {
    const url = prompt("Enter OpenAPI spec URL (leave empty to pick a local file):", "http://localhost:3000/openapi.json");
    if (url === null) return;

    try {
      if (url.trim()) {
        // URL mode — fetch and save
        toast.info("Downloading spec from URL...");
        const relativePath = await FetchSpecFromURL(url.trim());
        await LinkCollectionSpec(collID, relativePath);
        await loadCollections();
        toast.success("Spec linked from URL");
      } else {
        // File picker mode
        const fp = await PickFile("Select OpenAPI Spec", "*.yaml;*.yml;*.json");
        if (!fp) return;
        const ws = await GetActiveWorkspace();
        const dir = ws.dataDir.replace(/\\/g, "/");
        const n = fp.replace(/\\/g, "/");
        if (!n.startsWith(dir)) { toast.error("Spec file must be inside your workspace folder"); return; }
        await LinkCollectionSpec(collID, n.slice(dir.length).replace(/^\//, ""));
        await loadCollections();
        toast.success("Spec linked");
      }
    } catch (e) { toast.error(String(e)); }
  };

  const handleUnlinkSpec = async (collID: string, sp: string) => {
    try { await InvalidateSpec(sp); await LinkCollectionSpec(collID, ""); await loadCollections(); toast.success("Spec unlinked"); }
    catch (e) { toast.error(String(e)); }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set<string>();
    for (const row of rows) {
      if (row.type === "req") all.add(row.id);
    }
    setSelected(all);
  };

  const deselectAll = () => setSelected(new Set());

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} request${selected.size > 1 ? "s" : ""}?`)) return;
    await deleteRequests(Array.from(selected));
    setSelected(new Set());
    setSelecting(false);
    toast.success(`Deleted ${selected.size} request${selected.size > 1 ? "s" : ""}`);
  };

  const handleBatchMove = async (targetCollID: string) => {
    if (selected.size === 0) return;
    for (const reqID of selected) {
      await moveRequest(reqID, targetCollID);
    }
    setSelected(new Set());
    setSelecting(false);
    setMoveTargetOpen(false);
    toast.success(`Moved ${selected.size} request${selected.size > 1 ? "s" : ""}`);
  };

  const handleExportMarkdown = async (c: models.Collection) => {
    try {
      const path = await ExportCollectionMarkdown(c.id, mdOpts);
      toast.success(`Exported to ${path}`);
      setMdExportColl(null);
    } catch (e) { toast.error(String(e)); }
  };

  const handleExportHTML = async (c: models.Collection) => {
    try {
      const path = await ExportCollectionHTML(c.id, htmlOpts);
      toast.success(`Exported to ${path}`);
      setHtmlExportColl(null);
    } catch (e) { toast.error(String(e)); }
  };

  const loadRequest = (req: models.SavedRequest) => {
    newTab({ title: req.name, savedRequestID: req.id, request: decodePayload(req.payload, { preSetVars: req.preSetVars as unknown as PreSetVar[], extractRules: req.extractRules as unknown as ExtractRule[] }), response: null, dirty: false });
    setLoadedRequestID(req.id);
  };

  const handleDragStart = useCallback((e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    const type = el.dataset.dragType as "coll" | "req";
    const id = el.dataset.dragId!;
    const collID = el.dataset.dragCollId;
    dragItem.current = { type, id, collID };
    e.dataTransfer.effectAllowed = "move";
    if (e.dataTransfer.setDragImage) {
      e.dataTransfer.setDragImage(el, 0, 0);
    }
  }, []);

  const handleDragEnd = useCallback((_e: React.DragEvent) => {
    dragItem.current = null;
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const di = dragItem.current;
    if (!di) return;
    const el = e.currentTarget as HTMLElement;
    const targetType = el.dataset.dragType as "coll" | "req" | undefined;
    const targetID = el.dataset.dragId;
    if (!targetID || !targetType) return;

    if (di.type === "coll") {
      if (targetType !== "coll" || targetID === di.id) return;
      const rect = el.getBoundingClientRect();
      setDropTarget({ id: targetID, pos: e.clientY < rect.top + rect.height / 2 ? "before" : "after" });
    } else {
      if (targetType === "coll") {
        if (di.collID === targetID) return;
        setDropTarget({ id: targetID, pos: "before" });
      } else if (targetType === "req") {
        if (targetID === di.id) return;
        const rect = el.getBoundingClientRect();
        setDropTarget({ id: targetID, pos: e.clientY < rect.top + rect.height / 2 ? "before" : "after" });
      }
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    const targetID = el.dataset.dragId;
    if (!targetID) return;
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTarget((prev) => prev?.id === targetID ? null : prev);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDropTarget(null);
    const di = dragItem.current;
    if (!di) return;
    dragItem.current = null;
    const el = e.currentTarget as HTMLElement;
    const targetID = el.dataset.dragId;
    if (!targetID) return;

    if (di.type === "coll") {
      const fromIdx = collections.findIndex((c) => c.id === di.id);
      if (fromIdx === -1) return;
      let toIdx = collections.findIndex((c) => c.id === targetID);
      if (toIdx === -1) return;
      if (dropTarget?.pos === "after") toIdx++;
      if (fromIdx < toIdx) toIdx--;
      if (toIdx < 0) toIdx = 0;
      if (toIdx === fromIdx) return;
      await reorderCollection(di.id, toIdx);
    } else {
      const targetCollID = el.dataset.dragCollId;
      if (!targetCollID) return;
      if (di.collID !== targetCollID) {
        await moveRequest(di.id, targetCollID);
        return;
      }
      const coll = collections.find((c) => c.id === di.collID);
      if (!coll) return;
      const fromIdx = coll.requests.findIndex((r) => r.id === di.id);
      if (fromIdx === -1) return;
      let toIdx = coll.requests.findIndex((r) => r.id === targetID);
      if (toIdx === -1) return;
      if (dropTarget?.pos === "after") toIdx++;
      if (fromIdx < toIdx) toIdx--;
      if (toIdx < 0) toIdx = 0;
      if (toIdx === fromIdx) return;
      await reorderRequest(di.collID, di.id, toIdx);
    }
  }, [collections, dropTarget, reorderCollection, reorderRequest, moveRequest]);

  const dropLine = (id: string) => {
    if (!dropTarget || dropTarget.id !== id) return "";
    return dropTarget.pos === "before"
      ? "border-t-2 border-t-cyan"
      : "border-b-2 border-b-cyan";
  };

  return (
    <div className="flex flex-col" style={{ height: "100%" }}>
      <div className="shrink-0 flex flex-col gap-1">
        <div className="flex items-center gap-1 px-3">
          {creating ? (
            <div className="flex-1">
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={handleCreate}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setCreating(false); setNewName(""); } }}
                placeholder="Collection name…"
                className="w-full h-[28px] px-2 bg-surface border border-cyan rounded-md text-12 text-text outline-none ring-2 ring-cyan" />
            </div>
          ) : (
            <>
              <button type="button" onClick={() => setCreating(true)} data-shortcut="sidebar.newFolder"
                className="flex-1 h-[28px] px-2 flex items-center gap-2 text-12 text-subtext hover:text-cyan hover:bg-cardHover rounded-md border border-dashed border-border hover:border-cyan transition-colors">
                <Plus size={12} /><span>New collection</span>
              </button>
              <button type="button" onClick={() => { setSelecting((s) => !s); setSelected(new Set()); }}
                className={`h-[28px] px-2 flex items-center gap-1 text-11 rounded-md transition-colors ${selecting ? "bg-cyan/10 text-cyan" : "text-subtext hover:text-text hover:bg-cardHover border border-border"}`}
                title={selecting ? "Exit selection mode" : "Select requests"}>
                {selecting ? <CheckSquare size={11} /> : <Square size={11} />}
              </button>
            </>
          )}
        </div>

        {/* Batch action bar */}
        {selecting && selected.size > 0 && (
          <div className="mx-3 flex items-center gap-2 h-[28px]">
            <span className="text-11 text-subtext">{selected.size} selected</span>
            <button type="button" onClick={selectAll}
              className="text-11 text-cyan hover:underline">All</button>
            <button type="button" onClick={deselectAll}
              className="text-11 text-subtext hover:text-text hover:underline">None</button>
            <div className="flex-1" />
            <div className="relative">
              <button type="button" onClick={() => setMoveTargetOpen((o) => !o)}
                className="h-[24px] px-2 text-11 text-text hover:bg-cardHover rounded transition-colors border border-border">
                Move to…
              </button>
              {moveTargetOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMoveTargetOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-md shadow-lg py-1 min-w-[160px] max-h-[200px] overflow-y-auto">
                    {collections.map((c) => (
                      <button key={c.id} type="button" onClick={() => handleBatchMove(c.id)}
                        className="w-full px-3 py-1.5 text-left text-12 text-text hover:bg-cardHover truncate">
                        {c.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button type="button" onClick={handleBatchDelete}
              className="h-[24px] px-2 text-11 text-danger hover:bg-danger/10 rounded transition-colors border border-danger/30">
              Delete
            </button>
          </div>
        )}
      </div>

      {collections.length === 0 && !creating && (
        <div className="px-3 py-2 text-11 text-subtext italic shrink-0">No collections yet.</div>
      )}

      {filter && visible.length === 0 && collections.length > 0 && (
        <div className="px-3 py-2 text-11 text-subtext italic shrink-0">No matches.</div>
      )}

      {collections.length > 0 && visible.length > 0 && (
        <div ref={scrollRef} onScroll={handleScroll} className="overflow-y-auto flex-1 min-h-0" onDragEnd={handleDragEnd}>
          <div style={{ height: totalH, position: "relative" }}>
            <div style={{ height: topPad }} />
            {visibleRows.map((row) => {
              if (row.type === "coll") {
                const c = row.coll;
                return (
                  <div key={c.id} style={{ height: COLL_H }}
                    className={`group px-3 flex items-center gap-1 hover:bg-cardHover transition-colors ${dropLine(c.id)}`}
                    draggable={renamingID !== c.id}
                    data-drag-type="coll" data-drag-id={c.id}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}>
                    <button type="button" onClick={() => toggleExpanded(c.id)} data-shortcut={row.isOpen ? "sidebar.collapse" : "sidebar.expand"}
                      className="text-subtext hover:text-text transition-colors shrink-0" aria-label={row.isOpen ? "Collapse" : "Expand"}>
                      {row.isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    {renamingID === c.id ? (
                      <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleRename(c.id)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRename(c.id); if (e.key === "Escape") setRenamingID(null); }}
                        className="flex-1 h-[20px] px-1 bg-surface border border-cyan rounded-sm text-12 text-text outline-none" />
                    ) : (
                      <button type="button" onClick={() => toggleExpanded(c.id)} data-shortcut="sidebar.open"
                        className="flex-1 text-left text-12 font-semibold text-text truncate">{c.name}</button>
                    )}
                    {useGitStore.getState().locks[c.id] && (
                      <span title={`Locked by ${useGitStore.getState().locks[c.id].user}`} className="shrink-0 text-amber-400"><Lock size={10} /></span>
                    )}
                    {row.hasSpec && <span title={`Contract spec: ${c.spec}`} className="shrink-0 text-10 text-cyan/70 font-mono"><FileCode2 size={10} /></span>}
                    <span className="text-11 text-subtext font-mono shrink-0 mr-1">{c.requests.length}</span>
                    <CollectionMenu hasSpec={row.hasSpec} specPath={c.spec ?? ""}
                      onRename={() => { setRenameValue(c.name); setRenamingID(c.id); }}
                      onExport={() => {
                        downloadText(JSON.stringify({ schema: "flux/collection/v1", exportedAt: new Date().toISOString(), collection: c }, null, 2), `${safeFilename(c.name)}.flux.json`);
                        toast.success(`Exported "${c.name}"`);
                      }}
                      onExportOpenAPI={async () => { try { const s = await ExportOpenAPI(c.id); downloadText(s, `${safeFilename(c.name)}.openapi.json`); toast.success(`OpenAPI exported for "${c.name}"`); } catch (e) { toast.error(String(e)); } }}
                      onPreviewOpenAPI={async () => { try { await PreviewOpenAPI(c.id); toast.success(`API docs opened for "${c.name}"`); } catch (e) { toast.error(String(e)); } }}
                      onExportMarkdown={() => { setMdOpts({ includeHeaders: true, includeBody: true, includeExamples: true, baseUrl: "", timestamp: true }); setMdExportColl(c); }}
                      onExportHTML={() => { setHtmlOpts({ includeHeaders: true, includeBody: true, includeExamples: true, baseUrl: "", timestamp: true, darkMode: true }); setHtmlExportColl(c); }}
                      onLinkSpec={() => handleLinkSpec(c.id)}
                      onUnlinkSpec={() => handleUnlinkSpec(c.id, c.spec ?? "")}
                      onRun={row.requests.length > 0 ? () => openRunner(c.id) : undefined}
                      onVariables={() => { setVarsEditorDraft(c.variables ?? []); setVarsEditorColl(c); }}
                      onDelete={async () => { if (!confirm(`Delete "${c.name}"?`)) return; try { await deleteCollection(c.id); toast.success(`Deleted "${c.name}"`); } catch { toast.error(`Failed`); } }} />
                  </div>
                );
              }
              if (row.type === "req") {
                const req = row.req;
                return (
                  <div key={req.id} style={{ height: REQ_H }} data-shortcut="sidebar.open"
                    className={cn(
                      `group flex items-center gap-1 cursor-pointer transition-colors relative hover:bg-cardHover`,
                      dropLine(req.id),
                      loadedRequestID === req.id && "bg-card",
                      selecting ? "pl-2" : "pl-6",
                    )}
                    onClick={() => {
                      if (selecting) { toggleSelect(req.id); return; }
                      if (renamingReqID === req.id) return;
                      loadRequest(req);
                    }}
                    draggable={!selecting && renamingReqID !== req.id}
                    data-drag-type="req" data-drag-id={req.id} data-drag-coll-id={row.collID}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}>
                    {!selecting && loadedRequestID === req.id && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-cyan" />}
                    {selecting ? (
                      <button type="button" onClick={(e) => { e.stopPropagation(); toggleSelect(req.id); }}
                        className="shrink-0 text-subtext hover:text-text p-0.5">
                        {selected.has(req.id) ? <CheckSquare size={13} className="text-cyan" /> : <Square size={13} />}
                      </button>
                    ) : null}
                    <MethodBadge method={row.method} />
                    {renamingReqID === req.id ? (
                      <input ref={renameReqRef} autoFocus value={renameReqValue} onChange={(e) => setRenameReqValue(e.target.value)}
                        onBlur={() => handleRenameReq(req.id)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRenameReq(req.id); if (e.key === "Escape") setRenamingReqID(null); e.stopPropagation(); }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 h-[20px] px-1 bg-surface border border-cyan rounded-sm text-12 text-text outline-none" />
                    ) : (
                      <span className="flex-1 text-12 text-text truncate">{req.name}</span>
                    )}
                    {req.savedResponse && <span title="Saved for mock replay" className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />}
                    <button type="button" data-shortcut="sidebar.rename" onClick={(e) => { e.stopPropagation(); setRenameReqValue(req.name); setRenamingReqID(req.id); }}
                      className="opacity-0 group-hover:opacity-100 text-subtext hover:text-text transition-all shrink-0" title="Rename"><Pencil size={12} /></button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); duplicateRequest(req.id).catch(() => undefined); }}
                      className="opacity-0 group-hover:opacity-100 text-subtext hover:text-text transition-all shrink-0" title="Duplicate"><Copy size={12} /></button>
                    <button type="button" data-shortcut="sidebar.delete" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${req.name}"?`)) deleteRequest(req.id); }}
                      className="opacity-0 group-hover:opacity-100 text-subtext hover:text-danger transition-all shrink-0" title="Delete"><Trash2 size={12} /></button>
                  </div>
                );
              }
              return <div key="empty" style={{ height: EMPTY_H }} className="pl-7 pr-3 py-1 text-11 text-subtext italic">Empty</div>;
            })}
            <div style={{ height: Math.max(0, bottomPad) }} />
          </div>
        </div>
      )}

      <button type="button" data-shortcut="sidebar.moveUp" onClick={() => { (document.querySelector<HTMLElement>('[data-shortcut="sidebar.search"]'))?.focus(); }} style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
      <button type="button" data-shortcut="sidebar.moveDown" onClick={() => { (document.querySelector<HTMLElement>('[data-shortcut="sidebar.open"]'))?.click(); }} style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
      <button type="button" data-shortcut="sidebar.newRequest" onClick={() => newTab()} style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />

      {/* Markdown export options modal */}
      {mdExportColl && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setMdExportColl(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-card border border-border rounded-lg shadow-xl p-4 w-[320px] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-13 font-semibold text-text mb-3">Export Markdown — {mdExportColl.name}</h3>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-12 text-text cursor-pointer">
                  <input type="checkbox" checked={mdOpts.includeHeaders} onChange={(e) => setMdOpts({ ...mdOpts, includeHeaders: e.target.checked })} className="accent-cyan" />
                  Include Headers
                </label>
                <label className="flex items-center gap-2 text-12 text-text cursor-pointer">
                  <input type="checkbox" checked={mdOpts.includeBody} onChange={(e) => setMdOpts({ ...mdOpts, includeBody: e.target.checked })} className="accent-cyan" />
                  Include Body
                </label>
                <label className="flex items-center gap-2 text-12 text-text cursor-pointer">
                  <input type="checkbox" checked={mdOpts.includeExamples} onChange={(e) => setMdOpts({ ...mdOpts, includeExamples: e.target.checked })} className="accent-cyan" />
                  Include Examples
                </label>
                <label className="flex items-center gap-2 text-12 text-text cursor-pointer">
                  <input type="checkbox" checked={mdOpts.timestamp} onChange={(e) => setMdOpts({ ...mdOpts, timestamp: e.target.checked })} className="accent-cyan" />
                  Timestamp
                </label>
                <input type="text" value={mdOpts.baseUrl} onChange={(e) => setMdOpts({ ...mdOpts, baseUrl: e.target.value })}
                  placeholder="Base URL (optional)"
                  className="w-full h-[28px] px-2 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-cyan" />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setMdExportColl(null)}
                  className="h-[28px] px-3 text-12 text-subtext hover:text-text bg-cardHover rounded-md transition-colors">Cancel</button>
                <button type="button" onClick={() => handleExportMarkdown(mdExportColl)}
                  className="h-[28px] px-3 text-12 text-white bg-cyan rounded-md hover:bg-cyan/80 transition-colors">Export</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* HTML export options modal */}
      {htmlExportColl && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setHtmlExportColl(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-card border border-border rounded-lg shadow-xl p-4 w-[320px] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-13 font-semibold text-text mb-3">Export HTML Docs — {htmlExportColl.name}</h3>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-12 text-text cursor-pointer">
                  <input type="checkbox" checked={htmlOpts.includeHeaders} onChange={(e) => setHtmlOpts({ ...htmlOpts, includeHeaders: e.target.checked })} className="accent-cyan" />
                  Include Headers
                </label>
                <label className="flex items-center gap-2 text-12 text-text cursor-pointer">
                  <input type="checkbox" checked={htmlOpts.includeBody} onChange={(e) => setHtmlOpts({ ...htmlOpts, includeBody: e.target.checked })} className="accent-cyan" />
                  Include Body
                </label>
                <label className="flex items-center gap-2 text-12 text-text cursor-pointer">
                  <input type="checkbox" checked={htmlOpts.includeExamples} onChange={(e) => setHtmlOpts({ ...htmlOpts, includeExamples: e.target.checked })} className="accent-cyan" />
                  Include Examples
                </label>
                <label className="flex items-center gap-2 text-12 text-text cursor-pointer">
                  <input type="checkbox" checked={htmlOpts.timestamp} onChange={(e) => setHtmlOpts({ ...htmlOpts, timestamp: e.target.checked })} className="accent-cyan" />
                  Timestamp
                </label>
                <label className="flex items-center gap-2 text-12 text-text cursor-pointer">
                  <input type="checkbox" checked={htmlOpts.darkMode} onChange={(e) => setHtmlOpts({ ...htmlOpts, darkMode: e.target.checked })} className="accent-cyan" />
                  Dark mode
                </label>
                <input type="text" value={htmlOpts.baseUrl} onChange={(e) => setHtmlOpts({ ...htmlOpts, baseUrl: e.target.value })}
                  placeholder="Base URL (optional)"
                  className="w-full h-[28px] px-2 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-cyan" />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setHtmlExportColl(null)}
                  className="h-[28px] px-3 text-12 text-subtext hover:text-text bg-cardHover rounded-md transition-colors">Cancel</button>
                <button type="button" onClick={() => handleExportHTML(htmlExportColl)}
                  className="h-[28px] px-3 text-12 text-white bg-cyan rounded-md hover:bg-cyan/80 transition-colors">Export</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Collection variables editor modal */}
      {varsEditorColl && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setVarsEditorColl(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-card border border-border rounded-lg shadow-xl p-4 w-[420px] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-13 font-semibold text-text mb-3">Variables — {varsEditorColl.name}</h3>
              <p className="text-11 text-subtext mb-3">Collection-scoped variables override environment variables of the same name.</p>
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                {varsEditorDraft.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="checkbox" checked={v.enabled} onChange={(e) => {
                      const next = [...varsEditorDraft];
                      next[i] = { ...next[i], enabled: e.target.checked };
                      setVarsEditorDraft(next);
                    }} className="accent-cyan w-[14px] h-[14px]" />
                    <input type="text" value={v.key} onChange={(e) => {
                      const next = [...varsEditorDraft];
                      next[i] = { ...next[i], key: e.target.value };
                      setVarsEditorDraft(next);
                    }} placeholder="Key" className="flex-1 h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan font-mono" />
                    <input type="text" value={v.value} onChange={(e) => {
                      const next = [...varsEditorDraft];
                      next[i] = { ...next[i], value: e.target.value };
                      setVarsEditorDraft(next);
                    }} placeholder="Value" className="flex-1 h-[28px] px-2 bg-surface border border-border rounded text-12 text-text outline-none focus:border-cyan font-mono" />
                    <button type="button" onClick={() => setVarsEditorDraft(varsEditorDraft.filter((_, j) => j !== i))}
                      className="text-subtext hover:text-danger transition-colors p-1 shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setVarsEditorDraft([...varsEditorDraft, { key: "", value: "", enabled: true } as models.EnvVar])}
                className="flex items-center gap-1 mt-2 text-12 text-cyan hover:text-cyan-hover transition-colors">
                <Plus size={12} /> Add variable
              </button>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setVarsEditorColl(null)}
                  className="h-[28px] px-3 text-12 text-subtext hover:text-text bg-cardHover rounded-md transition-colors">Cancel</button>
                <button type="button" onClick={async () => {
                  if (varsEditorColl) {
                    await updateCollectionVariables(varsEditorColl.id, varsEditorDraft);
                    setVarsEditorColl(null);
                    toast.success("Collection variables saved");
                  }
                }}
                  className="h-[28px] px-3 text-12 text-white bg-cyan rounded-md hover:bg-cyan/80 transition-colors">Save</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function search(offsets: number[], t: number): number {
  let lo = 0, hi = offsets.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (offsets[m] <= t) lo = m + 1; else hi = m; }
  return lo;
}


