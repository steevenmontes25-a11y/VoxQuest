/** Escalas: patrones de semitonos desde la tonica. */

export interface ScaleDef {
  key: string;
  name: string;
  steps: number[]; // semitonos acumulables desde la tonica, incluyendo la octava
}

export const SCALES: Record<string, ScaleDef> = {
  major: { key: "major", name: "Mayor", steps: [0, 2, 4, 5, 7, 9, 11, 12] },
  naturalMinor: { key: "naturalMinor", name: "Menor natural", steps: [0, 2, 3, 5, 7, 8, 10, 12] },
  pentatonicMajor: { key: "pentatonicMajor", name: "Pentatonica mayor", steps: [0, 2, 4, 7, 9, 12] },
  pentatonicMinor: { key: "pentatonicMinor", name: "Pentatonica menor", steps: [0, 3, 5, 7, 10, 12] }
};

/** Devuelve las notas MIDI de una escala a partir de la tonica. */
export function scaleMidiNotes(tonicMidi: number, scaleKey: keyof typeof SCALES, descending = false): number[] {
  const def = SCALES[scaleKey];
  const asc = def.steps.map((s) => tonicMidi + s);
  return descending ? [...asc].reverse() : asc;
}

/** Circulo de quintas empezando en Do, para la leccion de tonalidades. */
export const CIRCLE_OF_FIFTHS = [
  "Do",
  "Sol",
  "Re",
  "La",
  "Mi",
  "Si",
  "Fa#",
  "Do#",
  "Sol#/Lab",
  "Re#/Mib",
  "La#/Sib",
  "Fa"
];
