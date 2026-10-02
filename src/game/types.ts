export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface Profile {
  name: string;
  onboarded: boolean;
  rangeLowMidi: number | null;
  rangeHighMidi: number | null;
  voiceTypeKey: string | null;
  voiceTypeLabel: string | null;
  experience: "none" | "some" | "choir" | "solo";
  goals: string[]; // "afinacion" | "tecnica" | "teoria" | "repertorio"
}

export interface ExerciseResult {
  exerciseId: string;
  stars: number;
  bestScore: number;
  attempts: number;
  lastPlayedISO: string;
  /** metrica libre por tipo de ejercicio (p.ej. segundos de aire, cents medios). */
  metrics?: Record<string, number>;
}

export interface StreakState {
  count: number;
  lastDayISO: string | null;
  best: number;
}

export interface Settings {
  difficulty: Difficulty;
  /** tolerancia de afinacion en cents (derivada de difficulty pero editable). */
  toleranceCents: number;
  /** modo sin sonido: refuerza feedback visual. */
  silentMode: boolean;
  fontScale: number; // 0.9 .. 1.4
  highContrast: boolean;
  noiseFloorDb: number;
}

export interface ProgressSnapshot {
  /** rango vocal a lo largo del tiempo para graficar evolucion. */
  dateISO: string;
  rangeLowMidi: number;
  rangeHighMidi: number;
  avgPitchErrorCents: number;
}

export interface PersistedState {
  profile: Profile;
  totalXp: number;
  streak: StreakState;
  results: Record<string, ExerciseResult>;
  unlockedUnits: string[];
  achievements: string[];
  settings: Settings;
  history: ProgressSnapshot[];
  version: 1;
}

export const DIFFICULTY_TOLERANCE: Record<Difficulty, number> = {
  beginner: 50,
  intermediate: 25,
  advanced: 10
};

export function defaultState(): PersistedState {
  return {
    profile: {
      name: "",
      onboarded: false,
      rangeLowMidi: null,
      rangeHighMidi: null,
      voiceTypeKey: null,
      voiceTypeLabel: null,
      experience: "none",
      goals: []
    },
    totalXp: 0,
    streak: { count: 0, lastDayISO: null, best: 0 },
    results: {},
    unlockedUnits: ["u-breath-1", "u-pitch-1", "u-theory-1"],
    achievements: [],
    settings: {
      difficulty: "beginner",
      toleranceCents: 50,
      silentMode: false,
      fontScale: 1,
      highContrast: false,
      noiseFloorDb: -70
    },
    history: [],
    version: 1
  };
}
