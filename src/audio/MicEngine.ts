/**
 * MicEngine: captura de microfono y analisis de tono en tiempo real.
 *
 * Diseno:
 *  - Singleton (`micEngine`) porque solo puede haber un flujo de microfono
 *    activo y todas las pantallas comparten el mismo motor.
 *  - Todo el DSP ocurre en el dispositivo. Nunca se envia audio a un servidor.
 *  - Bucle de analisis con requestAnimationFrame: en cada frame se leen las
 *    muestras del dominio temporal del AnalyserNode, se estima el tono con
 *    `PitchTracker` (MPM), se calcula el RMS y se suaviza la serie de tono.
 *  - Latencia: con fftSize 2048 y 48 kHz la ventana es ~43 ms; el suavizado
 *    anade ~1-2 frames. Latencia percibida total ~50-80 ms.
 *  - Politica de autoplay: `AudioContext` puede nacer "suspended"; `enable()`
 *    debe llamarse desde un gesto del usuario y hace `resume()`.
 */

import { analyzeFrequency, type NoteInfo } from "../music/notes";
import { PitchTracker, rms, linearToDb } from "./pitch";
import { PitchSmoother } from "./smoothing";

export interface MicFrame {
  /** Timestamp de alta resolucion (ms). */
  t: number;
  /** Frecuencia suavizada en Hz, o null si no hay tono fiable. */
  hz: number | null;
  /** Frecuencia cruda del detector (sin suavizar), Hz. */
  rawHz: number;
  /** Claridad del detector 0..1. */
  clarity: number;
  /** Nivel RMS lineal 0..1. */
  rms: number;
  /** Nivel en dBFS aprox. */
  db: number;
  /** true si el nivel supera el ruido de fondo calibrado + margen. */
  voiced: boolean;
  /** Info de nota (solo si hz != null). */
  note: NoteInfo | null;
}

export type MicListener = (frame: MicFrame) => void;
export type MicStatus = "idle" | "requesting" | "running" | "denied" | "error" | "unsupported";

export interface CalibrationResult {
  noiseFloorDb: number;
  noiseRms: number;
}

class MicEngine {
  status: MicStatus = "idle";
  lastError: string | null = null;

  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private tracker: PitchTracker | null = null;
  private smoother = new PitchSmoother();
  private buf: Float32Array<ArrayBuffer> = new Float32Array(new ArrayBuffer(2048 * 4));
  private raf = 0;
  private listeners = new Set<MicListener>();
  private statusListeners = new Set<(s: MicStatus) => void>();

  private noiseFloorDb = -70;
  private noiseMarginDb = 12;

  /** ultimo frame emitido (util para lecturas puntuales). */
  lastFrame: MicFrame | null = null;

  get isRunning(): boolean {
    return this.status === "running";
  }

  onFrame(fn: MicListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onStatus(fn: (s: MicStatus) => void): () => void {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }

  private setStatus(s: MicStatus) {
    this.status = s;
    this.statusListeners.forEach((fn) => fn(s));
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  /** Debe invocarse desde un gesto del usuario (click/tap). */
  async enable(): Promise<boolean> {
    if (this.status === "running") return true;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      this.setStatus("unsupported");
      this.lastError = "Este navegador no soporta captura de microfono.";
      return false;
    }
    this.setStatus("requesting");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1
        }
      });
    } catch (err) {
      const e = err as DOMException;
      if (e.name === "NotAllowedError" || e.name === "SecurityError") {
        this.setStatus("denied");
        this.lastError = "Permiso de microfono denegado.";
      } else if (e.name === "NotFoundError") {
        this.setStatus("error");
        this.lastError = "No se encontro ningun microfono.";
      } else {
        this.setStatus("error");
        this.lastError = e.message || "Error al abrir el microfono.";
      }
      return false;
    }

    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    if (this.ctx.state === "suspended") await this.ctx.resume();

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;
    this.buf = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));
    this.source.connect(this.analyser);
    // Nota: el analyser NO se conecta al destino -> no hay eco/realimentacion.

    this.tracker = new PitchTracker(this.analyser.fftSize, this.ctx.sampleRate);
    this.smoother.reset();

    this.setStatus("running");
    this.loop();
    return true;
  }

  disable(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.ctx = null;
    this.stream = null;
    this.source = null;
    this.analyser = null;
    this.tracker = null;
    this.lastFrame = null;
    this.setStatus("idle");
  }

  /**
   * Mide el ruido de fondo durante `ms` milisegundos (pedir silencio al usuario)
   * y fija el umbral de deteccion. Devuelve el nivel medido.
   */
  async calibrateNoise(ms = 1500): Promise<CalibrationResult> {
    if (!this.analyser) throw new Error("Microfono no iniciado");
    const samples: number[] = [];
    const start = performance.now();
    return new Promise((resolve) => {
      const step = () => {
        this.analyser!.getFloatTimeDomainData(this.buf);
        samples.push(rms(this.buf));
        if (performance.now() - start < ms) {
          requestAnimationFrame(step);
        } else {
          samples.sort((a, b) => a - b);
          // Percentil 80 del ruido para ser conservadores.
          const p80 = samples[Math.floor(samples.length * 0.8)] || 1e-4;
          this.noiseFloorDb = linearToDb(p80);
          resolve({ noiseFloorDb: this.noiseFloorDb, noiseRms: p80 });
        }
      };
      requestAnimationFrame(step);
    });
  }

  setNoiseFloorDb(db: number): void {
    this.noiseFloorDb = db;
  }

  private loop = (): void => {
    if (!this.analyser || !this.tracker) return;
    this.analyser.getFloatTimeDomainData(this.buf);

    const level = rms(this.buf);
    const db = linearToDb(level);
    const voiced = db > this.noiseFloorDb + this.noiseMarginDb;

    let rawHz = 0;
    let clarity = 0;
    if (voiced) {
      const res = this.tracker.analyze(this.buf);
      rawHz = res.hz;
      clarity = res.clarity;
    }

    const smoothHz = voiced ? this.smoother.push(rawHz, clarity) : this.smoother.push(0, 0);
    const frame: MicFrame = {
      t: performance.now(),
      hz: smoothHz,
      rawHz,
      clarity,
      rms: level,
      db,
      voiced,
      note: smoothHz ? analyzeFrequency(smoothHz) : null
    };
    this.lastFrame = frame;
    this.listeners.forEach((fn) => fn(frame));
    this.raf = requestAnimationFrame(this.loop);
  };
}

export const micEngine = new MicEngine();
