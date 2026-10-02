import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../game/store";
import { useAuth } from "../game/authStore";
import { DIFFICULTY_TOLERANCE, type Difficulty } from "../game/types";
import { MicGate, NoiseCalibration } from "../components/MicGate";
import { VocalRangeTest } from "./VocalRangeTest";
import { micEngine } from "../audio/MicEngine";
import { useMicStatus } from "../audio/useMicEngine";
import { midiToLatin } from "../music/notes";

export function Settings() {
  const s = useGame();
  const navigate = useNavigate();
  const auth = useAuth();
  const micStatus = useMicStatus();
  const [retest, setRetest] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-display">Ajustes</h1>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Cuenta y sincronizacion</h2>
        {auth.status === "authed" ? (
          <>
            <div className="text-sm text-white/70">
              Sesion: <b>{auth.user?.email ?? "activa"}</b>
            </div>
            <div className="text-xs text-white/50">
              {auth.sync
                ? `${auth.sync.pending} pendientes · ${auth.sync.online ? "en linea" : "sin conexion"}` +
                  (auth.sync.lastSyncAt ? ` · ultima sync ${new Date(auth.sync.lastSyncAt).toLocaleTimeString()}` : "") +
                  (auth.sync.syncing ? " · sincronizando..." : "")
                : "Sincronizacion en la nube activa."}
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost text-sm" onClick={() => auth.syncNow()} disabled={auth.sync?.syncing}>
                Sincronizar ahora
              </button>
              <button className="btn-ghost text-sm text-bad" onClick={() => auth.logout()} disabled={auth.busy}>
                Cerrar sesion
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-white/60 text-sm">
              Opcional: crea una cuenta para respaldar tu progreso y jugar en varios dispositivos. Sin cuenta todo se
              guarda solo en este dispositivo.
            </p>
            <button className="btn-primary text-sm" onClick={() => navigate("/account")}>
              Iniciar sesion / crear cuenta
            </button>
          </>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Dificultad de afinacion</h2>
        <div className="grid grid-cols-3 gap-2">
          {(["beginner", "intermediate", "advanced"] as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => s.setDifficulty(d)}
              className={`btn text-sm ${s.settings.difficulty === d ? "bg-brand text-white" : "bg-white/5"}`}
            >
              ±{DIFFICULTY_TOLERANCE[d]}c
            </button>
          ))}
        </div>
        <label className="block text-sm">
          Tolerancia personalizada: <b>±{s.settings.toleranceCents} cents</b>
          <input
            type="range"
            min={5}
            max={60}
            value={s.settings.toleranceCents}
            onChange={(e) => s.setSettings({ toleranceCents: Number(e.target.value) })}
            className="w-full accent-brand"
          />
        </label>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Accesibilidad</h2>
        <Toggle
          label="Modo sin sonido (refuerza feedback visual)"
          checked={s.settings.silentMode}
          onChange={(v) => s.setSettings({ silentMode: v })}
        />
        <Toggle label="Alto contraste" checked={s.settings.highContrast} onChange={(v) => s.setSettings({ highContrast: v })} />
        <label className="block text-sm">
          Tamano de texto: <b>{Math.round(s.settings.fontScale * 100)}%</b>
          <input
            type="range"
            min={0.9}
            max={1.4}
            step={0.05}
            value={s.settings.fontScale}
            onChange={(e) => s.setSettings({ fontScale: Number(e.target.value) })}
            className="w-full accent-brand"
          />
        </label>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Microfono y audio</h2>
        <div className="text-sm text-white/60">
          Estado: <b>{micStatus}</b> · Umbral de ruido: {s.settings.noiseFloorDb.toFixed(0)} dBFS
        </div>
        {micStatus === "running" ? (
          <>
            <NoiseCalibration />
            <button className="btn-ghost text-sm" onClick={() => micEngine.disable()}>
              Apagar microfono
            </button>
          </>
        ) : (
          <button className="btn-ghost text-sm" onClick={() => micEngine.enable()}>
            Encender microfono
          </button>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Voz</h2>
        <div className="text-sm text-white/60">
          Rango actual:{" "}
          <b>
            {s.profile.rangeLowMidi != null ? midiToLatin(s.profile.rangeLowMidi) : "?"} –{" "}
            {s.profile.rangeHighMidi != null ? midiToLatin(s.profile.rangeHighMidi) : "?"}
          </b>{" "}
          ({s.profile.voiceTypeLabel ?? "sin clasificar"})
        </div>
        {!retest ? (
          <button className="btn-ghost text-sm" onClick={() => setRetest(true)}>
            Repetir test de rango vocal
          </button>
        ) : (
          <MicGate>
            <VocalRangeTest
              onDone={(r) => {
                s.setProfile({
                  rangeLowMidi: r.lowMidi,
                  rangeHighMidi: r.highMidi,
                  voiceTypeKey: r.voiceKey,
                  voiceTypeLabel: r.voiceLabel
                });
                s.addSnapshot(r.lowMidi, r.highMidi, 0);
                setTimeout(() => setRetest(false), 2500);
              }}
            />
          </MicGate>
        )}
      </section>

      <section className="card p-4 space-y-2">
        <h2 className="font-semibold text-bad">Zona peligrosa</h2>
        {!confirmReset ? (
          <button className="btn-ghost text-sm text-bad" onClick={() => setConfirmReset(true)}>
            Borrar todo mi progreso
          </button>
        ) : (
          <div className="flex gap-2">
            <button className="btn bg-bad text-white text-sm flex-1" onClick={() => s.resetAll()}>
              Si, borrar todo
            </button>
            <button className="btn-ghost text-sm flex-1" onClick={() => setConfirmReset(false)}>
              Cancelar
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="flex items-center justify-between w-full text-sm" onClick={() => onChange(!checked)}>
      <span>{label}</span>
      <span className={`w-11 h-6 rounded-full p-0.5 transition ${checked ? "bg-brand" : "bg-white/15"}`}>
        <span className={`block w-5 h-5 rounded-full bg-white transition ${checked ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}
