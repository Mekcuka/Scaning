import type OlMap from 'ol/Map';
import Feature from 'ol/Feature';
import type { Coordinate } from 'ol/coordinate';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import VectorSource from 'ol/source/Vector';
import { fromLonLat, transform } from 'ol/proj';
import { LINE_SUBTYPES } from '../api';
import {
  closestPointOnPolyline,
  LINE_SPLIT_HIT_TOLERANCE_KM,
  LINE_SPLIT_HIT_TOLERANCE_PX,
} from '../lineSplit';

const LINE_SUBTYPE_SET = new Set<string>(LINE_SUBTYPES as readonly string[]);

function innerFeature(feat: Feature): Feature {
  const features = feat.get('features') as Feature[] | undefined;
  return features?.length === 1 ? features[0]! : feat;
}

function extentAroundCoordinate(
  map: OlMap,
  coordinate: Coordinate,
  hitTolerancePx: number,
): [number, number, number, number] {
  const resolution = map.getView().getResolution() ?? 1;
  const delta = resolution * hitTolerancePx;
  return [
    coordinate[0]! - delta,
    coordinate[1]! - delta,
    coordinate[0]! + delta,
    coordinate[1]! + delta,
  ];
}

function infraPointFromFeature(inner: Feature): { lon: number; lat: number; id: string } | null {
  const subtype = inner.get('subtype') as string;
  const kind = inner.get('featureKind') as string;
  const id = inner.get('id') as string | undefined;
  if (!id || subtype === 'draft') return null;
  if (kind !== 'infra') return null;
  const geom = inner.getGeometry();
  if (!(geom instanceof Point)) return null;
  const [lon, lat] = transform(geom.getCoordinates(), 'EPSG:3857', 'EPSG:4326');
  const objectId = (inner.get('infra_object_id') as string | undefined) ?? id;
  return { lon, lat, id: objectId };
}

function resolveInfraPointInSource(
  map: OlMap,
  pointSource: VectorSource,
  coordinate: Coordinate,
  hitTolerancePx: number,
): { lon: number; lat: number; id: string } | null {
  const extent = extentAroundCoordinate(map, coordinate, hitTolerancePx);
  let bestLon = 0;
  let bestLat = 0;
  let bestId = '';
  let bestDist2 = Number.POSITIVE_INFINITY;
  pointSource.forEachFeatureIntersectingExtent(extent, (feat) => {
    const inner = innerFeature(feat as Feature);
    const hit = infraPointFromFeature(inner);
    if (!hit) return;
    const geom = inner.getGeometry();
    if (!(geom instanceof Point)) return;
    const c = geom.getCoordinates();
    const dx = c[0]! - coordinate[0]!;
    const dy = c[1]! - coordinate[1]!;
    const dist2 = dx * dx + dy * dy;
    if (dist2 < bestDist2) {
      bestDist2 = dist2;
      bestLon = hit.lon;
      bestLat = hit.lat;
      bestId = hit.id;
    }
  });
  if (!Number.isFinite(bestDist2) || bestDist2 === Number.POSITIVE_INFINITY) return null;
  return { lon: bestLon, lat: bestLat, id: bestId };
}

export function resolveInfraPointAtCoordinate(
  map: OlMap,
  pointSource: VectorSource,
  coordinate: Coordinate,
  hitTolerancePx = 20,
  nodePointSource?: VectorSource,
): { lon: number; lat: number; id: string } | null {
  const primary = resolveInfraPointInSource(map, pointSource, coordinate, hitTolerancePx);
  if (primary) return primary;
  if (!nodePointSource) return null;
  return resolveInfraPointInSource(map, nodePointSource, coordinate, hitTolerancePx);
}

function closestPointDist2(inner: Feature, coordinate: Coordinate): number | null {
  const id = inner.get('id') as string | undefined;
  const subtype = inner.get('subtype') as string | undefined;
  if (!id || subtype === 'draft') return null;
  const geom = inner.getGeometry();
  if (!(geom instanceof Point)) return null;
  const c = geom.getCoordinates();
  const dx = c[0]! - coordinate[0]!;
  const dy = c[1]! - coordinate[1]!;
  return dx * dx + dy * dy;
}

function closestLineDist2(inner: Feature, coordinate: Coordinate): number | null {
  const id = inner.get('id') as string | undefined;
  const subtype = inner.get('subtype') as string | undefined;
  if (!id || subtype === 'draft') return null;
  const geom = inner.getGeometry();
  if (!(geom instanceof LineString)) return null;
  const [clickLon, clickLat] = transform(coordinate, 'EPSG:3857', 'EPSG:4326');
  const coords = geom
    .getCoordinates()
    .map((c) => transform(c, 'EPSG:3857', 'EPSG:4326') as [number, number]);
  const closest = closestPointOnPolyline([clickLon, clickLat], coords);
  if (!closest) return null;
  const snap = fromLonLat([closest.point[0]!, closest.point[1]!]);
  const dx = snap[0]! - coordinate[0]!;
  const dy = snap[1]! - coordinate[1]!;
  return dx * dx + dy * dy;
}

/** Footprint polygon hover when point icons are hidden. */
export function resolveFootprintHoverIdAtCoordinate(
  map: OlMap,
  footprintSource: VectorSource,
  coordinate: Coordinate,
  hitTolerancePx = 8,
): string | null {
  const extent = extentAroundCoordinate(map, coordinate, hitTolerancePx);
  let bestId: string | null = null;
  footprintSource.forEachFeatureIntersectingExtent(extent, (feat) => {
    if (!feat.get('footprint')) return;
    const id = feat.get('id') as string | undefined;
    if (id) bestId = id;
  });
  return bestId;
}

/** Точки (кроме узлов) → узлы → линии. */
export function resolveHoverFeatureIdAtCoordinate(
  map: OlMap,
  pointSource: VectorSource,
  lineSource: VectorSource,
  coordinate: Coordinate,
  hitTolerancePx = 8,
  nodePointSource?: VectorSource,
): string | null {
  const extent = extentAroundCoordinate(map, coordinate, hitTolerancePx);
  let bestPointId: string | null = null;
  let bestPointDist2 = Number.POSITIVE_INFINITY;
  let bestNodeId: string | null = null;
  let bestNodeDist2 = Number.POSITIVE_INFINITY;
  let bestLineId: string | null = null;
  let bestLineDist2 = Number.POSITIVE_INFINITY;

  pointSource.forEachFeatureIntersectingExtent(extent, (feat) => {
    const inner = innerFeature(feat as Feature);
    const dist2 = closestPointDist2(inner, coordinate);
    if (dist2 == null || dist2 >= bestPointDist2) return;
    bestPointDist2 = dist2;
    const infraObjectId = inner.get('infra_object_id') as string | undefined;
    bestPointId = infraObjectId ?? (inner.get('id') as string);
  });

  nodePointSource?.forEachFeatureIntersectingExtent(extent, (feat) => {
    const inner = innerFeature(feat as Feature);
    const dist2 = closestPointDist2(inner, coordinate);
    if (dist2 == null || dist2 >= bestNodeDist2) return;
    bestNodeDist2 = dist2;
    bestNodeId = inner.get('id') as string;
  });

  lineSource.forEachFeatureIntersectingExtent(extent, (feat) => {
    const inner = innerFeature(feat as Feature);
    const dist2 = closestLineDist2(inner, coordinate);
    if (dist2 == null || dist2 >= bestLineDist2) return;
    bestLineDist2 = dist2;
    bestLineId = inner.get('id') as string;
  });

  if (bestPointId != null) return bestPointId;
  if (bestNodeId != null) return bestNodeId;
  return bestLineId;
}

export type LineSplitHit = {
  feature: Feature;
  id: string;
  geom: LineString;
};

export function resolveInfraLineSplitAtCoordinate(
  map: OlMap,
  lineSource: VectorSource,
  coordinate: Coordinate,
  _pixel: number[],
  hitTolerancePx = LINE_SPLIT_HIT_TOLERANCE_PX,
): {
  lineId: string;
  lon: number;
  lat: number;
  segmentIndex: number;
} | null {
  const extent = extentAroundCoordinate(map, coordinate, hitTolerancePx);
  let lineId = '';
  let lineGeom: LineString | undefined;
  let bestDist2 = Number.POSITIVE_INFINITY;

  lineSource.forEachFeatureIntersectingExtent(extent, (feat) => {
    const inner = innerFeature(feat as Feature);
    const subtype = inner.get('subtype') as string;
    const kind = inner.get('featureKind') as string;
    const id = inner.get('id') as string | undefined;
    if (!id || subtype === 'draft' || kind !== 'infra') return;
    if (!LINE_SUBTYPE_SET.has(subtype)) return;
    const geom = inner.getGeometry();
    if (!(geom instanceof LineString)) return;
    const flat = geom.getClosestPoint(coordinate) as Coordinate;
    const dx = flat[0]! - coordinate[0]!;
    const dy = flat[1]! - coordinate[1]!;
    const dist2 = dx * dx + dy * dy;
    if (dist2 < bestDist2) {
      bestDist2 = dist2;
      lineId = id;
      lineGeom = geom;
    }
  });

  if (!lineGeom) return null;

  const [clickLon, clickLat] = transform(coordinate, 'EPSG:3857', 'EPSG:4326');
  const coords = lineGeom
    .getCoordinates()
    .map((c: Coordinate) => transform(c, 'EPSG:3857', 'EPSG:4326') as [number, number]);
  const closest = closestPointOnPolyline([clickLon, clickLat], coords);
  if (!closest || closest.distanceKm > LINE_SPLIT_HIT_TOLERANCE_KM) return null;

  return {
    lineId,
    lon: closest.point[0],
    lat: closest.point[1],
    segmentIndex: closest.segmentIndex,
  };
}
