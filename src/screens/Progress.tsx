import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useGame, useLevel } from "../game/store";
import { ACHIEVEMENTS } from "../game/achievements";
import { CURRICULUM, MODULE_META, type ModuleKey } from "../data/curriculum";
import { midiToLatin } from "../music/notes";
import { XPBar } from "../components/Gamify";
import { cn } from "../lib/cn";

export function Progress() {
  const { level } = useLevel();
  const state = useGame();
  const earned = new Set(state.achievements);

  const totalStars = Object.values(state.results).reduce((a, r) => a + r.stars, 0);
  const exercisesDone = Object.keys(state.results).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display">Tu progreso</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Nivel" value={level} />
        <Stat label="Racha" value={`${state.streak.count} 🔥`} sub={`mejor ${state.streak.best}`} />
        <Stat label="Estrellas" value={totalStars} />
        <Stat label="Ejercicios" value={exercisesDone} />
      </div>

      <div className="card p-4">
        <div className="text-sm font-semibold mb-2">Experiencia</div>
        <XPBar />
      </div>

      <RangeChart />

      <section>
        <h2 className="font-display text-lg mb-2">Dominio por modulo</h2>
        <div className="space-y-2">
          {(Object.keys(MODULE_META) as ModuleKey[]).map((mk) => {
            const units = CURRICULUM.filter((u) => u.module === mk);
            const exs = units.flatMap((u) => u.exercises);
            const got = exs.reduce((a, e) => a + (state.results[e.id]?.stars ?? 0), 0);
            const max = exs.length * 3;
            return (
              <div key={mk} className="card p-3">
                <div className="flex justify-between text-sm mb-1">
                  <span style={{ color: MODULE_META[mk].color }}>
                    {MODULE_META[mk].icon} {MODULE_META[mk].label}
                  </span>
                  <span className="text-white/50">
                    {got}/{max} ★
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full" style={{ width: `${max ? (got / max) * 100 : 0}%`, background: MODULE_META[mk].color }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Logros ({earned.size}/{ACHIEVEMENTS.length})</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const on = earned.has(a.id);
            return (
              <div key={a.id} className={cn("card p-3 flex items-center gap-2", !on && "opacity-40")}>
                <span className="text-2xl">{a.icon}</span>
                <div>
                  <div className="text-xs font-semibold leading-tight">{a.title}</div>
                  <div className="text-[11px] text-white/50 leading-tight">{a.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Link to="/glossary" className="btn-ghost w-full">
        📖 Abrir glosario musical
      </Link>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-3">
      <div className="text-white/50 text-xs">{label}</div>
      <div className="text-2xl font-display">{value}</div>
      {sub && <div className="text-white/40 text-[11px]">{sub}</div>}
    </div>
  );
}

function RangeChart() {
  const history = useGame((s) => s.history);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = 180;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (history.length < 1) {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "12px Inter";
      ctx.fillText("Aun no hay datos. Completa ejercicios de afinacion.", 10, H / 2);
      return;
    }

    const lows = history.map((h) => h.rangeLowMidi);
    const highs = history.map((h) => h.rangeHighMidi);
    const lo = Math.min(...lows) - 2;
    const hi = Math.max(...highs) + 2;
    const x = (i: number) => (history.length === 1 ? W / 2 : (i / (history.length - 1)) * (W - 20) + 10);
    const y = (m: number) => H - 20 - ((m - lo) / (hi - lo)) * (H - 40);

    // banda de rango
    ctx.fillStyle = "rgba(124,58,237,0.20)";
    ctx.beginPath();
    history.forEach((h, i) => (i === 0 ? ctx.moveTo(x(i), y(h.rangeHighMidi)) : ctx.lineTo(x(i), y(h.rangeHighMidi))));
    for (let i = history.length - 1; i >= 0; i--) ctx.lineTo(x(i), y(history[i].rangeLowMidi));
    ctx.closePath();
    ctx.fill();

    // error de afinacion (cents) escalado a la altura
    const errs = history.map((h) => h.avgPitchErrorCents).filter((e) => e > 0);
    if (errs.length) {
      const maxErr = Math.max(50, ...errs);
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.beginPath();
      history.forEach((h, i) => {
        const yy = H - 20 - (h.avgPitchErrorCents / maxErr) * (H - 40);
        i === 0 ? ctx.moveTo(x(i), yy) : ctx.lineTo(x(i), yy);
      });
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "10px Inter";
    ctx.fillText(`${midiToLatin(Math.round(hi))}`, 4, 12);
    ctx.fillText(`${midiToLatin(Math.round(lo))}`, 4, H - 6);
  }, [history]);

  return (
    <div className="card p-4">
      <div className="text-sm font-semibold mb-1">Evolucion del rango y de la afinacion</div>
      <div className="text-xs text-white/45 mb-2">
        Banda morada = rango vocal registrado · Linea cian = error medio de afinacion (menor es mejor)
      </div>
      <canvas ref={ref} className="w-full" style={{ height: 180 }} />
    </div>
  );
}
