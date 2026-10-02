/** Curva de experiencia y calculo de nivel. */

/** XP necesaria para pasar del nivel `level` al siguiente. */
export function xpToNext(level: number): number {
  return Math.round(80 * Math.pow(level, 1.35) + 60);
}

/** XP acumulada total para alcanzar `level` (nivel 1 = 0). */
export function xpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}

export interface LevelState {
  level: number;
  intoLevel: number;
  span: number;
  progress: number; // 0..1
}

export function levelFromXp(totalXp: number): LevelState {
  let level = 1;
  let acc = 0;
  while (acc + xpToNext(level) <= totalXp) {
    acc += xpToNext(level);
    level++;
  }
  const span = xpToNext(level);
  const intoLevel = totalXp - acc;
  return { level, intoLevel, span, progress: span ? intoLevel / span : 0 };
}

/**
 * XP que otorga un ejercicio segun rendimiento.
 * `stars` 0..3, `score` 0..1, `firstClear` da bono unico.
 */
export function xpForExercise(baseXp: number, stars: number, score: number, firstClear: boolean): number {
  const perf = 0.5 + 0.5 * score; // 0.5x .. 1x
  const starBonus = 1 + stars * 0.15; // hasta 1.45x con 3 estrellas
  const first = firstClear ? 1.5 : 1;
  return Math.round(baseXp * perf * starBonus * first);
}

/** Traduce un score 0..1 a estrellas 0..3 con umbrales estandar. */
export function starsFromScore(score: number): number {
  if (score >= 0.9) return 3;
  if (score >= 0.75) return 2;
  if (score >= 0.55) return 1;
  return 0;
}
