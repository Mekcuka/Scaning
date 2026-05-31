import type { StyleSpecification } from 'maplibre-gl';
import { MAP3D_LAYER_IDS, MAP3D_SOURCE_IDS } from './map3dConfig';

export const ESRI_WORLD_IMAGERY_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

/** Minimal MapLibre style with Esri raster + empty GeoJSON sources for app layers. */
export function createMap3dBaseStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      [MAP3D_SOURCE_IDS.basemap]: {
        type: 'raster',
        tiles: [ESRI_WORLD_IMAGERY_URL],
        tileSize: 256,
        attribution: 'Tiles © Esri',
        maxzoom: 19,
      },
      [MAP3D_SOURCE_IDS.thresholds]: { type: 'geojson', data: EMPTY_FC, promoteId: 'id' },
      [MAP3D_SOURCE_IDS.infraLines]: { type: 'geojson', data: EMPTY_FC, promoteId: 'id' },
      [MAP3D_SOURCE_IDS.infraExtrusions]: { type: 'geojson', data: EMPTY_FC, promoteId: 'id' },
      [MAP3D_SOURCE_IDS.infraPoints]: { type: 'geojson', data: EMPTY_FC, promoteId: 'id' },
      [MAP3D_SOURCE_IDS.pois]: { type: 'geojson', data: EMPTY_FC, promoteId: 'id' },
      [MAP3D_SOURCE_IDS.analysisLines]: { type: 'geojson', data: EMPTY_FC },
      [MAP3D_SOURCE_IDS.analysisLabels]: { type: 'geojson', data: EMPTY_FC },
      [MAP3D_SOURCE_IDS.infraLineLabels]: { type: 'geojson', data: EMPTY_FC },
    },
    layers: [
      {
        id: MAP3D_LAYER_IDS.basemap,
        type: 'raster',
        source: MAP3D_SOURCE_IDS.basemap,
      },
    ],
  };
}
