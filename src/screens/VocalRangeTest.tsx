import { useEffect, useRef, useState } from "react";
import { micEngine } from "../audio/MicEngine";
import { analyzeFrequency, classifyVoice, midiToLatin } from "../music/notes";
import { PitchMeter } from "../components/PitchMeter";

/**
 * Test de rango vocal. El usuario canta su nota mas grave comoda y luego la mas
 * aguda. Se auto-captura cuando mantiene un tono estable ~1 s; tambien hay
 * boton manual. Devuelve el rango y el tipo de voz orientativo.
 */
export function VocalRangeTest({
  onDone
}: {
  onDone: (r: { lowMidi: number; highMidi: number; voiceKey: string; voiceLabel: string }) => void;
}) {
  const [phase, setPhase] = useState<"low" | "high" | "result">("low");
  const [low, setLow] = useState<number | null>(null);
  const [high, setHigh] = useState<number | null>(null);
  const [liveMidi, setLiveMidi] = useState<number | null>(null);
  const stableRef = useRef<{ midi: number; since: number } | null>(null);
  const [holdPct, setHoldPct] = useState(0);

  useEffect(() => {
    if (phase === "result") return;
    return micEngine.onFrame((f) => {
      if (!f.note || !f.hz) {
        setLiveMidi(null);
        stableRef.current = null;
        setHoldPct(0);
        return;
      }
      setLiveMidi(f.note.midi + f.note.cents / 100);
      const now = performance.now();
      const s = stableRef.current;
      if (s && Math.abs(s.midi - f.note.midi) <= 1) {
        const held = now - s.since;
        setHoldPct(Math.min(100, (held / 1000) * 100));
        if (held >= 1000) {
          capture(f.note.midi);
          stableRef.current = null;
          setHoldPct(0);
        }
      } else {
        stableRef.current = { midi: f.note.midi, since: now };
        setHoldPct(0);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const capture = (midi: number) => {
    if (phase === "low") {
      setLow(midi);
      setPhase("high");
    } else if (phase === "high") {
      const lo = low ?? midi - 12;
      const hi = Math.max(midi, lo + 5);
      setHigh(hi);
      setPhase("result");
      const v = classifyVoice(lo, hi);
      onDone({ lowMidi: lo, highMidi: hi, voiceKey: v.key, voiceLabel: v.label });
    }
  };

  const manual = () => {
    if (liveMidi != null) capture(Math.round(liveMidi));
  };

  if (phase === "result") {
    const v = low != null && high != null ? classifyVoice(low, high) : null;
    return (
      <div className="card p-5 text-center animate-pop-in">
        <div className="text-4xl mb-2">🎉</div>
        <h3 className="font-display text-xl mb-1">Tu rango vocal</h3>
        <p className="text-2xl font-display text-brand-soft">
          {low != null ? midiToLatin(low) : "?"} – {high != null ? midiToLatin(high) : "?"}
        </p>
        <p className="text-white/70 mt-1">
          Tipo de voz aproximado: <b>{v?.label}</b>
        </p>
        <p className="text-white/40 text-xs mt-2">Es una estimacion; puedes repetir el test cuando quieras desde Ajustes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="card p-4 text-center">
        <p className="font-display text-lg">
          {phase === "low" ? "Canta tu nota MAS GRAVE comoda" : "Ahora tu nota MAS AGUDA comoda"}
        </p>
        <p className="text-white/60 text-sm">Sosten la nota ~1 segundo y se capturara sola.</p>
      </div>
      <div className="text-center text-3xl font-display tabular-nums">
        {liveMidi != null ? midiToLatin(analyzeFrequency(440 * Math.pow(2, (liveMidi - 69) / 12)).midi) : "—"}
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-good transition-[width]" style={{ width: `${holdPct}%` }} />
      </div>
      <PitchMeter toleranceCents={50} centerMidi={phase === "low" ? 50 : 64} rangeSemitones={30} height={220} />
      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={manual} disabled={liveMidi == null}>
          Registrar nota manualmente
        </button>
      </div>
      {low != null && <p className="text-xs text-white/50">Grave registrada: {midiToLatin(low)}</p>}
    </div>
  );
}
