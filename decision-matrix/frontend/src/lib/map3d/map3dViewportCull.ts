import type { Map as MapLibreMap } from 'maplibre-gl';

/** Zoom level frozen for margin math while the camera animates (pan/zoom). */
const frozenZoomByMap = new WeakMap<MapLibreMap, number>();

/** Smaller margin when zoomed in; wider prefetch when zoomed out. */
export function viewportMarginDegForZoom(zoom: number): number {
  if (zoom >= 14) return 0.01;
  if (zoom >= 10) return 0.03;
  if (zoom >= 7) return 0.05;
  return 0.08;
}

function effectiveCullZoom(map: MapLibreMap): number {
  return frozenZoomByMap.get(map) ?? map.getZoom();
}

export function viewportMarginDegForMap(map: MapLibreMap): number {
  return viewportMarginDegForZoom(effectiveCullZoom(map));
}

/** Wider than render cull — prefetch meshes before they enter the viewport. */
export function viewportLoadMarginDegForMap(map: MapLibreMap): number {
  const renderMargin = viewportMarginDegForMap(map);
  return Math.max(renderMargin * 2.5, renderMargin + 0.025);
}

/** Freeze margin thresholds during camera animation to avoid mass pop-in/out. */
export function freezeViewportCullForMap(map: MapLibreMap): void {
  frozenZoomByMap.set(map, map.getZoom());
}

export function clearViewportCullFreezeForMap(map: MapLibreMap): void {
  frozenZoomByMap.delete(map);
}

/** Skip per-frame cull toggling while panning/zooming — main source of zoom flicker. */
export function shouldApplyViewportCull(map: MapLibreMap, cullingEnabled: boolean): boolean {
  if (!cullingEnabled) return false;
  if (map.isMoving()) return false;
  return true;
}

export function isLonLatInExpandedBounds(
  map: MapLibreMap,
  lon: number,
  lat: number,
  marginDeg?: number,
): boolean {
  const margin = marginDeg ?? viewportMarginDegForMap(map);
  const bounds = map.getBounds();
  const west = bounds.getWest() - margin;
  const east = bounds.getEast() + margin;
  const south = bounds.getSouth() - margin;
  const north = bounds.getNorth() + margin;
  if (lon < west || lon > east || lat < south || lat > north) return false;
  return true;
}
