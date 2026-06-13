import OlMap from 'ol/Map';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import Polygon from 'ol/geom/Polygon';
import { fromLonLat, transform } from 'ol/proj';
import Feature from 'ol/Feature';
import VectorSource from 'ol/source/Vector';
import type { InfraObject } from '../../lib/api';
import { linePathForDisplay, type LinePathDisplayOptions } from '../../lib/infraGeometry';
import { LINE_SUBTYPE_SET } from './constants';
import { LINE_VERTEX_HIT_TOLERANCE_PX } from './constants';

export function geometrySyncKey(geometry: Point | LineString | Polygon): string {
  return JSON.stringify(geometry.getCoordinates());
}

export function infraLineGeometry(
  obj: InfraObject,
  snapPool: InfraObject[],
  displayOptions?: LinePathDisplayOptions,
): LineString | null {
  const path = linePathForDisplay(obj, snapPool, displayOptions);
  if (!path) return null;
  return new LineString(path.map((c) => fromLonLat([c[0], c[1]])));
}

export function syncFeaturesById(
  source: VectorSource,
  items: { id: string; geometry: Point | LineString | Polygon; attrs: Record<string, unknown> }[],
  skipSubtype?: string
) {
  const existing = new Map<string, Feature>();
  source.getFeatures().forEach((f) => {
    if (skipSubtype && f.get('subtype') === skipSubtype) return;
    const id = f.get('id') as string | undefined;
    if (id) existing.set(id, f);
  });
  const keep = new Set<string>();
  for (const { id, geometry, attrs } of items) {
    keep.add(id);
    const geomKey = geometrySyncKey(geometry);
    const found = existing.get(id);
    if (found) {
      if (found.get('_geomKey') !== geomKey) {
        found.setGeometry(geometry.clone());
        found.set('_geomKey', geomKey);
      }
      for (const [k, v] of Object.entries(attrs)) found.set(k, v);
    } else {
      source.addFeature(
        new Feature({ geometry: geometry.clone(), id, _geomKey: geomKey, ...attrs }),
      );
    }
  }
  existing.forEach((f, id) => {
    if (!keep.has(id)) source.removeFeature(f);
  });
}

export function lineCoordsFromGeometry(geom: LineString): number[][] {
  return geom.getCoordinates().map((c) => {
    const [lon, lat] = transform(c, 'EPSG:3857', 'EPSG:4326');
    return [lon, lat];
  });
}

export function findLineVertexIndexAtPixel(
  map: OlMap,
  geom: LineString,
  pixel: number[],
  tolerancePx = LINE_VERTEX_HIT_TOLERANCE_PX,
): number | null {
  const coords = geom.getCoordinates();
  let bestIndex: number | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < coords.length; i++) {
    const vertexPixel = map.getPixelFromCoordinate(coords[i]!);
    if (!vertexPixel) continue;
    const dist = Math.hypot(vertexPixel[0]! - pixel[0]!, vertexPixel[1]! - pixel[1]!);
    if (dist <= tolerancePx && dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}

export function infraSnapPoolSignature(pool: readonly InfraObject[]): string {
  const parts: string[] = [];
  for (const o of pool) {
    if (LINE_SUBTYPE_SET.has(o.subtype)) continue;
    parts.push(`${o.id}:${o.lon}:${o.lat}`);
  }
  parts.sort();
  return parts.join('|');
}
