import { useEffect, useState } from "react";
import { Modal } from "@/shared/components/Modal";
import reqitLogo from "../../assets/images/reqitlogo.jpeg";

const STORAGE_KEY = "reqit_milestone_300_shown";

function fireConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;z-index:9999;pointer-events:none;";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ["#ff0", "#f0f", "#0ff", "#0f0", "#f00", "#00f", "#ff8800", "#ff4488", "#00e5ff", "#76ff03"];
  const pieces = Array.from({ length: 150 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 120,
    w: 6 + Math.random() * 6,
    h: 4 + Math.random() * 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    vy: 2 + Math.random() * 5,
    vx: (Math.random() - 0.5) * 5,
    rot: Math.random() * 360,
    rv: (Math.random() - 0.5) * 12,
  }));

  let frame = 0;
  const c = ctx;
  function draw() {
    if (!c) { canvas.remove(); return; }
    if (frame >= 150) { c.clearRect(0, 0, canvas.width, canvas.height); canvas.remove(); return; }
    c.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.04;
      p.rot += p.rv;
      c.save();
      c.translate(p.x, p.y);
      c.rotate((p.rot * Math.PI) / 180);
      c.fillStyle = p.color;
      c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      c.restore();
    }
    frame++;
    requestAnimationFrame(draw);
  }
  draw();
}

export function MilestoneBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {}
    // Small delay so it feels like a reveal after the app loads
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (open) fireConfetti();
  }, [open]);

  const handleDismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setOpen(false);
  };

  return (
    <Modal open={open} onClose={handleDismiss} title="">
      <div className="flex flex-col items-center gap-4 w-[420px] max-w-full text-center">
        <img src={reqitLogo} alt="reqit" className="h-[36px] w-auto object-contain" />

        <div className="text-28 font-bold text-text leading-tight">
          🎉 300 Downloads
        </div>

        <p className="text-13 text-subtext leading-relaxed">
          reqit just crossed <span className="font-semibold text-cyan">300 downloads</span>.
          <br />
          Thank you for being part of the journey — whether you joined yesterday or since the beginning.
        </p>

        <div className="flex items-center gap-3 mt-2 px-4 py-3 rounded-lg bg-surface border border-border">
          <span className="text-20">🚀</span>
          <p className="text-12 text-subtext text-left">
            This is just the start. More features, better AI, and deeper integrations are on the way.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="h-[34px] px-6 mt-1 bg-cyan hover:bg-cyan-hover text-white text-12 font-bold rounded-md transition-all"
        >
          Let's go
        </button>
      </div>
    </Modal>
  );
}
