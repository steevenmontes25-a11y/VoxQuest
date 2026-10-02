import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useGame } from "../game/store";
import { MicGate, NoiseCalibration } from "../components/MicGate";
import { VocalRangeTest } from "./VocalRangeTest";
import { DIFFICULTY_TOLERANCE, type Difficulty } from "../game/types";
import { cn } from "../lib/cn";

const GOALS = [
  { id: "afinacion", label: "Afinar mejor", icon: "🎯" },
  { id: "tecnica", label: "Tecnica vocal", icon: "🎙️" },
  { id: "teoria", label: "Entender teoria", icon: "🎼" },
  { id: "repertorio", label: "Cantar canciones", icon: "🎤" }
];

const EXPERIENCE: Array<{ id: "none" | "some" | "choir" | "solo"; label: string }> = [
  { id: "none", label: "Nunca he cantado en serio" },
  { id: "some", label: "Canto por hobby a veces" },
  { id: "choir", label: "He cantado en coro" },
  { id: "solo", label: "Tengo experiencia como solista" }
];

export function Onboarding() {
  const navigate = useNavigate();
  const setProfile = useGame((s) => s.setProfile);
  const completeOnboarding = useGame((s) => s.completeOnboarding);
  const setDifficulty = useGame((s) => s.setDifficulty);
  const addSnapshot = useGame((s) => s.addSnapshot);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [experience, setExperience] = useState<(typeof EXPERIENCE)[number]["id"]>("none");
  const [goals, setGoals] = useState<string[]>(["afinacion"]);
  const [difficulty, setDiff] = useState<Difficulty>("beginner");
  const [range, setRange] = useState<{ lowMidi: number; highMidi: number; voiceKey: string; voiceLabel: string } | null>(null);
  const [rangeSkipped, setRangeSkipped] = useState(false);

  const steps = ["Bienvenida", "Experiencia", "Objetivos", "Dificultad", "Microfono", "Rango vocal", "Listo"];

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = () => {
    setProfile({ name: name.trim() || "Cantante" });
    setDifficulty(difficulty);
    if (range) {
      completeOnboarding({
        name: name.trim() || "Cantante",
        experience,
        goals,
        rangeLowMidi: range.lowMidi,
        rangeHighMidi: range.highMidi,
        voiceTypeKey: range.voiceKey,
        voiceTypeLabel: range.voiceLabel
      });
      addSnapshot(range.lowMidi, range.highMidi, 0);
    } else {
      completeOnboarding({ name: name.trim() || "Cantante", experience, goals });
    }
    navigate("/");
  };

  return (
    <div className="min-h-full max-w-lg mx-auto px-4 py-8">
      <div className="flex gap-1 mb-6">
        {steps.map((_, i) => (
          <div key={i} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-brand" : "bg-white/10")} />
        ))}
      </div>

      <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
        {step === 0 && (
          <div className="text-center space-y-3">
            <div className="text-6xl animate-float">🎤</div>
            <h1 className="text-3xl font-display">Bienvenido a VoxQuest</h1>
            <p className="text-white/70">Aprende a cantar como un videojuego: respiracion, oido, afinacion y teoria, con feedback en vivo.</p>
            <input
              className="w-full bg-white/5 rounded-xl px-4 py-3 outline-none focus:ring-2 ring-brand"
              placeholder="¿Como te llamas?"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}

        {step === 1 && (
          <>
            <h2 className="text-xl font-display">¿Cuanta experiencia tienes?</h2>
            <div className="space-y-2">
              {EXPERIENCE.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setExperience(e.id)}
                  className={cn("btn w-full justify-start", experience === e.id ? "bg-brand text-white" : "bg-white/5")}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-xl font-display">¿Que quieres lograr?</h2>
            <p className="text-white/50 text-sm">Elige una o varias.</p>
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map((g) => {
                const on = goals.includes(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => setGoals((cur) => (on ? cur.filter((x) => x !== g.id) : [...cur, g.id]))}
                    className={cn("card p-4 text-center", on && "ring-2 ring-brand")}
                  >
                    <div className="text-3xl">{g.icon}</div>
                    <div className="text-sm mt-1">{g.label}</div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-xl font-display">Nivel de exigencia en afinacion</h2>
            <div className="space-y-2">
              {(["beginner", "intermediate", "advanced"] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDiff(d)}
                  className={cn("btn w-full justify-between", difficulty === d ? "bg-brand text-white" : "bg-white/5")}
                >
                  <span>{d === "beginner" ? "Principiante" : d === "intermediate" ? "Intermedio" : "Avanzado"}</span>
                  <span className="pill">± {DIFFICULTY_TOLERANCE[d]} cents</span>
                </button>
              ))}
            </div>
            <p className="text-white/50 text-sm">Podras cambiarlo cuando quieras en Ajustes.</p>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="text-xl font-display">Activa tu microfono</h2>
            <MicGate>
              <div className="space-y-3">
                <div className="card p-4 text-center text-good">✅ Microfono activo</div>
                <NoiseCalibration />
                <p className="text-white/50 text-sm">Cuando termines de calibrar, continua.</p>
              </div>
            </MicGate>
          </>
        )}

        {step === 5 && (
          <>
            <h2 className="text-xl font-display">Midamos tu rango vocal</h2>
            <MicGate>
              <VocalRangeTest onDone={setRange} />
            </MicGate>
            {!range && (
              <button className="btn-ghost w-full text-sm" onClick={() => setRangeSkipped(true)}>
                Saltar por ahora (usaremos un rango estandar)
              </button>
            )}
          </>
        )}

        {step === 6 && (
          <div className="text-center space-y-3">
            <div className="text-6xl">🚀</div>
            <h2 className="text-2xl font-display">¡Todo listo, {name.trim() || "Cantante"}!</h2>
            {range && (
              <p className="text-white/70">
                Rango {range.voiceLabel}. Tu mapa de habilidades esta personalizado.
              </p>
            )}
            <button className="btn-primary w-full" onClick={finish}>
              Empezar a jugar
            </button>
          </div>
        )}
      </motion.div>

      {step < 6 && (
        <div className="flex gap-2 mt-8">
          {step > 0 && (
            <button className="btn-ghost" onClick={back}>
              Atras
            </button>
          )}
          <button
            className="btn-primary flex-1"
            onClick={next}
            disabled={(step === 0 && !name.trim()) || (step === 5 && !range && !rangeSkipped)}
          >
            Continuar
          </button>
        </div>
      )}
    </div>
  );
}
