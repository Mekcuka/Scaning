import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  DEFAULT_TERRAIN_EXAGGERATION,
  getMaptilerKey,
  MAP3D_LAYER_IDS,
  MAP3D_SOURCE_IDS,
} from './map3dConfig';

export function maptilerTerrainTilesUrl(key: string): string {
  return `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${encodeURIComponent(key)}`;
}

export function ensureTerrainSource(map: MapLibreMap, key: string): void {
  if (map.getSource(MAP3D_SOURCE_IDS.terrain)) return;
  map.addSource(MAP3D_SOURCE_IDS.terrain, {
    type: 'raster-dem',
    url: maptilerTerrainTilesUrl(key),
    tileSize: 512,
    maxzoom: 14,
    encoding: 'mapbox',
  });
}

function hillshadeBeforeLayerId(map: MapLibreMap): string | undefined {
  if (map.getLayer(MAP3D_LAYER_IDS.basemap)) return MAP3D_LAYER_IDS.basemap;
  return map.getStyle()?.layers?.[0]?.id;
}

export function ensureHillshadeLayer(map: MapLibreMap): void {
  if (map.getLayer(MAP3D_LAYER_IDS.hillshade)) return;
  if (!map.getSource(MAP3D_SOURCE_IDS.terrain)) return;
  map.addLayer(
    {
      id: MAP3D_LAYER_IDS.hillshade,
      type: 'hillshade',
      source: MAP3D_SOURCE_IDS.terrain,
      layout: { visibility: 'visible' },
      paint: {
        'hillshade-shadow-color': '#473B24',
        'hillshade-highlight-color': '#fff',
        'hillshade-accent-color': '#000',
        'hillshade-exaggeration': 0.35,
      },
    },
    hillshadeBeforeLayerId(map),
  );
}

export function removeMap3dTerrain(map: MapLibreMap): void {
  map.setTerrain(null);
  if (map.getLayer(MAP3D_LAYER_IDS.hillshade)) map.removeLayer(MAP3D_LAYER_IDS.hillshade);
  if (map.getSource(MAP3D_SOURCE_IDS.terrain)) map.removeSource(MAP3D_SOURCE_IDS.terrain);
}

export function applyMap3dTerrain(
  map: MapLibreMap,
  enabled: boolean,
  exaggeration = DEFAULT_TERRAIN_EXAGGERATION,
): boolean {
  const key = getMaptilerKey();
  if (!enabled || !key) {
    removeMap3dTerrain(map);
    return false;
  }

  ensureTerrainSource(map, key);
  ensureHillshadeLayer(map);
  map.setTerrain({ source: MAP3D_SOURCE_IDS.terrain, exaggeration });
  if (map.getLayer(MAP3D_LAYER_IDS.hillshade)) {
    map.setLayoutProperty(MAP3D_LAYER_IDS.hillshade, 'visibility', 'visible');
  }
  return true;
}
