import { useEffect, useRef, useState } from "react";
import { micEngine } from "../../audio/MicEngine";
import { hzToMidiFloat, midiToLatin } from "../../music/notes";
import { SingTargets, type SingTarget } from "./SingTargets";
import type { PlayerProps } from "./types";
import { clamp } from "../../lib/cn";

/* Registros: voz de pecho (grave) y voz de cabeza (agudo). */
export function RegistersPlayer({ toleranceCents, rangeLowMidi, rangeHighMidi, running, onResult }: PlayerProps) {
  const chest = Math.round(clamp(rangeLowMidi + 3, rangeLowMidi, rangeHighMidi - 6));
  const head = Math.round(clamp(rangeHighMidi - 3, chest + 5, rangeHighMidi));
  const targets: SingTarget[] = [
    { midi: chest, label: `${midiToLatin(chest)} — voz de pecho`, holdSeconds: 3 },
    { midi: head, label: `${midiToLatin(head)} — voz de cabeza`, holdSeconds: 3 }
  ];
  return (
    <div className="space-y-3">
      <div className="card p-3 text-sm text-white/75">
        Canta primero grave con <b>voz de pecho</b> (resuena en el pecho) y luego agudo con <b>voz de cabeza</b> (resuena
        arriba). La zona intermedia donde la voz tiende a quebrarse es el <b>passaggio</b>: pasa por ahi con suavidad y
        menos aire.
      </div>
      <SingTargets
        targets={targets}
        toleranceCents={Math.max(toleranceCents, 35)}
        running={running}
        onComplete={(r) => onResult({ score: r.score, metrics: { perfectNotes: r.perfectNotes, registersReached: r.perTarget.filter((v) => v >= 0.5).length } })}
      />
    </div>
  );
}

/* Vibrato: mantener una oscilacion periodica del tono de 4.5-7.5 Hz. */
export function VibratoPlayer({ exercise, running, onResult }: PlayerProps) {
  const targetHz = (exercise.params?.targetHz as number) ?? 6;
  const need = (exercise.params?.seconds as number) ?? 3;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rate, setRate] = useState(0);
  const [ampCents, setAmpCents] = useState(0);
  const [goodSec, setGoodSec] = useState(0);
  const doneRef = useRef(false);
  const cbRef = useRef(onResult);
  cbRef.current = onResult;

  useEffect(() => {
    if (!running) return;
    doneRef.current = false;
    const buf: Array<{ t: number; m: number }> = [];
    let bestGood = 0;
    let curGood = 0;
    let last = performance.now();
    const start = last;
    let raf = 0;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = 140 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const loop = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const f = micEngine.lastFrame;
      if (f?.hz) buf.push({ t: now, m: hzToMidiFloat(f.hz) });
      while (buf.length && now - buf[0].t > 1500) buf.shift();

      let r = 0;
      let amp = 0;
      if (buf.length > 10) {
        const mean = buf.reduce((a, b) => a + b.m, 0) / buf.length;
        const dev = buf.map((b) => b.m - mean);
        const min = Math.min(...dev);
        const max = Math.max(...dev);
        amp = ((max - min) / 2) * 100;
        let crossings = 0;
        for (let k = 1; k < dev.length; k++) if (dev[k - 1] <= 0 && dev[k] > 0) crossings++;
        const span = (buf[buf.length - 1].t - buf[0].t) / 1000;
        r = span > 0 ? crossings / span : 0;
      }
      setRate(r);
      setAmpCents(amp);

      const good = r >= 4.5 && r <= 7.5 && amp >= 20 && amp <= 130;
      if (good) {
        curGood += dt;
        bestGood = Math.max(bestGood, curGood);
      } else {
        curGood = 0;
      }
      setGoodSec(bestGood);

      // dibujo de la desviacion
      const W = canvas.clientWidth;
      const Hc = 140;
      ctx.clearRect(0, 0, W, Hc);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.beginPath();
      ctx.moveTo(0, Hc / 2);
      ctx.lineTo(W, Hc / 2);
      ctx.stroke();
      ctx.strokeStyle = good ? "#22c55e" : "#22d3ee";
      ctx.lineWidth = 2;
      ctx.beginPath();
      buf.forEach((b, k) => {
        const x = (k / Math.max(1, buf.length - 1)) * W;
        const mean = buf.reduce((a, c) => a + c.m, 0) / buf.length;
        const y = Hc / 2 - (b.m - mean) * 40;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      if (bestGood >= need || (now - start) / 1000 > need + 12) {
        if (!doneRef.current) {
          doneRef.current = true;
          cbRef.current({ score: clamp(bestGood / need, 0, 1), metrics: { vibratoSeconds: Math.round(bestGood * 10) / 10, vibratoHz: Math.round(r * 10) / 10 } });
        }
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, need]);

  return (
    <div className="space-y-2">
      <div className="card p-3 text-sm text-white/75">
        Sostiene una vocal y hazla "ondular" de forma pareja. Objetivo: ~{targetHz} Hz de oscilacion durante {need} s
        seguidos.
      </div>
      <canvas ref={canvasRef} className="w-full rounded-xl bg-black/40" style={{ height: 140 }} />
      <div className="flex gap-5 text-sm">
        <span>Frecuencia: <b className={clamp(rate, 4.5, 7.5) === rate ? "text-good" : ""}>{rate.toFixed(1)} Hz</b></span>
        <span>Amplitud: <b>{ampCents.toFixed(0)} cents</b></span>
        <span>Mejor tramo: <b className="text-good">{goodSec.toFixed(1)}s</b> / {need}s</span>
      </div>
    </div>
  );
}
