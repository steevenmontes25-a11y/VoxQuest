import { useEffect, useRef } from "react";
import { micEngine, type MicFrame } from "../audio/MicEngine";
import { hzToMidiFloat, midiToLatin, midiToHz, centsBetween } from "../music/notes";
import { scoreColor, clamp } from "../lib/cn";

/**
 * Medidor de afinacion en tiempo real dibujado en canvas.
 *
 * Muestra un pentagrama de notas centrado en `centerMidi` (o en la nota objetivo)
 * y una "burbuja" que sigue el tono detectado. El color de la burbuja y de la
 * banda de tolerancia comunican si el usuario esta afinado.
 *
 * Se dibuja con su propio rAF y lee `micEngine.lastFrame` -> no provoca renders
 * de React.
 */
export interface PitchMeterProps {
  targetMidi?: number | null;
  toleranceCents: number;
  centerMidi?: number;
  rangeSemitones?: number;
  height?: number;
  /** callback opcional con el error actual en cents (para HUD externos). */
  onReading?: (info: { hz: number | null; errorCents: number | null; inTune: boolean }) => void;
}

export function PitchMeter({
  targetMidi = null,
  toleranceCents,
  centerMidi,
  rangeSemitones = 16,
  height = 260,
  onReading
}: PitchMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ targetMidi, toleranceCents, centerMidi, rangeSemitones, onReading });
  propsRef.current = { targetMidi, toleranceCents, centerMidi, rangeSemitones, onReading };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const trail: Array<{ midi: number; a: number }> = [];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      canvas.width = w * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const p = propsRef.current;
      const frame: MicFrame | null = micEngine.lastFrame;
      const w = canvas.clientWidth;
      const h = height;
      ctx.clearRect(0, 0, w, h);

      const center = p.centerMidi ?? p.targetMidi ?? 60;
      const half = p.rangeSemitones / 2;
      const lo = center - half;
      const hi = center + half;
      const midiToY = (m: number) => h - ((m - lo) / (hi - lo)) * h;

      // lineas de nota
      ctx.textAlign = "left";
      ctx.font = "11px Inter, sans-serif";
      for (let m = Math.ceil(lo); m <= Math.floor(hi); m++) {
        const y = midiToY(m);
        const isC = ((m % 12) + 12) % 12 === 0;
        ctx.strokeStyle = isC ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(44, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.fillStyle = isC ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)";
        ctx.fillText(midiToLatin(m), 4, y + 3);
      }

      // banda objetivo + tolerancia
      let errorCents: number | null = null;
      let inTune = false;
      if (p.targetMidi != null) {
        const tHz = midiToHz(p.targetMidi);
        const tYcenter = midiToY(p.targetMidi);
        const tolMidi = p.toleranceCents / 100;
        const yTop = midiToY(p.targetMidi + tolMidi);
        const yBot = midiToY(p.targetMidi - tolMidi);
        ctx.fillStyle = "rgba(124,58,237,0.16)";
        ctx.fillRect(44, yTop, w - 44, yBot - yTop);
        ctx.strokeStyle = "rgba(167,139,250,0.7)";
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(44, tYcenter);
        ctx.lineTo(w, tYcenter);
        ctx.stroke();
        ctx.setLineDash([]);

        if (frame?.hz) {
          errorCents = centsBetween(frame.hz, tHz);
          inTune = Math.abs(errorCents) <= p.toleranceCents;
        }
      }

      // burbuja del usuario + estela
      if (frame?.hz) {
        const midiF = hzToMidiFloat(frame.hz);
        const y = clamp(midiToY(midiF), 6, h - 6);
        const x = w - 60;
        trail.unshift({ midi: midiF, a: 1 });
        if (trail.length > 26) trail.pop();

        let col = "#22d3ee";
        if (p.targetMidi != null && errorCents != null) {
          const norm = clamp(1 - Math.abs(errorCents) / 200, 0, 1);
          col = scoreColor(norm);
        }

        trail.forEach((pt, i) => {
          const ty = clamp(midiToY(pt.midi), 6, h - 6);
          const tx = x - i * 6;
          ctx.globalAlpha = (1 - i / trail.length) * 0.5;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(tx, ty, 4, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;

        ctx.shadowBlur = 18;
        ctx.shadowColor = col;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = "#0b0b16";
        ctx.font = "bold 10px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(frame.note ? frame.note.latin : "", x, y + 3);
      } else {
        trail.length = 0;
      }

      p.onReading?.({ hz: frame?.hz ?? null, errorCents, inTune });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [height]);

  return <canvas ref={canvasRef} className="w-full rounded-xl bg-black/30" style={{ height }} />;
}
