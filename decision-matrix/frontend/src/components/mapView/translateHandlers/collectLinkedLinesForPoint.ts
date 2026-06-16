import LineString from 'ol/geom/LineString';
import { LINE_SUBTYPES, type InfraObject } from '../../../lib/api';
import {
  isGsBottomholeLine,
  parseGsLineEndpointFeatureId,
} from '../../../lib/wellBottomholeProperties';
import { lineEndMatchesStoredPoint } from '../featureSelection';
import type { LinkedLineDragState } from '../types';
import type VectorSource from 'ol/source/Vector';

export function collectLinkedLinesForInfraMapPoint(
  lineSource: VectorSource,
  featureId: string,
  pointLon: number,
  pointLat: number,
  infraObjects: InfraObject[],
  excludeLineIds: Set<string> = new Set(),
): LinkedLineDragState['links'] {
  const gsParsed = parseGsLineEndpointFeatureId(featureId);
  if (gsParsed) {
    const parent = infraObjects.find((o) => o.id === gsParsed.objectId);
    if (parent && isGsBottomholeLine(parent) && !excludeLineIds.has(gsParsed.objectId)) {
      return [
        {
          lineId: gsParsed.objectId,
          start: gsParsed.endpoint === 'heel',
          end: gsParsed.endpoint === 'toe',
          pointId: featureId,
        },
      ];
    }
    return [];
  }

  const links = collectLinkedLinesForPoint(
    lineSource,
    featureId,
    pointLon,
    pointLat,
    excludeLineIds,
  );

  lineSource.getFeatures().forEach((lineFeature) => {
    if (lineFeature.get('subtype') !== 'gs-bottomhole-connector') return;
    const lineId = lineFeature.get('id') as string | undefined;
    if (!lineId || excludeLineIds.has(lineId)) return;
    const heelId = lineFeature.get('heel_id') as string | undefined;
    const toeId = lineFeature.get('toe_id') as string | undefined;
    if (heelId === featureId) {
      links.push({ lineId, start: true, end: false, pointId: featureId });
    } else if (toeId === featureId) {
      links.push({ lineId, start: false, end: true, pointId: featureId });
    }
  });

  return links;
}

export function collectLinkedLinesForPoint(
  lineSource: VectorSource,
  pointId: string,
  pointLon: number,
  pointLat: number,
  excludeLineIds: Set<string>,
): LinkedLineDragState['links'] {
  const links: LinkedLineDragState['links'] = [];
  lineSource.getFeatures().forEach((lineFeature) => {
    const lineId = lineFeature.get('id') as string | undefined;
    const lineSubtype = lineFeature.get('subtype') as string | undefined;
    if (!lineId || !lineSubtype || lineSubtype === 'draft' || lineSubtype === 'measure') return;
    if (!LINE_SUBTYPES.includes(lineSubtype as (typeof LINE_SUBTYPES)[number])) return;
    if (excludeLineIds.has(lineId)) return;
    const lineGeom = lineFeature.getGeometry();
    if (!(lineGeom instanceof LineString)) return;
    const coords = lineGeom.getCoordinates();
    if (coords.length < 2) return;
    const first = coords[0]!;
    const last = coords[coords.length - 1]!;
    const start = lineEndMatchesStoredPoint(first, pointLon, pointLat);
    const end = lineEndMatchesStoredPoint(last, pointLon, pointLat);
    if (!start && !end) return;
    links.push({ lineId, start, end, pointId });
  });
  return links;
}
