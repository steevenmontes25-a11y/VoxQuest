import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { QUIZ_SETS } from "../../data/theory";
import { playSequence } from "../../audio/synth";
import { midiToLatin, nameToMidi } from "../../music/notes";
import { cn } from "../../lib/cn";
import type { PlayerProps } from "./types";

/* -------------------------- Quiz de opcion multiple -------------------------- */
export function TheoryQuizPlayer({ exercise, running, silentMode, onResult }: PlayerProps) {
  const setKey = (exercise.params?.set as string) ?? "basics";
  const set = QUIZ_SETS[setKey] ?? QUIZ_SETS.basics;
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);

  if (!running) return <QuizPreview title={set.title} n={set.questions.length} />;

  const q = set.questions[i];
  const done = i >= set.questions.length;

  if (done) return null;

  const choose = (idx: number) => {
    if (picked != null) return;
    setPicked(idx);
    const ok = idx === q.answer;
    if (ok) setCorrect((c) => c + 1);
    setTimeout(() => {
      const next = i + 1;
      if (next >= set.questions.length) {
        const finalCorrect = correct + (ok ? 1 : 0);
        onResult({ score: finalCorrect / set.questions.length, metrics: { correct: finalCorrect, total: set.questions.length } });
      }
      setI(next);
      setPicked(null);
    }, 1400);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-white/50">
        <span>
          Pregunta {i + 1} / {set.questions.length}
        </span>
        <span>Aciertos: {correct}</span>
      </div>
      <div className="card p-4">
        <p className="font-display text-lg mb-1">{q.q}</p>
        {q.earSemitones != null && !silentMode && (
          <button className="btn-ghost text-sm my-2" onClick={() => playSequence([60, 60 + q.earSemitones!], 0.6, 0.7)}>
            🔊 Escuchar intervalo
          </button>
        )}
        <div className="grid gap-2 mt-2">
          {q.options.map((opt, idx) => {
            const state =
              picked == null ? "idle" : idx === q.answer ? "good" : idx === picked ? "bad" : "idle";
            return (
              <button
                key={idx}
                onClick={() => choose(idx)}
                className={cn(
                  "btn text-left justify-start",
                  state === "idle" && "bg-white/5 hover:bg-white/10",
                  state === "good" && "bg-good/25 ring-1 ring-good",
                  state === "bad" && "bg-bad/25 ring-1 ring-bad"
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>
        {picked != null && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-white/70 mt-3">
            {picked === q.answer ? "✅ Correcto. " : "❌ "}
            {q.explain}
          </motion.p>
        )}
      </div>
    </div>
  );
}

function QuizPreview({ title, n }: { title: string; n: number }) {
  return (
    <div className="card p-4 text-sm text-white/70">
      Quiz: <b>{title}</b> — {n} preguntas. Pulsa Empezar.
    </div>
  );
}

/* --------------------- Coloca la nota en el pentagrama --------------------- */
const STAFF_NOTES = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5", "G5"].map((n) => ({
  name: n,
  midi: nameToMidi(n)
}));

export function TheoryStaffPlayer({ running, onResult }: PlayerProps) {
  const rounds = useMemo(
    () => Array.from({ length: 5 }, () => STAFF_NOTES[2 + Math.floor(Math.random() * (STAFF_NOTES.length - 3))]),
    []
  );
  const [r, setR] = useState(0);
  const [hits, setHits] = useState(0);
  const [flash, setFlash] = useState<null | "good" | "bad">(null);

  if (!running) return <div className="card p-4 text-sm text-white/70">Haz clic en la posicion correcta del pentagrama para cada nota pedida.</div>;
  if (r >= rounds.length) return null;

  const target = rounds[r];
  // y por indice diatonico: G5 arriba (y=10) ... C4 abajo (y=120)
  const yFor = (idx: number) => 12 + (STAFF_NOTES.length - 1 - idx) * 10;
  const lineMidis = ["E4", "G4", "B4", "D5", "F5"].map(nameToMidi);

  const pick = (idx: number) => {
    if (flash) return;
    const ok = STAFF_NOTES[idx].midi === target.midi;
    setFlash(ok ? "good" : "bad");
    if (ok) setHits((h) => h + 1);
    setTimeout(() => {
      const next = r + 1;
      if (next >= rounds.length) onResult({ score: (hits + (ok ? 1 : 0)) / rounds.length, metrics: { correct: hits + (ok ? 1 : 0) } });
      setR(next);
      setFlash(null);
    }, 900);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-xs text-white/50">
        <span>Ronda {r + 1} / {rounds.length}</span>
        <span>Aciertos: {hits}</span>
      </div>
      <div className="card p-4 text-center">
        <p className="mb-2">
          Coloca: <b className="font-display text-xl text-brand-soft">{midiToLatin(target.midi)}</b>
        </p>
        <svg viewBox="0 0 320 150" className="w-full max-w-sm mx-auto">
          {lineMidis.map((lm) => {
            const idx = STAFF_NOTES.findIndex((s) => s.midi === lm);
            return <line key={lm} x1="20" x2="300" y1={yFor(idx)} y2={yFor(idx)} stroke="rgba(255,255,255,0.4)" />;
          })}
          <text x="6" y={yFor(STAFF_NOTES.findIndex((s) => s.name === "G4")) + 14} fontSize="34" fill="rgba(255,255,255,0.6)">
            𝄞
          </text>
          {STAFF_NOTES.map((s, idx) => (
            <circle
              key={s.name}
              cx={160}
              cy={yFor(idx)}
              r={7}
              className="cursor-pointer"
              fill={flash === "good" && s.midi === target.midi ? "#22c55e" : flash === "bad" && s.midi === target.midi ? "#22c55e" : "rgba(167,139,250,0.35)"}
              stroke="rgba(255,255,255,0.5)"
              onClick={() => pick(idx)}
            />
          ))}
        </svg>
        <p className="text-white/40 text-xs mt-1">Toca el circulo en la linea o espacio correcto.</p>
      </div>
    </div>
  );
}

/* --------------------- Completa el compas (4/4) --------------------- */
const FIGURES = [
  { name: "Redonda", beats: 4, glyph: "𝅝" },
  { name: "Blanca", beats: 2, glyph: "𝅗𝅥" },
  { name: "Negra", beats: 1, glyph: "♩" },
  { name: "Corchea", beats: 0.5, glyph: "♪" }
];

export function TheoryRhythmPlayer({ running, onResult }: PlayerProps) {
  const rounds = useMemo(
    () =>
      [
        { preset: [1, 1], name: "dos negras" },
        { preset: [2], name: "una blanca" },
        { preset: [1, 0.5, 0.5], name: "negra + dos corcheas" }
      ] as Array<{ preset: number[]; name: string }>,
    []
  );
  const [r, setR] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [scoreAcc, setScoreAcc] = useState(0);

  if (!running) return <div className="card p-4 text-sm text-white/70">Anade figuras hasta completar exactamente 4 tiempos (compas de 4/4).</div>;
  if (r >= rounds.length) return null;

  const base = rounds[r].preset.reduce((a, b) => a + b, 0);
  const total = base + placed.reduce((a, b) => a + b, 0);
  const remaining = 4 - total;

  const add = (beats: number) => {
    if (beats > remaining + 1e-6) return;
    setPlaced((p) => [...p, beats]);
  };

  const submit = () => {
    const exact = Math.abs(total - 4) < 1e-6;
    const efficiency = exact ? Math.max(0.6, 1 - placed.length * 0.08) : 0.2;
    const nextAcc = scoreAcc + efficiency;
    const next = r + 1;
    if (next >= rounds.length) onResult({ score: nextAcc / rounds.length, metrics: {} });
    setScoreAcc(nextAcc);
    setR(next);
    setPlaced([]);
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-white/50">Ronda {r + 1} / {rounds.length}</div>
      <div className="card p-4">
        <p className="text-sm mb-2">
          El compas ya tiene: <b>{rounds[r].name}</b> ({base} tiempos). Completa hasta 4.
        </p>
        <div className="flex items-center gap-2 text-3xl min-h-[48px] bg-black/30 rounded-lg px-3 py-2">
          {rounds[r].preset.map((b, k) => (
            <span key={`p${k}`} className="opacity-60">
              {FIGURES.find((f) => f.beats === b)?.glyph ?? "?"}
            </span>
          ))}
          <span className="text-white/20">|</span>
          {placed.map((b, k) => (
            <span key={`a${k}`} className="text-brand-soft">
              {FIGURES.find((f) => f.beats === b)?.glyph ?? "?"}
            </span>
          ))}
        </div>
        <div className="mt-2 text-sm">
          Total: <b className={cn(Math.abs(total - 4) < 1e-6 ? "text-good" : "text-warn")}>{total}</b> / 4 tiempos
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {FIGURES.map((f) => (
            <button key={f.name} className="btn-ghost text-sm" disabled={f.beats > remaining + 1e-6} onClick={() => add(f.beats)}>
              {f.glyph} {f.name} ({f.beats})
            </button>
          ))}
          <button className="btn-ghost text-sm" onClick={() => setPlaced([])}>
            ↺ Limpiar
          </button>
        </div>
        <button className="btn-primary w-full mt-3" disabled={Math.abs(total - 4) > 1e-6} onClick={submit}>
          Confirmar compas
        </button>
      </div>
    </div>
  );
}
