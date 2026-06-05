import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { transform } from 'ol/proj';
import { lineCoordsFromGeometry } from '../geometry';
import type { MapFeatureSelection } from '../types';

export function readFeatureGeometry(
  f: Feature,
): { sel: MapFeatureSelection; lon: number; lat: number; coords?: number[][] } | null {
  const members = f.get('features') as Feature[] | undefined;
  const inner = members?.length === 1 ? members[0] : f;
  const kind = inner.get('featureKind') as string;
  const id = inner.get('id') as string;
  if (!id || !kind) return null;
  const sel: MapFeatureSelection =
    kind === 'poi' ? { kind: 'poi', id } : { kind: 'infra', id };
  const geom = f.getGeometry();
  if (geom instanceof Point) {
    const [lon, lat] = transform(geom.getCoordinates(), 'EPSG:3857', 'EPSG:4326');
    return { sel, lon, lat };
  }
  if (geom instanceof LineString) {
    const coords = lineCoordsFromGeometry(geom);
    if (coords.length < 2) return null;
    const [lon, lat] = coords[0]!;
    return { sel, lon, lat, coords };
  }
  return null;
}
