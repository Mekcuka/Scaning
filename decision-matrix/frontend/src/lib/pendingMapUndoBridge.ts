import type { MapUndoEntry } from './mapUndo';

const STORAGE_KEY = 'dm-pending-map-undo';

type PendingMapUndoStore = Record<string, MapUndoEntry[]>;

function readStore(): PendingMapUndoStore {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as PendingMapUndoStore;
  } catch {
    return {};
  }
}

function writeStore(store: PendingMapUndoStore): void {
  try {
    if (Object.keys(store).length === 0) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* sessionStorage unavailable */
  }
}

/** Queue undo entries from Parameters (or other non-map pages) for the map undo stack. */
export function enqueuePendingMapUndo(projectId: string, entry: MapUndoEntry): void {
  const store = readStore();
  const list = store[projectId] ?? [];
  list.push(entry);
  store[projectId] = list;
  writeStore(store);
}

export function drainPendingMapUndos(projectId: string): MapUndoEntry[] {
  const store = readStore();
  const list = store[projectId] ?? [];
  if (list.length === 0) return [];
  delete store[projectId];
  writeStore(store);
  return list;
}
