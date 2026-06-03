import { LINE_SUBTYPES, type InfraObject } from './api';
import type { InfraPointSnapIndex } from './infraSnapIndex';
import { normalizeLinePathEndpoints } from './lineEndpointRules';

export type LinePathDisplayOptions = {
  snapIndex?: InfraPointSnapIndex;
  /** Display-only: two snapped endpoints when zoomed out. */
  lod?: 'full' | 'endpoints';
};

export function isLineSubtype(subtype: string): boolean {
  return (LINE_SUBTYPES as readonly string[]).includes(subtype);
}

/** Full vertex list for a linear infrastructure object. */
export function getLineCoordinates(obj: InfraObject): number[][] | null {
  if (obj.coordinates && obj.coordinates.length >= 2) {
    return obj.coordinates.map((c) => [c[0], c[1]]);
  }
  if (obj.end_lon != null && obj.end_lat != null) {
    return [
      [obj.lon, obj.lat],
      [obj.end_lon, obj.end_lat],
    ];
  }
  return null;
}

/**
 * Line path for map display / 3D: snap ends to nearest point objects (≤300 m).
 * Use full project `infraObjects` as snapPool, not a search-filtered subset.
 */
/**
 * Canonical horizontal path for **2D OpenLayers**, **3D tubes/ЛЭП**, and **MapLibre GeoJSON**.
 * Same `snapPool` (full project infra) must be passed everywhere or vertex coords diverge.
 */
export function linePathForDisplay(
  line: InfraObject,
  snapPool: InfraObject[],
  options?: LinePathDisplayOptions,
): [number, number][] | null {
  const coords = getLineCoordinates(line);
  if (!coords || coords.length < 2) return null;
  const path = normalizeLinePathEndpoints(
    line.subtype,
    coords.map((c) => [c[0], c[1]] as [number, number]),
    snapPool,
    options?.snapIndex,
  );
  if (!path) return null;
  if (options?.lod === 'endpoints' && path.length > 2) {
    return [path[0]!, path[path.length - 1]!];
  }
  return path;
}

/** True when two paths have the same vertex count and lon/lat per vertex (±ε). */
export function linePathsEqual(
  a: [number, number][] | null | undefined,
  b: [number, number][] | null | undefined,
  epsilon = 1e-9,
): boolean {
  if (!a || !b || a.length !== b.length || a.length < 2) return false;
  return a.every(
    (p, i) =>
      Math.abs(p[0] - b[i]![0]) <= epsilon && Math.abs(p[1] - b[i]![1]) <= epsilon,
  );
}

/** If stored coords differ from snapped ends, returns fields to persist. */
export function lineEndpointHealPayload(
  line: InfraObject,
  snapPool: InfraObject[],
  snapIndex?: InfraPointSnapIndex,
): {
  lon: number;
  lat: number;
  end_lon: number;
  end_lat: number;
  coordinates: [number, number][];
} | null {
  const path = linePathForDisplay(line, snapPool, { snapIndex });
  const raw = getLineCoordinates(line);
  if (!path || !raw || raw.length < 2) return null;

  const endsMatch =
    Math.abs(path[0]![0] - raw[0]![0]) < 1e-9 &&
    Math.abs(path[0]![1] - raw[0]![1]) < 1e-9 &&
    Math.abs(path[path.length - 1]![0] - raw[raw.length - 1]![0]!) < 1e-9 &&
    Math.abs(path[path.length - 1]![1] - raw[raw.length - 1]![1]!) < 1e-9;
  if (endsMatch) return null;

  return {
    lon: path[0]![0],
    lat: path[0]![1],
    end_lon: path[path.length - 1]![0],
    end_lat: path[path.length - 1]![1],
    coordinates: path,
  };
}
