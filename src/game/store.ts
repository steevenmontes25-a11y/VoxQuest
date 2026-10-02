import { useMemo } from "react";
import { create } from "zustand";
import {
  defaultState,
  DIFFICULTY_TOLERANCE,
  type Difficulty,
  type PersistedState,
  type Profile,
  type Settings
} from "./types";
import { loadState, saveState, clearState } from "./persistence";
import { newlyEarned } from "./achievements";
import { levelFromXp, starsFromScore, xpForExercise } from "./xp";
import { CURRICULUM, unitForExercise } from "../data/curriculum";

function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function dayDiff(aISO: string, bISO: string): number {
  const a = new Date(aISO + "T00:00:00Z").getTime();
  const b = new Date(bISO + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86_400_000);
}

export interface RecordArgs {
  exerciseId: string;
  score: number; // 0..1
  baseXp: number;
  metrics?: Record<string, number>;
}

export interface RecordOutcome {
  stars: number;
  xpGained: number;
  leveledUp: boolean;
  newAchievements: string[];
  firstClear: boolean;
}

interface StoreState extends PersistedState {
  hydrated: boolean;
  lastOutcome: RecordOutcome | null;

  hydrate: () => Promise<void>;
  setProfile: (patch: Partial<Profile>) => void;
  completeOnboarding: (p: Partial<Profile>) => void;
  setDifficulty: (d: Difficulty) => void;
  setSettings: (patch: Partial<Settings>) => void;
  touchStreak: () => void;
  recordExercise: (args: RecordArgs) => RecordOutcome;
  addSnapshot: (lowMidi: number, highMidi: number, avgErr: number) => void;
  isUnitUnlocked: (unitId: string) => boolean;
  resetAll: () => Promise<void>;
  dismissOutcome: () => void;
}

function persist(get: () => StoreState) {
  const s = get();
  const snapshot: PersistedState = {
    profile: s.profile,
    totalXp: s.totalXp,
    streak: s.streak,
    results: s.results,
    unlockedUnits: s.unlockedUnits,
    achievements: s.achievements,
    settings: s.settings,
    history: s.history,
    version: 1
  };
  saveState(snapshot);
}

export const useGame = create<StoreState>((set, get) => ({
  ...defaultState(),
  hydrated: false,
  lastOutcome: null,

  hydrate: async () => {
    const saved = await loadState();
    if (saved) set({ ...saved, hydrated: true });
    else set({ hydrated: true });
    get().touchStreak();
  },

  setProfile: (patch) => {
    set((st) => ({ profile: { ...st.profile, ...patch } }));
    persist(get);
  },

  completeOnboarding: (p) => {
    set((st) => ({ profile: { ...st.profile, ...p, onboarded: true } }));
    persist(get);
  },

  setDifficulty: (d) => {
    set((st) => ({
      settings: { ...st.settings, difficulty: d, toleranceCents: DIFFICULTY_TOLERANCE[d] }
    }));
    persist(get);
  },

  setSettings: (patch) => {
    set((st) => ({ settings: { ...st.settings, ...patch } }));
    persist(get);
  },

  touchStreak: () => {
    const { streak } = get();
    const today = todayKey();
    if (streak.lastDayISO === today) return;
    let count = 1;
    if (streak.lastDayISO && dayDiff(streak.lastDayISO, today) === 1) count = streak.count + 1;
    set({
      streak: {
        count,
        lastDayISO: today,
        best: Math.max(streak.best, count)
      }
    });
    persist(get);
  },

  recordExercise: ({ exerciseId, score, baseXp, metrics }) => {
    const st = get();
    const prev = st.results[exerciseId];
    const firstClear = !prev;
    const stars = starsFromScore(score);
    const xpGained = xpForExercise(baseXp, stars, score, firstClear);

    const prevLevel = levelFromXp(st.totalXp).level;
    const totalXp = st.totalXp + xpGained;
    const leveledUp = levelFromXp(totalXp).level > prevLevel;

    const mergedMetrics = { ...(prev?.metrics ?? {}), ...(metrics ?? {}) };
    // Las metricas acumulativas se quedan con el maximo historico.
    for (const k of Object.keys(mergedMetrics)) {
      if (prev?.metrics?.[k] != null) mergedMetrics[k] = Math.max(prev.metrics[k], mergedMetrics[k]);
    }

    const results = {
      ...st.results,
      [exerciseId]: {
        exerciseId,
        stars: Math.max(prev?.stars ?? 0, stars),
        bestScore: Math.max(prev?.bestScore ?? 0, score),
        attempts: (prev?.attempts ?? 0) + 1,
        lastPlayedISO: new Date().toISOString(),
        metrics: mergedMetrics
      }
    };

    // Desbloqueo de unidades: una unidad se abre cuando la anterior de su modulo
    // tiene al menos 1 estrella en todos sus ejercicios base.
    const unlockedUnits = [...st.unlockedUnits];
    for (const unit of CURRICULUM) {
      if (unlockedUnits.includes(unit.id)) continue;
      if (!unit.requires) continue;
      const req = CURRICULUM.find((u) => u.id === unit.requires);
      if (!req) continue;
      const cleared = req.exercises.every((ex) => (results[ex.id]?.stars ?? 0) >= 1);
      if (cleared) unlockedUnits.push(unit.id);
    }

    const draft: PersistedState = {
      ...st,
      totalXp,
      results,
      unlockedUnits,
      version: 1
    };
    const earned = newlyEarned(draft);
    const achievements = [...st.achievements, ...earned];

    const outcome: RecordOutcome = { stars, xpGained, leveledUp, newAchievements: earned, firstClear };
    set({ totalXp, results, unlockedUnits, achievements, lastOutcome: outcome });
    get().touchStreak();
    persist(get);

    void unitForExercise; // referencia usada por otros modulos; evita tree-shake agresivo en dev
    return outcome;
  },

  addSnapshot: (lowMidi, highMidi, avgErr) => {
    set((st) => ({
      history: [
        ...st.history.slice(-59),
        { dateISO: new Date().toISOString(), rangeLowMidi: lowMidi, rangeHighMidi: highMidi, avgPitchErrorCents: avgErr }
      ]
    }));
    persist(get);
  },

  isUnitUnlocked: (unitId) => get().unlockedUnits.includes(unitId),

  resetAll: async () => {
    await clearState();
    set({ ...defaultState(), hydrated: true, lastOutcome: null });
  },

  dismissOutcome: () => set({ lastOutcome: null })
}));

export function useLevel() {
  const totalXp = useGame((s) => s.totalXp);
  return useMemo(() => levelFromXp(totalXp), [totalXp]);
}
