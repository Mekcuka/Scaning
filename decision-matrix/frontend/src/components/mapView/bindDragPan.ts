import type OlMap from 'ol/Map';
import DragPan from 'ol/interaction/DragPan';
import type { MapViewRefs } from './mapViewRefs';

export function bindDragPan(map: OlMap, refs: MapViewRefs): DragPan | null {
  const dragPan = map
    .getInteractions()
    .getArray()
    .find((i) => i instanceof DragPan) as DragPan | undefined;
  refs.dragPanRef.current = dragPan ?? null;
  return dragPan ?? null;
}
