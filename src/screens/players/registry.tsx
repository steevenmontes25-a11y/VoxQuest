import type { ComponentType } from "react";
import type { ExerciseKind } from "../../data/curriculum";
import type { PlayerProps } from "./types";
import { BreathPatternPlayer, BreathCandlePlayer } from "./breath";
import { PitchSustainPlayer, IntervalPlayer, ScalePlayer, EchoPlayer, FallingPlayer } from "./pitch";
import { TheoryQuizPlayer, TheoryStaffPlayer, TheoryRhythmPlayer } from "./theory";
import { RegistersPlayer, VibratoPlayer } from "./technique";
import { SongPlayer } from "./song";
import { BossPlayer } from "./boss";

export const PLAYERS: Record<ExerciseKind, ComponentType<PlayerProps>> = {
  "breath-pattern": BreathPatternPlayer,
  "breath-candle": BreathCandlePlayer,
  "pitch-sustain": PitchSustainPlayer,
  "pitch-falling": FallingPlayer,
  "pitch-echo": EchoPlayer,
  interval: IntervalPlayer,
  scale: ScalePlayer,
  "theory-quiz": TheoryQuizPlayer,
  "theory-staff": TheoryStaffPlayer,
  "theory-rhythm": TheoryRhythmPlayer,
  "technique-registers": RegistersPlayer,
  "technique-vibrato": VibratoPlayer,
  song: SongPlayer,
  boss: BossPlayer
};

/** true si el ejercicio necesita microfono activo. */
export function needsMic(kind: ExerciseKind): boolean {
  return kind !== "theory-quiz" && kind !== "theory-staff" && kind !== "theory-rhythm";
}
