import type { PersistedState } from "./types";
import { levelFromXp } from "./xp";

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  /** true si ya se cumple con el estado dado. */
  check: (s: PersistedState) => boolean;
}

const totalStars = (s: PersistedState) =>
  Object.values(s.results).reduce((acc, r) => acc + r.stars, 0);

const anyMetricAtLeast = (s: PersistedState, key: string, value: number) =>
  Object.values(s.results).some((r) => (r.metrics?.[key] ?? -Infinity) >= value);

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-note",
    title: "Primera nota perfecta",
    desc: "Canta una nota dentro de la tolerancia.",
    icon: "🎯",
    check: (s) => anyMetricAtLeast(s, "perfectNotes", 1)
  },
  {
    id: "first-exercise",
    title: "Calentando motores",
    desc: "Completa tu primer ejercicio.",
    icon: "🔥",
    check: (s) => Object.keys(s.results).length >= 1
  },
  {
    id: "streak-3",
    title: "Constancia",
    desc: "3 dias seguidos practicando.",
    icon: "📅",
    check: (s) => s.streak.count >= 3 || s.streak.best >= 3
  },
  {
    id: "streak-7",
    title: "Semana de fuego",
    desc: "7 dias seguidos practicando.",
    icon: "⚡",
    check: (s) => s.streak.count >= 7 || s.streak.best >= 7
  },
  {
    id: "level-5",
    title: "Aprendiz de cantante",
    desc: "Alcanza el nivel 5.",
    icon: "⭐",
    check: (s) => levelFromXp(s.totalXp).level >= 5
  },
  {
    id: "level-10",
    title: "Voz en ascenso",
    desc: "Alcanza el nivel 10.",
    icon: "🌟",
    check: (s) => levelFromXp(s.totalXp).level >= 10
  },
  {
    id: "fifth-master",
    title: "Domina la quinta",
    desc: "3 estrellas en el ejercicio de intervalo de 5ta.",
    icon: "🎼",
    check: (s) => (s.results["ex-interval-fifth"]?.stars ?? 0) >= 3
  },
  {
    id: "air-20s",
    title: "Pulmones de acero",
    desc: "Sosten el aire estable 20 segundos.",
    icon: "🫁",
    check: (s) => anyMetricAtLeast(s, "airSeconds", 20)
  },
  {
    id: "stars-15",
    title: "Coleccionista",
    desc: "Acumula 15 estrellas.",
    icon: "✨",
    check: (s) => totalStars(s) >= 15
  },
  {
    id: "boss-1",
    title: "Cazador de jefes",
    desc: "Supera tu primer jefe de unidad.",
    icon: "👑",
    check: (s) => Object.keys(s.results).some((id) => id.startsWith("boss-"))
  },
  {
    id: "vibrato",
    title: "Vibrato controlado",
    desc: "Manten un vibrato de 5-7 Hz durante 3 s.",
    icon: "〰️",
    check: (s) => anyMetricAtLeast(s, "vibratoSeconds", 3)
  },
  {
    id: "song-clear",
    title: "Primera cancion",
    desc: "Completa una cancion en el modo repertorio.",
    icon: "🎤",
    check: (s) => Object.keys(s.results).some((id) => id.startsWith("song-"))
  }
];

/** Devuelve los ids de logros recien cumplidos que aun no estaban en `s.achievements`. */
export function newlyEarned(s: PersistedState): string[] {
  return ACHIEVEMENTS.filter((a) => !s.achievements.includes(a.id) && a.check(s)).map((a) => a.id);
}
