/** Definiciones de intervalos musicales (en semitonos) con nombres en espanol. */

export interface Interval {
  semitones: number;
  name: string;
  short: string;
}

export const INTERVALS: Interval[] = [
  { semitones: 0, name: "Unisono", short: "1J" },
  { semitones: 1, name: "Segunda menor", short: "2m" },
  { semitones: 2, name: "Segunda mayor", short: "2M" },
  { semitones: 3, name: "Tercera menor", short: "3m" },
  { semitones: 4, name: "Tercera mayor", short: "3M" },
  { semitones: 5, name: "Cuarta justa", short: "4J" },
  { semitones: 6, name: "Tritono", short: "TT" },
  { semitones: 7, name: "Quinta justa", short: "5J" },
  { semitones: 8, name: "Sexta menor", short: "6m" },
  { semitones: 9, name: "Sexta mayor", short: "6M" },
  { semitones: 10, name: "Septima menor", short: "7m" },
  { semitones: 11, name: "Septima mayor", short: "7M" },
  { semitones: 12, name: "Octava justa", short: "8J" }
];

export function intervalBySemitones(semitones: number): Interval {
  const found = INTERVALS.find((i) => i.semitones === Math.abs(semitones));
  return found ?? { semitones: Math.abs(semitones), name: `${Math.abs(semitones)} semitonos`, short: `${semitones}` };
}
