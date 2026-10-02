/**
 * Utilidades de teoria musical: conversion frecuencia <-> nota, cents, MIDI.
 * Referencia de afinacion: A4 = 440 Hz (MIDI 69).
 */

export const A4_HZ = 440;
export const A4_MIDI = 69;

export const NOTE_NAMES_SHARP = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B"
] as const;

/** Nombres en notacion latina (Do Re Mi) para la UI en espanol. */
export const NOTE_NAMES_LATIN = [
  "Do",
  "Do#",
  "Re",
  "Re#",
  "Mi",
  "Fa",
  "Fa#",
  "Sol",
  "Sol#",
  "La",
  "La#",
  "Si"
] as const;

export interface NoteInfo {
  /** Nota MIDI redondeada mas cercana. */
  midi: number;
  /** Nombre cientifico, p.ej. "A4". */
  name: string;
  /** Nombre en notacion latina, p.ej. "La4". */
  latin: string;
  /** Desviacion respecto a la nota temperada, en cents (-50..+50). */
  cents: number;
  /** Frecuencia exacta de la nota temperada mas cercana. */
  exactHz: number;
}

/** Frecuencia (Hz) de una nota MIDI. */
export function midiToHz(midi: number): number {
  return A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/** Nota MIDI (float, sin redondear) de una frecuencia. */
export function hzToMidiFloat(hz: number): number {
  return A4_MIDI + 12 * Math.log2(hz / A4_HZ);
}

/** Nombre cientifico de una nota MIDI entera (C4 = 60). */
export function midiToName(midi: number): string {
  const n = Math.round(midi);
  const octave = Math.floor(n / 12) - 1;
  return `${NOTE_NAMES_SHARP[((n % 12) + 12) % 12]}${octave}`;
}

/** Nombre latino de una nota MIDI entera. */
export function midiToLatin(midi: number): string {
  const n = Math.round(midi);
  const octave = Math.floor(n / 12) - 1;
  return `${NOTE_NAMES_LATIN[((n % 12) + 12) % 12]}${octave}`;
}

/** Convierte un nombre cientifico ("A4", "C#3") a nota MIDI. */
export function nameToMidi(name: string): number {
  const m = /^([A-Ga-g])(#|b)?(-?\d+)$/.exec(name.trim());
  if (!m) throw new Error(`Nombre de nota invalido: ${name}`);
  const letter = m[1].toUpperCase();
  const accidental = m[2];
  const octave = parseInt(m[3], 10);
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let semis = base[letter];
  if (accidental === "#") semis += 1;
  if (accidental === "b") semis -= 1;
  return semis + (octave + 1) * 12;
}

/** Analiza una frecuencia y devuelve nota, cents y frecuencia temperada. */
export function analyzeFrequency(hz: number): NoteInfo {
  const midiFloat = hzToMidiFloat(hz);
  const midi = Math.round(midiFloat);
  const cents = (midiFloat - midi) * 100;
  return {
    midi,
    name: midiToName(midi),
    latin: midiToLatin(midi),
    cents,
    exactHz: midiToHz(midi)
  };
}

/** Diferencia en cents entre dos frecuencias (positivo = f1 mas aguda). */
export function centsBetween(f1: number, f2: number): number {
  return 1200 * Math.log2(f1 / f2);
}

/**
 * Puntaje de afinacion 0..1 a partir del error absoluto en cents.
 * `tolerance` es el error (en cents) que aun cuenta como "perfecto".
 * A partir de `tolerance` la puntuacion decae de forma suave hasta 0 en 200 cents.
 */
export function pitchScore(errorCents: number, tolerance: number): number {
  const e = Math.abs(errorCents);
  if (e <= tolerance) return 1;
  const decayRange = 200 - tolerance;
  if (decayRange <= 0) return e <= tolerance ? 1 : 0;
  const t = (e - tolerance) / decayRange;
  return Math.max(0, 1 - t);
}

/** Clasifica el tipo de voz (orientativo) a partir del rango en notas MIDI. */
export interface VoiceType {
  key: "bass" | "baritone" | "tenor" | "contralto" | "mezzo" | "soprano";
  label: string;
}

export function classifyVoice(lowMidi: number, highMidi: number): VoiceType {
  const center = (lowMidi + highMidi) / 2;
  // Centros aproximados por tesitura (MIDI): bajo ~E2-E4, baritono ~A2-A4,
  // tenor ~C3-C5, contralto ~F3-F5, mezzo ~A3-A5, soprano ~C4-C6.
  const ranges: Array<[VoiceType["key"], string, number]> = [
    ["bass", "Bajo", nameToMidi("A2")],
    ["baritone", "Baritono", nameToMidi("D3")],
    ["tenor", "Tenor", nameToMidi("G3")],
    ["contralto", "Contralto", nameToMidi("A3")],
    ["mezzo", "Mezzosoprano", nameToMidi("C4")],
    ["soprano", "Soprano", nameToMidi("E4")]
  ];
  let best = ranges[0];
  let bestDist = Infinity;
  for (const r of ranges) {
    const d = Math.abs(center - r[2]);
    if (d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return { key: best[0], label: best[1] };
}
