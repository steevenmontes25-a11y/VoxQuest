import { useCallback, useEffect, useRef, useState } from "react";
import { micEngine, type MicFrame, type MicStatus } from "./MicEngine";

/**
 * Hook de acceso al motor de microfono.
 *
 * `useMicStatus` es barato (solo re-renderiza en cambios de estado).
 * `useMicFrame` re-renderiza en cada frame de audio -> usarlo solo en
 * componentes ligeros (medidores). Para logica de juego intensiva conviene
 * suscribirse con `micEngine.onFrame` directamente dentro de un efecto.
 */

export function useMicStatus(): MicStatus {
  const [status, setStatus] = useState<MicStatus>(micEngine.status);
  useEffect(() => micEngine.onStatus(setStatus), []);
  return status;
}

export function useMicControls() {
  const enable = useCallback(() => micEngine.enable(), []);
  const disable = useCallback(() => micEngine.disable(), []);
  const calibrate = useCallback((ms?: number) => micEngine.calibrateNoise(ms), []);
  return { enable, disable, calibrate };
}

export function useMicFrame(active = true): MicFrame | null {
  const [frame, setFrame] = useState<MicFrame | null>(micEngine.lastFrame);
  useEffect(() => {
    if (!active) return;
    return micEngine.onFrame(setFrame);
  }, [active]);
  return frame;
}

/**
 * Suscripcion imperativa: entrega cada frame a `cb` sin causar re-render.
 * Ideal para bucles de juego que dibujan en canvas.
 */
export function useFrameSubscription(cb: (f: MicFrame) => void, active = true): void {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!active) return;
    return micEngine.onFrame((f) => ref.current(f));
  }, [active]);
}
