/** Parse `minLon,minLat,maxLon,maxLat` and expand by ratio (viewport buffer). */
export function expandMapBbox(bbox: string, bufferRatio = 0.12): string {
  const parts = bbox.split(',').map((x) => Number(x.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return bbox;
  const [minLon, minLat, maxLon, maxLat] = parts as [number, number, number, number];
  const dLon = (maxLon - minLon) * bufferRatio;
  const dLat = (maxLat - minLat) * bufferRatio;
  return [minLon - dLon, minLat - dLat, maxLon + dLon, maxLat + dLat].join(',');
}

/** Merge viewport subset with objects that must stay visible (selection, paste). */
export function mergeInfraForMapDisplay<T extends { id: string }>(
  viewport: T[],
  full: T[],
  keepIds: Iterable<string>,
): T[] {
  const keep = new Set(keepIds);
  if (keep.size === 0) return viewport.length ? viewport : full;
  const byId = new Map(full.map((o) => [o.id, o]));
  const out = new Map<string, T>();
  for (const o of viewport) {
    out.set(o.id, byId.get(o.id) ?? o);
  }
  for (const id of keep) {
    const obj = byId.get(id);
    if (obj) out.set(id, obj);
  }
  return [...out.values()];
}

export const MAP_INFRA_STALE_MS = 5 * 60 * 1000;
export const MAP_VIEWPORT_MIN_OBJECTS = 80;
export const LINE_HEAL_STORAGE_KEY = 'map-line-endpoint-heal-v1';

export function lineHealDoneKey(projectId: string): string {
  return `${LINE_HEAL_STORAGE_KEY}:${projectId}`;
}

export function isLineHealDoneForProject(projectId: string): boolean {
  try {
    return localStorage.getItem(lineHealDoneKey(projectId)) === '1';
  } catch {
    return false;
  }
}

export function markLineHealDoneForProject(projectId: string): void {
  try {
    localStorage.setItem(lineHealDoneKey(projectId), '1');
  } catch {
    /* ignore */
  }
}

export function clearLineHealDoneForProject(projectId: string): void {
  try {
    localStorage.removeItem(lineHealDoneKey(projectId));
  } catch {
    /* ignore */
  }
}
