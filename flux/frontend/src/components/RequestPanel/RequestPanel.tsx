export function RequestPanel() {
  return (
    <section className="w-[420px] shrink-0 h-full bg-bg border-r border-border flex flex-col">
      <div className="h-[48px] px-4 flex items-center border-b border-border">
        <span className="text-13 text-subtext">Request</span>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <div className="text-subtext text-12">Request builder will appear here.</div>
      </div>
    </section>
  );
}
