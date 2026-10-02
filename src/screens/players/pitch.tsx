import { useMemo, useState } from "react";
import { SingTargets, type SingTarget } from "./SingTargets";
import { FallingNotes, type GameNote } from "../../components/FallingNotes";
import { playNote, playSequence, playCadence } from "../../audio/synth";
import { midiToLatin } from "../../music/notes";
import { scaleMidiNotes, SCALES } from "../../music/scales";
import { intervalBySemitones } from "../../music/intervals";
import { comfortableTonic, type PlayerProps } from "./types";

/* Sostener notas: 3 objetivos aleatorios comodos. */
export function PitchSustainPlayer({ exercise, toleranceCents, rangeLowMidi, rangeHighMidi, running, silentMode, onResult }: PlayerProps) {
  const hold = (exercise.params?.holdSeconds as number) ?? 4;
  const count = (exercise.params?.targets as number) ?? 3;
  const targets = useMemo<SingTarget[]>(() => {
    const lo = Math.round(rangeLowMidi + 2);
    const hi = Math.round(rangeHighMidi - 2);
    const arr: SingTarget[] = [];
    for (let i = 0; i < count; i++) {
      const m = lo + Math.round(Math.random() * Math.max(1, hi - lo));
      arr.push({ midi: m, label: midiToLatin(m), holdSeconds: hold });
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id, count, hold]);

  return (
    <div className="space-y-3">
      {!silentMode && (
        <button className="btn-ghost text-sm" onClick={() => playNote(targets[0].midi)}>
          🔊 Escuchar primera nota
        </button>
      )}
      <SingTargets
        targets={targets}
        toleranceCents={toleranceCents}
        running={running}
        onComplete={(r) => onResult({ score: r.score, metrics: { perfectNotes: r.perfectNotes, avgErrorCents: Math.round(r.avgErrorCents) } })}
        instructions="Manten la nota afinada; la barra verde se llena cuando la clavas."
      />
    </div>
  );
}

/* Intervalo: referencia + nota destino a `semitones`. */
export function IntervalPlayer({ exercise, toleranceCents, rangeLowMidi, rangeHighMidi, running, silentMode, onResult }: PlayerProps) {
  const semis = (exercise.params?.semitones as number) ?? 7;
  const info = intervalBySemitones(semis);
  const ref = useMemo(() => comfortableTonic(rangeLowMidi, rangeHighMidi, semis + 2), [rangeLowMidi, rangeHighMidi, semis]);
  const targets: SingTarget[] = [
    { midi: ref, label: `${midiToLatin(ref)} (referencia)`, holdSeconds: 2 },
    { midi: ref + semis, label: `${midiToLatin(ref + semis)} (${info.name})`, holdSeconds: 2.5 }
  ];
  return (
    <div className="space-y-3">
      <div className="card p-3 text-sm">
        Vas a cantar una <b>{info.name}</b> ({info.short}). Primero repite la nota de referencia, luego sube al intervalo.
      </div>
      {!silentMode && (
        <div className="flex gap-2">
          <button className="btn-ghost text-sm" onClick={() => playNote(ref)}>
            🔊 Referencia
          </button>
          <button className="btn-ghost text-sm" onClick={() => playSequence([ref, ref + semis], 0.6, 0.7)}>
            🔊 Intervalo completo
          </button>
        </div>
      )}
      <SingTargets
        targets={targets}
        toleranceCents={toleranceCents}
        running={running}
        onComplete={(r) => onResult({ score: r.score, metrics: { perfectNotes: r.perfectNotes, avgErrorCents: Math.round(r.avgErrorCents) } })}
      />
    </div>
  );
}

/* Escala completa ascendente y descendente. */
export function ScalePlayer({ exercise, toleranceCents, rangeLowMidi, rangeHighMidi, running, silentMode, onResult }: PlayerProps) {
  const scaleKey = (exercise.params?.scale as keyof typeof SCALES) ?? "major";
  const tonic = useMemo(() => comfortableTonic(rangeLowMidi, rangeHighMidi, 12), [rangeLowMidi, rangeHighMidi]);
  const notes = useMemo(() => {
    const asc = scaleMidiNotes(tonic, scaleKey);
    const desc = [...asc].slice(0, -1).reverse();
    return [...asc, ...desc];
  }, [tonic, scaleKey]);
  const targets: SingTarget[] = notes.map((m) => ({ midi: m, label: midiToLatin(m), holdSeconds: 1.2 }));
  return (
    <div className="space-y-3">
      <div className="card p-3 text-sm">
        Escala <b>{SCALES[scaleKey].name}</b> desde {midiToLatin(tonic)}. Sube y baja nota por nota.
      </div>
      {!silentMode && (
        <div className="flex gap-2">
          <button className="btn-ghost text-sm" onClick={() => playCadence(tonic)}>
            🔊 Cadencia (fija el tono)
          </button>
          <button className="btn-ghost text-sm" onClick={() => playSequence(notes, 0.32, 0.36)}>
            🔊 Escala modelo
          </button>
        </div>
      )}
      <SingTargets
        targets={targets}
        toleranceCents={toleranceCents}
        running={running}
        onComplete={(r) => onResult({ score: r.score, metrics: { perfectNotes: r.perfectNotes, avgErrorCents: Math.round(r.avgErrorCents) } })}
      />
    </div>
  );
}

/* Eco: la app toca una frase; el usuario la repite. */
export function EchoPlayer({ exercise, toleranceCents, rangeLowMidi, rangeHighMidi, running, silentMode, onResult }: PlayerProps) {
  const phrase = (exercise.params?.phrase as number[]) ?? [0, 2, 4, 5, 4, 2, 0];
  const tonic = useMemo(() => comfortableTonic(rangeLowMidi, rangeHighMidi, Math.max(...phrase) + 2), [rangeLowMidi, rangeHighMidi, phrase]);
  const midis = phrase.map((d) => tonic + d);
  const [played, setPlayed] = useState(false);
  const targets: SingTarget[] = midis.map((m) => ({ midi: m, label: midiToLatin(m), holdSeconds: 1 }));

  return (
    <div className="space-y-3">
      <div className="card p-3 text-sm">Escucha la frase y repitela nota por nota.</div>
      {!silentMode && (
        <button
          className="btn-primary text-sm"
          onClick={async () => {
            await playSequence(midis, 0.4, 0.45);
            setPlayed(true);
          }}
        >
          🔊 {played ? "Escuchar de nuevo" : "Escuchar frase"}
        </button>
      )}
      <SingTargets
        targets={targets}
        toleranceCents={toleranceCents}
        running={running}
        onComplete={(r) => onResult({ score: r.score, metrics: { perfectNotes: r.perfectNotes, avgErrorCents: Math.round(r.avgErrorCents) } })}
      />
    </div>
  );
}

/* Notas cayendo. */
export function FallingPlayer({ exercise, toleranceCents, rangeLowMidi, rangeHighMidi, running, silentMode, onResult }: PlayerProps) {
  const pattern = (exercise.params?.pattern as number[]) ?? [0, 2, 4, 2, 0];
  const bpm = (exercise.params?.bpm as number) ?? 60;
  const tonic = useMemo(
    () => comfortableTonic(rangeLowMidi, rangeHighMidi, Math.max(...pattern) - Math.min(...pattern) + 2),
    [rangeLowMidi, rangeHighMidi, pattern]
  );
  const notes = useMemo<GameNote[]>(() => {
    let beat = 0;
    return pattern.map((d) => {
      const n: GameNote = { midi: tonic + d, startBeat: beat, beats: 2, label: midiToLatin(tonic + d) };
      beat += 2;
      return n;
    });
  }, [pattern, tonic]);

  return (
    <FallingNotes
      notes={notes}
      bpm={bpm}
      toleranceCents={toleranceCents}
      playGuide={!silentMode}
      running={running}
      onComplete={(r) =>
        onResult({
          score: r.score,
          metrics: { perfectNotes: r.perfectNotes, maxCombo: r.maxCombo, hitRatio: Math.round(r.hitRatio * 100) }
        })
      }
    />
  );
}
