import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CURRICULUM, MODULE_META, type ModuleKey, type Unit } from "../data/curriculum";
import { useGame } from "../game/store";
import { cn } from "../lib/cn";

type UnitState = "locked" | "available" | "completed" | "mastered";

function useUnitState() {
  const results = useGame((s) => s.results);
  const unlocked = useGame((s) => s.unlockedUnits);
  return (u: Unit): UnitState => {
    if (!unlocked.includes(u.id)) return "locked";
    const stars = u.exercises.map((e) => results[e.id]?.stars ?? 0);
    if (stars.every((s) => s >= 3)) return "mastered";
    if (stars.every((s) => s >= 1)) return "completed";
    return "available";
  };
}

export function SkillMap() {
  const navigate = useNavigate();
  const stateOf = useUnitState();
  const profile = useGame((s) => s.profile);

  const modules = Object.keys(MODULE_META) as ModuleKey[];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-display">Hola, {profile.name || "Cantante"} 👋</h1>
        <p className="text-white/60 text-sm">
          {profile.voiceTypeLabel ? `Voz ${profile.voiceTypeLabel}. ` : ""}Elige por donde seguir tu aventura vocal.
        </p>
      </header>

      {modules.map((mk) => {
        const meta = MODULE_META[mk];
        const units = CURRICULUM.filter((u) => u.module === mk);
        return (
          <section key={mk}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{meta.icon}</span>
              <h2 className="font-display text-lg" style={{ color: meta.color }}>
                {meta.label}
              </h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {units.map((u, i) => {
                const st = stateOf(u);
                const locked = st === "locked";
                const stars = u.exercises.reduce((a, e) => a + (useGame.getState().results[e.id]?.stars ?? 0), 0);
                const maxStars = u.exercises.length * 3;
                return (
                  <motion.button
                    key={u.id}
                    whileTap={{ scale: 0.96 }}
                    disabled={locked}
                    onClick={() => navigate(`/unit/${u.id}`)}
                    className={cn(
                      "min-w-[190px] max-w-[190px] text-left card p-4 relative",
                      locked && "opacity-45",
                      st === "mastered" && "ring-2 ring-warn",
                      st === "completed" && "ring-1 ring-good"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="grid place-items-center w-8 h-8 rounded-lg text-sm font-display font-bold"
                        style={{ background: locked ? "rgba(255,255,255,0.08)" : meta.color, color: locked ? "#888" : "#0b0b16" }}
                      >
                        {locked ? "🔒" : i + 1}
                      </span>
                      {st === "mastered" && <span title="Dominado">🏆</span>}
                    </div>
                    <div className="font-semibold text-sm mt-2 leading-tight">{u.title}</div>
                    <div className="text-white/50 text-xs mt-1 line-clamp-2">{u.blurb}</div>
                    <div className="text-xs mt-2 text-warn">
                      {"★".repeat(Math.round(stars / 3))}
                      <span className="text-white/30">{" "}{stars}/{maxStars}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
