import { HugeiconsIcon } from "@hugeicons/react";
import { Book01Icon } from "@hugeicons/core-free-icons";
import { openExternal } from "@/shared/lib/links";
import { DOC_SECTIONS } from "@/app/screens/home/homeContent";

export function DocsView() {
  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-12">
      {/* Page header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Book01Icon} size={18} color="#3B82F6" strokeWidth={1.5} />
          <h1
            className="text-26 sm:text-30 font-bold text-text tracking-tight"
            style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
          >
            Documentation
          </h1>
        </div>
        <p className="text-13 text-subtext max-w-[480px] leading-relaxed">
          Every feature in reqit — what it does, how it works, and why it's there.
        </p>
      </div>

      {/* Quick-nav pills */}
      <div className="flex flex-wrap gap-2">
        {DOC_SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="inline-flex items-center gap-1.5 h-[26px] px-2.5 text-11 font-semibold rounded-full border border-border bg-card hover:border-cyan/40 hover:text-text text-subtext transition-all"
            style={{ scrollBehavior: "smooth" }}
          >
            <HugeiconsIcon icon={s.icon} size={11} color={s.color} strokeWidth={1.5} />
            {s.title}
          </a>
        ))}
      </div>

      {/* Sections */}
      {DOC_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="flex flex-col gap-5">
          {/* Section heading */}
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <div
              className="w-[34px] h-[34px] rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: section.color + "18" }}
            >
              <HugeiconsIcon icon={section.icon} size={16} color={section.color} strokeWidth={1.5} />
            </div>
            <div>
              <div
                className="text-15 font-bold text-text leading-tight"
                style={{ fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif' }}
              >
                {section.title}
              </div>
              <div className="text-11 text-subtext mt-0.5">{section.subtitle}</div>
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {section.features.map((f) => (
              <div
                key={f.name}
                className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1.5 hover:border-cyan/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-[6px] h-[6px] rounded-full shrink-0"
                    style={{ backgroundColor: section.color }}
                  />
                  <span className="text-12 font-semibold text-text">{f.name}</span>
                </div>
                <p className="text-11 text-subtext leading-relaxed pl-[14px]">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Footer */}
      <footer className="flex flex-col items-center gap-2 pt-4 pb-4 border-t border-border">
        <p className="text-11 text-subtext text-center">
          Missing something?{" "}
          <button
            type="button"
            onClick={() => openExternal("https://github.com/HalxDocs/reqit/issues")}
            className="text-cyan hover:underline"
          >
            Open an issue on GitHub
          </button>
        </p>
      </footer>
    </div>
  );
}


