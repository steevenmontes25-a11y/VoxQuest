/** Persistencia local con IndexedDB (idb-keyval). Funciona offline desde el
 *  primer uso. La sincronizacion con backend es opcional y se engancha aqui. */

import { get, set, del } from "idb-keyval";
import type { PersistedState } from "./types";

const KEY = "voxquest:save:v1";

export async function loadState(): Promise<PersistedState | null> {
  try {
    const raw = await get<PersistedState>(KEY);
    return raw ?? null;
  } catch {
    return null;
  }
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;

/** Guarda con debounce para no golpear IndexedDB en cada frame. */
export function saveState(state: PersistedState): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    void set(KEY, state).catch(() => {
      /* almacenamiento lleno o no disponible: se ignora, la app sigue en memoria */
    });
    // Empuja el mismo estado a la nube si hay un CloudSync registrado. Es
    // best-effort: encola eventos offline y reintenta por su cuenta.
    void cloudSync?.push(state).catch(() => {
      /* la cola local se conserva; cloudSync reintentara */
    });
  }, 400);
}

export async function clearState(): Promise<void> {
  await del(KEY);
}

/** Punto de extension para sincronizacion en la nube (Laravel/Firebase). */
export interface CloudSync {
  push(state: PersistedState): Promise<void>;
  pull(): Promise<PersistedState | null>;
}

export let cloudSync: CloudSync | null = null;
export function registerCloudSync(impl: CloudSync): void {
  cloudSync = impl;
}
