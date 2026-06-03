import type { AutoroadConnectResult } from './api';

export type AutoroadPlanPreviewLine = {
  coordinates: number[][];
  kind: string;
};

/** Extract plan line geometries from backend GeoJSON preview for map overlay. */
export function linesFromAutoroadPlanPreview(
  preview: AutoroadConnectResult['preview'],
): AutoroadPlanPreviewLine[] {
  if (!preview || preview.type !== 'FeatureCollection' || !Array.isArray(preview.features)) {
    return [];
  }
  const out: AutoroadPlanPreviewLine[] = [];
  for (const raw of preview.features) {
    const feat = raw as {
      geometry?: { type?: string; coordinates?: unknown };
      properties?: { kind?: string };
    };
    if (feat.geometry?.type !== 'LineString') continue;
    const coords = feat.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const line: number[][] = [];
    for (const c of coords) {
      if (!Array.isArray(c) || c.length < 2) continue;
      const lon = Number(c[0]);
      const lat = Number(c[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      line.push([lon, lat]);
    }
    if (line.length >= 2) {
      out.push({
        coordinates: line,
        kind: feat.properties?.kind ?? 'link',
      });
    }
  }
  return out;
}
