import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { findExercise, MODULE_META } from "../data/curriculum";
import { useGame } from "../game/store";
import { MicGate } from "../components/MicGate";
import { PLAYERS, needsMic } from "./players/registry";
import type { PlayerResult } from "./players/types";
import { StarRating } from "../components/Gamify";

const DEFAULT_LOW = 52; // E3
const DEFAULT_HIGH = 72; // C5

export function ExercisePlayer() {
  const { exerciseId } = useParams();
  const navigate = useNavigate();
  const found = exerciseId ? findExercise(exerciseId) : null;

  const settings = useGame((s) => s.settings);
  const profile = useGame((s) => s.profile);
  const recordExercise = useGame((s) => s.recordExercise);
  const addSnapshot = useGame((s) => s.addSnapshot);

  const [running, setRunning] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [finished, setFinished] = useState<PlayerResult | null>(null);

  const rangeLow = profile.rangeLowMidi ?? DEFAULT_LOW;
  const rangeHigh = profile.rangeHighMidi ?? DEFAULT_HIGH;

  const Player = found ? PLAYERS[found.exercise.kind] : null;
  const meta = found ? MODULE_META[found.unit.module] : null;

  const playerProps = useMemo(
    () =>
      found
        ? {
            exercise: found.exercise,
            unit: found.unit,
            toleranceCents: settings.toleranceCents,
            rangeLowMidi: rangeLow,
            rangeHighMidi: rangeHigh,
            silentMode: settings.silentMode,
            running
          }
        : null,
    [found, settings.toleranceCents, settings.silentMode, rangeLow, rangeHigh, running]
  );

  if (!found || !Player || !playerProps || !meta) {
    return <div className="card p-6">Ejercicio no encontrado.</div>;
  }
  const { exercise } = found;

  const handleResult = (r: PlayerResult) => {
    setRunning(false);
    setFinished(r);
    recordExercise({ exerciseId: exercise.id, score: r.score, baseXp: exercise.baseXp, metrics: r.metrics });
    if (r.metrics?.avgErrorCents != null) {
      addSnapshot(rangeLow, rangeHigh, r.metrics.avgErrorCents);
    }
  };

  const retry = () => {
    setFinished(null);
    setAttempt((a) => a + 1);
    setRunning(true);
  };

  const body = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-white/50 text-sm">
          ← Volver
        </button>
        <span className="pill" style={{ background: meta.color + "30", color: meta.color }}>
          {meta.icon} {meta.label}
        </span>
      </div>
      <h1 className="text-xl font-display">{exercise.title}</h1>

      {!running && !finished && (
        <div className="card p-5 text-center space-y-3">
          <p className="text-white/70 text-sm">
            {settings.silentMode ? "Modo sin sonido activo: guias visuales reforzadas." : "Ponte los auriculares para un mejor resultado."}
          </p>
          <button className="btn-primary w-full" onClick={() => setRunning(true)}>
            Empezar
          </button>
        </div>
      )}

      {(running || finished) && (
        <div className={finished ? "opacity-40 pointer-events-none" : ""}>
          <Player key={attempt} {...playerProps} onResult={handleResult} />
        </div>
      )}

      {finished && (
        <div className="card p-5 text-center space-y-3 animate-pop-in">
          <div className="flex justify-center">
            <StarRating value={useGame.getState().lastOutcome?.stars ?? 0} />
          </div>
          <p className="text-white/70 text-sm">Precision: {Math.round(finished.score * 100)}%</p>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={retry}>
              Repetir
            </button>
            <button className="btn-primary flex-1" onClick={() => navigate(-1)}>
              Seguir
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return needsMic(exercise.kind) ? <MicGate>{body}</MicGate> : body;
}
