/**
 * Canciones de practica. Todo es material ORIGINAL compuesto para la app o
 * melodias tradicionales de dominio publico. No se usan melodias ni letras
 * de canciones comerciales con derechos.
 *
 * Cada nota: grado en semitonos relativo a la tonica de la cancion, duracion
 * en tiempos (beats) y silaba de solfeo/letra para el karaoke.
 */

export interface SongNote {
  degree: number; // semitonos desde la tonica
  beats: number;
  lyric: string;
}

export interface Song {
  id: string;
  title: string;
  origin: string;
  bpm: number;
  tonicName: string; // nota cientifica sugerida como tonica (se adapta al rango)
  notes: SongNote[];
}

export const SONGS: Record<string, Song> = {
  "solfeo-1": {
    id: "solfeo-1",
    title: "Solfeo ascendente",
    origin: "Original de VoxQuest",
    bpm: 72,
    tonicName: "C4",
    notes: [
      { degree: 0, beats: 1, lyric: "Do" },
      { degree: 2, beats: 1, lyric: "Re" },
      { degree: 4, beats: 1, lyric: "Mi" },
      { degree: 5, beats: 1, lyric: "Fa" },
      { degree: 7, beats: 2, lyric: "Sol" },
      { degree: 5, beats: 1, lyric: "Fa" },
      { degree: 4, beats: 1, lyric: "Mi" },
      { degree: 2, beats: 1, lyric: "Re" },
      { degree: 0, beats: 2, lyric: "Do" },
      { degree: 4, beats: 1, lyric: "Mi" },
      { degree: 7, beats: 1, lyric: "Sol" },
      { degree: 12, beats: 2, lyric: "Do" },
      { degree: 7, beats: 1, lyric: "Sol" },
      { degree: 4, beats: 1, lyric: "Mi" },
      { degree: 0, beats: 2, lyric: "Do" }
    ]
  },
  "lullaby-1": {
    id: "lullaby-1",
    title: "Cancion de cuna",
    origin: "Melodia tradicional de dominio publico",
    bpm: 66,
    tonicName: "C4",
    notes: [
      { degree: 0, beats: 1, lyric: "Duer" },
      { degree: 0, beats: 1, lyric: "me" },
      { degree: 7, beats: 1, lyric: "ya" },
      { degree: 7, beats: 1, lyric: "mi" },
      { degree: 9, beats: 1, lyric: "ni" },
      { degree: 9, beats: 1, lyric: "no" },
      { degree: 7, beats: 2, lyric: "duer" },
      { degree: 5, beats: 1, lyric: "me" },
      { degree: 5, beats: 1, lyric: "sin" },
      { degree: 4, beats: 1, lyric: "te" },
      { degree: 4, beats: 1, lyric: "mor" },
      { degree: 2, beats: 1, lyric: "la" },
      { degree: 2, beats: 1, lyric: "no" },
      { degree: 0, beats: 2, lyric: "che" }
    ]
  }
};

export function songById(id: string): Song | null {
  return SONGS[id] ?? null;
}
