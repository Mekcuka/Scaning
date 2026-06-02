import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import type { AnalysisRow, InfraLayer, InfraObject, POI } from '../api';
import { normalizeInfraSubtype } from '../api';
import { LINE_SUBTYPES } from '../api';
import { isLineSubtype } from '../infraGeometry';
import { MAP_SUBTYPE_COLORS } from '../mapIcons';
import type { ThresholdCircle } from '../../components/MapView';
import { scaleMap3dMeters } from './map3dConfig';
import { footprintHalfSizeForSubtype } from './extrusionHeights';
import { linePathForDisplay } from '../infraGeometry';
import { resolveRender3D, shouldBuildPointExtrusion } from './render3d';

const LINE_SUBTYPE_SET = new Set<string>(LINE_SUBTYPES as readonly string[]);

const STATUS_LINE_COLOR: Record<string, string> = {
  within_limit: '#4caf50',
  exceeds_limit: '#f44336',
  construction_required: '#ff9800',
};

const LINE_WIDTH_BY_SUBTYPE: Record<string, number> = {
  autoroad: 3,
  oil_pipeline: 4,
  gas_pipeline: 4,
  water_pipeline: 3,
  power_line: 2,
  methanol_pipeline: 3,
  additional_line: 2,
};

export type Map3dGeoJsonBundle = {
  infraLines: FeatureCollection<LineString>;
  infraExtrusions: FeatureCollection<Polygon>;
  infraPoints: FeatureCollection<Point>;
  pois: FeatureCollection<Point>;
  thresholds: FeatureCollection<Polygon>;
  analysisLines: FeatureCollection<LineString>;
  analysisLabels: FeatureCollection<Point>;
  infraLineLabels: FeatureCollection<Point>;
};

type LayerMaps = {
  opacityByLayer: Record<string, number>;
  colorByLayer: Record<string, string>;
};

export function layerMaps(layers: InfraLayer[] | undefined): LayerMaps {
  const opacityByLayer: Record<string, number> = {};
  const colorByLayer: Record<string, string> = {};
  layers?.forEach((l) => {
    opacityByLayer[l.id] = l.is_visible ? (l.opacity ?? 1) : 0;
    const c = (l.style_config as { color?: string })?.color;
    if (c) colorByLayer[l.id] = c;
  });
  return { opacityByLayer, colorByLayer };
}

export function resolveColor(
  subtype: string,
  layerId: string | null | undefined,
  maps: LayerMaps,
): string {
  const st = subtype.trim().toLowerCase();
  const canonical = MAP_SUBTYPE_COLORS[st];
  if (LINE_SUBTYPE_SET.has(st)) {
    return canonical || '#666';
  }
  // Point markers: canonical palette (matches 2D Lucide icons), not layer tint.
  if (canonical) return canonical;
  const custom = layerId ? maps.colorByLayer[layerId] : undefined;
  return custom || '#666';
}

export function layerVisible(
  layerId: string | null | undefined,
  maps: LayerMaps,
): boolean {
  if (!layerId) return true;
  return (maps.opacityByLayer[layerId] ?? 1) > 0;
}

function geodesicCircleRing(
  centerLon: number,
  centerLat: number,
  radiusM: number,
  steps = 64,
): number[][] {
  const latRad = (centerLat * Math.PI) / 180;
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos(latRad) || 111320;
  const ring: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (2 * Math.PI * i) / steps;
    ring.push([
      centerLon + (radiusM * Math.cos(angle)) / mPerDegLon,
      centerLat + (radiusM * Math.sin(angle)) / mPerDegLat,
    ]);
  }
  return ring;
}

function squareFootprintRing(lon: number, lat: number, halfSizeM: number): number[][] {
  const latRad = (lat * Math.PI) / 180;
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos(latRad) || 111320;
  const dLon = halfSizeM / mPerDegLon;
  const dLat = halfSizeM / mPerDegLat;
  return [
    [lon - dLon, lat - dLat],
    [lon + dLon, lat - dLat],
    [lon + dLon, lat + dLat],
    [lon - dLon, lat + dLat],
    [lon - dLon, lat - dLat],
  ];
}

function emptyCollection<G extends LineString | Point | Polygon>(): FeatureCollection<G> {
  return { type: 'FeatureCollection', features: [] };
}

function infraToFeatures(
  infraObjects: InfraObject[],
  layers: InfraLayer[] | undefined,
  showModels: boolean,
  snapPool: InfraObject[],
): Pick<Map3dGeoJsonBundle, 'infraLines' | 'infraExtrusions' | 'infraPoints'> {
  const maps = layerMaps(layers);
  const lineFeatures: Feature<LineString>[] = [];
  const extrusionFeatures: Feature<Polygon>[] = [];
  const pointFeatures: Feature<Point>[] = [];

  for (const obj of infraObjects) {
    if (!layerVisible(obj.layer_id, maps)) continue;

    const st = normalizeInfraSubtype(obj.subtype);
    const render = resolveRender3D(st, obj.properties);
    if (!render.visible) continue;

    const color = resolveColor(st, obj.layer_id, maps);
    const opacity = obj.layer_id ? (maps.opacityByLayer[obj.layer_id] ?? 1) : 1;
    const baseProps = {
      id: obj.id,
      name: obj.name,
      subtype: st,
      layer_id: obj.layer_id ?? '',
      featureKind: 'infra' as const,
      color,
      opacity,
      extrusion_height_m: scaleMap3dMeters(render.heightM * render.scale),
      extrusion_base_m: render.baseM,
    };

    if (isLineSubtype(st)) {
      const path = linePathForDisplay(obj, snapPool);
      if (!path || path.length < 2) continue;
      lineFeatures.push({
        type: 'Feature',
        id: obj.id,
        properties: {
          ...baseProps,
          line_width: LINE_WIDTH_BY_SUBTYPE[st] ?? 3,
        },
        geometry: {
          type: 'LineString',
          coordinates: path,
        },
      });
      continue;
    }

    pointFeatures.push({
      type: 'Feature',
      id: obj.id,
      properties: baseProps,
      geometry: { type: 'Point', coordinates: [obj.lon, obj.lat] },
    });

    if (!shouldBuildPointExtrusion(st, obj.properties, showModels)) continue;

    const half = scaleMap3dMeters(footprintHalfSizeForSubtype(st) * render.scale);
    extrusionFeatures.push({
      type: 'Feature',
      id: obj.id,
      properties: baseProps,
      geometry: {
        type: 'Polygon',
        coordinates: [squareFootprintRing(obj.lon, obj.lat, half)],
      },
    });
  }

  return {
    infraLines: { type: 'FeatureCollection', features: lineFeatures },
    infraExtrusions: { type: 'FeatureCollection', features: extrusionFeatures },
    infraPoints: { type: 'FeatureCollection', features: pointFeatures },
  };
}

function poisToFeatures(pois: POI[]): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  for (const poi of pois) {
    const render = resolveRender3D('poi');
    if (!render.visible) continue;
    const color = MAP_SUBTYPE_COLORS.poi;
    features.push({
      type: 'Feature',
      id: poi.id,
      properties: {
        id: poi.id,
        name: poi.name,
        subtype: 'poi',
        layer_id: '',
        featureKind: 'poi' as const,
        color,
        opacity: 1,
        extrusion_height_m: scaleMap3dMeters(render.heightM * render.scale),
        extrusion_base_m: render.baseM,
      },
      geometry: { type: 'Point', coordinates: [poi.lon, poi.lat] },
    });
  }
  return { type: 'FeatureCollection', features };
}

function poiExtrusions(pois: POI[], showModels: boolean): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = [];
  for (const poi of pois) {
    const render = resolveRender3D('poi');
    if (!render.visible) continue;
    if (!shouldBuildPointExtrusion('poi', undefined, showModels)) continue;
    const half = scaleMap3dMeters(footprintHalfSizeForSubtype('poi') * render.scale);
    features.push({
      type: 'Feature',
      id: poi.id,
      properties: {
        id: poi.id,
        name: poi.name,
        subtype: 'poi',
        layer_id: '',
        featureKind: 'poi' as const,
        color: MAP_SUBTYPE_COLORS.poi,
        opacity: 1,
        extrusion_height_m: scaleMap3dMeters(render.heightM * render.scale),
        extrusion_base_m: render.baseM,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [squareFootprintRing(poi.lon, poi.lat, half)],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function buildThresholdGeoJson(
  circles: ThresholdCircle[],
  centerLon: number,
  centerLat: number,
): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = [];
  for (const c of circles) {
    if (!c.visible || c.km <= 0) continue;
    features.push({
      type: 'Feature',
      properties: { key: c.key, color: c.color },
      geometry: {
        type: 'Polygon',
        coordinates: [geodesicCircleRing(centerLon, centerLat, c.km * 1000)],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function buildAnalysisLinesGeoJson(
  rows: AnalysisRow[],
  poiLon: number,
  poiLat: number,
): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = [];
  for (const row of rows) {
    const lon = row.anchor_lon;
    const lat = row.anchor_lat;
    if (lon == null || lat == null || !Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const dist = row.distance_km;
    const distLabel =
      dist != null && Number.isFinite(Number(dist)) ? `${Number(dist).toFixed(1)} км` : '';
    features.push({
      type: 'Feature',
      properties: {
        status: row.status,
        subtype: row.subtype,
        color: STATUS_LINE_COLOR[row.status] || '#2196f3',
        distance_km: dist,
        label: distLabel,
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [poiLon, poiLat],
          [lon, lat],
        ],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function buildInfraLineLabelsGeoJson(
  lines: FeatureCollection<LineString>,
): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  for (const f of lines.features) {
    const name = (f.properties?.name as string | undefined)?.trim();
    if (!name) continue;
    const coords = f.geometry.coordinates;
    if (coords.length < 2) continue;
    const mid = coords[Math.floor(coords.length / 2)]!;
    features.push({
      type: 'Feature',
      properties: { label: name, color: f.properties?.color || '#212121' },
      geometry: { type: 'Point', coordinates: mid },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function buildAnalysisLabelsGeoJson(
  lines: FeatureCollection<LineString>,
): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  for (const f of lines.features) {
    const label = f.properties?.label as string | undefined;
    if (!label) continue;
    const coords = f.geometry.coordinates;
    if (coords.length < 2) continue;
    const mid = coords[Math.floor(coords.length / 2)]!;
    features.push({
      type: 'Feature',
      properties: { label, color: f.properties?.color || '#212121' },
      geometry: { type: 'Point', coordinates: mid },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function buildMap3dGeoJson(input: {
  infraObjects: InfraObject[];
  /** Full project list for line endpoint snap (defaults to infraObjects). */
  snapPool?: InfraObject[];
  pois: POI[];
  layers?: InfraLayer[];
  showModels?: boolean;
  thresholdCircles?: ThresholdCircle[];
  thresholdCenter?: { lon: number; lat: number } | null;
  connectionLines?: AnalysisRow[];
  selectedPoi?: POI | null;
}): Map3dGeoJsonBundle {
  const showModels = input.showModels !== false;
  const snapPool = input.snapPool ?? input.infraObjects;
  const infra = infraToFeatures(input.infraObjects, input.layers, showModels, snapPool);
  const poiPoints = poisToFeatures(input.pois);
  const poiExtrusionFc = poiExtrusions(input.pois, showModels);

  const thresholds =
    input.thresholdCircles?.length && input.thresholdCenter
      ? buildThresholdGeoJson(
          input.thresholdCircles,
          input.thresholdCenter.lon,
          input.thresholdCenter.lat,
        )
      : emptyCollection<Polygon>();

  const analysisLines =
    input.connectionLines?.length && input.selectedPoi
      ? buildAnalysisLinesGeoJson(
          input.connectionLines,
          input.selectedPoi.lon,
          input.selectedPoi.lat,
        )
      : emptyCollection<LineString>();

  const analysisLabels = buildAnalysisLabelsGeoJson(analysisLines);
  const infraLineLabels = buildInfraLineLabelsGeoJson(infra.infraLines);

  return {
    ...infra,
    pois: poiPoints,
    infraExtrusions: {
      type: 'FeatureCollection',
      features: [...infra.infraExtrusions.features, ...poiExtrusionFc.features],
    },
    thresholds,
    analysisLines,
    analysisLabels,
    infraLineLabels,
  };
}
