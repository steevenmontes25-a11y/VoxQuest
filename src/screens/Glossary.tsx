import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GLOSSARY } from "../data/theory";
import { CIRCLE_OF_FIFTHS } from "../music/scales";

export function Glossary() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  const tags = useMemo(() => Array.from(new Set(GLOSSARY.flatMap((g) => g.tags))).sort(), []);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return GLOSSARY.filter((g) => {
      if (tag && !g.tags.includes(tag)) return false;
      if (!needle) return true;
      return g.term.toLowerCase().includes(needle) || g.def.toLowerCase().includes(needle);
    });
  }, [q, tag]);

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="text-white/50 text-sm">
        ← Volver
      </button>
      <h1 className="text-2xl font-display">Glosario musical</h1>

      <input
        className="w-full bg-white/5 rounded-xl px-4 py-2.5 outline-none focus:ring-2 ring-brand"
        placeholder="Buscar termino..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        <button className={`pill ${!tag ? "bg-brand text-white" : ""}`} onClick={() => setTag(null)}>
          todos
        </button>
        {tags.map((t) => (
          <button key={t} className={`pill ${tag === t ? "bg-brand text-white" : ""}`} onClick={() => setTag(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {list.map((g) => (
          <div key={g.term} className="card p-3">
            <div className="font-display font-semibold text-brand-soft">{g.term}</div>
            <div className="text-sm text-white/70">{g.def}</div>
          </div>
        ))}
        {list.length === 0 && <p className="text-white/40 text-sm">Sin resultados.</p>}
      </div>

      <div className="card p-4">
        <div className="font-semibold text-sm mb-2">Circulo de quintas</div>
        <div className="flex flex-wrap gap-2">
          {CIRCLE_OF_FIFTHS.map((n, i) => (
            <span key={n} className="pill" title={`${i} quintas desde Do`}>
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
