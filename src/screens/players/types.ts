import type { Exercise, Unit } from "../../data/curriculum";

export interface PlayerResult {
  score: number; // 0..1
  metrics?: Record<string, number>;
}

export interface PlayerProps {
  exercise: Exercise;
  unit: Unit;
  toleranceCents: number;
  rangeLowMidi: number;
  rangeHighMidi: number;
  running: boolean;
  silentMode: boolean;
  onResult: (r: PlayerResult) => void;
}

/** Elige una tonica comoda para el usuario dentro de su rango. */
export function comfortableTonic(low: number, high: number, span = 12): number {
  const mid = (low + high) / 2;
  // deja espacio hacia arriba para el `span`
  return Math.round(Math.min(mid - 2, high - span - 1, mid));
}
