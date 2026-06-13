export function parseMapBbox(
  bbox: string | null | undefined,
): [number, number, number, number] | null {
  if (!bbox) return null;
  const parts = bbox.split(',').map((x) => Number(x.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return parts as [number, number, number, number];
}

/** True if `viewport` lies entirely inside the buffered envelope of a prior fetch. */
export function viewportInsideFetchedBuffer(
  fetchedViewport: string,
  viewport: string,
  bufferRatio = MAP_BBOX_BUFFER_RATIO,
): boolean {
  const outer = parseMapBbox(expandMapBbox(fetchedViewport, bufferRatio));
  const inner = parseMapBbox(viewport);
  if (!outer || !inner) return false;
  const [oMinLon, oMinLat, oMaxLon, oMaxLat] = outer;
  const [iMinLon, iMinLat, iMaxLon, iMaxLat] = inner;
  return (
    iMinLon >= oMinLon && iMinLat >= oMinLat && iMaxLon <= oMaxLon && iMaxLat <= oMaxLat
  );
}

/** Skip bbox state/query updates while the user pans/zooms inside the last fetch buffer. */
export function shouldUpdateMapBbox(
  prev: string | null,
  next: string,
  bufferRatio = MAP_BBOX_BUFFER_RATIO,
): boolean {
  if (!prev || prev === next) return !prev;
  return !viewportInsideFetchedBuffer(prev, next, bufferRatio);
}

/** Parse `minLon,minLat,maxLon,maxLat` and expand by ratio (viewport buffer). */
export function expandMapBbox(bbox: string, bufferRatio = MAP_BBOX_BUFFER_RATIO): string {
  const parts = bbox.split(',').map((x) => Number(x.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return bbox;
  const [minLon, minLat, maxLon, maxLat] = parts as [number, number, number, number];
  const dLon = (maxLon - minLon) * bufferRatio;
  const dLat = (maxLat - minLat) * bufferRatio;
  return [minLon - dLon, minLat - dLat, maxLon + dLon, maxLat + dLat].join(',');
}

/**
 * Merge viewport bbox slice with full project list.
 * `keepIds` — selection; `overlayIds` — local create/update not yet in viewport API slice.
 */
export function mergeInfraForMapDisplay<T extends { id: string }>(
  viewport: T[],
  full: T[],
  keepIds: Iterable<string>,
  overlayIds?: Iterable<string>,
): T[] {
  const keep = new Set(keepIds);
  const overlay = new Set(overlayIds ?? []);
  const byId = new Map(full.map((o) => [o.id, o]));
  const out = new Map<string, T>();

  for (const o of viewport) {
    out.set(o.id, byId.get(o.id) ?? o);
  }
  for (const id of keep) {
    const obj = byId.get(id);
    if (obj) out.set(id, obj);
  }
  for (const id of overlay) {
    const obj = byId.get(id);
    if (obj) out.set(id, obj);
  }

  if (out.size === 0) return full;
  return [...out.values()];
}

export const MAP_INFRA_STALE_MS = 5 * 60 * 1000;
export const MAP_VIEWPORT_MIN_OBJECTS = 80;
/** Debounce before refetching infra by viewport after pan/zoom. */
export const MAP_BBOX_DEBOUNCE_MS = 180;
/** Expand fetched bbox so small pans do not trigger a new API call. */
export const MAP_BBOX_BUFFER_RATIO = 0.18;
export const LINE_HEAL_STORAGE_KEY = 'map-line-endpoint-heal-v1';

/** Viewport slice for map display (readonly, large projects, or while full list is loading). */
export function shouldUseViewportInfraLoad(params: {
  mapEditEnabled: boolean;
  mapBbox: string | null;
  infraCount: number;
  fullListLoading: boolean;
}): boolean {
  if (params.mapEditEnabled || !params.mapBbox) return false;
  if (params.infraCount >= MAP_VIEWPORT_MIN_OBJECTS) return true;
  return params.fullListLoading;
}

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
