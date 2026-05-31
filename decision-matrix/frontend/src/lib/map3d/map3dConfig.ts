/** Feature flag: 3D map toggle on MapPage. */
export function isMap3dEnabled(): boolean {
  return import.meta.env.VITE_MAP_3D_ENABLED === 'true';
}

export function getMaptilerKey(): string | undefined {
  const key = import.meta.env.VITE_MAPTILER_KEY?.trim();
  return key || undefined;
}

export function isMaptilerTerrainAvailable(): boolean {
  return !!getMaptilerKey();
}

export const DEFAULT_TERRAIN_EXAGGERATION = 1.2;

/** Global visual scale for 3D models, line tubes, and fill-extrusions on the map. */
export const MAP3D_OBJECT_SCALE = 5;

export function scaleMap3dMeters(meters: number): number {
  return meters * MAP3D_OBJECT_SCALE;
}

export const MAP3D_SOURCE_IDS = {
  basemap: 'dm-basemap',
  terrain: 'dm-terrain',
  thresholds: 'dm-thresholds',
  infraLines: 'dm-infra-lines',
  infraExtrusions: 'dm-infra-extrusions',
  infraPoints: 'dm-infra-points',
  pois: 'dm-pois',
  analysisLines: 'dm-analysis-lines',
  analysisLabels: 'dm-analysis-labels',
  infraLineLabels: 'dm-infra-line-labels',
} as const;

export const MAP3D_TERRAIN_TOAST_KEY = 'dm-map3d-terrain-toast-shown';

export const MAP3D_LAYER_IDS = {
  basemap: 'dm-basemap',
  hillshade: 'dm-hillshade',
  thresholds: 'dm-thresholds-fill',
  thresholdsOutline: 'dm-thresholds-outline',
  infraLines: 'dm-infra-lines',
  infraExtrusions: 'dm-infra-extrusions',
  infraPointSymbols: 'dm-infra-point-symbols',
  infraPoints: 'dm-infra-points',
  poiSymbols: 'dm-poi-symbols',
  pois: 'dm-pois',
  analysisLines: 'dm-analysis-lines',
  analysisLabels: 'dm-analysis-labels',
  infraLineLabels: 'dm-infra-line-labels',
} as const;

export const MAP3D_ICON_PREFIX = 'dm-icon-';
