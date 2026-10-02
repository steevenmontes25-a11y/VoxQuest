import { useEffect, useRef, useState } from "react";
import { micEngine } from "../../audio/MicEngine";
import { centsBetween, midiToHz, midiToLatin } from "../../music/notes";
import { PitchMeter } from "../../components/PitchMeter";
import { clamp } from "../../lib/cn";

export interface SingTarget {
  midi: number;
  label?: string;
  /** segundos afinado necesarios para "clavar" este objetivo. */
  holdSeconds?: number;
}

export interface SingResult {
  score: number;
  perfectNotes: number;
  avgErrorCents: number;
  perTarget: number[];
}

/**
 * Guia de canto objetivo por objetivo. Para cada target muestra el medidor con
 * la nota a alcanzar; acumula tiempo afinado dentro de la tolerancia y avanza
 * cuando se alcanza `holdSeconds` o se agota el tiempo maximo (holdSeconds x3).
 */
export function SingTargets({
  targets,
  toleranceCents,
  running,
  onComplete,
  instructions
}: {
  targets: SingTarget[];
  toleranceCents: number;
  running: boolean;
  onComplete: (r: SingResult) => void;
  instructions?: string;
}) {
  const [idx, setIdx] = useState(0);
  const [heldMs, setHeldMs] = useState(0);
  const dataRef = useRef({
    per: targets.map(() => ({ frames: 0, inTune: 0, errSum: 0 })),
    onComplete,
    targets,
    toleranceCents
  });
  dataRef.current.onComplete = onComplete;
  dataRef.current.targets = targets;
  dataRef.current.toleranceCents = toleranceCents;

  useEffect(() => {
    if (!running) return;
    dataRef.current.per = targets.map(() => ({ frames: 0, inTune: 0, errSum: 0 }));
    let i = 0;
    setIdx(0);
    let held = 0;
    let elapsed = 0;
    let last = performance.now();
    let raf = 0;

    const finish = () => {
      const d = dataRef.current;
      const perTarget = d.per.map((p) => (p.frames ? p.inTune / p.frames : 0));
      const score = perTarget.reduce((a, b) => a + b, 0) / perTarget.length;
      const perfectNotes = perTarget.filter((v) => v >= 0.75).length;
      const totFrames = d.per.reduce((a, p) => a + p.frames, 0) || 1;
      const avgErrorCents = d.per.reduce((a, p) => a + p.errSum, 0) / totFrames;
      d.onComplete({ score, perfectNotes, avgErrorCents, perTarget });
    };

    const tick = () => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      elapsed += dt;

      const t = dataRef.current.targets[i];
      const need = (t.holdSeconds ?? 2) * 1000;
      const maxMs = need * 3;

      const f = micEngine.lastFrame;
      if (f?.hz) {
        const err = centsBetween(f.hz, midiToHz(t.midi));
        const p = dataRef.current.per[i];
        p.frames++;
        p.errSum += Math.abs(err);
        if (Math.abs(err) <= dataRef.current.toleranceCents) {
          p.inTune++;
          held += dt;
        } else {
          held = Math.max(0, held - dt * 0.6);
        }
      }
      setHeldMs(held);

      if (held >= need || elapsed >= maxMs) {
        i++;
        if (i >= dataRef.current.targets.length) {
          finish();
          return;
        }
        setIdx(i);
        held = 0;
        elapsed = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, targets]);

  const t = targets[idx];
  const need = (t?.holdSeconds ?? 2) * 1000;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="pill">
          Objetivo {idx + 1} / {targets.length}
        </span>
        <span className="font-display text-lg">
          Canta: <b className="text-brand-soft">{t?.label ?? (t ? midiToLatin(t.midi) : "")}</b>
        </span>
      </div>
      <PitchMeter targetMidi={t?.midi ?? null} toleranceCents={toleranceCents} centerMidi={t?.midi} height={260} />
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-good transition-[width] duration-100" style={{ width: `${clamp((heldMs / need) * 100, 0, 100)}%` }} />
      </div>
      {instructions && <p className="text-white/50 text-xs">{instructions}</p>}
    </div>
  );
}
