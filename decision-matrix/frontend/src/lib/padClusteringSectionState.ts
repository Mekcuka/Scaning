/** Persist open/collapsed state of pad clustering sidebar sections (localStorage). */

const STORAGE_KEY = 'dm-pad-clustering-sections';

function readMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function readPadClusteringSectionOpen(sectionId: string, defaultOpen: boolean): boolean {
  const saved = readMap()[sectionId];
  return typeof saved === 'boolean' ? saved : defaultOpen;
}

export function writePadClusteringSectionOpen(sectionId: string, open: boolean): void {
  try {
    const map = readMap();
    map[sectionId] = open;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* localStorage unavailable */
  }
}
