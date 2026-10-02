/**
 * Sintesis de referencia con Tone.js: notas guia, arpegios, metronomo y
 * cadencias para ambientar tonalidad. Se carga Tone de forma perezosa para
 * no penalizar el arranque.
 */

import * as Tone from "tone";
import { midiToHz } from "../music/notes";

let synth: Tone.PolySynth | null = null;
let metro: Tone.MembraneSynth | null = null;
let started = false;

async function ensureStarted() {
  if (!started) {
    await Tone.start();
    started = true;
  }
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.15, sustain: 0.5, release: 0.4 }
    }).toDestination();
    synth.volume.value = -8;
  }
  if (!metro) {
    metro = new Tone.MembraneSynth().toDestination();
    metro.volume.value = -10;
  }
}

/** Reproduce una nota (MIDI) durante `dur` segundos. */
export async function playNote(midi: number, dur = 0.7): Promise<void> {
  await ensureStarted();
  synth!.triggerAttackRelease(midiToHz(midi), dur);
}

/** Reproduce una secuencia de notas MIDI con separacion `gap`. */
export async function playSequence(midis: number[], noteDur = 0.5, gap = 0.55): Promise<void> {
  await ensureStarted();
  const now = Tone.now();
  midis.forEach((m, i) => {
    synth!.triggerAttackRelease(midiToHz(m), noteDur, now + i * gap);
  });
}

/** Acorde (varias notas simultaneas). */
export async function playChord(midis: number[], dur = 1.2): Promise<void> {
  await ensureStarted();
  synth!.triggerAttackRelease(midis.map(midiToHz), dur);
}

/** Cadencia I-IV-V-I en una tonalidad para fijar el centro tonal en el oido. */
export async function playCadence(tonicMidi: number): Promise<void> {
  await ensureStarted();
  const now = Tone.now();
  const chords = [
    [0, 4, 7],
    [5, 9, 12],
    [7, 11, 14],
    [0, 4, 7]
  ];
  chords.forEach((c, i) => {
    synth!.triggerAttackRelease(
      c.map((s) => midiToHz(tonicMidi + s)),
      0.5,
      now + i * 0.55
    );
  });
}

let metroId: number | null = null;

export async function startMetronome(bpm: number): Promise<void> {
  await ensureStarted();
  stopMetronome();
  Tone.getTransport().bpm.value = bpm;
  metroId = Tone.getTransport().scheduleRepeat((time) => {
    metro!.triggerAttackRelease("C2", 0.05, time);
  }, "4n") as unknown as number;
  Tone.getTransport().start();
}

export function stopMetronome(): void {
  if (metroId != null) {
    Tone.getTransport().clear(metroId);
    metroId = null;
  }
  Tone.getTransport().stop();
}
