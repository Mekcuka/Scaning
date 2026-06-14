import { useEffect } from 'react';
import type { MapViewRefs } from './mapViewRefs';
import type { DrawMode, MapViewProps } from './types';

const EMPHASIS_DRAW_MODES = new Set<DrawMode>(['pad_placement', 'autoroad_network']);

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

function refreshEmphasisLayers(refs: MapViewRefs): void {
  refs.pointLayerRef.current?.changed();
  refs.nodePointLayerRef.current?.changed();
  refs.padFootprintLayerRef.current?.changed();
  refs.wellTrajectoryBottomholeLayerRef.current?.changed();
}

export function useMapViewEmphasisSync(
  refs: MapViewRefs,
  { drawMode = 'select', selectedFeatureIds = [] }: Pick<MapViewProps, 'drawMode' | 'selectedFeatureIds'>,
): void {
  const idsKey = selectedFeatureIds.join('|');

  useEffect(() => {
    const next = EMPHASIS_DRAW_MODES.has(drawMode)
      ? new Set(selectedFeatureIds)
      : new Set<string>();
    if (setsEqual(next, refs.emphasisFeatureIdsRef.current)) return;
    refs.emphasisFeatureIdsRef.current = next;
    refreshEmphasisLayers(refs);
  }, [drawMode, idsKey, refs, selectedFeatureIds]);
}
