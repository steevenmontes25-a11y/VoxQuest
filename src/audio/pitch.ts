/**
 * Deteccion de tono. Usa `pitchy` (metodo McLeod / MPM: autocorrelacion
 * normalizada + interpolacion parabolica del pico) que da precision sub-cent
 * con senales limpias y una medida de "claridad" util para descartar ruido.
 *
 * Se incluye ademas una implementacion propia de autocorrelacion (ACF) como
 * respaldo y para tests: `autoCorrelate`.
 */

import { PitchDetector } from "pitchy";

export interface PitchResult {
  hz: number;
  clarity: number; // 0..1
}

export class PitchTracker {
  private detector: PitchDetector<Float32Array>;
  private sampleRate: number;
  private minHz: number;
  private maxHz: number;

  constructor(fftSize: number, sampleRate: number, minHz = 65, maxHz = 1400) {
    this.detector = PitchDetector.forFloat32Array(fftSize);
    this.detector.minVolumeDecibels = -34; // ignora frames muy silenciosos
    this.sampleRate = sampleRate;
    this.minHz = minHz;
    this.maxHz = maxHz;
  }

  /** Analiza un buffer de dominio temporal (-1..1). */
  analyze(timeDomain: Float32Array<ArrayBuffer>): PitchResult {
    const [hz, clarity] = this.detector.findPitch(timeDomain, this.sampleRate);
    if (hz < this.minHz || hz > this.maxHz) return { hz: 0, clarity: 0 };
    return { hz, clarity };
  }
}

/** RMS de un buffer temporal (-1..1). */
export function rms(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

/** Convierte una amplitud lineal (0..1) a dBFS aproximados. */
export function linearToDb(x: number): number {
  return 20 * Math.log10(Math.max(x, 1e-8));
}

/**
 * Autocorrelacion normalizada simple. Devuelve frecuencia estimada o 0.
 * Se mantiene para pruebas deterministas con ondas sinusoidales conocidas.
 */
export function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const size = buf.length;
  let rmsVal = 0;
  for (let i = 0; i < size; i++) rmsVal += buf[i] * buf[i];
  rmsVal = Math.sqrt(rmsVal / size);
  if (rmsVal < 0.01) return 0;

  let r1 = 0;
  let r2 = size - 1;
  const threshold = 0.2;
  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buf[i]) < threshold) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < size / 2; i++) {
    if (Math.abs(buf[size - i]) < threshold) {
      r2 = size - i;
      break;
    }
  }
  const trimmed = buf.slice(r1, r2);
  const n = trimmed.length;
  const c = new Float32Array(n).fill(0);
  for (let lag = 0; lag < n; lag++) {
    for (let i = 0; i < n - lag; i++) c[lag] += trimmed[i] * trimmed[i + lag];
  }

  let d = 0;
  while (d < n - 1 && c[d] > c[d + 1]) d++;
  let maxPos = -1;
  let maxVal = -1;
  for (let i = d; i < n; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }
  if (maxPos <= 0) return 0;

  // Interpolacion parabolica alrededor del pico.
  const x1 = c[maxPos - 1];
  const x2 = c[maxPos];
  const x3 = c[maxPos + 1] ?? c[maxPos];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  const shift = a ? -b / (2 * a) : 0;
  const period = maxPos + shift;
  return period > 0 ? sampleRate / period : 0;
}
