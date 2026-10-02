import { describe, it, expect } from "vitest";
import { midiToHz, hzToMidiFloat, nameToMidi, midiToName, centsBetween, pitchScore, classifyVoice } from "./notes";

describe("conversiones de nota", () => {
  it("A4 = MIDI 69 = 440 Hz", () => {
    expect(nameToMidi("A4")).toBe(69);
    expect(midiToHz(69)).toBeCloseTo(440, 5);
    expect(midiToName(69)).toBe("A4");
  });
  it("C4 = MIDI 60 (Do central)", () => {
    expect(nameToMidi("C4")).toBe(60);
    expect(midiToName(60)).toBe("C4");
  });
  it("round-trip hz -> midi -> hz", () => {
    for (const m of [40, 55, 60, 69, 72, 84]) {
      expect(hzToMidiFloat(midiToHz(m))).toBeCloseTo(m, 6);
    }
  });
  it("nameToMidi soporta sostenidos y bemoles", () => {
    expect(nameToMidi("C#4")).toBe(61);
    expect(nameToMidi("Db4")).toBe(61);
  });
});

describe("centsBetween", () => {
  it("una octava son 1200 cents", () => {
    expect(centsBetween(880, 440)).toBeCloseTo(1200, 3);
  });
  it("un semitono son 100 cents", () => {
    expect(centsBetween(midiToHz(61), midiToHz(60))).toBeCloseTo(100, 3);
  });
});

describe("pitchScore", () => {
  it("da 1 dentro de la tolerancia y decae fuera", () => {
    expect(pitchScore(0, 10)).toBe(1);
    expect(pitchScore(10, 10)).toBe(1);
    expect(pitchScore(105, 10)).toBeCloseTo(0.5, 1);
    expect(pitchScore(210, 10)).toBe(0);
  });
});

describe("classifyVoice", () => {
  it("un rango grave se clasifica como bajo/baritono", () => {
    const v = classifyVoice(nameToMidi("E2"), nameToMidi("E4"));
    expect(["bass", "baritone"]).toContain(v.key);
  });
  it("un rango agudo se clasifica como mezzo/soprano", () => {
    const v = classifyVoice(nameToMidi("C4"), nameToMidi("C6"));
    expect(["mezzo", "soprano"]).toContain(v.key);
  });
});
