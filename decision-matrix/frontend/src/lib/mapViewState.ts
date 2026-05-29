/** Persisted OpenLayers view per UI surface and project. */

export type MapViewStateId = 'main' | 'matrix' | 'report' | 'ranking';

export type SavedMapViewState = {
  centerLon: number;
  centerLat: number;
  zoom: number;
};

const DEFAULT_VIEW: SavedMapViewState = {
  centerLon: 37.6176,
  centerLat: 55.7558,
  zoom: 9,
};

function storageKey(
  viewId: MapViewStateId,
  projectId: string | null,
  scope?: string | null
): string {
  const base = `dm-map-view:${viewId}:${projectId ?? '_none'}`;
  return scope ? `${base}:${scope}` : base;
}

function isValidState(s: SavedMapViewState): boolean {
  return (
    Number.isFinite(s.centerLon) &&
    Number.isFinite(s.centerLat) &&
    Math.abs(s.centerLon) <= 180 &&
    Math.abs(s.centerLat) <= 90 &&
    Number.isFinite(s.zoom) &&
    s.zoom >= 0 &&
    s.zoom <= 24
  );
}

export function loadMapViewState(
  viewId: MapViewStateId,
  projectId: string | null,
  scope?: string | null
): SavedMapViewState | null {
  try {
    const raw = localStorage.getItem(storageKey(viewId, projectId, scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedMapViewState;
    return isValidState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveMapViewState(
  viewId: MapViewStateId,
  projectId: string | null,
  state: SavedMapViewState,
  scope?: string | null
): void {
  if (!isValidState(state)) return;
  try {
    localStorage.setItem(storageKey(viewId, projectId, scope), JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

export function resolveInitialMapView(
  viewId: MapViewStateId | undefined,
  projectId: string | null,
  scope?: string | null
): SavedMapViewState {
  if (!viewId) return DEFAULT_VIEW;
  return loadMapViewState(viewId, projectId, scope) ?? DEFAULT_VIEW;
}
