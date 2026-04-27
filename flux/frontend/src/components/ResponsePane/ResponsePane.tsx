export function ResponsePane() {
  return (
    <section className="flex-1 h-full bg-bg flex flex-col">
      <div className="h-[48px] px-4 flex items-center border-b border-border">
        <span className="text-13 text-subtext">Response</span>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <div className="text-subtext text-12">Send a request to see the response.</div>
      </div>
    </section>
  );
}
