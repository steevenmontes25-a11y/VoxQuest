import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame, useLevel } from "../game/store";
import { ACHIEVEMENTS } from "../game/achievements";
import { cn } from "../lib/cn";

export function LevelBadge() {
  const { level } = useLevel();
  return (
    <div className="flex items-center gap-1.5">
      <span className="grid place-items-center w-7 h-7 rounded-lg bg-brand text-white text-sm font-display font-bold shadow-glow">
        {level}
      </span>
      <span className="text-xs text-white/60 hidden sm:block">Nivel</span>
    </div>
  );
}

export function XPBar({ compact = false }: { compact?: boolean }) {
  const { intoLevel, span, progress } = useLevel();
  return (
    <div className={cn("w-full", compact ? "max-w-[160px]" : "")}>
      <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-brand-soft to-brand"
          animate={{ width: `${Math.round(progress * 100)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
      {!compact && (
        <div className="text-[11px] text-white/50 mt-1">
          {intoLevel} / {span} XP
        </div>
      )}
    </div>
  );
}

export function StreakBadge() {
  const streak = useGame((s) => s.streak);
  return (
    <div className="flex items-center gap-1" title={`Racha: ${streak.count} dias (mejor ${streak.best})`}>
      <span className="text-base">🔥</span>
      <span className="font-display font-bold text-sm">{streak.count}</span>
    </div>
  );
}

export function StarRating({ value, size = 22 }: { value: number; size?: number }) {
  return (
    <div className="flex gap-1" aria-label={`${value} de 3 estrellas`}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.12 * i, type: "spring", stiffness: 260, damping: 14 }}
          style={{ fontSize: size }}
        >
          {i < value ? "⭐" : "☆"}
        </motion.span>
      ))}
    </div>
  );
}

/** Confeti ligero en canvas (sin dependencias). */
export function Confetti({ fire }: { fire: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!fire) return;
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    const colors = ["#a78bfa", "#22d3ee", "#22c55e", "#f59e0b", "#ef4444"];
    const parts = Array.from({ length: 140 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 80,
      y: H / 2 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 11 - 3,
      s: Math.random() * 5 + 3,
      c: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI
    }));
    let raf = 0;
    let t = 0;
    const tick = () => {
      t++;
      ctx.clearRect(0, 0, W, H);
      parts.forEach((p) => {
        p.vy += 0.32;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += 0.2;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        ctx.restore();
      });
      if (t < 140) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire]);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

/**
 * Overlay de recompensa. Escucha `lastOutcome` del store y lo muestra:
 * estrellas, XP ganada, subida de nivel y logros nuevos.
 */
export function RewardOverlay() {
  const outcome = useGame((s) => s.lastOutcome);
  const dismiss = useGame((s) => s.dismissOutcome);

  const earned = useMemo(
    () => (outcome ? ACHIEVEMENTS.filter((a) => outcome.newAchievements.includes(a.id)) : []),
    [outcome]
  );

  return (
    <AnimatePresence>
      {outcome && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismiss}
        >
          <Confetti fire={outcome.stars >= 2 || outcome.leveledUp} />
          <motion.div
            className="card p-6 max-w-sm w-full text-center relative"
            initial={{ scale: 0.7, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-display mb-1">
              {outcome.stars === 3 ? "¡Perfecto!" : outcome.stars >= 1 ? "¡Bien hecho!" : "Sigue practicando"}
            </h3>
            <div className="flex justify-center my-3">
              <StarRating value={outcome.stars} size={34} />
            </div>
            <div className="text-brand-soft font-display text-xl">+{outcome.xpGained} XP</div>

            {outcome.leveledUp && (
              <motion.div
                className="mt-3 pill bg-brand text-white"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
              >
                ¡Subiste de nivel! 🎉
              </motion.div>
            )}

            {earned.length > 0 && (
              <div className="mt-4 space-y-2">
                {earned.map((a) => (
                  <motion.div
                    key={a.id}
                    className="flex items-center gap-3 bg-white/5 rounded-xl p-2 text-left"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                  >
                    <span className="text-2xl">{a.icon}</span>
                    <div>
                      <div className="text-sm font-semibold">{a.title}</div>
                      <div className="text-xs text-white/60">{a.desc}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            <button className="btn-primary w-full mt-5" onClick={dismiss}>
              Continuar
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
