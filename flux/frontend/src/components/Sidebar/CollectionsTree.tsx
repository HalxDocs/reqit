import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Download, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useCollectionStore } from "../../stores/useCollectionStore";
import { useUIStore } from "../../stores/useUIStore";
import { useTabsStore } from "../../stores/useTabsStore";
import { decodePayload } from "../../lib/loadPayload";
import { MethodBadge } from "../shared/MethodBadge";
import { cn } from "../../lib/cn";
import { downloadText, safeFilename } from "../../lib/download";
import { toast } from "../../stores/useToastStore";
import type { models } from "../../../wailsjs/go/models";
import type { HttpMethod } from "../../types/request";

export function CollectionsTree() {
  const collections = useCollectionStore((s) => s.collections);
  const expanded = useCollectionStore((s) => s.expanded);
  const toggleExpanded = useCollectionStore((s) => s.toggleExpanded);
  const createCollection = useCollectionStore((s) => s.createCollection);
  const renameCollection = useCollectionStore((s) => s.renameCollection);
  const deleteCollection = useCollectionStore((s) => s.deleteCollection);
  const deleteRequest = useCollectionStore((s) => s.deleteRequest);
  const renameRequest = useCollectionStore((s) => s.renameRequest);
  const duplicateRequest = useCollectionStore((s) => s.duplicateRequest);
  const newTab = useTabsStore((s) => s.newTab);
  const setLoadedRequestID = useUIStore((s) => s.setLoadedRequestID);
  const loadedRequestID = useUIStore((s) => s.loadedRequestID);
  const filter = useUIStore((s) => s.sidebarFilter);

  const [renamingID, setRenamingID] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renamingReqID, setRenamingReqID] = useState<string | null>(null);
  const [renameReqValue, setRenameReqValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const renameReqRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return collections.map((c) => ({ coll: c, requests: c.requests }));
    return collections
      .map((c) => {
        const collMatches = c.name.toLowerCase().includes(q);
        const matchedReqs = collMatches
          ? c.requests
          : c.requests.filter((r) => r.name.toLowerCase().includes(q));
        return { coll: c, requests: matchedReqs, collMatches };
      })
      .filter((x) => x.collMatches || x.requests.length > 0);
  }, [collections, filter]);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setCreating(false);
      return;
    }
    await createCollection(trimmed);
    setNewName("");
    setCreating(false);
  };

  const handleRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) await renameCollection(id, trimmed);
    setRenamingID(null);
  };

  const handleRenameReq = async (id: string) => {
    const trimmed = renameReqValue.trim();
    if (trimmed) await renameRequest(id, trimmed);
    setRenamingReqID(null);
  };

  const loadRequest = (req: models.SavedRequest) => {
    newTab({
      title: req.name,
      savedRequestID: req.id,
      request: decodePayload(req.payload),
      response: null,
      dirty: false,
    });
    setLoadedRequestID(req.id);
  };

  return (
    <div className="flex flex-col">
      {creating ? (
        <div className="px-3 pb-1">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleCreate}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setCreating(false);
                setNewName("");
              }
            }}
            placeholder="Collection name…"
            className="w-full h-[28px] px-2 bg-surface border border-blue rounded-md text-12 text-text outline-none ring-2 ring-blue"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mx-3 mb-1 h-[28px] px-2 flex items-center gap-2 text-12 text-subtext hover:text-blue hover:bg-cardHover rounded-md border border-dashed border-border hover:border-blue transition-colors"
        >
          <Plus size={12} />
          <span>New collection</span>
        </button>
      )}

      {collections.length === 0 && !creating && (
        <div className="px-3 py-2 text-11 text-subtext italic">
          No collections yet.
        </div>
      )}

      {filter && visible.length === 0 && collections.length > 0 && (
        <div className="px-3 py-2 text-11 text-subtext italic">No matches.</div>
      )}

      {visible.map(({ coll: c, requests }) => {
        const isOpen = expanded[c.id] !== false || !!filter;
        return (
          <div key={c.id} className="flex flex-col">
            <div className="group px-3 py-1.5 flex items-center gap-1 hover:bg-cardHover transition-colors">
              <button
                type="button"
                onClick={() => toggleExpanded(c.id)}
                className="text-subtext hover:text-text transition-colors"
                aria-label={isOpen ? "Collapse" : "Expand"}
              >
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              {renamingID === c.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRename(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(c.id);
                    if (e.key === "Escape") setRenamingID(null);
                  }}
                  className="flex-1 h-[20px] px-1 bg-surface border border-blue rounded-sm text-12 text-text outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => toggleExpanded(c.id)}
                  className="flex-1 text-left text-12 font-semibold text-text truncate"
                >
                  {c.name}
                </button>
              )}
              <span className="text-11 text-subtext font-mono mr-1">
                {c.requests.length}
              </span>
              <CollectionMenu
                onRename={() => {
                  setRenameValue(c.name);
                  setRenamingID(c.id);
                }}
                onExport={() => {
                  const payload = JSON.stringify(
                    {
                      schema: "flux/collection/v1",
                      exportedAt: new Date().toISOString(),
                      collection: c,
                    },
                    null,
                    2,
                  );
                  downloadText(payload, `${safeFilename(c.name)}.flux.json`);
                  toast.success(`Exported "${c.name}"`);
                }}
                onDelete={() => {
                  if (confirm(`Delete collection "${c.name}" and all its requests?`)) {
                    deleteCollection(c.id).then(() => toast.success(`Deleted "${c.name}"`));
                  }
                }}
              />
            </div>

            {isOpen && requests.length === 0 && (
              <div className="pl-7 pr-3 py-1 text-11 text-subtext italic">Empty</div>
            )}

            {isOpen &&
              requests.map((req) => (
                <div
                  key={req.id}
                  className={cn(
                    "group pl-6 pr-3 py-1.5 flex items-center gap-2 cursor-pointer transition-colors relative",
                    "hover:bg-cardHover",
                    loadedRequestID === req.id && "bg-card",
                  )}
                  onClick={() => renamingReqID === req.id ? undefined : loadRequest(req)}
                >
                  {loadedRequestID === req.id && (
                    <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-blue" />
                  )}
                  <MethodBadge method={(req.payload.method as HttpMethod) || "GET"} />
                  {renamingReqID === req.id ? (
                    <input
                      ref={renameReqRef}
                      autoFocus
                      value={renameReqValue}
                      onChange={(e) => setRenameReqValue(e.target.value)}
                      onBlur={() => handleRenameReq(req.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameReq(req.id);
                        if (e.key === "Escape") setRenamingReqID(null);
                        e.stopPropagation();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 h-[20px] px-1 bg-surface border border-blue rounded-sm text-12 text-text outline-none"
                    />
                  ) : (
                    <span className="flex-1 text-12 text-text truncate">{req.name}</span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenameReqValue(req.name);
                      setRenamingReqID(req.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-subtext hover:text-text transition-all"
                    aria-label="Rename request"
                    title="Rename"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateRequest(req.id).catch(() => undefined);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-subtext hover:text-text transition-all"
                    aria-label="Duplicate request"
                    title="Duplicate"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete request "${req.name}"?`)) {
                        deleteRequest(req.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 text-subtext hover:text-danger transition-all"
                    aria-label="Delete request"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}

function CollectionMenu({
  onRename,
  onExport,
  onDelete,
}: {
  onRename: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="opacity-0 group-hover:opacity-100 text-subtext hover:text-text transition-all p-1 rounded-sm"
        aria-label="Collection actions"
      >
        <MoreVertical size={12} />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-md shadow-lg py-1 min-w-[140px]">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onRename();
              }}
              className="w-full px-3 py-1.5 text-left text-12 text-text hover:bg-cardHover"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onExport();
              }}
              className="w-full px-3 py-1.5 text-left text-12 text-text hover:bg-cardHover flex items-center gap-2"
            >
              <Download size={12} />
              <span>Export as JSON</span>
            </button>
            <div className="border-t border-border my-1" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="w-full px-3 py-1.5 text-left text-12 text-danger hover:bg-cardHover"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
