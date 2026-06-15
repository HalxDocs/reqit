import { useState } from "react";
import { Download, Eye, FileCode2, MoreVertical, Unlink } from "lucide-react";
import { Button } from "@/shared/components/Button";

interface CollectionMenuProps {
  hasSpec: boolean;
  specPath: string;
  onRename: () => void;
  onExport: () => void;
  onExportOpenAPI?: () => void;
  onPreviewOpenAPI?: () => void;
  onExportMarkdown?: () => void;
  onLinkSpec: () => void;
  onUnlinkSpec: () => void;
  onDelete: () => void;
  onRun?: () => void;
}

export function CollectionMenu({
  hasSpec, specPath, onRename, onExport, onExportOpenAPI,
  onPreviewOpenAPI, onExportMarkdown, onLinkSpec, onUnlinkSpec,
  onDelete, onRun,
}: CollectionMenuProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="opacity-0 group-hover:opacity-100 text-subtext hover:text-text transition-all p-1 rounded-sm" aria-label="Actions">
        <MoreVertical size={12} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-md shadow-lg py-1 min-w-[170px]">
            <Button variant="menu-item" onClick={() => { close(); onRename(); }}>Rename</Button>
            <Button variant="menu-item" onClick={() => { close(); onExport(); }}><Download size={12} />Export as JSON</Button>
            {onExportOpenAPI && <Button variant="menu-item" onClick={() => { close(); onExportOpenAPI(); }}><FileCode2 size={12} />Export OpenAPI</Button>}
            {onPreviewOpenAPI && <Button variant="menu-item" onClick={() => { close(); onPreviewOpenAPI(); }}><Eye size={12} />Preview API Docs</Button>}
            {onExportMarkdown && <Button variant="menu-item" onClick={() => { close(); onExportMarkdown(); }}><Download size={12} />Export Markdown</Button>}
            {onRun && <Button variant="menu-item" onClick={() => { close(); onRun(); }}>Run</Button>}
            <div className="border-t border-border my-1" />
            {hasSpec ? (
              <>
                <div className="px-3 py-1 text-10 text-subtext/60 font-mono truncate max-w-[170px]" title={specPath}>{specPath}</div>
                <Button variant="menu-item" onClick={() => { close(); onLinkSpec(); }}><FileCode2 size={12} className="text-cyan" />Change Spec</Button>
                <Button variant="menu-item" onClick={() => { close(); onUnlinkSpec(); }}><Unlink size={12} />Unlink Spec</Button>
              </>
            ) : (
              <Button variant="menu-item" onClick={() => { close(); onLinkSpec(); }}><FileCode2 size={12} className="text-cyan" />Link OpenAPI Spec</Button>
            )}
            <div className="border-t border-border my-1" />
            <Button variant="menu-item-danger" onClick={() => { close(); onDelete(); }}>Delete</Button>
          </div>
        </>
      )}
    </div>
  );
}
