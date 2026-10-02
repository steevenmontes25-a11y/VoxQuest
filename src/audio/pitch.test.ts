import { describe, it, expect } from "vitest";
import { PitchDetector } from "pitchy";
import { autoCorrelate } from "./pitch";
import { analyzeFrequency } from "../music/notes";

const SR = 48_000;

function sine(freq: number, n: number, sr = SR): Float32Array {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) b[i] = Math.sin((2 * Math.PI * freq * i) / sr);
  return b;
}

/** Onda con 2 armonicos (mas parecida a una voz). */
function voiceLike(freq: number, n: number, sr = SR): Float32Array {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    b[i] =
      0.6 * Math.sin(2 * Math.PI * freq * t) +
      0.3 * Math.sin(2 * Math.PI * 2 * freq * t) +
      0.1 * Math.sin(2 * Math.PI * 3 * freq * t);
  }
  return b;
}

describe("autoCorrelate", () => {
  it("detecta A4 (440 Hz) con error < 5 cents", () => {
    const buf = sine(440, 4096);
    const est = autoCorrelate(buf, SR);
    const cents = 1200 * Math.log2(est / 440);
    expect(Math.abs(cents)).toBeLessThan(5);
  });

  it("detecta un rango de notas cantables con error < 10 cents", () => {
    for (const f of [110, 146.83, 220, 329.63, 523.25, 659.25]) {
      const est = autoCorrelate(voiceLike(f, 4096), SR);
      const cents = 1200 * Math.log2(est / f);
      expect(Math.abs(cents), `${f} Hz -> ${est.toFixed(2)} Hz`).toBeLessThan(10);
    }
  });
});

describe("pitchy (MPM) - motor real", () => {
  it("estima la frecuencia con precision sub-10-cents y buena claridad", () => {
    const size = 2048;
    const det = PitchDetector.forFloat32Array(size);
    for (const f of [130.81, 196, 261.63, 392, 440]) {
      const [hz, clarity] = det.findPitch(voiceLike(f, size), SR);
      const cents = 1200 * Math.log2(hz / f);
      expect(Math.abs(cents), `${f} Hz`).toBeLessThan(10);
      expect(clarity).toBeGreaterThan(0.8);
    }
  });
});

describe("analyzeFrequency", () => {
  it("mapea 440 Hz a A4 con ~0 cents", () => {
    const n = analyzeFrequency(440);
    expect(n.name).toBe("A4");
    expect(Math.abs(n.cents)).toBeLessThan(1);
  });
  it("detecta desviacion de +30 cents dentro de la misma nota", () => {
    const n = analyzeFrequency(440 * Math.pow(2, 30 / 1200));
    expect(n.name).toBe("A4");
    expect(n.cents).toBeGreaterThan(25);
    expect(n.cents).toBeLessThan(35);
  });

  it("a +50 cents cae en el limite y redondea a la nota superior", () => {
    const n = analyzeFrequency(440 * Math.pow(2, 51 / 1200));
    expect(n.name).toBe("A#4");
    expect(n.cents).toBeLessThan(-45);
  });
});
