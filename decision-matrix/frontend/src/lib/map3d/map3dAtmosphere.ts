import type { Map as MapLibreMap } from 'maplibre-gl';

/** Sky gradient for pitched 3D view (MapLibre sky layer). */
export function applyMap3dAtmosphere(map: MapLibreMap): void {
  try {
    map.setSky({
      'sky-color': '#8ec8f0',
      'horizon-color': '#e8eef4',
      'sky-horizon-blend': 0.15,
    });
  } catch {
    /* unsupported */
  }
  const setFog = (map as { setFog?: (spec: object) => void }).setFog;
  if (typeof setFog === 'function') {
    try {
      setFog.call(map, {
        color: 'rgb(200, 220, 235)',
        'horizon-blend': 0.08,
        range: [0.5, 8],
      });
    } catch {
      /* fog optional per MapLibre version */
    }
  }
}
