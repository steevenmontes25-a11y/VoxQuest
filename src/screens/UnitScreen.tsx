import { useNavigate, useParams } from "react-router-dom";
import { CURRICULUM, MODULE_META } from "../data/curriculum";
import { useGame } from "../game/store";
import { StarRating } from "../components/Gamify";
import { cn } from "../lib/cn";

export function UnitScreen() {
  const { unitId } = useParams();
  const navigate = useNavigate();
  const unit = CURRICULUM.find((u) => u.id === unitId);
  const results = useGame((s) => s.results);
  const unlocked = useGame((s) => s.unlockedUnits);

  if (!unit) return <div className="card p-6">Unidad no encontrada.</div>;
  const meta = MODULE_META[unit.module];
  const isLocked = !unlocked.includes(unit.id);

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("/")} className="text-white/50 text-sm">
        ← Mapa
      </button>
      <header className="card p-5" style={{ borderColor: meta.color + "40" }}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{meta.icon}</span>
          <span className="pill" style={{ background: meta.color + "30", color: meta.color }}>
            {meta.label}
          </span>
        </div>
        <h1 className="text-2xl font-display mt-2">{unit.title}</h1>
        <p className="text-white/60 text-sm">{unit.blurb}</p>
      </header>

      {isLocked && (
        <div className="card p-4 text-sm text-warn">
          🔒 Completa la unidad anterior de {meta.label} (al menos 1 estrella en cada ejercicio) para desbloquear esta.
        </div>
      )}

      <div className="space-y-2">
        {unit.exercises.map((ex, i) => {
          const r = results[ex.id];
          const isBoss = ex.kind === "boss";
          return (
            <button
              key={ex.id}
              disabled={isLocked}
              onClick={() => navigate(`/play/${ex.id}`)}
              className={cn(
                "w-full card p-4 flex items-center gap-3 text-left transition",
                !isLocked && "hover:bg-panel2",
                isBoss && "ring-2 ring-bad/60"
              )}
            >
              <span
                className={cn(
                  "grid place-items-center w-9 h-9 rounded-lg font-display font-bold shrink-0",
                  isBoss ? "bg-bad text-white" : "bg-white/10"
                )}
              >
                {isBoss ? "👑" : i + 1}
              </span>
              <div className="flex-1">
                <div className="font-semibold text-sm">{ex.title}</div>
                <div className="text-white/45 text-xs">
                  {ex.baseXp} XP base · {r ? `${r.attempts} intento(s)` : "sin intentar"}
                </div>
              </div>
              <StarRating value={r?.stars ?? 0} size={16} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
