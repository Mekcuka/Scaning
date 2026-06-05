import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import type Select from 'ol/interaction/Select';
import type VectorLayer from 'ol/layer/Vector';
import type VectorSource from 'ol/source/Vector';
import type { LinkedLineDragState } from '../types';

export function createApplyLinkedLineDrag(params: {
  select: Select;
  editModeRef: { current: boolean };
  linkedLineDragRef: { current: LinkedLineDragState | null };
  lineSourceRef: { current: VectorSource };
  lineLayerRef: { current: VectorLayer | null };
}) {
  const { select, editModeRef, linkedLineDragRef, lineSourceRef, lineLayerRef } = params;

  return () => {
    const dragState = linkedLineDragRef.current;
    if (!dragState || !editModeRef.current) return;
    const pointCoordsById = new Map<string, number[]>();
    select.getFeatures().forEach((f) => {
      const members = f.get('features') as Feature[] | undefined;
      const inner = members?.length === 1 ? members[0] : f;
      const id = inner.get('id') as string | undefined;
      const geom = f.getGeometry();
      if (!id || !(geom instanceof Point)) return;
      pointCoordsById.set(id, geom.getCoordinates());
    });
    if (pointCoordsById.size === 0) return;

    for (const link of dragState.links) {
      const pointCoord = pointCoordsById.get(link.pointId);
      if (!pointCoord) continue;
      const lineFeature = lineSourceRef.current
        .getFeatures()
        .find((lf) => (lf.get('id') as string | undefined) === link.lineId);
      if (!lineFeature) continue;
      const lineGeom = lineFeature.getGeometry();
      if (!(lineGeom instanceof LineString)) continue;
      const current = lineGeom.getCoordinates();
      if (current.length < 2) continue;
      const next = current.map((c) => [c[0], c[1]]);
      if (link.start) next[0] = [pointCoord[0], pointCoord[1]];
      if (link.end) next[next.length - 1] = [pointCoord[0], pointCoord[1]];
      lineFeature.setGeometry(new LineString(next));
    }
    lineLayerRef.current?.changed();
  };
}
