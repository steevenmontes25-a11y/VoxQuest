import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../game/authStore";
import { cn } from "../lib/cn";

/**
 * Optional account screen. VoxQuest works fully offline without it — signing in
 * only turns on cloud backup + multi-device sync.
 */
export function Account() {
  const navigate = useNavigate();
  const { status, user, busy, error, login, register, logout } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (status === "authed" && user) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="text-white/50 text-sm">
          ← Volver
        </button>
        <div className="card p-6 text-center animate-pop-in">
          <div className="text-4xl mb-2">☁️</div>
          <h1 className="text-xl font-display">Sesion iniciada</h1>
          <p className="text-white/70 text-sm mt-1">{user.email}</p>
          <p className="text-white/50 text-xs mt-2">
            Tu progreso se respalda y sincroniza automaticamente entre dispositivos.
          </p>
          <button
            className="btn-ghost w-full mt-5 text-bad"
            disabled={busy}
            onClick={async () => {
              await logout();
              navigate("/settings");
            }}
          >
            Cerrar sesion
          </button>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok =
      mode === "login"
        ? await login(email.trim(), password)
        : await register({ name: name.trim() || "Cantante", email: email.trim(), password, password_confirmation: password });
    if (ok) navigate("/");
  };

  return (
    <div className="space-y-4 max-w-sm mx-auto">
      <button onClick={() => navigate(-1)} className="text-white/50 text-sm">
        ← Volver
      </button>

      <div className="card p-6">
        <div className="text-center mb-4">
          <div className="text-4xl mb-1">☁️</div>
          <h1 className="text-xl font-display">
            {mode === "login" ? "Inicia sesion" : "Crea tu cuenta"}
          </h1>
          <p className="text-white/50 text-xs mt-1">
            Opcional. Sirve para respaldar tu progreso y jugar en varios dispositivos.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn("btn", mode === m ? "bg-brand text-white" : "bg-white/5")}
            >
              {m === "login" ? "Entrar" : "Registrarme"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <input
              className="w-full bg-white/5 rounded-xl px-4 py-2.5 outline-none focus:ring-2 ring-brand"
              placeholder="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            type="email"
            required
            autoComplete="email"
            className="w-full bg-white/5 rounded-xl px-4 py-2.5 outline-none focus:ring-2 ring-brand"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="w-full bg-white/5 rounded-xl px-4 py-2.5 outline-none focus:ring-2 ring-brand"
            placeholder="Contrasena (min. 8, con letras y numeros)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-bad text-sm">
              {error}
            </motion.p>
          )}

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>
      </div>

      <p className="text-white/40 text-xs text-center">
        Puedes seguir jugando sin cuenta: todo se guarda en este dispositivo.
      </p>
    </div>
  );
}
