import LineString from 'ol/geom/LineString';
import { LINE_SUBTYPES } from '../../../lib/api';
import { lineEndMatchesStoredPoint } from '../featureSelection';
import type { LinkedLineDragState } from '../types';
import type VectorSource from 'ol/source/Vector';

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
