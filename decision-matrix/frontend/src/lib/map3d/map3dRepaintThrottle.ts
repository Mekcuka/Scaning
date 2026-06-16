import type { Map as MapLibreMap } from 'maplibre-gl';

/** Coalesce triggerRepaint to one call per animation frame (batch async glTF loads). */
export function createRepaintThrottler(map: MapLibreMap): () => void {
  let scheduled = false;
  return () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      map.triggerRepaint();
    });
  };
}
