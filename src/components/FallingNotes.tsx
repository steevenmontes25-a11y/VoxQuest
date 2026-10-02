import { useEffect, useRef, useState } from "react";
import { micEngine } from "../audio/MicEngine";
import { hzToMidiFloat, midiToLatin, midiToHz, centsBetween } from "../music/notes";
import { playNote } from "../audio/synth";
import { scoreColor, clamp } from "../lib/cn";

export interface GameNote {
  midi: number;
  startBeat: number;
  beats: number;
  label?: string;
}

export interface FallingNotesResult {
  score: number; // 0..1 medio de todas las notas
  perfectNotes: number;
  hitRatio: number; // notas con score >= 0.5
  maxCombo: number;
}

interface Props {
  notes: GameNote[];
  bpm: number;
  toleranceCents: number;
  leadInBeats?: number;
  playGuide?: boolean;
  running: boolean;
  onComplete: (r: FallingNotesResult) => void;
}

/**
 * Carril tipo "piano roll" horizontal. El tiempo avanza hacia la izquierda y la
 * "linea de ahora" esta fija cerca del borde izquierdo. Mientras una nota cruza
 * esa linea se muestrea el tono del usuario (`micEngine.lastFrame`) frame a
 * frame y se acumula el tiempo afinado.
 */
export function FallingNotes({
  notes,
  bpm,
  toleranceCents,
  leadInBeats = 4,
  playGuide = true,
  running,
  onComplete
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [combo, setCombo] = useState(0);
  const [countIn, setCountIn] = useState<number | null>(leadInBeats);

  const stateRef = useRef({
    notes,
    bpm,
    toleranceCents,
    leadInBeats,
    playGuide,
    onComplete,
    combo: 0,
    maxCombo: 0
  });
  stateRef.current.notes = notes;
  stateRef.current.bpm = bpm;
  stateRef.current.toleranceCents = toleranceCents;
  stateRef.current.onComplete = onComplete;
  stateRef.current.playGuide = playGuide;
  stateRef.current.leadInBeats = leadInBeats;

  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const H = 320;
    const NOW_X = 90;
    const PPS = 150; // pixeles por segundo de scroll

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const s = stateRef.current;
    const beat = 60 / s.bpm;
    const midis = s.notes.map((n) => n.midi);
    const lo = Math.min(...midis) - 3;
    const hi = Math.max(...midis) + 3;
    const spanBeats = Math.max(...s.notes.map((n) => n.startBeat + n.beats));

    // acumuladores por nota
    const acc = s.notes.map(() => ({ frames: 0, inTune: 0, guided: false }));
    s.combo = 0;
    s.maxCombo = 0;

    let raf = 0;
    const t0 = performance.now();
    let finished = false;

    const midiToY = (m: number) => H - ((m - lo) / (hi - lo)) * H;

    const loop = () => {
      const now = performance.now();
      const elapsed = (now - t0) / 1000;
      const songT = elapsed - s.leadInBeats * beat; // negativo durante la cuenta atras
      const curBeat = songT / beat;

      if (songT < 0) {
        setCountIn(Math.ceil(-songT / beat));
      } else {
        setCountIn(null);
      }

      const W = canvas.clientWidth;
      ctx.clearRect(0, 0, W, H);

      // rejilla de notas
      ctx.font = "10px Inter, sans-serif";
      for (let m = Math.ceil(lo); m <= Math.floor(hi); m++) {
        const y = midiToY(m);
        const isC = ((m % 12) + 12) % 12 === 0;
        ctx.strokeStyle = isC ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)";
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillText(midiToLatin(m), 4, y + 3);
      }

      // linea de ahora
      ctx.strokeStyle = "rgba(167,139,250,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(NOW_X, 0);
      ctx.lineTo(NOW_X, H);
      ctx.stroke();

      const frame = micEngine.lastFrame;
      const userMidi = frame?.hz ? hzToMidiFloat(frame.hz) : null;

      // notas
      s.notes.forEach((n, i) => {
        const noteStartT = n.startBeat * beat;
        const noteEndT = (n.startBeat + n.beats) * beat;
        const x = NOW_X + (noteStartT - songT) * PPS;
        const w = n.beats * beat * PPS;
        const y = midiToY(n.midi);
        const barH = 16;

        const a = acc[i];
        const active = songT >= noteStartT && songT <= noteEndT;

        // guia sonora al entrar
        if (s.playGuide && !a.guided && songT >= noteStartT - 0.03 && songT < noteEndT) {
          a.guided = true;
          void playNote(n.midi, Math.min(n.beats * beat, 0.6));
        }

        let noteScore = a.frames ? a.inTune / a.frames : 0;
        if (active && userMidi != null) {
          a.frames++;
          const errC = centsBetween(midiToHz(userMidi), midiToHz(n.midi));
          if (Math.abs(errC) <= s.toleranceCents) a.inTune++;
          noteScore = a.inTune / a.frames;
        }

        // fondo de la barra
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        roundRect(ctx, x, y - barH / 2, w, barH, 6);
        ctx.fill();
        // relleno segun acierto
        if (a.frames > 0) {
          ctx.fillStyle = scoreColor(noteScore);
          roundRect(ctx, x, y - barH / 2, w * clamp(noteScore, 0.04, 1), barH, 6);
          ctx.fill();
        }
        if (active) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          roundRect(ctx, x, y - barH / 2, w, barH, 6);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "bold 10px Inter, sans-serif";
        if (w > 24) ctx.fillText(n.label ?? midiToLatin(n.midi), x + 5, y + 3);

        // al terminar la nota, actualizar combo (una sola vez)
        if (!active && songT > noteEndT && !(a as { done?: boolean }).done && a.frames > 0) {
          (a as { done?: boolean }).done = true;
          if (a.inTune / a.frames >= 0.5) {
            s.combo++;
            s.maxCombo = Math.max(s.maxCombo, s.combo);
          } else {
            s.combo = 0;
          }
          setCombo(s.combo);
        }
      });

      // burbuja del usuario en la linea de ahora
      if (userMidi != null) {
        const y = clamp(midiToY(userMidi), 6, H - 6);
        ctx.shadowBlur = 16;
        ctx.shadowColor = "#22d3ee";
        ctx.fillStyle = "#22d3ee";
        ctx.beginPath();
        ctx.arc(NOW_X, y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // combo
      if (s.combo > 1) {
        ctx.fillStyle = "#a78bfa";
        ctx.font = "bold 20px 'Baloo 2', sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`x${s.combo}`, W - 10, 26);
        ctx.textAlign = "left";
      }

      if (curBeat > spanBeats + 1.5 && !finished) {
        finished = true;
        const perNote = acc.map((a) => (a.frames ? a.inTune / a.frames : 0));
        const score = perNote.reduce((x, y) => x + y, 0) / perNote.length;
        const perfectNotes = perNote.filter((v) => v >= 0.8).length;
        const hitRatio = perNote.filter((v) => v >= 0.5).length / perNote.length;
        s.onComplete({ score, perfectNotes, hitRatio, maxCombo: s.maxCombo });
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [running]);

  return (
    <div className="relative">
      <canvas ref={canvasRef} className="w-full rounded-xl bg-black/40" style={{ height: 320 }} />
      {countIn != null && countIn > 0 && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <span className="text-7xl font-display font-extrabold text-white/90 animate-pop-in">{countIn}</span>
        </div>
      )}
      <div className="mt-1 text-xs text-white/50">Combo actual: x{combo}</div>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
