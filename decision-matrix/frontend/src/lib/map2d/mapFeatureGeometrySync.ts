import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';

/** OpenLayers cluster/collection wrapper: one visible member feature. */
export function resolveInnerLayerFeature(outer: Feature): Feature {
  const members = outer.get('features') as Feature[] | undefined;
  if (members?.length === 1) return members[0]!;
  return outer;
}

/**
 * Copy geometry from the selected wrapper feature to its inner layer feature.
 * During Modify/Translate the wrapper moves first; icons render on the inner feature.
 */
export function syncOuterGeometryToInnerFeature(outer: Feature): boolean {
  const inner = resolveInnerLayerFeature(outer);
  if (inner === outer) return false;
  const geom = outer.getGeometry();
  if (!(geom instanceof Point) && !(geom instanceof LineString)) return false;
  inner.setGeometry(geom.clone());
  return true;
}

export function syncOuterGeometryToInnerFeatures(features: readonly Feature[]): number {
  let synced = 0;
  for (const f of features) {
    if (syncOuterGeometryToInnerFeature(f)) synced += 1;
  }
  return synced;
}

/** Vector layers must repaint during drag-edit or only OL handles move, not icons. */
export function shouldUpdateVectorLayerWhileInteracting(editMode: boolean): boolean {
  return editMode;
}

type OlLayerWithUpdateFlag = {
  set: (key: string, value: boolean) => void;
};

/** OpenLayers stores `updateWhileInteracting` as a BaseObject property (no setter method). */
export function applyVectorLayerUpdateWhileInteracting(
  pointLayer: OlLayerWithUpdateFlag | null | undefined,
  lineLayer: OlLayerWithUpdateFlag | null | undefined,
  editMode: boolean,
  nodePointLayer?: OlLayerWithUpdateFlag | null | undefined,
): void {
  const live = shouldUpdateVectorLayerWhileInteracting(editMode);
  pointLayer?.set('updateWhileInteracting', live);
  nodePointLayer?.set('updateWhileInteracting', live);
  lineLayer?.set('updateWhileInteracting', live);
}
