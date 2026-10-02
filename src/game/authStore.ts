/**
 * Auth + cloud-sync state for the UI. The game itself never depends on this —
 * VoxQuest works fully offline and logged out. Signing in only turns on backup
 * and cross-device sync.
 */

import { create } from "zustand";
import { auth, clearToken, isAuthenticated, updateProfile, ApiError, type AuthUser } from "./api";
import { cloudSync } from "./persistence";
import { resetCloudSync, syncNow, type SyncStatus } from "./cloudSync";
import { useGame } from "./store";

interface AuthState {
  user: AuthUser | null;
  status: "unknown" | "anon" | "authed";
  busy: boolean;
  error: string | null;
  sync: SyncStatus | null;

  boot: () => Promise<void>;
  register: (input: { name: string; email: string; password: string; password_confirmation: string }) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setSync: (s: SyncStatus) => void;
  syncNow: () => Promise<void>;
}

/** Push the current local state up, then merge the server's answer back down. */
async function reconcile(): Promise<void> {
  const snapshot = snapshotForSync();

  // Profile (name + client-detected voice range) isn't part of the event stream.
  const p = snapshot.profile;
  try {
    await updateProfile({
      name: p.name || undefined,
      voice_type_key: p.voiceTypeKey,
      voice_type_label: p.voiceTypeLabel,
      range_low_midi: p.rangeLowMidi,
      range_high_midi: p.rangeHighMidi,
      mark_onboarded: p.onboarded || undefined
    });
  } catch {
    /* non-fatal: retried on the next reconcile */
  }

  await cloudSync?.push(snapshot);
  const merged = await cloudSync?.pull();
  if (merged) useGame.setState(merged);
}

function snapshotForSync() {
  const s = useGame.getState();
  return {
    profile: s.profile,
    totalXp: s.totalXp,
    streak: s.streak,
    results: s.results,
    unlockedUnits: s.unlockedUnits,
    achievements: s.achievements,
    settings: s.settings,
    history: s.history,
    version: 1 as const
  };
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  status: "unknown",
  busy: false,
  error: null,
  sync: null,

  boot: async () => {
    if (!isAuthenticated()) {
      set({ status: "anon" });
      return;
    }
    try {
      const { data } = await auth.me();
      set({ user: data, status: "authed" });
      void reconcile();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        clearToken();
        set({ status: "anon", user: null });
      } else {
        // offline: keep the token, stay optimistic
        set({ status: "authed" });
      }
    }
  },

  register: async (input) => {
    set({ busy: true, error: null });
    try {
      const user = await auth.register(input);
      set({ user, status: "authed", busy: false });
      await reconcile();
      return true;
    } catch (e) {
      set({ busy: false, error: errorMessage(e) });
      return false;
    }
  },

  login: async (email, password) => {
    set({ busy: true, error: null });
    try {
      const user = await auth.login(email, password);
      set({ user, status: "authed", busy: false });
      await reconcile();
      return true;
    } catch (e) {
      set({ busy: false, error: errorMessage(e) });
      return false;
    }
  },

  logout: async () => {
    set({ busy: true });
    await auth.logout();
    await resetCloudSync();
    set({ user: null, status: "anon", busy: false, sync: null });
  },

  setSync: (s) => set({ sync: s }),

  syncNow: async () => {
    if (get().status !== "authed") return;
    await cloudSync?.push(snapshotForSync());
    await syncNow();
    const merged = await cloudSync?.pull();
    if (merged) useGame.setState(merged);
  }
}));

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const first = Object.values(e.validationErrors)[0]?.[0];
    return first ?? e.message;
  }
  return "Algo salio mal. Intenta de nuevo.";
}
