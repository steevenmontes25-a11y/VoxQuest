/**
 * Curriculo de VoxQuest: mundos (unidades) agrupados por modulo.
 * El "arbol de habilidades" del mapa se deriva de `requires`.
 */

export type ModuleKey = "breath" | "pitch" | "theory" | "technique" | "repertoire";

export type ExerciseKind =
  | "breath-pattern" // respiracion guiada por temporizador
  | "breath-candle" // sostener flujo estable (vela virtual)
  | "pitch-sustain" // sostener una nota objetivo
  | "pitch-falling" // notas cayendo estilo piano roll
  | "pitch-echo" // repetir una frase melodica
  | "interval" // cantar un intervalo desde una referencia
  | "scale" // cantar una escala completa
  | "theory-quiz" // mini-juego de teoria
  | "theory-staff" // colocar notas en el pentagrama
  | "theory-rhythm" // completar el compas
  | "technique-registers" // pecho vs cabeza + passaggio
  | "technique-vibrato" // mantener vibrato controlado
  | "song" // cancion completa con karaoke de afinacion
  | "boss"; // reto combinado de fin de unidad

export interface Exercise {
  id: string;
  title: string;
  kind: ExerciseKind;
  module: ModuleKey;
  baseXp: number;
  /** parametros libres consumidos por el reproductor de cada tipo. */
  params?: Record<string, unknown>;
}

export interface Unit {
  id: string;
  module: ModuleKey;
  title: string;
  blurb: string;
  /** unidad que hay que "limpiar" (>=1 estrella en todo) para desbloquear esta. */
  requires?: string;
  exercises: Exercise[];
}

export const MODULE_META: Record<ModuleKey, { label: string; color: string; icon: string; route: string }> = {
  breath: { label: "Respiracion", color: "#22d3ee", icon: "🫁", route: "/m/breath" },
  pitch: { label: "Oido y afinacion", color: "#7c3aed", icon: "🎯", route: "/m/pitch" },
  theory: { label: "Teoria musical", color: "#f59e0b", icon: "🎼", route: "/m/theory" },
  technique: { label: "Tecnica vocal", color: "#22c55e", icon: "🎙️", route: "/m/technique" },
  repertoire: { label: "Repertorio", color: "#ef4444", icon: "🎤", route: "/m/repertoire" }
};

export const CURRICULUM: Unit[] = [
  {
    id: "u-breath-1",
    module: "breath",
    title: "Respiracion diafragmatica",
    blurb: "Aprende a respirar desde el diafragma y a controlar la exhalacion.",
    exercises: [
      {
        id: "ex-breath-478",
        title: "Ciclo 4-7-8",
        kind: "breath-pattern",
        module: "breath",
        baseXp: 40,
        params: { inhale: 4, hold: 7, exhale: 8, cycles: 4 }
      },
      {
        id: "ex-breath-box",
        title: "Respiracion en caja",
        kind: "breath-pattern",
        module: "breath",
        baseXp: 40,
        params: { inhale: 4, hold: 4, exhale: 4, holdOut: 4, cycles: 5 }
      },
      {
        id: "ex-breath-candle",
        title: "La vela virtual",
        kind: "breath-candle",
        module: "breath",
        baseXp: 55,
        params: { targetSeconds: 10 }
      },
      {
        id: "boss-breath-1",
        title: "Jefe: Control total del aire",
        kind: "boss",
        module: "breath",
        baseXp: 120,
        params: { candleSeconds: 15, pattern: { inhale: 4, hold: 6, exhale: 10, cycles: 2 } }
      }
    ]
  },
  {
    id: "u-breath-2",
    module: "breath",
    title: "Aire sostenido",
    blurb: "Amplia el tiempo de fonacion sostenida con \"sss\" y vocales.",
    requires: "u-breath-1",
    exercises: [
      {
        id: "ex-breath-candle-long",
        title: "Vela larga (15 s)",
        kind: "breath-candle",
        module: "breath",
        baseXp: 70,
        params: { targetSeconds: 15 }
      },
      {
        id: "ex-breath-candle-xl",
        title: "Vela maestra (20 s)",
        kind: "breath-candle",
        module: "breath",
        baseXp: 90,
        params: { targetSeconds: 20 }
      }
    ]
  },
  {
    id: "u-pitch-1",
    module: "pitch",
    title: "Primeros tonos",
    blurb: "Empareja tu voz con una nota de referencia y sostenla afinada.",
    exercises: [
      {
        id: "ex-pitch-sustain-1",
        title: "Sostener una nota",
        kind: "pitch-sustain",
        module: "pitch",
        baseXp: 40,
        params: { holdSeconds: 4, targets: 3 }
      },
      {
        id: "ex-pitch-falling-1",
        title: "Notas cayendo I",
        kind: "pitch-falling",
        module: "pitch",
        baseXp: 55,
        params: { pattern: [0, 2, 4, 2, 0, -1, 0], bpm: 60 }
      },
      {
        id: "ex-pitch-echo-1",
        title: "Eco melodico I",
        kind: "pitch-echo",
        module: "pitch",
        baseXp: 55,
        params: { phrase: [0, 2, 4, 5, 4, 2, 0] }
      }
    ]
  },
  {
    id: "u-pitch-2",
    module: "pitch",
    title: "Intervalos",
    blurb: "Canta terceras, quintas y octavas desde una nota dada.",
    requires: "u-pitch-1",
    exercises: [
      { id: "ex-interval-third", title: "Tercera mayor", kind: "interval", module: "pitch", baseXp: 50, params: { semitones: 4 } },
      { id: "ex-interval-fifth", title: "Quinta justa", kind: "interval", module: "pitch", baseXp: 50, params: { semitones: 7 } },
      { id: "ex-interval-octave", title: "Octava", kind: "interval", module: "pitch", baseXp: 50, params: { semitones: 12 } },
      {
        id: "boss-pitch-1",
        title: "Jefe: El desafio del oido",
        kind: "boss",
        module: "pitch",
        baseXp: 140,
        params: { intervals: [4, 7, 12, 5], phrase: [0, 4, 7, 12, 7, 4, 0] }
      }
    ]
  },
  {
    id: "u-pitch-3",
    module: "pitch",
    title: "Escalas",
    blurb: "Recorre escalas mayores, menores y pentatonicas nota a nota.",
    requires: "u-pitch-2",
    exercises: [
      { id: "ex-scale-major", title: "Escala mayor", kind: "scale", module: "pitch", baseXp: 60, params: { scale: "major" } },
      { id: "ex-scale-minor", title: "Escala menor natural", kind: "scale", module: "pitch", baseXp: 60, params: { scale: "naturalMinor" } },
      { id: "ex-scale-penta", title: "Pentatonica mayor", kind: "scale", module: "pitch", baseXp: 60, params: { scale: "pentatonicMajor" } }
    ]
  },
  {
    id: "u-theory-1",
    module: "theory",
    title: "El pentagrama y el ritmo",
    blurb: "Notas, figuras ritmicas y compases simples, todo interactivo.",
    exercises: [
      { id: "ex-theory-staff", title: "Coloca la nota", kind: "theory-staff", module: "theory", baseXp: 35 },
      { id: "ex-theory-rhythm", title: "Completa el compas", kind: "theory-rhythm", module: "theory", baseXp: 35 },
      { id: "ex-theory-quiz-1", title: "Quiz: fundamentos", kind: "theory-quiz", module: "theory", baseXp: 35, params: { set: "basics" } }
    ]
  },
  {
    id: "u-theory-2",
    module: "theory",
    title: "Intervalos y tonalidades",
    blurb: "Identifica intervalos de oido y explora el circulo de quintas.",
    requires: "u-theory-1",
    exercises: [
      { id: "ex-theory-quiz-intervals", title: "Quiz: intervalos", kind: "theory-quiz", module: "theory", baseXp: 45, params: { set: "intervals" } },
      { id: "ex-theory-quiz-keys", title: "Quiz: tonalidades", kind: "theory-quiz", module: "theory", baseXp: 45, params: { set: "keys" } }
    ]
  },
  {
    id: "u-tech-1",
    module: "technique",
    title: "Registros y color",
    blurb: "Voz de pecho, voz de cabeza, el passaggio y un vibrato controlado.",
    requires: "u-pitch-1",
    exercises: [
      { id: "ex-tech-registers", title: "Pecho y cabeza", kind: "technique-registers", module: "technique", baseXp: 60 },
      { id: "ex-tech-vibrato", title: "Vibrato controlado", kind: "technique-vibrato", module: "technique", baseXp: 70, params: { targetHz: 6, seconds: 3 } }
    ]
  },
  {
    id: "u-rep-1",
    module: "repertoire",
    title: "Canciones de practica",
    blurb: "Melodias originales y de dominio publico con karaoke de afinacion.",
    requires: "u-pitch-2",
    exercises: [
      { id: "song-solfeo-1", title: "Solfeo ascendente", kind: "song", module: "repertoire", baseXp: 90, params: { songId: "solfeo-1" } },
      { id: "song-folk-1", title: "Cancion de cuna (dominio publico)", kind: "song", module: "repertoire", baseXp: 90, params: { songId: "lullaby-1" } }
    ]
  }
];

export function allUnits(): Unit[] {
  return CURRICULUM;
}

export function unitsByModule(module: ModuleKey): Unit[] {
  return CURRICULUM.filter((u) => u.module === module);
}

export function findExercise(id: string): { unit: Unit; exercise: Exercise } | null {
  for (const unit of CURRICULUM) {
    const ex = unit.exercises.find((e) => e.id === id);
    if (ex) return { unit, exercise: ex };
  }
  return null;
}

export function unitForExercise(id: string): Unit | null {
  return findExercise(id)?.unit ?? null;
}
