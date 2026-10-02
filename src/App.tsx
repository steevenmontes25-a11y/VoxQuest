import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useGame } from "./game/store";
import { AppShell } from "./components/AppShell";
import { RewardOverlay } from "./components/Gamify";
import { Onboarding } from "./screens/Onboarding";
import { SkillMap } from "./screens/SkillMap";
import { UnitScreen } from "./screens/UnitScreen";
import { ExercisePlayer } from "./screens/ExercisePlayer";
import { Progress } from "./screens/Progress";
import { Settings } from "./screens/Settings";
import { Glossary } from "./screens/Glossary";
import { Account } from "./screens/Account";

export default function App() {
  const hydrated = useGame((s) => s.hydrated);
  const onboarded = useGame((s) => s.profile.onboarded);
  const hydrate = useGame((s) => s.hydrate);
  const location = useLocation();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="min-h-full grid place-items-center">
        <div className="text-center animate-pulse">
          <div className="text-5xl mb-2">🎤</div>
          <div className="font-display text-xl">VoxQuest</div>
        </div>
      </div>
    );
  }

  if (!onboarded && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  if (location.pathname === "/onboarding") {
    return (
      <>
        <Onboarding />
        <RewardOverlay />
      </>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<SkillMap />} />
        <Route path="/unit/:unitId" element={<UnitScreen />} />
        <Route path="/play/:exerciseId" element={<ExercisePlayer />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/glossary" element={<Glossary />} />
        <Route path="/account" element={<Account />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <RewardOverlay />
    </AppShell>
  );
}
