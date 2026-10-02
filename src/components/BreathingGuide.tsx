import { useEffect, useRef, useState } from "react";
import { micEngine } from "../audio/MicEngine";
import { clamp } from "../lib/cn";

/* ---------------------------------------------------------------------------
 * Modo patron: circulo que respira (inhala/reten/exhala/reten) por N ciclos.
 * Puntua la ESTABILIDAD del flujo de aire durante las fases de exhalacion
 * (coeficiente de variacion del RMS). Si el usuario respira en silencio,
 * puntua alto por completar el patron.
 * ------------------------------------------------------------------------- */

export interface BreathPattern {
  inhale: number;
  hold: number;
  exhale: number;
  holdOut?: number;
  cycles: number;
}

type Phase = "inhale" | "hold" | "exhale" | "holdOut";

export function BreathPatternGuide({
  pattern,
  running,
  onComplete
}: {
  pattern: BreathPattern;
  running: boolean;
  onComplete: (score: number, metrics: Record<string, number>) => void;
}) {
  const [phase, setPhase] = useState<Phase>("inhale");
  const [remaining, setRemaining] = useState(pattern.inhale);
  const [cycle, setCycle] = useState(1);
  const scale = phase === "inhale" ? 1 : phase === "exhale" ? 0.45 : phase === "hold" ? 1 : 0.45;
  const dur = phase === "inhale" ? pattern.inhale : phase === "exhale" ? pattern.exhale : phase === "hold" ? pattern.hold : (pattern.holdOut ?? 0);

  const dataRef = useRef({ exhaleSamples: [] as number[], onComplete });
  dataRef.current.onComplete = onComplete;

  useEffect(() => {
    if (!running) return;
    const seq: Phase[] = ["inhale", "hold", "exhale"];
    if (pattern.holdOut) seq.push("holdOut");
    const durOf = (p: Phase) =>
      p === "inhale" ? pattern.inhale : p === "hold" ? pattern.hold : p === "exhale" ? pattern.exhale : pattern.holdOut ?? 0;

    let idx = 0;
    let cyc = 1;
    let phaseStart = performance.now();
    setPhase("inhale");
    setRemaining(pattern.inhale);
    setCycle(1);
    dataRef.current.exhaleSamples = [];

    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const cur = seq[idx];
      const elapsed = (now - phaseStart) / 1000;
      const left = Math.max(0, durOf(cur) - elapsed);
      setRemaining(left);

      if (cur === "exhale") {
        const f = micEngine.lastFrame;
        if (f && f.voiced) dataRef.current.exhaleSamples.push(f.rms);
      }

      if (left <= 0) {
        idx++;
        if (idx >= seq.length) {
          idx = 0;
          cyc++;
          if (cyc > pattern.cycles) {
            const sm = dataRef.current.exhaleSamples;
            let score: number;
            if (sm.length > 8) {
              const mean = sm.reduce((a, b) => a + b, 0) / sm.length;
              const varc = sm.reduce((a, b) => a + (b - mean) ** 2, 0) / sm.length;
              const cv = Math.sqrt(varc) / (mean || 1e-6);
              score = clamp(1 - cv, 0.4, 1);
            } else {
              score = 0.85; // respiracion silenciosa correcta
            }
            dataRef.current.onComplete(score, { cyclesDone: pattern.cycles, airStability: score });
            return;
          }
          setCycle(cyc);
        }
        setPhase(seq[idx]);
        phaseStart = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, pattern]);

  const labels: Record<Phase, string> = {
    inhale: "Inhala",
    hold: "Reten",
    exhale: "Exhala (sss...)",
    holdOut: "Vacio"
  };

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="relative grid place-items-center w-64 h-64">
        <div className="absolute w-64 h-64 rounded-full border border-white/10" />
        <div
          className="rounded-full bg-gradient-to-br from-cyan to-brand shadow-glow transition-transform ease-in-out"
          style={{ width: 180, height: 180, transform: `scale(${scale})`, transitionDuration: `${dur}s` }}
        />
        <div className="absolute text-center">
          <div className="text-2xl font-display font-bold">{labels[phase]}</div>
          <div className="text-4xl font-display tabular-nums">{Math.ceil(remaining)}</div>
        </div>
      </div>
      <div className="pill">Ciclo {cycle} / {pattern.cycles}</div>
      <p className="text-white/50 text-xs text-center max-w-xs">
        Exhala haciendo un sonido "sss" constante: el juego mide que tan estable mantienes el aire.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Modo vela: mantener un flujo/sonido estable. La llama se apaga si el volumen
 * cae por debajo del umbral o si pica bruscamente. Se puntua el mejor tramo
 * sostenido continuo frente a `targetSeconds`.
 * ------------------------------------------------------------------------- */

export function CandleGuide({
  targetSeconds,
  running,
  onComplete
}: {
  targetSeconds: number;
  running: boolean;
  onComplete: (score: number, metrics: Record<string, number>) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [life, setLife] = useState(1);
  const [best, setBest] = useState(0);
  const [held, setHeld] = useState(0);
  const doneRef = useRef(false);
  const cbRef = useRef(onComplete);
  cbRef.current = onComplete;

  useEffect(() => {
    if (!running) return;
    doneRef.current = false;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = 260 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    let last = performance.now();
    let flame = 1;
    let sustain = 0;
    let bestSustain = 0;
    let prevRms = 0;
    const overallStart = performance.now();

    const loop = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const f = micEngine.lastFrame;
      const level = f?.rms ?? 0;
      const voiced = !!f?.voiced;
      const spike = Math.abs(level - prevRms) > 0.06;
      prevRms = level;

      // banda "buena": suficiente aire, sin picos
      const good = voiced && level > 0.012 && !spike;
      if (good) {
        flame = clamp(flame + dt * 0.8, 0, 1);
        sustain += dt;
        bestSustain = Math.max(bestSustain, sustain);
      } else {
        flame = clamp(flame - dt * (voiced ? 1.1 : 1.8), 0, 1);
        sustain = 0;
      }
      setLife(flame);
      setHeld(sustain);
      setBest(bestSustain);

      const W = canvas.clientWidth;
      const Hc = 260;
      ctx.clearRect(0, 0, W, Hc);
      // vela
      ctx.fillStyle = "#e9e4d0";
      ctx.fillRect(W / 2 - 22, Hc - 90, 44, 80);
      ctx.fillStyle = "#c9c2a6";
      ctx.fillRect(W / 2 - 22, Hc - 90, 44, 8);
      // pabilo
      ctx.strokeStyle = "#3a2f22";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(W / 2, Hc - 92);
      ctx.lineTo(W / 2, Hc - 104);
      ctx.stroke();
      // llama
      const flick = good ? (Math.random() - 0.5) * 4 : (Math.random() - 0.5) * 14;
      const fh = 20 + flame * 70;
      const grd = ctx.createLinearGradient(0, Hc - 104 - fh, 0, Hc - 104);
      grd.addColorStop(0, `rgba(255,240,180,${0.2 + flame * 0.8})`);
      grd.addColorStop(0.5, `rgba(255,170,60,${0.3 + flame * 0.7})`);
      grd.addColorStop(1, `rgba(255,90,30,${0.2 + flame * 0.6})`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(W / 2 - 12, Hc - 104);
      ctx.quadraticCurveTo(W / 2 - 14 + flick, Hc - 104 - fh * 0.5, W / 2 + flick, Hc - 104 - fh);
      ctx.quadraticCurveTo(W / 2 + 14 + flick, Hc - 104 - fh * 0.5, W / 2 + 12, Hc - 104);
      ctx.closePath();
      ctx.fill();
      if (flame < 0.06) {
        ctx.fillStyle = "rgba(180,180,190,0.5)";
        ctx.font = "12px Inter";
        ctx.textAlign = "center";
        ctx.fillText("💨 se apago", W / 2, Hc - 120);
        ctx.textAlign = "left";
      }

      if ((now - overallStart) / 1000 > targetSeconds + 6 || bestSustain >= targetSeconds) {
        if (!doneRef.current) {
          doneRef.current = true;
          const score = clamp(bestSustain / targetSeconds, 0, 1);
          cbRef.current(score, { airSeconds: Math.round(bestSustain * 10) / 10 });
        }
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, targetSeconds]);

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas ref={canvasRef} className="w-full rounded-xl bg-black/40" style={{ height: 260 }} />
      <div className="flex gap-6 text-sm">
        <span>
          Sostenido: <b className="tabular-nums">{held.toFixed(1)}s</b>
        </span>
        <span>
          Mejor: <b className="tabular-nums text-good">{best.toFixed(1)}s</b> / {targetSeconds}s
        </span>
        <span>
          Llama: <b>{Math.round(life * 100)}%</b>
        </span>
      </div>
      <p className="text-white/50 text-xs text-center max-w-xs">
        Emite un sonido sostenido y parejo ("sss" o "aaa"). Si el aire baja o pega un pico, la llama se apaga.
      </p>
    </div>
  );
}
