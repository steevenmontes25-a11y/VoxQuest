import { useMemo } from "react";
import { FallingNotes, type GameNote } from "../../components/FallingNotes";
import { songById } from "../../data/songs";
import { midiToLatin } from "../../music/notes";
import { comfortableTonic, type PlayerProps } from "./types";

export function SongPlayer({ exercise, toleranceCents, rangeLowMidi, rangeHighMidi, running, silentMode, onResult }: PlayerProps) {
  const song = songById((exercise.params?.songId as string) ?? "solfeo-1");

  const { notes, tonic } = useMemo(() => {
    if (!song) return { notes: [] as GameNote[], tonic: 60 };
    const maxDeg = Math.max(...song.notes.map((n) => n.degree));
    const t = comfortableTonic(rangeLowMidi, rangeHighMidi, maxDeg + 2);
    let beat = 0;
    const gn: GameNote[] = song.notes.map((n) => {
      const note: GameNote = { midi: t + n.degree, startBeat: beat, beats: n.beats, label: n.lyric };
      beat += n.beats;
      return note;
    });
    return { notes: gn, tonic: t };
  }, [song, rangeLowMidi, rangeHighMidi]);

  if (!song) return <div className="card p-4 text-bad">Cancion no encontrada.</div>;

  return (
    <div className="space-y-3">
      <div className="card p-3 text-sm">
        <b className="font-display">{song.title}</b> · {song.origin} · {song.bpm} BPM · tonica {midiToLatin(tonic)}
      </div>
      <FallingNotes
        notes={notes}
        bpm={song.bpm}
        toleranceCents={toleranceCents}
        playGuide={!silentMode}
        leadInBeats={4}
        running={running}
        onComplete={(r) =>
          onResult({
            score: r.score,
            metrics: { perfectNotes: r.perfectNotes, maxCombo: r.maxCombo, pitchPct: Math.round(r.score * 100) }
          })
        }
      />
      <p className="text-white/60 text-sm leading-relaxed">
        {song.notes.map((n, i) => (
          <span key={i}>{n.lyric} </span>
        ))}
      </p>
    </div>
  );
}
