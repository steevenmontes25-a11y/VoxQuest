/**
 * Cloud sync for VoxQuest — the concrete implementation of the `CloudSync`
 * extension point in persistence.ts, talking to the Laravel backend.
 *
 * Design
 * ------
 * - Offline-first. Every local change is turned into append-only *events* that
 *   are stored in an IndexedDB queue. Nothing is lost if the network is down or
 *   the user is logged out.
 * - The queue is flushed to `POST /api/v1/sync` as one batch with a stable
 *   `idempotency_key` (kept across retries), so a retry never double-applies.
 * - Each event also carries a deterministic `client_generated_id`, so even if a
 *   batch partially lands and is retried, individual events dedupe server-side.
 * - The server response contains the authoritative consolidated state; we hand
 *   it to `onServerState` so the store can merge it (all merges are monotonic /
 *   "best wins", so a merge can only move progress forward).
 *
 * Wiring: call `initCloudSync(...)` once on app start (see main.tsx example at
 * the bottom of this file).
 */

import { get, set, del } from "idb-keyval";
import { apiFetch, ApiError, getToken } from "./api";
import type { PersistedState } from "./types";
import { registerCloudSync } from "./persistence";

const Q_KEY = "voxquest:sync:queue:v1";
const BASELINE_KEY = "voxquest:sync:baseline:v1";
const BATCH_KEY = "voxquest:sync:batch-key:v1";
const LAST_SYNC_KEY = "voxquest:sync:last-at";

type SyncEvent =
  | {
      type: "exercise_result";
      client_generated_id: string;
      exercise_id: string;
      score: number;
      metrics?: Record<string, number>;
      occurred_at?: string;
    }
  | {
      type: "vocal_range";
      client_generated_id: string;
      low_midi: number;
      high_midi: number;
      avg_pitch_error_cents?: number;
      recorded_at?: string;
    }
  | { type: "achievement_unlock"; achievement_id: string; unlocked_at?: string };

interface SyncResponse {
  batch: {
    id: string;
    events_applied: number;
    events_rejected: number;
    errors: unknown[];
  };
  state: ServerState;
  replayed_batch: boolean;
}

interface ServerState {
  xp_total: number;
  level: number;
  streak: { current: number; longest: number; last_activity_date: string | null };
  unlocked_units: string[];
  results: Record<
    string,
    { stars: number; best_score: number; attempts: number; metrics: Record<string, number>; last_played_at: string | null }
  >;
  achievements: { id: string; unlocked_at: string }[];
  profile: {
    onboarded: boolean;
    voice_type_key: string | null;
    voice_type_label: string | null;
    range_low_midi: number | null;
    range_high_midi: number | null;
  };
}

interface CloudSyncConfig {
  /** Called with the server's authoritative state after a successful sync/pull. */
  onServerState?: (merged: PersistedState) => void;
  /** Called after each flush attempt, success or not. */
  onStatus?: (status: SyncStatus) => void;
}

export interface SyncStatus {
  pending: number;
  online: boolean;
  authenticated: boolean;
  lastSyncAt: number | null;
  syncing: boolean;
  lastError?: string;
}

/* --------------------------------------------------------------------------- */

let config: CloudSyncConfig = {};
let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 2000;

async function readQueue(): Promise<SyncEvent[]> {
  return (await get<SyncEvent[]>(Q_KEY)) ?? [];
}

async function writeQueue(q: SyncEvent[]): Promise<void> {
  await set(Q_KEY, q);
  emitStatus();
}

async function enqueue(events: SyncEvent[]): Promise<void> {
  if (!events.length) return;
  const q = await readQueue();
  // de-dupe by client_generated_id / (type + achievement_id)
  const seen = new Set(q.map(eventKey));
  for (const e of events) {
    const k = eventKey(e);
    if (!seen.has(k)) {
      q.push(e);
      seen.add(k);
    }
  }
  await writeQueue(q);
}

function eventKey(e: SyncEvent): string {
  return e.type === "achievement_unlock" ? `ach:${e.achievement_id}` : `${e.type}:${e.client_generated_id}`;
}

/* -------- diff local state -> events (only monotonic, append-only) --------- */

function diffToEvents(prev: PersistedState | null, next: PersistedState): SyncEvent[] {
  const events: SyncEvent[] = [];
  const prevResults = prev?.results ?? {};

  for (const [exId, r] of Object.entries(next.results)) {
    const before = prevResults[exId];
    const changed =
      !before ||
      before.attempts !== r.attempts ||
      before.stars !== r.stars ||
      before.bestScore !== r.bestScore;
    if (!changed) continue;
    events.push({
      type: "exercise_result",
      // deterministic per (exercise, attempt count): replay-safe
      client_generated_id: uuidFrom(`${exId}#${r.attempts}`),
      exercise_id: exId,
      score: r.bestScore,
      metrics: r.metrics,
      occurred_at: r.lastPlayedISO
    });
  }

  const prevAch = new Set(prev?.achievements ?? []);
  for (const id of next.achievements) {
    if (!prevAch.has(id)) events.push({ type: "achievement_unlock", achievement_id: id });
  }

  const prevHist = prev?.history ?? [];
  for (const snap of next.history.slice(prevHist.length)) {
    events.push({
      type: "vocal_range",
      client_generated_id: uuidFrom(`range#${snap.dateISO}`),
      low_midi: snap.rangeLowMidi,
      high_midi: snap.rangeHighMidi,
      avg_pitch_error_cents: snap.avgPitchErrorCents || undefined,
      recorded_at: snap.dateISO
    });
  }

  return events;
}

/** Deterministic UUID v4-shaped string from a seed (FNV-1a based). */
function uuidFrom(seed: string): string {
  let h = 0x811c9dc5;
  const bytes: number[] = [];
  for (let i = 0; i < 32; i++) {
    h ^= seed.charCodeAt(i % seed.length) + i;
    h = Math.imul(h, 0x01000193) >>> 0;
    bytes.push(h & 0xff);
  }
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0"));
  hex[6] = ((parseInt(hex[6], 16) & 0x0f) | 0x40).toString(16).padStart(2, "0");
  hex[8] = ((parseInt(hex[8], 16) & 0x3f) | 0x80).toString(16).padStart(2, "0");
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

/* ----------------------- merge server state into local -------------------- */

function mergeServerState(local: PersistedState, server: ServerState): PersistedState {
  const results = { ...local.results };
  for (const [exId, sr] of Object.entries(server.results)) {
    const lr = results[exId];
    results[exId] = {
      exerciseId: exId,
      stars: Math.max(lr?.stars ?? 0, sr.stars),
      bestScore: Math.max(lr?.bestScore ?? 0, sr.best_score),
      attempts: Math.max(lr?.attempts ?? 0, sr.attempts),
      lastPlayedISO: sr.last_played_at ?? lr?.lastPlayedISO ?? new Date().toISOString(),
      metrics: { ...(lr?.metrics ?? {}), ...sr.metrics }
    };
  }

  return {
    ...local,
    totalXp: Math.max(local.totalXp, server.xp_total),
    streak: {
      count: Math.max(local.streak.count, server.streak.current),
      best: Math.max(local.streak.best, server.streak.longest),
      lastDayISO: server.streak.last_activity_date ?? local.streak.lastDayISO
    },
    unlockedUnits: Array.from(new Set([...local.unlockedUnits, ...server.unlocked_units])),
    achievements: Array.from(new Set([...local.achievements, ...server.achievements.map((a) => a.id)])),
    results,
    profile: {
      ...local.profile,
      onboarded: local.profile.onboarded || server.profile.onboarded,
      voiceTypeKey: local.profile.voiceTypeKey ?? server.profile.voice_type_key,
      voiceTypeLabel: local.profile.voiceTypeLabel ?? server.profile.voice_type_label,
      rangeLowMidi: local.profile.rangeLowMidi ?? server.profile.range_low_midi,
      rangeHighMidi: local.profile.rangeHighMidi ?? server.profile.range_high_midi
    }
  };
}

/* ------------------------------- flush loop ------------------------------- */

async function currentBatchKey(): Promise<string> {
  let key = await get<string>(BATCH_KEY);
  if (!key) {
    key = crypto.randomUUID();
    await set(BATCH_KEY, key);
  }
  return key;
}

async function flush(localState?: PersistedState): Promise<void> {
  if (flushing) return;
  if (!getToken() || (typeof navigator !== "undefined" && navigator.onLine === false)) {
    emitStatus();
    return;
  }

  const queue = await readQueue();
  if (queue.length === 0) return;

  flushing = true;
  emitStatus({ syncing: true });
  try {
    const idempotency_key = await currentBatchKey();
    const res = await apiFetch<SyncResponse>("/sync", {
      method: "POST",
      retries: 3,
      body: { idempotency_key, device_id: deviceId(), events: queue }
    });

    await writeQueue([]);
    await del(BATCH_KEY);
    await set(BASELINE_KEY, localState ?? null);
    await set(LAST_SYNC_KEY, Date.now());
    retryDelay = 2000;

    const base = localState ?? (await get<PersistedState>(BASELINE_KEY)) ?? null;
    if (base && config.onServerState) {
      config.onServerState(mergeServerState(base, res.state));
    }
  } catch (err) {
    const msg = err instanceof ApiError ? `${err.status} ${err.message}` : String(err);
    emitStatus({ lastError: msg });
    scheduleRetry();
  } finally {
    flushing = false;
    emitStatus({ syncing: false });
  }
}

function scheduleRetry(): void {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    retryDelay = Math.min(retryDelay * 2, 5 * 60_000);
    void flush();
  }, retryDelay);
}

function deviceId(): string {
  let id = localStorage.getItem("voxquest:device-id");
  if (!id) {
    id = crypto.randomUUID().slice(0, 24);
    localStorage.setItem("voxquest:device-id", id);
  }
  return id;
}

async function emitStatus(patch: Partial<SyncStatus> = {}): Promise<void> {
  if (!config.onStatus) return;
  const q = await readQueue();
  config.onStatus({
    pending: q.length,
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    authenticated: getToken() !== null,
    lastSyncAt: (await get<number>(LAST_SYNC_KEY)) ?? null,
    syncing: flushing,
    ...patch
  });
}

/* ------------------------------- public API ------------------------------ */

/**
 * Register the cloud-sync implementation. Call once, early (main.tsx).
 * `onServerState` receives a fully merged PersistedState — feed it to the store.
 */
export function initCloudSync(cfg: CloudSyncConfig = {}): void {
  config = cfg;

  registerCloudSync({
    async push(state: PersistedState) {
      // Logged out: don't accumulate an unbounded queue. Progress stays safe in
      // IndexedDB and gets uploaded on the next login (baseline is null then, so
      // the whole local state is diffed into events).
      if (!getToken()) return;
      const baseline = (await get<PersistedState>(BASELINE_KEY)) ?? null;
      await enqueue(diffToEvents(baseline, state));
      // remember the latest state so a successful flush can rebase from it
      await set(BASELINE_KEY, state);
      void flush(state);
    },

    async pull(): Promise<PersistedState | null> {
      if (!getToken()) return null;
      try {
        const { state } = await apiFetch<{ state: ServerState }>("/state");
        const base = (await get<PersistedState>(BASELINE_KEY)) ?? null;
        return base ? mergeServerState(base, state) : null;
      } catch {
        return null;
      }
    }
  });

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => void flush());
  }
  void emitStatus();
}

/** Force a flush now (e.g. from a "Sync" button). */
export function syncNow(): Promise<void> {
  return flush();
}

/** Drop all local sync bookkeeping (call on logout). */
export async function resetCloudSync(): Promise<void> {
  await Promise.all([del(Q_KEY), del(BASELINE_KEY), del(BATCH_KEY), del(LAST_SYNC_KEY)]);
}

/* ---------------------------------------------------------------------------
 * Example wiring — src/main.tsx
 * ---------------------------------------------------------------------------
 *
 *   import { initCloudSync } from "./game/cloudSync";
 *   import { useGame } from "./game/store";
 *   import { isAuthenticated } from "./game/api";
 *
 *   initCloudSync({
 *     onServerState: (merged) => {
 *       // merges are monotonic, so this only ever moves progress forward
 *       useGame.setState(merged);
 *     },
 *     onStatus: (s) => console.debug("[sync]", s)
 *   });
 *
 *   // optional: pull the server snapshot right after a login/app-start
 *   if (isAuthenticated()) {
 *     useGame.getState().hydrate().then(async () => {
 *       const pulled = await persistence.cloudSync?.pull();
 *       if (pulled) useGame.setState(pulled);
 *     });
 *   }
 *
 * The store already calls saveState() (which now also calls cloudSync.push())
 * on every change, so nothing else is required for outbound sync.
 * ------------------------------------------------------------------------- */
