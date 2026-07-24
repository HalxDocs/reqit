import { useState, useEffect } from "react";
import { Modal } from "@/shared/components/Modal";
import { GetVersion } from "../../../wailsjs/go/main/App";
import { releaseHistory, allFeatures } from "@/app/data/releaseNotes";
import { Sparkles, List, ChevronDown, ChevronRight } from "lucide-react";

type Tab = "whatsnew" | "features";

export function WhatsNewModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("whatsnew");
  const [currentVersion, setCurrentVersion] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      GetVersion().then(setCurrentVersion).catch(() => {});
    }
  }, [open]);

  const currentNote = releaseHistory.find(
    (r) => r.version === currentVersion || (currentVersion && r.version.startsWith("Sprint")),
  );

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Modal open={open} onClose={onClose} title="">
      <div className="w-[680px] max-w-full">
        <div className="flex gap-0 border-b border-border mb-4">
          <button
            type="button"
            onClick={() => setTab("whatsnew")}
            className={`flex items-center gap-2 px-4 py-2 text-13 border-b-2 transition-colors ${
              tab === "whatsnew"
                ? "border-cyan text-cyan font-semibold"
                : "border-transparent text-subtext hover:text-text"
            }`}
          >
            <Sparkles size={14} />
            What's New
          </button>
          <button
            type="button"
            onClick={() => setTab("features")}
            className={`flex items-center gap-2 px-4 py-2 text-13 border-b-2 transition-colors ${
              tab === "features"
                ? "border-cyan text-cyan font-semibold"
                : "border-transparent text-subtext hover:text-text"
            }`}
          >
            <List size={14} />
            All Features
          </button>
        </div>

        {tab === "whatsnew" ? (
          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
            {currentNote && (
              <div className="bg-cyan/5 border border-cyan/15 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-14 font-bold text-text">{currentNote.title}</h3>
                  <span className="text-11 text-subtext bg-surface px-2 py-0.5 rounded border border-border">
                    {currentNote.version} — {currentNote.date}
                  </span>
                </div>
                {currentNote.highlights.map((h, i) => (
                  <div key={i} className="mb-2 last:mb-0">
                    {h.category && (
                      <h4 className="text-11 font-semibold text-cyan uppercase tracking-wider mb-1">{h.category}</h4>
                    )}
                    <ul className="space-y-1">
                      {h.items.map((item, j) => (
                        <li key={j} className="text-13 text-text flex items-start gap-2">
                          <span className="text-cyan shrink-0 mt-0.5">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            <h4 className="text-12 font-semibold text-subtext uppercase tracking-wider">Previous Releases</h4>
            {releaseHistory
              .filter((r) => r !== currentNote)
              .map((note) => {
                const key = note.version;
                const isExpanded = expanded[key] ?? false;
                return (
                  <div key={key} className="border border-border rounded-lg">
                    <button
                      type="button"
                      onClick={() => toggleExpand(key)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-cardHover transition-colors rounded-lg"
                    >
                      <div>
                        <span className="text-13 font-semibold text-text">{note.title}</span>
                        <span className="ml-2 text-11 text-subtext">{note.version} — {note.date}</span>
                      </div>
                      {isExpanded ? <ChevronDown size={14} className="text-subtext" /> : <ChevronRight size={14} className="text-subtext" />}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-2">
                        {note.highlights.map((h, i) => (
                          <div key={i}>
                            {h.category && (
                              <h5 className="text-11 font-semibold text-cyan uppercase tracking-wider mb-1">{h.category}</h5>
                            )}
                            <ul className="space-y-1">
                              {h.items.map((item, j) => (
                                <li key={j} className="text-13 text-text flex items-start gap-2">
                                  <span className="text-subtext shrink-0 mt-0.5">•</span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
            {allFeatures.map((group) => (
              <div key={group.category}>
                <h3 className="text-12 font-semibold text-cyan uppercase tracking-wider mb-2 border-b border-border pb-1">
                  {group.category}
                </h3>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {group.items.map((item, i) => (
                    <li key={i} className="text-13 text-text flex items-start gap-2">
                      <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
