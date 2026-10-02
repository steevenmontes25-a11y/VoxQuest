import { useState, type ReactNode } from "react";
import { micEngine } from "../audio/MicEngine";
import { useMicStatus } from "../audio/useMicEngine";
import { useGame } from "../game/store";

/**
 * Puerta de permiso de microfono. Explica por que se necesita ANTES de pedirlo
 * y gestiona todos los estados de error. Solo renderiza `children` cuando el
 * motor esta capturando audio.
 */
export function MicGate({ children }: { children: ReactNode }) {
  const status = useMicStatus();
  const [busy, setBusy] = useState(false);

  if (status === "running") return <>{children}</>;

  const request = async () => {
    setBusy(true);
    await micEngine.enable();
    setBusy(false);
  };

  return (
    <div className="card p-6 max-w-lg mx-auto text-center animate-pop-in">
      <div className="text-5xl mb-3">🎤</div>
      <h2 className="text-xl font-display mb-2">Necesitamos tu microfono</h2>
      <p className="text-white/70 text-sm mb-4">
        VoxQuest analiza tu voz <b>en tu dispositivo</b> para darte feedback de afinacion en tiempo real.
        El audio nunca se envia a ningun servidor.
      </p>

      {status === "denied" && (
        <p className="text-bad text-sm mb-3">
          El permiso fue denegado. Abre los ajustes del sitio en tu navegador, permite el microfono y vuelve a intentarlo.
        </p>
      )}
      {status === "unsupported" && (
        <p className="text-bad text-sm mb-3">
          Este navegador no soporta captura de audio. Prueba con Chrome, Edge o Safari recientes.
        </p>
      )}
      {status === "error" && <p className="text-bad text-sm mb-3">{micEngine.lastError}</p>}

      <button className="btn-primary w-full" onClick={request} disabled={busy || status === "requesting"}>
        {busy || status === "requesting" ? "Solicitando..." : "Activar microfono"}
      </button>
      <p className="text-white/40 text-xs mt-3">
        Consejo: usa auriculares para evitar que el sonido de referencia entre por el micro.
      </p>
    </div>
  );
}

/** Calibracion de ruido ambiente. Guarda el umbral medido en los ajustes. */
export function NoiseCalibration({ onDone }: { onDone?: () => void }) {
  const [phase, setPhase] = useState<"idle" | "measuring" | "done">("idle");
  const [floor, setFloor] = useState<number | null>(null);
  const setSettings = useGame((s) => s.setSettings);

  const run = async () => {
    setPhase("measuring");
    try {
      const res = await micEngine.calibrateNoise(1600);
      setFloor(res.noiseFloorDb);
      setSettings({ noiseFloorDb: res.noiseFloorDb });
      setPhase("done");
      onDone?.();
    } catch {
      setPhase("idle");
    }
  };

  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="text-2xl">🔇</div>
      <div className="flex-1">
        <div className="font-semibold text-sm">Calibrar ruido de fondo</div>
        <div className="text-white/60 text-xs">
          {phase === "idle" && "Quedate en silencio ~1.5 s para ajustar el umbral."}
          {phase === "measuring" && "Midiendo... no hagas ruido."}
          {phase === "done" && floor != null && `Listo. Umbral: ${floor.toFixed(0)} dBFS.`}
        </div>
      </div>
      <button className="btn-ghost text-sm" onClick={run} disabled={phase === "measuring"}>
        {phase === "done" ? "Recalibrar" : "Calibrar"}
      </button>
    </div>
  );
}
