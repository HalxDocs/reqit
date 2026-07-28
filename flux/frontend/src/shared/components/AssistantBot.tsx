import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Sparkles, ExternalLink, MessageSquare } from "lucide-react";
import { allFeatures, type NavTarget } from "@/app/data/releaseNotes";

interface Message {
  role: "user" | "assistant";
  text: string;
  navTarget?: NavTarget;
  navLabel?: string;
}

const KB: { keywords: string[]; answer: string; nav?: NavTarget; navLabel?: string }[] = [];

for (const group of allFeatures) {
  for (const item of group.items) {
    const keywords = item.label.toLowerCase().split(/[\s,()]+/).filter(Boolean);
    KB.push({
      keywords,
      answer: item.label,
      nav: item.nav,
      navLabel: group.category,
    });
  }
}

KB.push(
  { keywords: ["hello", "hi", "hey", "help"], answer: "Hi! I'm reqit's assistant. Ask me about any feature — for example: 'How do I test WebSockets?', 'Does reqit support GraphQL?', or 'How do I import from Postman?'" },
  { keywords: ["what", "can", "do", "features", "all"], answer: `reqit has ${allFeatures.reduce((s, g) => s + g.items.length, 0)} features across ${allFeatures.length} categories: ${allFeatures.map(g => g.category).join(", ")}. Ask about any one!` },
  { keywords: ["thanks", "thank", "thx"], answer: "You're welcome! Ask me anything about reqit anytime." },
);

function findAnswer(query: string): { answer: string; nav?: NavTarget; navLabel?: string } | null {
  const q = query.toLowerCase();
  const qWords = q.split(/\s+/).filter(w => w.length > 2);
  let best: { key: string; answer: string; nav?: NavTarget; navLabel?: string; score: number } | null = null;

  for (const entry of KB) {
    const matchCount = entry.keywords.filter(kw => qWords.some(qw => kw.includes(qw) || qw.includes(kw))).length;
    if (matchCount === 0) continue;
    const score = matchCount / Math.max(entry.keywords.length, qWords.length);
    if (!best || score > best.score) {
      best = { key: entry.keywords[0], answer: entry.answer, nav: entry.nav, navLabel: entry.navLabel, score };
    }
  }

  return best && best.score > 0.1 ? { answer: best.answer, nav: best.nav, navLabel: best.navLabel } : null;
}

const GREETINGS = ["hi", "hello", "hey", "help", "what can you do"];

export function AssistantBot({ onNavigate }: { onNavigate: (target: NavTarget) => void }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hi! I'm the reqit assistant. Ask me about any feature — GraphQL, WebSocket, import/export, testing, and more!" },
  ]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const handleSend = () => {
    const q = input.trim();
    if (!q) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);

    const result = findAnswer(q);
    if (result && result.answer) {
      const msg: Message = { role: "assistant", text: result.answer };
      if (result.nav && result.navLabel) {
        msg.navTarget = result.nav;
        msg.navLabel = result.navLabel;
      }
      setTimeout(() => setMessages((prev) => [...prev, msg]), 300);
    } else {
      setTimeout(() => setMessages((prev) => [...prev, {
        role: "assistant",
        text: "I'm not sure about that one. Try asking about a specific feature like 'GraphQL', 'WebSocket', 'import', 'export', 'testing', 'mock server', etc.",
      }]), 300);
    }
  };

  const goTo = (target: NavTarget) => {
    onNavigate(target);
    setOpen(false);
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 w-[48px] h-[48px] rounded-full bg-cyan hover:bg-cyan-hover text-white shadow-lg shadow-cyan/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        title="Ask reqit assistant"
      >
        {open ? <X size={20} /> : <Bot size={20} />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-[72px] right-5 z-50 w-[360px] max-w-[calc(100vw-40px)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col animate-[fade-in_0.15s_ease-out]">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0">
            <div className="w-[30px] h-[30px] rounded-full bg-cyan/10 flex items-center justify-center">
              <Bot size={15} className="text-cyan" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-12 font-semibold text-text">reqit Assistant</div>
              <div className="text-10 text-subtext">Built-in feature guide</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-[26px] h-[26px] flex items-center justify-center rounded-full text-subtext hover:text-text hover:bg-surface transition-colors"
            >
              <X size={12} />
            </button>
          </div>

          {/* Messages */}
          <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 max-h-[360px]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-12 leading-relaxed ${
                    msg.role === "user"
                      ? "bg-cyan/10 text-text rounded-tr-sm"
                      : "bg-surface text-text rounded-tl-sm"
                  }`}
                >
                  {msg.text}
                  {msg.navTarget && msg.navLabel && (
                    <button
                      type="button"
                      onClick={() => goTo(msg.navTarget!)}
                      className="flex items-center gap-1.5 mt-1.5 text-11 text-cyan hover:text-cyan-hover transition-colors font-medium"
                    >
                      <ExternalLink size={11} />
                      Open in {msg.navLabel}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-border shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                placeholder="Ask about reqit features..."
                className="flex-1 h-[34px] px-3 bg-surface border border-border rounded-lg text-12 text-text outline-none focus:border-cyan transition-colors placeholder:text-subtext/40"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim()}
                className="h-[34px] w-[34px] flex items-center justify-center bg-cyan text-white rounded-lg hover:bg-cyan-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
