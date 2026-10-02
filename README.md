# VoxQuest

Aprende a cantar como un videojuego. PWA con **feedback de afinacion en tiempo real** desde tu microfono:
respiracion guiada, entrenamiento de oido, teoria musical interactiva, tecnica vocal y canciones de practica,
todo envuelto en mecanicas de juego (XP, niveles, rachas, logros y "jefes" de unidad).

Todo el analisis de audio ocurre **en tu dispositivo**. El audio nunca se envia a un servidor.

## Cuenta y sincronizacion en la nube (opcional)

La app funciona **100% offline y sin cuenta** — todo se guarda en IndexedDB. Si
inicias sesion (Ajustes → "Cuenta y sincronizacion"), el progreso se respalda y
sincroniza entre dispositivos contra el backend Laravel de `backend/`:

- `src/game/api.ts` — cliente con token Sanctum, reintentos con backoff.
- `src/game/cloudSync.ts` — cola de eventos append-only en IndexedDB, flush a
  `POST /api/v1/sync` con `idempotency_key` estable, merge monotono del estado.
- `src/game/authStore.ts` — estado de sesion + `login/register/logout/syncNow`.
- Ya cableado en `src/main.tsx` (`initCloudSync`). Config: `VITE_API_URL` en
  `.env` (por defecto `http://localhost:8000/api/v1`).

Para correr el stack completo en local: levanta el backend (`cd backend && php
artisan serve`) y luego `npm run dev`.

## Requisitos

- Node.js >= 18 (probado con Node 26)
- Un navegador moderno con Web Audio API y `getUserMedia`: Chrome, Edge o Safari recientes
- Un microfono. Se recomiendan **auriculares** para que el sonido de referencia no entre por el micro.

## Instalacion y ejecucion

```bash
npm install
npm run dev      # servidor de desarrollo en http://localhost:5173
```

Otros scripts:

```bash
npm run build      # build de produccion (tsc + vite) -> dist/
npm run preview    # sirve el build
npm test           # tests (Vitest): DSP de pitch, teoria musical, XP, suavizado
npm run typecheck  # solo comprobacion de tipos
```

### Permisos de microfono

Al entrar a un ejercicio con microfono, la app muestra una pantalla explicativa **antes** de pedir el permiso.
El navegador solo concede el microfono sobre `http://localhost` o `https://`. Si deniegas el permiso por error,
habilitalo desde el icono de candado / ajustes del sitio y pulsa "Activar microfono" de nuevo.
En **Ajustes** puedes recalibrar el ruido de fondo, apagar el micro o repetir el test de rango vocal.

## Como funciona el motor de audio

`src/audio/`

| Archivo | Rol |
| --- | --- |
| `MicEngine.ts` | Singleton. `getUserMedia` -> `AudioContext` -> `AnalyserNode`. Bucle `requestAnimationFrame` que en cada frame lee el dominio temporal, estima el tono, calcula RMS/dB, aplica suavizado y emite un `MicFrame` a los suscriptores. Maneja `AudioContext` suspendido (politica de autoplay) y calibracion de ruido. |
| `pitch.ts` | `PitchTracker` envuelve `pitchy` (metodo McLeod / MPM: autocorrelacion normalizada + interpolacion parabolica). Incluye `autoCorrelate` propio para tests deterministas. Precision medida en tests: **< 10 cents** con ondas tipo voz. |
| `smoothing.ts` | `PitchSmoother`: ventana de mediana (quita outliers), rechazo de saltos de octava (x2, /2, /3) y EMA final para continuidad visual sin retraso perceptible. |
| `synth.ts` | Tone.js (carga perezosa): notas guia, secuencias, acordes, cadencia I-IV-V-I y metronomo. |
| `useMicEngine.ts` | Hooks de React: `useMicStatus`, `useMicControls`, `useMicFrame`, `useFrameSubscription` (esta ultima no provoca renders: para bucles de juego en canvas). |

**Latencia:** ventana FFT de 2048 (~43 ms a 48 kHz) + 1-2 frames de suavizado ≈ 50-80 ms percibidos.

## Modulos (todos jugables)

- **A · Onboarding y diagnostico** (`screens/Onboarding.tsx`, `screens/VocalRangeTest.tsx`): experiencia, objetivos,
  dificultad, permiso + calibracion de micro, y test de rango vocal con auto-captura y clasificacion orientativa
  del tipo de voz. Genera el mapa de habilidades personalizado.
- **B · Respiracion** (`components/BreathingGuide.tsx`): patrones guiados (4-7-8, caja) con circulo que respira;
  mide la estabilidad del flujo de aire en la exhalacion. "Vela virtual": la llama se apaga si el aire baja o pica;
  puntua el mejor tramo sostenido.
- **C · Oido y afinacion** (`components/PitchMeter.tsx`, `components/FallingNotes.tsx`, `screens/players/SingTargets.tsx`):
  sostener notas, **notas cayendo** estilo piano roll con burbuja de pitch en vivo y combo, intervalos (3ª/5ª/8ª),
  escalas (mayor/menor/pentatonica) asc-desc, y modo **eco**. Tolerancia por dificultad (±50 / ±25 / ±10 cents).
- **D · Teoria musical** (`screens/players/theory.tsx`, `data/theory.ts`): quizzes (fundamentos, intervalos de oido,
  tonalidades), "coloca la nota" sobre el pentagrama, "completa el compas" en 4/4, y **glosario** buscable
  (`screens/Glossary.tsx`) con circulo de quintas.
- **E · Tecnica vocal** (`screens/players/technique.tsx`): registros pecho/cabeza con nota sobre el passaggio, y
  **detector de vibrato** (mide tasa en Hz y amplitud en cents por cruces por cero de la desviacion del tono).
- **F · Repertorio** (`screens/players/song.tsx`, `data/songs.ts`): canciones **originales o de dominio publico**
  con karaoke de afinacion nota por nota y desglose de precision. No se usan melodias ni letras con derechos.

Cada unidad termina en un **jefe** (`screens/players/boss.tsx`): reto de 3 etapas (respiracion + afinacion + teoria)
con puntaje ponderado.

## Gamificacion (transversal)

`src/game/`

- `xp.ts` — curva de nivel, XP por rendimiento (score x estrellas x bono de primera vez), umbrales de estrellas.
- `achievements.ts` — 12 logros con condiciones sobre el estado (`newlyEarned` detecta los recien cumplidos).
- `store.ts` — store Zustand: perfil, XP, racha diaria (con dia de gracia), resultados por ejercicio,
  desbloqueo de unidades (una unidad abre la siguiente al lograr >=1 estrella en todos sus ejercicios),
  historial de snapshots para las graficas de progreso.
- `persistence.ts` — IndexedDB (`idb-keyval`) con escritura *debounced*. Funciona **offline desde el primer uso**.
  Punto de extension `registerCloudSync()` para sincronizar con un backend (Laravel + MySQL/Postgres o Firebase).

El `RewardOverlay` (confeti propio en canvas, estrellas, XP, subida de nivel y logros) escucha `lastOutcome`
del store y aparece al terminar cualquier ejercicio.

## Estructura del proyecto

```
src/
  audio/       motor de microfono, deteccion de pitch, suavizado, sintesis
  music/       teoria: notas <-> Hz <-> cents, intervalos, escalas
  game/        xp, logros, store (zustand), persistencia (indexeddb)
  data/        curriculo (unidades/ejercicios), canciones, contenido de teoria
  components/  PitchMeter, FallingNotes, BreathingGuide, MicGate, Gamify, AppShell
  screens/     Onboarding, SkillMap, UnitScreen, ExercisePlayer, Progress, Settings, Glossary
    players/   un reproductor por tipo de ejercicio + registry
  test/        setup de Vitest
```

## Accesibilidad

Modo sin sonido (refuerza guias visuales), alto contraste, escala de texto ajustable, y respeto de
`prefers-reduced-motion`. Objetivo mobile-first, responsive en escritorio.

## Estado

Foundation + motor de audio + Modulos A-F jugables + gamificacion + persistencia local.
Pendiente / mejoras naturales: sincronizacion con backend real, deteccion de registro por formantes
(hoy aproximada por tono), mas repertorio y unidades, y AudioWorklet para bajar aun mas la latencia.
