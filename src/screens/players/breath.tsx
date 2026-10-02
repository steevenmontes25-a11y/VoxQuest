import { BreathPatternGuide, CandleGuide, type BreathPattern } from "../../components/BreathingGuide";
import type { PlayerProps } from "./types";

export function BreathPatternPlayer({ exercise, running, onResult }: PlayerProps) {
  const p = exercise.params as unknown as BreathPattern;
  return <BreathPatternGuide pattern={p} running={running} onComplete={(score, metrics) => onResult({ score, metrics })} />;
}

export function BreathCandlePlayer({ exercise, running, onResult }: PlayerProps) {
  const target = (exercise.params?.targetSeconds as number) ?? 10;
  return <CandleGuide targetSeconds={target} running={running} onComplete={(score, metrics) => onResult({ score, metrics })} />;
}
