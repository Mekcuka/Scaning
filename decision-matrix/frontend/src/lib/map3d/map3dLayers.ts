import type {
  ExpressionSpecification,
  Map as MapLibreMap,
  SymbolLayerSpecification,
} from 'maplibre-gl';
import { ESRI_WORLD_IMAGERY_URL } from './map3dBasemap';
import { map3dIconImageExpression } from './map3dIcons';
import { MAP3D_LAYER_IDS, MAP3D_SOURCE_IDS } from './map3dConfig';

const LINE_WIDTH_ZOOM: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  8,
  ['*', ['coalesce', ['get', 'line_width'], 2], 0.6],
  12,
  ['coalesce', ['get', 'line_width'], 3],
  16,
  ['+', ['coalesce', ['get', 'line_width'], 3], 1],
];

/** Layers that receive click queries (extrusions + invisible hit circles). */
const INTERACTIVE_LAYERS = [
  MAP3D_LAYER_IDS.infraExtrusions,
  MAP3D_LAYER_IDS.infraPointSymbols,
  MAP3D_LAYER_IDS.poiSymbols,
  MAP3D_LAYER_IDS.infraLines,
  MAP3D_LAYER_IDS.infraPoints,
  MAP3D_LAYER_IDS.pois,
] as const;

export function getMap3dInteractiveLayerIds(): readonly string[] {
  return INTERACTIVE_LAYERS;
}

const SYMBOL_LAYOUT: SymbolLayerSpecification['layout'] = {
  'icon-image': map3dIconImageExpression(),
  'icon-size': 0.85,
  'icon-allow-overlap': true,
  'text-field': ['get', 'name'],
  'text-font': ['Open Sans Regular'],
  'text-size': 11,
  'text-offset': [0, 1.2],
  'text-anchor': 'top',
  'text-optional': true,
  'text-max-width': 14,
};

const SYMBOL_PAINT = {
  'text-color': '#212121',
  'text-halo-color': '#ffffff',
  'text-halo-width': 1.5,
};

const WELL_TRAJECTORY_LINE_WIDTH: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  8,
  1.5,
  12,
  2.5,
  16,
  3,
];

/** App vector layers (call after map load). */
export function addMap3dVectorLayers(map: MapLibreMap): void {
  if (map.getLayer(MAP3D_LAYER_IDS.thresholds)) return;

  map.addLayer({
    id: MAP3D_LAYER_IDS.thresholds,
    type: 'fill',
    source: MAP3D_SOURCE_IDS.thresholds,
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': 0.14,
    },
  });

  map.addLayer({
    id: MAP3D_LAYER_IDS.thresholdsOutline,
    type: 'line',
    source: MAP3D_SOURCE_IDS.thresholds,
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 1,
      'line-dasharray': [4, 4],
      'line-opacity': 0.55,
    },
  });

  map.addLayer({
    id: MAP3D_LAYER_IDS.analysisLines,
    type: 'line',
    source: MAP3D_SOURCE_IDS.analysisLines,
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 2,
      'line-dasharray': [4, 3],
      'line-opacity': 0.9,
    },
  });

  map.addLayer({
    id: MAP3D_LAYER_IDS.analysisLabels,
    type: 'symbol',
    source: MAP3D_SOURCE_IDS.analysisLabels,
    minzoom: 10,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Open Sans Regular'],
      'text-size': 11,
      'text-anchor': 'center',
    },
    paint: {
      'text-color': '#212121',
      'text-halo-color': '#ffffff',
      'text-halo-width': 2,
    },
  });

  map.addLayer({
    id: MAP3D_LAYER_IDS.infraLines,
    type: 'line',
    source: MAP3D_SOURCE_IDS.infraLines,
    paint: {
      'line-color': ['get', 'color'],
      'line-width': [
        '+',
        LINE_WIDTH_ZOOM,
        ['case', ['boolean', ['feature-state', 'selected'], false], 2, 0],
      ],
      'line-opacity': ['coalesce', ['get', 'opacity'], 1],
    },
  });

  map.addLayer({
    id: MAP3D_LAYER_IDS.infraLineLabels,
    type: 'symbol',
    source: MAP3D_SOURCE_IDS.infraLineLabels,
    minzoom: 12,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Open Sans Regular'],
      'text-size': 11,
      'text-anchor': 'center',
      'text-optional': true,
      'text-max-width': 16,
    },
    paint: {
      'text-color': '#212121',
      'text-halo-color': '#ffffff',
      'text-halo-width': 2,
    },
  });

  map.addLayer({
    id: MAP3D_LAYER_IDS.infraExtrusions,
    type: 'fill-extrusion',
    source: MAP3D_SOURCE_IDS.infraExtrusions,
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['get', 'extrusion_height_m'],
      'fill-extrusion-base': ['get', 'extrusion_base_m'],
      'fill-extrusion-opacity': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        0.95,
        0.85,
      ],
    },
  });

  map.addLayer({
    id: MAP3D_LAYER_IDS.infraPointSymbols,
    type: 'symbol',
    source: MAP3D_SOURCE_IDS.infraPoints,
    minzoom: 11,
    layout: SYMBOL_LAYOUT,
    paint: SYMBOL_PAINT,
  });

  map.addLayer({
    id: MAP3D_LAYER_IDS.infraPoints,
    type: 'circle',
    source: MAP3D_SOURCE_IDS.infraPoints,
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        10,
        6,
      ],
      'circle-opacity': ['coalesce', ['get', 'opacity'], 0.01],
      'circle-stroke-width': 0,
    },
  });

  map.addLayer({
    id: MAP3D_LAYER_IDS.poiSymbols,
    type: 'symbol',
    source: MAP3D_SOURCE_IDS.pois,
    minzoom: 11,
    layout: SYMBOL_LAYOUT,
    paint: SYMBOL_PAINT,
  });

  map.addLayer({
    id: MAP3D_LAYER_IDS.pois,
    type: 'circle',
    source: MAP3D_SOURCE_IDS.pois,
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        12,
        8,
      ],
      'circle-opacity': 0.01,
    },
  });

  /** Pick-only fallback; visible geometry is Three.js `dm-3d-well-trajectories`. */
  map.addLayer({
    id: MAP3D_LAYER_IDS.wellTrajectories,
    type: 'line',
    source: MAP3D_SOURCE_IDS.wellTrajectories,
    paint: {
      'line-color': '#1565c0',
      'line-width': WELL_TRAJECTORY_LINE_WIDTH,
      'line-opacity': 0,
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
  });
}

function bottomStackLayerId(map: MapLibreMap): string | undefined {
  const styleLayers = map.getStyle()?.layers;
  return styleLayers?.[0]?.id;
}

/** Add/remove Esri basemap so hidden mode does not prefetch raster tiles. */
export function syncMap3dBasemap(map: MapLibreMap, visible: boolean): void {
  const hasLayer = !!map.getLayer(MAP3D_LAYER_IDS.basemap);
  const hasSource = !!map.getSource(MAP3D_SOURCE_IDS.basemap);

  if (visible) {
    if (!hasSource) {
      map.addSource(MAP3D_SOURCE_IDS.basemap, {
        type: 'raster',
        tiles: [ESRI_WORLD_IMAGERY_URL],
        tileSize: 256,
        attribution: 'Tiles © Esri',
        maxzoom: 19,
      });
    }
    if (!hasLayer) {
      map.addLayer(
        {
          id: MAP3D_LAYER_IDS.basemap,
          type: 'raster',
          source: MAP3D_SOURCE_IDS.basemap,
        },
        bottomStackLayerId(map),
      );
    } else {
      map.setLayoutProperty(MAP3D_LAYER_IDS.basemap, 'visibility', 'visible');
    }
    return;
  }

  if (hasLayer) map.removeLayer(MAP3D_LAYER_IDS.basemap);
  if (hasSource) map.removeSource(MAP3D_SOURCE_IDS.basemap);
}

/** @deprecated Use syncMap3dBasemap — visibility-only hid tiles but still loaded them. */
export function setBasemapVisibility(map: MapLibreMap, visible: boolean): void {
  syncMap3dBasemap(map, visible);
}

/**
 * MapLibre line layers are often buried under terrain in 3D.
 * When Three.js tubes are shown, keep this layer for picking only (opacity 0).
 */
export function setMap3dInfraLinesPickOnly(map: MapLibreMap, pickOnly: boolean): void {
  if (!map.getLayer(MAP3D_LAYER_IDS.infraLines)) return;
  if (pickOnly) {
    map.setPaintProperty(MAP3D_LAYER_IDS.infraLines, 'line-opacity', 0);
    map.setPaintProperty(MAP3D_LAYER_IDS.infraLines, 'line-width', [
      '+',
      LINE_WIDTH_ZOOM,
      ['case', ['boolean', ['feature-state', 'selected'], false], 6, 4],
    ]);
  } else {
    map.setPaintProperty(MAP3D_LAYER_IDS.infraLines, 'line-opacity', ['coalesce', ['get', 'opacity'], 1]);
    map.setPaintProperty(MAP3D_LAYER_IDS.infraLines, 'line-width', [
      '+',
      LINE_WIDTH_ZOOM,
      ['case', ['boolean', ['feature-state', 'selected'], false], 2, 0],
    ]);
  }
}

/** Hide 2D icon/label symbols when 3D meshes are shown (they sit above the custom layer). */
export function setMap3dPointSymbolsVisibility(map: MapLibreMap, visible: boolean): void {
  for (const layerId of [MAP3D_LAYER_IDS.infraPointSymbols, MAP3D_LAYER_IDS.poiSymbols]) {
    if (!map.getLayer(layerId)) continue;
    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
  }
}
