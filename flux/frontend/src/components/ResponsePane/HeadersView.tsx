export function HeadersView({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers).sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    return <div className="p-5 text-12 text-subtext">No response headers.</div>;
  }

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-[1fr_2fr] gap-3 px-4 py-2 text-11 text-subtext font-semibold uppercase tracking-wider border-b border-border">
        <span>Name</span>
        <span>Value</span>
      </div>
      {entries.map(([name, value]) => (
        <div
          key={name}
          className="grid grid-cols-[1fr_2fr] gap-3 px-4 py-2 border-b border-border/50 hover:bg-card/50 transition-colors"
        >
          <span className="font-mono text-11 text-subtext break-all">{name}</span>
          <span className="font-mono text-11 text-text break-all">{value}</span>
        </div>
      ))}
    </div>
  );
}
