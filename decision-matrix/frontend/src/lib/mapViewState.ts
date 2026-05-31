/** Persisted OpenLayers / MapLibre view per UI surface and project. */

export type MapViewStateId = 'main' | 'matrix' | 'report';

export type SavedMapViewState = {
  centerLon: number;
  centerLat: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
};

export type SavedMapViewState3D = SavedMapViewState & {
  pitch: number;
  bearing: number;
};

const DEFAULT_VIEW: SavedMapViewState = {
  centerLon: 37.6176,
  centerLat: 55.7558,
  zoom: 9,
};

const DEFAULT_VIEW_3D: SavedMapViewState3D = {
  ...DEFAULT_VIEW,
  pitch: 60,
  bearing: 0,
};

function storageKey(
  viewId: MapViewStateId,
  projectId: string | null,
  scope?: string | null,
  mode3d = false,
): string {
  const prefix = mode3d ? 'dm-map-view-3d' : 'dm-map-view';
  const base = `${prefix}:${viewId}:${projectId ?? '_none'}`;
  return scope ? `${base}:${scope}` : base;
}

function isValidState2d(s: SavedMapViewState): boolean {
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

function isValidState3d(s: SavedMapViewState3D): boolean {
  return (
    isValidState2d(s) &&
    Number.isFinite(s.pitch) &&
    s.pitch >= 0 &&
    s.pitch <= 85 &&
    Number.isFinite(s.bearing)
  );
}

export function loadMapViewState(
  viewId: MapViewStateId,
  projectId: string | null,
  scope?: string | null,
): SavedMapViewState | null {
  try {
    const raw = localStorage.getItem(storageKey(viewId, projectId, scope, false));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedMapViewState;
    return isValidState2d(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadMapViewState3d(
  viewId: MapViewStateId,
  projectId: string | null,
  scope?: string | null,
): SavedMapViewState3D | null {
  try {
    const raw = localStorage.getItem(storageKey(viewId, projectId, scope, true));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedMapViewState3D;
    if (!isValidState3d(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveMapViewState(
  viewId: MapViewStateId,
  projectId: string | null,
  state: SavedMapViewState,
  scope?: string | null,
): void {
  if (!isValidState2d(state)) return;
  const { centerLon, centerLat, zoom } = state;
  try {
    localStorage.setItem(
      storageKey(viewId, projectId, scope, false),
      JSON.stringify({ centerLon, centerLat, zoom }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function saveMapViewState3d(
  viewId: MapViewStateId,
  projectId: string | null,
  state: SavedMapViewState3D,
  scope?: string | null,
): void {
  if (!isValidState3d(state)) return;
  try {
    localStorage.setItem(storageKey(viewId, projectId, scope, true), JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

export function resolveInitialMapView(
  viewId: MapViewStateId | undefined,
  projectId: string | null,
  scope?: string | null,
): SavedMapViewState {
  if (!viewId) return DEFAULT_VIEW;
  return loadMapViewState(viewId, projectId, scope) ?? DEFAULT_VIEW;
}

export function resolveInitialMapView3d(
  viewId: MapViewStateId | undefined,
  projectId: string | null,
  scope?: string | null,
): SavedMapViewState3D {
  if (!viewId) return DEFAULT_VIEW_3D;
  return loadMapViewState3d(viewId, projectId, scope) ?? DEFAULT_VIEW_3D;
}
