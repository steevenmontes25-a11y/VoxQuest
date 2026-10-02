import { describe, it, expect } from "vitest";
import { levelFromXp, xpForLevel, xpForExercise, starsFromScore } from "./xp";
import { PitchSmoother } from "../audio/smoothing";

describe("xp / niveles", () => {
  it("0 XP = nivel 1", () => {
    expect(levelFromXp(0).level).toBe(1);
  });
  it("el nivel sube de forma monotona con la XP", () => {
    let prev = 0;
    for (let xp = 0; xp < 20_000; xp += 137) {
      const lv = levelFromXp(xp).level;
      expect(lv).toBeGreaterThanOrEqual(prev);
      prev = lv;
    }
  });
  it("xpForLevel es consistente con levelFromXp", () => {
    for (let l = 1; l <= 15; l++) {
      expect(levelFromXp(xpForLevel(l)).level).toBe(l);
    }
  });
  it("mejor rendimiento da mas XP", () => {
    const low = xpForExercise(100, 0, 0.4, false);
    const high = xpForExercise(100, 3, 1, false);
    expect(high).toBeGreaterThan(low);
  });
  it("primera vez otorga bono", () => {
    expect(xpForExercise(100, 2, 0.8, true)).toBeGreaterThan(xpForExercise(100, 2, 0.8, false));
  });
  it("umbrales de estrellas", () => {
    expect(starsFromScore(0.95)).toBe(3);
    expect(starsFromScore(0.8)).toBe(2);
    expect(starsFromScore(0.6)).toBe(1);
    expect(starsFromScore(0.3)).toBe(0);
  });
});

describe("PitchSmoother", () => {
  it("filtra un outlier puntual", () => {
    const s = new PitchSmoother({ medianWindow: 5, emaAlpha: 0.5, minClarity: 0 });
    for (const v of [220, 221, 219, 220, 222]) s.push(v, 1);
    const afterSpike = s.push(880, 1); // salto de octava espurio -> corregido a ~440->/2? ratio 4x -> /...
    expect(afterSpike).toBeGreaterThan(180);
    expect(afterSpike).toBeLessThan(260);
  });
  it("devuelve null con baja claridad", () => {
    const s = new PitchSmoother({ minClarity: 0.6 });
    expect(s.push(440, 0.2)).toBeNull();
  });
  it("corrige salto de octava exacto (x2)", () => {
    const s = new PitchSmoother({ medianWindow: 3, emaAlpha: 1, minClarity: 0 });
    s.push(220, 1);
    s.push(220, 1);
    const r = s.push(440, 1);
    expect(r).toBeLessThan(260);
  });
});
