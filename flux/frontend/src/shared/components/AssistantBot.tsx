import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, X, Send, Sparkles, ExternalLink, MessageSquare, GripHorizontal } from "lucide-react";
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

  // Dragging state
  const dragRef = useRef<{ startX: number; startY: number; left: number; top: number; dragging: boolean }>({
    startX: 0, startY: 0, left: -1, top: -1, dragging: false,
  });
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const currentLeft = pos?.left ?? window.innerWidth - 72;
    const currentTop = pos?.top ?? window.innerHeight - 72;
    dragRef.current = { startX: clientX, startY: clientY, left: currentLeft, top: currentTop, dragging: true };
  }, [pos]);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current.dragging) return;
      e.preventDefault();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      setPos({ left: dragRef.current.left + clientX - dragRef.current.startX, top: dragRef.current.top + clientY - dragRef.current.startY });
    };
    const handleUp = () => {
      dragRef.current.dragging = false;
    };
    window.addEventListener("mousemove", handleMove, { passive: false });
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, []);

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

  const left = pos?.left ?? window.innerWidth - 72;
  const top = pos?.top ?? window.innerHeight - 72;

  return (
    <>
      {/* Floating button — draggable */}
      <div
        className="fixed z-50 select-none"
        style={{ left, top }}
      >
        <button
          type="button"
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
          onClick={() => { if (!dragRef.current.dragging) setOpen(!open); }}
          className="w-[52px] h-[52px] rounded-full bg-cyan hover:bg-cyan-hover text-white shadow-lg shadow-cyan/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-grab active:cursor-grabbing relative group"
          title="Drag to move — click to open chat"
        >
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-cyan animate-pulse" />
          {open ? <X size={20} /> : <Bot size={22} className="animate-bot-idle" />}
          <GripHorizontal size={14} className="absolute -bottom-1 opacity-0 group-hover:opacity-60 transition-opacity text-white/60" />
        </button>
      </div>

      {/* Chat panel — follows button */}
      {open && (
        <div
          ref={panelRef}
          className="fixed z-50 w-[360px] max-w-[calc(100vw-40px)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col animate-[fade-in_0.15s_ease-out]"
          style={{ left: Math.min(left + 58, window.innerWidth - 380), top: Math.max(10, top - 440) }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0">
            <div className="w-[30px] h-[30px] rounded-full bg-cyan/10 flex items-center justify-center">
              <Bot size={15} className="text-cyan animate-bot-idle" />
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
