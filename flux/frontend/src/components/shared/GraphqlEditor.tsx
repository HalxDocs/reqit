interface Props {
  value: string;
  onChange: (val: string) => void;
}

export function GraphqlEditor({ value, onChange }: Props) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`query {\n  users {\n    id\n    name\n    email\n  }\n}`}
      spellCheck={false}
      className="w-full h-full resize-none bg-transparent text-12 text-text font-mono p-3 outline-none placeholder:text-subtext/30"
    />
  );
}
