import { syncOuterGeometryToInnerFeature } from '../../../lib/mapFeatureGeometrySync';
import type Select from 'ol/interaction/Select';
import type VectorLayer from 'ol/layer/Vector';

export function lineEndpointMoved(
  draft: [number, number],
  original: [number, number],
): boolean {
  return Math.abs(draft[0] - original[0]) > 1e-6 || Math.abs(draft[1] - original[1]) > 1e-6;
}

export function createRefreshDraggedFeatureVisual(params: {
  select: Select;
  editModeRef: { current: boolean };
  pointLayerRef: { current: VectorLayer | null };
  lineLayerRef: { current: VectorLayer | null };
}) {
  const { select, editModeRef, pointLayerRef, lineLayerRef } = params;
  return () => {
    if (!editModeRef.current) return;
    const f = select.getFeatures().item(0);
    if (!f) return;
    syncOuterGeometryToInnerFeature(f);
    pointLayerRef.current?.changed();
    lineLayerRef.current?.changed();
  };
}
