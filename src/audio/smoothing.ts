/**
 * Suavizado de la senal de pitch.
 *
 * El detector devuelve una frecuencia por frame (~cada 20-45 ms). Esa serie
 * tiene dos problemas: (1) ruido de alta frecuencia que hace "parpadear" la UI
 * y (2) saltos de octava esporadicos (el detector engancha un armonico).
 *
 * Estrategia:
 *  - Ventana de mediana corta -> elimina outliers puntuales sin arrastrar retraso.
 *  - Rechazo de salto de octava: si la nueva lectura esta a ~1200 +/- 60 cents
 *    de la lectura estable previa, se corrige dividiendo/multiplicando por 2.
 *  - EMA (media exponencial) final -> continuidad visual. alpha alto => menos
 *    retraso pero mas nervioso; alpha bajo => suave pero perezoso.
 */

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface SmootherOptions {
  medianWindow?: number;
  emaAlpha?: number;
  /** Debajo de esta claridad (0..1) el frame se ignora. */
  minClarity?: number;
  /** Corrige saltos de octava cuando la lectura cruda esta cerca de x2 o /2. */
  fixOctaveJumps?: boolean;
}

export class PitchSmoother {
  private window: number[] = [];
  private ema: number | null = null;
  private lastStableHz: number | null = null;
  private opts: Required<SmootherOptions>;

  constructor(options: SmootherOptions = {}) {
    this.opts = {
      medianWindow: options.medianWindow ?? 5,
      emaAlpha: options.emaAlpha ?? 0.35,
      minClarity: options.minClarity ?? 0.6,
      fixOctaveJumps: options.fixOctaveJumps ?? true
    };
  }

  reset(): void {
    this.window = [];
    this.ema = null;
    this.lastStableHz = null;
  }

  /**
   * Procesa un frame. Devuelve la frecuencia suavizada o `null` si no hay
   * tono fiable (silencio o senal poco clara).
   */
  push(rawHz: number, clarity: number): number | null {
    if (!Number.isFinite(rawHz) || rawHz <= 0 || clarity < this.opts.minClarity) {
      // Decaimiento suave del historial para no "congelar" la ultima nota.
      if (this.window.length) this.window.shift();
      if (!this.window.length) {
        this.ema = null;
        this.lastStableHz = null;
        return null;
      }
      return this.ema;
    }

    let hz = rawHz;
    if (this.opts.fixOctaveJumps && this.lastStableHz) {
      const ratio = hz / this.lastStableHz;
      if (ratio > 1.8 && ratio < 2.2) hz /= 2;
      else if (ratio > 0.45 && ratio < 0.56) hz *= 2;
      else if (ratio > 2.7 && ratio < 3.3) hz /= 3;
    }

    this.window.push(hz);
    if (this.window.length > this.opts.medianWindow) this.window.shift();
    const med = median(this.window);
    this.lastStableHz = med;

    this.ema = this.ema == null ? med : this.opts.emaAlpha * med + (1 - this.opts.emaAlpha) * this.ema;
    return this.ema;
  }
}
