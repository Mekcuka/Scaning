import { useEffect } from 'react';
import type { MapViewRefs } from './mapViewRefs';
import { setupOpenLayersMap } from './setupOpenLayersMap';

export function useMapViewInit(refs: MapViewRefs, showBasemap: boolean): void {
  useEffect(() => setupOpenLayersMap(refs, { showBasemap }), []);
}
