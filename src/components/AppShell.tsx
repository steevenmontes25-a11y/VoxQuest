import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { LevelBadge, XPBar, StreakBadge } from "./Gamify";
import { useGame } from "../game/store";
import { useAuth } from "../game/authStore";
import { cn } from "../lib/cn";

function SyncIndicator() {
  const navigate = useNavigate();
  const status = useAuth((a) => a.status);
  const sync = useAuth((a) => a.sync);

  if (status !== "authed") return null;

  const label = !sync
    ? "☁️"
    : sync.syncing
      ? "⟳"
      : !sync.online
        ? "⛅"
        : sync.pending > 0
          ? `☁︎${sync.pending}`
          : "☁︎✓";

  return (
    <button
      onClick={() => navigate("/settings")}
      title="Sincronizacion en la nube"
      className={cn("text-xs px-1.5 py-0.5 rounded-md bg-white/5", sync?.syncing && "animate-pulse")}
    >
      {label}
    </button>
  );
}

const NAV = [
  { to: "/", label: "Mapa", icon: "🗺️", end: true },
  { to: "/progress", label: "Progreso", icon: "📈" },
  { to: "/settings", label: "Ajustes", icon: "⚙️" }
];

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const name = useGame((s) => s.profile.name);
  const fontScale = useGame((s) => s.settings.fontScale);
  const highContrast = useGame((s) => s.settings.highContrast);

  return (
    <div
      className={cn("min-h-full flex flex-col", highContrast && "contrast-125 saturate-150")}
      style={{ fontSize: `${fontScale}rem` }}
    >
      <header className="sticky top-0 z-30 bg-ink/80 backdrop-blur border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="font-display font-extrabold text-lg tracking-tight">
            Vox<span className="text-brand-soft">Quest</span>
          </button>
          <div className="flex-1 flex items-center gap-3 justify-end">
            <SyncIndicator />
            <StreakBadge />
            <div className="hidden sm:block w-40">
              <XPBar compact />
            </div>
            <LevelBadge />
          </div>
        </div>
        <div className="sm:hidden max-w-3xl mx-auto px-4 pb-2">
          <XPBar compact />
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-5 pb-24">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-ink/90 backdrop-blur border-t border-white/5">
        <div className="max-w-3xl mx-auto grid grid-cols-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 py-2.5 text-xs transition",
                  isActive ? "text-brand-soft" : "text-white/50 hover:text-white/80"
                )
              }
            >
              <span className="text-lg">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {name ? null : null}
    </div>
  );
}
