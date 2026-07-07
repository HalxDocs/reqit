import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useResponseStore } from "@/features/request/stores/useResponseStore";

const COLORS = ["#ff0", "#f0f", "#0ff", "#0f0", "#f00", "#00f", "#ff8800", "#ff4488"];

function fireConfetti() {
  const el = document.getElementById("party-confetti-canvas") as HTMLCanvasElement;
  if (!el) return;
  const c = el.getContext("2d");
  if (!c) return;
  const ctx: CanvasRenderingContext2D = c;
  el.width = window.innerWidth;
  el.height = window.innerHeight;
  const w = el.width;
  const h = el.height;

  const pieces: { x: number; y: number; w: number; h: number; color: string; vy: number; vx: number; rot: number; rv: number }[] = [];
  for (let i = 0; i < 120; i++) {
    pieces.push({
      x: Math.random() * w,
      y: -20 - Math.random() * 100,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vy: 2 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 4,
      rot: Math.random() * 360,
      rv: (Math.random() - 0.5) * 10,
    });
  }

  let frame = 0;
  const maxFrames = 120;
  function draw() {
    if (frame >= maxFrames) { ctx.clearRect(0, 0, w, h); return; }
    ctx.clearRect(0, 0, w, h);
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.rot += p.rv;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    frame++;
    requestAnimationFrame(draw);
  }
  draw();
}

function shakeScreen() {
  const el = document.getElementById("party-shake-target");
  if (!el) return;
  el.classList.add("party-shake");
  setTimeout(() => el.classList.remove("party-shake"), 500);
}

const STORAGE_KEY = "reqit_party_mode";

export function PartyModeToggle() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={enabled ? "Disable party mode" : "Enable party mode"}
      className={`flex items-center gap-1 text-11 transition-colors ${
        enabled ? "text-cyan" : "text-subtext/30 hover:text-subtext"
      }`}
    >
      <Sparkles size={11} />
    </button>
  );
}

export function PartyModeEffects() {
  const enabled = localStorage.getItem(STORAGE_KEY) === "true";
  const response = useResponseStore((s) => s.response);
  const prevCode = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !response) return;
    const code = response.statusCode;
    if (code === prevCode.current) return;
    prevCode.current = code;

    if (code >= 200 && code < 300) {
      setTimeout(() => fireConfetti(), 100);
    } else if (code >= 500) {
      shakeScreen();
    }
  }, [enabled, response]);

  if (!enabled) return null;

  return (
    <>
      <canvas id="party-confetti-canvas" className="fixed inset-0 pointer-events-none z-[9999]" />
      <style>{`
        @keyframes partyShake {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-4px); }
          20% { transform: translateX(4px); }
          30% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          50% { transform: translateX(-2px); }
          60% { transform: translateX(2px); }
          70% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
          90% { transform: translateX(-1px); }
        }
        .party-shake {
          animation: partyShake 0.5s ease-in-out;
        }
      `}</style>
    </>
  );
}
