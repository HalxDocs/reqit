import type { main, models } from "../../../../wailsjs/go/models";

interface HTMLExportModalProps {
  open: boolean;
  onClose: () => void;
  collection: models.Collection;
  opts: main.ExportHTMLDocsOpts;
  setOpts: (opts: main.ExportHTMLDocsOpts) => void;
  onExport: (c: models.Collection) => void;
}

export function HTMLExportModal({ open, onClose, collection, opts, setOpts, onExport }: HTMLExportModalProps) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="bg-card border border-border rounded-lg shadow-xl p-4 w-[320px] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-13 font-semibold text-text mb-3">Export HTML Docs — {collection.name}</h3>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-12 text-text cursor-pointer">
              <input type="checkbox" checked={opts.includeHeaders} onChange={(e) => setOpts({ ...opts, includeHeaders: e.target.checked })} className="accent-cyan" />
              Include Headers
            </label>
            <label className="flex items-center gap-2 text-12 text-text cursor-pointer">
              <input type="checkbox" checked={opts.includeBody} onChange={(e) => setOpts({ ...opts, includeBody: e.target.checked })} className="accent-cyan" />
              Include Body
            </label>
            <label className="flex items-center gap-2 text-12 text-text cursor-pointer">
              <input type="checkbox" checked={opts.includeExamples} onChange={(e) => setOpts({ ...opts, includeExamples: e.target.checked })} className="accent-cyan" />
              Include Examples
            </label>
            <label className="flex items-center gap-2 text-12 text-text cursor-pointer">
              <input type="checkbox" checked={opts.timestamp} onChange={(e) => setOpts({ ...opts, timestamp: e.target.checked })} className="accent-cyan" />
              Timestamp
            </label>
            <label className="flex items-center gap-2 text-12 text-text cursor-pointer">
              <input type="checkbox" checked={opts.darkMode} onChange={(e) => setOpts({ ...opts, darkMode: e.target.checked })} className="accent-cyan" />
              Dark mode
            </label>
            <input type="text" value={opts.baseUrl} onChange={(e) => setOpts({ ...opts, baseUrl: e.target.value })}
              placeholder="Base URL (optional)"
              className="w-full h-[28px] px-2 bg-surface border border-border rounded-md text-12 text-text outline-none focus:border-cyan" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose}
              className="h-[28px] px-3 text-12 text-subtext hover:text-text bg-cardHover rounded-md transition-colors">Cancel</button>
            <button type="button" onClick={() => onExport(collection)}
              className="h-[28px] px-3 text-12 text-white bg-cyan rounded-md hover:bg-cyan/80 transition-colors">Export</button>
          </div>
        </div>
      </div>
    </>
  );
}
