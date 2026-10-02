export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpola un color entre rojo -> ambar -> verde segun `t` en 0..1 (0 = malo). */
export function scoreColor(t: number): string {
  const c = clamp(t, 0, 1);
  if (c < 0.5) {
    const k = c / 0.5;
    return `rgb(${Math.round(239 + (245 - 239) * k)}, ${Math.round(68 + (158 - 68) * k)}, ${Math.round(68 + (11 - 68) * k)})`;
  }
  const k = (c - 0.5) / 0.5;
  return `rgb(${Math.round(245 + (34 - 245) * k)}, ${Math.round(158 + (197 - 158) * k)}, ${Math.round(11 + (94 - 11) * k)})`;
}
