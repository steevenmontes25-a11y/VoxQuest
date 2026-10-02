import { useMemo, useState } from "react";
import { BreathPatternGuide, CandleGuide, type BreathPattern } from "../../components/BreathingGuide";
import { FallingNotes, type GameNote } from "../../components/FallingNotes";
import { TheoryQuizPlayer } from "./theory";
import { midiToLatin } from "../../music/notes";
import { comfortableTonic, type PlayerProps } from "./types";
import { cn } from "../../lib/cn";

/**
 * Jefe de unidad: reto combinado en 3 etapas (respiracion -> afinacion -> teoria).
 * El puntaje final es el promedio ponderado de las tres.
 */
export function BossPlayer(props: PlayerProps) {
  const { exercise, toleranceCents, rangeLowMidi, rangeHighMidi, running, silentMode, onResult } = props;
  const params = exercise.params ?? {};
  const [stage, setStage] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [perfect, setPerfect] = useState(0);

  const pattern = params.pattern as BreathPattern | undefined;
  const candleSeconds = params.candleSeconds as number | undefined;
  const phrase = (params.phrase as number[]) ?? [0, 4, 7, 12, 7, 4, 0];

  const notes = useMemo<GameNote[]>(() => {
    const tonic = comfortableTonic(rangeLowMidi, rangeHighMidi, Math.max(...phrase) + 2);
    let beat = 0;
    return phrase.map((d) => {
      const n: GameNote = { midi: tonic + d, startBeat: beat, beats: 2, label: midiToLatin(tonic + d) };
      beat += 2;
      return n;
    });
  }, [phrase, rangeLowMidi, rangeHighMidi]);

  const advance = (s: number, perfectNotes = 0) => {
    const next = [...scores, s];
    setScores(next);
    setPerfect((p) => p + perfectNotes);
    if (stage >= 2) {
      const weights = [0.3, 0.45, 0.25];
      const final = next.reduce((a, b, i) => a + b * (weights[i] ?? 0.33), 0);
      onResult({ score: final, metrics: { perfectNotes: perfect + perfectNotes } });
    } else {
      setStage(stage + 1);
    }
  };

  const stages = [
    { key: "breath", label: "Respiracion" },
    { key: "pitch", label: "Afinacion" },
    { key: "theory", label: "Teoria" }
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {stages.map((s, i) => (
          <div
            key={s.key}
            className={cn(
              "flex-1 text-center text-xs py-1.5 rounded-lg",
              i < stage ? "bg-good/25 text-good" : i === stage ? "bg-brand/30 text-white" : "bg-white/5 text-white/40"
            )}
          >
            {i < stage ? "✓ " : ""}
            {s.label}
          </div>
        ))}
      </div>

      {stage === 0 &&
        (pattern ? (
          <BreathPatternGuide pattern={pattern} running={running} onComplete={(sc) => advance(sc)} />
        ) : (
          <CandleGuide targetSeconds={candleSeconds ?? 12} running={running} onComplete={(sc) => advance(sc)} />
        ))}

      {stage === 1 && (
        <FallingNotes
          notes={notes}
          bpm={60}
          toleranceCents={toleranceCents}
          playGuide={!silentMode}
          running={running}
          onComplete={(r) => advance(r.score, r.perfectNotes)}
        />
      )}

      {stage === 2 && (
        <TheoryQuizPlayer
          {...props}
          exercise={{ ...exercise, params: { set: "basics" } }}
          running={running}
          onResult={(r) => advance(r.score)}
        />
      )}
    </div>
  );
}
