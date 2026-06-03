import { useEffect, useRef } from 'react';
import OlMap from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import XYZ from 'ol/source/XYZ';
import type { Options as XyzOptions } from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import { boundingExtent } from 'ol/extent';
import { fromLonLat, getPointResolution, transform } from 'ol/proj';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { circular as circularPolygon } from 'ol/geom/Polygon';
import { Circle as CircleStyle, Fill, Icon, Stroke, Style, Text } from 'ol/style';
import { LINE_SUBTYPES, normalizeInfraSubtype, type InfraLayer } from '../lib/api';
import Select from 'ol/interaction/Select';
import Modify from 'ol/interaction/Modify';
import Translate from 'ol/interaction/Translate';
import DragBox from 'ol/interaction/DragBox';
import DragPan from 'ol/interaction/DragPan';
import { defaults as defaultInteractions } from 'ol/interaction/defaults';
import { click, mouseActionButton } from 'ol/events/condition';
import Overlay from 'ol/Overlay';
import type { AnalysisRow, InfraObject, POI } from '../lib/api';
import { isValidAnalysisAnchor } from '../lib/analysisDisplay';
import {
  constrainLineCoordinatesOnEdit,
  findLineEndpointAttachment,
} from '../lib/lineEndpointRules';
import { closestPointOnPolyline } from '../lib/lineSplit';
import { linePathForDisplay } from '../lib/infraGeometry';
import { MAP_SUBTYPE_COLORS, iconDataUrl } from '../lib/mapIcons';
import {
  loadMapViewState,
  resolveInitialMapView,
  saveMapViewState,
  type MapViewStateId,
} from '../lib/mapViewState';
import { useAppStore } from '../store';
import 'ol/ol.css';

function infraLineGeometry(obj: InfraObject, snapPool: InfraObject[]): LineString | null {
  const path = linePathForDisplay(obj, snapPool);
  if (!path) return null;
  return new LineString(path.map((c) => fromLonLat([c[0], c[1]])));
}

function syncFeaturesById(
  source: VectorSource,
  items: { id: string; geometry: Point | LineString; attrs: Record<string, unknown> }[],
  skipSubtype?: string
) {
  const existing = new Map<string, Feature>();
  source.getFeatures().forEach((f) => {
    if (skipSubtype && f.get('subtype') === skipSubtype) return;
    const id = f.get('id') as string | undefined;
    if (id) existing.set(id, f);
  });
  const keep = new Set<string>();
  for (const { id, geometry, attrs } of items) {
    keep.add(id);
    const found = existing.get(id);
    if (found) {
      found.setGeometry(geometry.clone());
      for (const [k, v] of Object.entries(attrs)) found.set(k, v);
    } else {
      source.addFeature(new Feature({ geometry: geometry.clone(), id, ...attrs }));
    }
  }
  existing.forEach((f, id) => {
    if (!keep.has(id)) source.removeFeature(f);
  });
}

const LINE_SUBTYPE_SET = new Set<string>(LINE_SUBTYPES as readonly string[]);

const STATUS_LINE_COLOR: Record<string, string> = {
  within_limit: '#4caf50',
  exceeds_limit: '#f44336',
  construction_required: '#ff9800',
};

export interface ThresholdCircle {
  key: string;
  km: number;
  color: string;
  visible: boolean;
}

export type DrawMode = 'select' | 'poi' | 'point' | 'line' | 'ruler';

export type SelectMode = 'single' | 'box';

export type MapFeatureSelection =
  | { kind: 'poi'; id: string }
  | { kind: 'infra'; id: string };

/** Pan/zoom target (change nonce to re-run animation). */
export type MapFocusTarget = {
  lon: number;
  lat: number;
  extentLonLat?: [number, number, number, number];
  nonce: number;
  /** Internal dedupe key (ReportPage). */
  focusKey?: string;
};

export type MeasureLabel = {
  lon: number;
  lat: number;
  text: string;
};

function resolveFeatureSelection(f: Feature): MapFeatureSelection | null {
  const features = f.get('features') as Feature[] | undefined;
  if (features && features.length > 1) {
    return null;
  }
  const inner = features?.length === 1 ? features[0] : f;
  const kind = inner.get('featureKind') as string;
  const id = inner.get('id') as string;
  const subtype = inner.get('subtype') as string;
  if (!id || subtype === 'draft') return null;
  if (kind === 'poi') return { kind: 'poi', id };
  if (kind === 'infra') return { kind: 'infra', id };
  return null;
}

function expandLayerFeatures(f: Feature): Feature[] {
  const features = f.get('features') as Feature[] | undefined;
  if (features && features.length > 1) {
    return features.filter((inner) => {
      const subtype = inner.get('subtype') as string;
      return subtype !== 'draft' && !!inner.get('id');
    });
  }
  return [f];
}

function findSelectableLayerFeature(
  pointSource: VectorSource<Feature>,
  lineSource: VectorSource<Feature>,
  id: string
): Feature | undefined {
  for (const source of [pointSource, lineSource]) {
    const found = source.getFeatures().find((f) => {
      if (f.get('subtype') === 'draft' || f.get('subtype') === 'measure') return false;
      if (f.get('id') === id) return true;
      return expandLayerFeatures(f).some((inner) => inner.get('id') === id);
    });
    if (found) return found;
  }
  return undefined;
}

export type MapClickHit = {
  overPoint?: { lon: number; lat: number; id?: string };
  overLine?: { lineId: string; lon: number; lat: number; segmentIndex: number };
};

export interface MapViewProps {
  pois?: POI[];
  infraObjects?: InfraObject[];
  /** Full project list for snapping line ends (defaults to infraObjects). */
  infraSnapPool?: InfraObject[];
  /** When false, Esri tile underlay is hidden (vectors/radii remain). */
  showBasemap?: boolean;
  drawMode?: DrawMode;
  selectMode?: SelectMode;
  onMapClick?: (lon: number, lat: number, hit?: MapClickHit) => void;
  onFinishLine?: (
    coords: number[][],
    finishAt?: { lon: number; lat: number },
    splitHint?: { lineId: string; segmentIndex: number; snapLon?: number; snapLat?: number },
  ) => void;
  /** Double-click / finish current measure polyline (ruler mode). */
  onFinishMeasure?: () => void;
  onPointerMove?: (lon: number, lat: number, overPoint?: { lon: number; lat: number }) => void;
  onPointerLeave?: () => void;
  onFeatureSelect?: (sel: MapFeatureSelection | null) => void;
  onFeatureGroupSelect?: (sels: MapFeatureSelection[]) => void;
  onGeometryChange?: (sel: MapFeatureSelection, lon: number, lat: number, coords?: number[][]) => void;
  /** Group move in box-select mode (Translate interaction). */
  onBatchGeometryChange?: (
    items: { sel: MapFeatureSelection; lon: number; lat: number; coords?: number[][] }[],
  ) => void | Promise<void>;
  onBboxChange?: (bbox: string) => void;
  onViewChange?: (info: { zoom: number; scaleLabel: string }) => void;
  height?: string;
  connectionLines?: AnalysisRow[];
  selectedPoi?: POI | null;
  selectedFeatureId?: string | null;
  selectedFeatureIds?: string[];
  thresholdCircles?: ThresholdCircle[];
  draftLine?: number[][];
  /** Dashed segment from last draft vertex to cursor (line draw mode). */
  draftLinePreview?: [number, number] | null;
  /** Active measure polyline (lon/lat vertices). */
  measureLine?: number[][];
  measurePreview?: [number, number] | null;
  /** Finished measure polylines (stay on map until reset). */
  measureCompletedLines?: number[][][];
  /** Label following cursor while drawing. */
  measureCursorLabel?: MeasureLabel | null;
  /** Labels at finished measure endpoints. */
  measureAnchorLabels?: MeasureLabel[];
  showRadii?: boolean;
  useMapIcons?: boolean;
  layers?: InfraLayer[];
  mapFocus?: MapFocusTarget | null;
  /** Fit map extent to all visible objects (button under OL zoom controls). */
  onFitView?: () => void;
  /** When false: view-only — no drag-edit of geometries (select/view still allowed). */
  editMode?: boolean;
  /** Ghost icon at cursor while placing point infrastructure. */
  placementPreview?: { subtype: string; lon: number; lat: number } | null;
  /** Ghost markers while positioning clipboard paste. */
  clipboardPreviewPoints?: { subtype: string; lon: number; lat: number }[];
  /** When true, map click in select mode runs onMapClick (paste anchor). */
  pasteMode?: boolean;
  /** Remember pan/zoom per project when leaving the page (main / matrix / report). */
  viewStateId?: MapViewStateId;
  /** Optional sub-key (e.g. POI id on the report map). */
  viewStateScope?: string | null;
  /** When false, do not restore or save pan/zoom (report preview always fits via mapFocus). */
  persistViewState?: boolean;
  /** Latest 2D center/zoom (e.g. for 2D→3D camera sync). */
  onViewStateSnapshot?: (state: { centerLon: number; centerLat: number; zoom: number }) => void;
}

type LinkedLineDragState = {
  sessionId: number;
  links: { lineId: string; start: boolean; end: boolean; pointId: string }[];
};

type LineModifySession = {
  sessionId: number;
  lineId: string;
  subtype: string;
  originalStart: [number, number];
  originalFinish: [number, number];
  originalStartAttach: ReturnType<typeof findLineEndpointAttachment>;
  originalFinishAttach: ReturnType<typeof findLineEndpointAttachment>;
};

function lineCoordsFromGeometry(geom: LineString): number[][] {
  return geom.getCoordinates().map((c) => {
    const [lon, lat] = transform(c, 'EPSG:3857', 'EPSG:4326');
    return [lon, lat];
  });
}

const LINE_VERTEX_HIT_TOLERANCE_PX = 10;

function findLineVertexIndexAtPixel(
  map: OlMap,
  geom: LineString,
  pixel: number[],
  tolerancePx = LINE_VERTEX_HIT_TOLERANCE_PX,
): number | null {
  const coords = geom.getCoordinates();
  let bestIndex: number | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < coords.length; i++) {
    const vertexPixel = map.getPixelFromCoordinate(coords[i]!);
    if (!vertexPixel) continue;
    const dist = Math.hypot(vertexPixel[0]! - pixel[0]!, vertexPixel[1]! - pixel[1]!);
    if (dist <= tolerancePx && dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function layerOpacityMap(layers: InfraLayer[] | undefined): Record<string, number> {
  const m: Record<string, number> = {};
  layers?.forEach((l) => {
    m[l.id] = l.is_visible ? (l.opacity ?? 1) : 0;
  });
  return m;
}

function layerColorMap(layers: InfraLayer[] | undefined): Record<string, string> {
  const m: Record<string, string> = {};
  layers?.forEach((l) => {
    const c = (l.style_config as { color?: string })?.color;
    if (c) m[l.id] = c;
  });
  return m;
}

/** Fast tile defaults: no fade-in; subdomains {a-d} for parallel HTTP/2 requests. */
const XYZ_TILE_DEFAULTS: Pick<XyzOptions, 'crossOrigin' | 'transition' | 'maxZoom'> = {
  crossOrigin: 'anonymous',
  transition: 0,
  maxZoom: 19,
};

let esriBasemapSource: XYZ | null = null;

function getEsriBasemapSource(): XYZ {
  if (!esriBasemapSource) {
    esriBasemapSource = new XYZ({
      ...XYZ_TILE_DEFAULTS,
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attributions: 'Tiles © Esri',
    });
  }
  return esriBasemapSource;
}

function createBasemapLayer(): TileLayer {
  return new TileLayer({
    source: getEsriBasemapSource(),
    preload: 2,
    cacheSize: 512,
  });
}

function lineStyleForStatus(status: string): Style {
  const color = STATUS_LINE_COLOR[status] || '#2196f3';
  const dashed = status === 'construction_required';
  return new Style({
    stroke: new Stroke({
      color,
      width: 2,
      lineDash: dashed ? [8, 8] : undefined,
    }),
  });
}

const HOVER_GLOW = 'rgba(33, 150, 243, 0.28)';
const HOVER_RING_FILL = 'rgba(33, 150, 243, 0.1)';
const HOVER_RING_STROKE = 'rgba(33, 150, 243, 0.45)';
const LINE_ENDPOINT_FOLLOW_TOLERANCE_M = 250;

function lineStrokeStyles(color: string, width: number, hovered: boolean): Style[] {
  if (!hovered) {
    return [
      new Style({
        stroke: new Stroke({ color, width, lineCap: 'round', lineJoin: 'round' }),
      }),
    ];
  }
  return [
    new Style({
      stroke: new Stroke({
        color: HOVER_GLOW,
        width: width + 8,
        lineCap: 'round',
        lineJoin: 'round',
      }),
    }),
    new Style({
      stroke: new Stroke({
        color,
        width: width + 1,
        lineCap: 'round',
        lineJoin: 'round',
      }),
    }),
  ];
}

function softHoverRing(scale = 1): Style {
  return new Style({
    image: new CircleStyle({
      radius: 20 * scale,
      fill: new Fill({ color: HOVER_RING_FILL }),
      stroke: new Stroke({ color: HOVER_RING_STROKE, width: 1.5 }),
    }),
  });
}

function pointIconStyle(subtype: string, scale = 1): Style[] {
  const isPoi = subtype === 'poi';
  const iconScale = (isPoi ? 1.1 : 0.95) * scale;
  // Lucide SVG icons are stroke-only; add invisible circle so the whole icon area is clickable.
  const hitRadius = (isPoi ? 18 : 16) * scale;
  return [
    new Style({
      image: new CircleStyle({
        radius: hitRadius,
        fill: new Fill({ color: 'rgba(255,255,255,0.001)' }),
      }),
    }),
    new Style({
      image: new Icon({
        src: iconDataUrl(subtype),
        scale: iconScale,
        anchor: [0.5, isPoi ? 1 : 0.5],
      }),
    }),
  ];
}

function fallbackPointStyle(subtype: string, scale = 1): Style {
  const color = subtype === 'poi' ? '#e53935' : MAP_SUBTYPE_COLORS[subtype] || '#666';
  return new Style({
    image: new CircleStyle({
      radius: (subtype === 'poi' ? 10 : 7) * scale,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: '#fff', width: 2 }),
    }),
  });
}

function placementPreviewStyles(subtype: string, useIcons: boolean): Style[] {
  const ring = new Style({
    image: new CircleStyle({
      radius: 22,
      fill: new Fill({ color: 'rgba(33, 150, 243, 0.12)' }),
      stroke: new Stroke({ color: 'rgba(33, 150, 243, 0.55)', width: 2, lineDash: [5, 5] }),
    }),
  });
  const base = useIcons ? pointIconStyle(subtype, 1) : [fallbackPointStyle(subtype, 1)];
  return [ring, ...base];
}

function pointFeatureStyles(
  subtype: string,
  scale: number,
  hovered: boolean,
  useIcons: boolean
): Style[] {
  const iconScale = hovered ? scale * 1.06 : scale;
  const base = useIcons ? pointIconStyle(subtype, iconScale) : [fallbackPointStyle(subtype, iconScale)];
  return hovered ? [softHoverRing(iconScale), ...base] : base;
}

export function MapView({
  pois = [],
  infraObjects = [],
  infraSnapPool,
  showBasemap = true,
  drawMode = 'select',
  selectMode = 'single',
  onMapClick,
  onFinishLine,
  onFinishMeasure,
  onPointerMove,
  onPointerLeave,
  onFeatureSelect,
  onFeatureGroupSelect,
  onGeometryChange,
  onBatchGeometryChange,
  onBboxChange,
  onViewChange,
  height = '100%',
  connectionLines = [],
  selectedPoi = null,
  selectedFeatureId = null,
  selectedFeatureIds = [],
  thresholdCircles = [],
  draftLine = [],
  draftLinePreview = null,
  measureLine = [],
  measurePreview = null,
  measureCompletedLines = [],
  measureCursorLabel = null,
  measureAnchorLabels = [],
  showRadii = true,
  useMapIcons = true,
  layers = [],
  mapFocus = null,
  onFitView,
  editMode = false,
  placementPreview = null,
  clipboardPreviewPoints = [],
  pasteMode = false,
  viewStateId,
  viewStateScope = null,
  persistViewState = true,
  onViewStateSnapshot,
}: MapViewProps) {
  const projectId = useAppStore((s) => s.currentProjectId);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const infraObjectsRef = useRef(infraObjects);
  infraObjectsRef.current = infraObjects;
  const infraSnapPoolRef = useRef(infraSnapPool);
  infraSnapPoolRef.current = infraSnapPool;
  const poisRef = useRef(pois);
  poisRef.current = pois;
  const syncInfraDataToLayersRef = useRef<(() => void) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OlMap | null>(null);
  const pointSourceRef = useRef(new VectorSource());
  const lineSourceRef = useRef(new VectorSource());
  const radiusSourceRef = useRef(new VectorSource());
  const placementPreviewSourceRef = useRef(new VectorSource());
  const connectionSourceRef = useRef(new VectorSource());
  const selectRef = useRef<Select | null>(null);
  const modifyRef = useRef<Modify | null>(null);
  const translateRef = useRef<Translate | null>(null);
  const dragBoxRef = useRef<DragBox | null>(null);
  const dragPanRef = useRef<DragPan | null>(null);
  const pointLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const lineLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const basemapLayerRef = useRef<TileLayer | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const onPointerMoveRef = useRef(onPointerMove);
  const onPointerLeaveRef = useRef(onPointerLeave);
  const onFeatureSelectRef = useRef(onFeatureSelect);
  const onFeatureGroupSelectRef = useRef(onFeatureGroupSelect);
  const onGeometryChangeRef = useRef(onGeometryChange);
  const onBatchGeometryChangeRef = useRef(onBatchGeometryChange);
  const onBboxChangeRef = useRef(onBboxChange);
  const onViewChangeRef = useRef(onViewChange);
  const onFitViewRef = useRef(onFitView);
  const onFinishLineRef = useRef(onFinishLine);
  const onFinishMeasureRef = useRef(onFinishMeasure);
  const draftLineRef = useRef(draftLine);
  const cursorMeasureOverlayRef = useRef<Overlay | null>(null);
  const anchorMeasureOverlaysRef = useRef<Overlay[]>([]);
  const drawModeRef = useRef(drawMode);
  const pasteModeRef = useRef(pasteMode);
  const editModeRef = useRef(editMode);
  const selectModeRef = useRef(selectMode);
  const useIconsRef = useRef(useMapIcons);
  const suppressDataSyncRef = useRef(false);
  const infraIdsRef = useRef<Set<string>>(new Set());
  const linkedLineDragRef = useRef<LinkedLineDragState | null>(null);
  const lineModifySessionRef = useRef<LineModifySession | null>(null);
  const modifySessionRef = useRef(0);
  const translateSessionRef = useRef(0);
  const translateStartGeomsRef = useRef(
    new Map<string, { sel: MapFeatureSelection; lon: number; lat: number; coords?: number[][] }>(),
  );
  const suppressMapClickRef = useRef(false);
  const lineRightClickRef = useRef({ at: 0, x: 0, y: 0 });
  const persistViewStateRef = useRef(persistViewState);
  persistViewStateRef.current = persistViewState;
  const onViewStateSnapshotRef = useRef(onViewStateSnapshot);
  onViewStateSnapshotRef.current = onViewStateSnapshot;
  const viewStateIdRef = useRef(viewStateId);
  const viewStateScopeRef = useRef(viewStateScope);
  const projectIdRef = useRef(projectId);
  const prevProjectIdForViewRef = useRef<string | null | undefined>(undefined);

  viewStateIdRef.current = viewStateId;
  viewStateScopeRef.current = viewStateScope;
  projectIdRef.current = projectId;

  onMapClickRef.current = onMapClick;
  onPointerMoveRef.current = onPointerMove;
  onPointerLeaveRef.current = onPointerLeave;
  onFeatureSelectRef.current = onFeatureSelect;
  onFeatureGroupSelectRef.current = onFeatureGroupSelect;
  onGeometryChangeRef.current = onGeometryChange;
  onBatchGeometryChangeRef.current = onBatchGeometryChange;
  onBboxChangeRef.current = onBboxChange;
  onViewChangeRef.current = onViewChange;
  onFitViewRef.current = onFitView;
  onFinishLineRef.current = onFinishLine;
  onFinishMeasureRef.current = onFinishMeasure;
  draftLineRef.current = draftLine;
  drawModeRef.current = drawMode;
  pasteModeRef.current = pasteMode;
  editModeRef.current = editMode;
  selectModeRef.current = selectMode;
  useIconsRef.current = useMapIcons;

  useEffect(() => {
    if (!containerRef.current) return;

    const lineLayer = new VectorLayer({
      source: lineSourceRef.current,
      zIndex: 3,
      style: (feature) => {
        const subtype = feature.get('subtype') as string;
        if (subtype === 'draft') {
          return new Style({
            stroke: new Stroke({ color: '#2196f3', width: 2.5 }),
          });
        }
        if (subtype === 'draft-preview') {
          return new Style({
            stroke: new Stroke({ color: '#2196f3', width: 2, lineDash: [8, 6] }),
          });
        }
        if (subtype === 'draft-point') {
          return new Style({
            image: new CircleStyle({
              radius: 7,
              fill: new Fill({ color: '#2196f3' }),
              stroke: new Stroke({ color: '#fff', width: 2 }),
            }),
          });
        }
        if (subtype === 'measure') {
          return new Style({
            stroke: new Stroke({ color: '#c45c00', width: 2.5, lineDash: [8, 6] }),
          });
        }
        const id = feature.get('id') as string;
        const hovered = id && hoveredIdRef.current === id;
        const layerId = feature.get('layer_id') as string | undefined;
        const opacityByLayer = layerOpacityMap(layersRef.current);
        const colorByLayer = layerColorMap(layersRef.current);
        const op = layerId ? opacityByLayer[layerId] ?? 1 : 1;
        const custom = layerId ? colorByLayer[layerId] : undefined;
        // For linear objects keep canonical subtype colors; layer color remains for non-line objects.
        const color = LINE_SUBTYPE_SET.has(subtype)
          ? (MAP_SUBTYPE_COLORS[subtype] || '#666')
          : (custom || MAP_SUBTYPE_COLORS[subtype] || '#666');
        const strokeColor =
          op < 1 && color.startsWith('#')
            ? `${color}${Math.round(op * 255)
                .toString(16)
                .padStart(2, '0')}`
            : color;
        return lineStrokeStyles(strokeColor, 3, !!hovered);
      },
    });

    const pointLayer = new VectorLayer({
      source: pointSourceRef.current,
      zIndex: 4,
      style: (feature) => {
        const subtype = feature.get('subtype') as string;
        const id = feature.get('id') as string;
        const layerId = feature.get('layer_id') as string | undefined;
        const opacityByLayer = layerOpacityMap(layersRef.current);
        const op = layerId ? opacityByLayer[layerId] ?? 1 : 1;
        const scale = (op < 0.5 ? 0.85 : 1);
        if (op <= 0) return new Style({});
        const hovered = !!id && hoveredIdRef.current === id;
        return pointFeatureStyles(subtype, scale, hovered, useIconsRef.current);
      },
    });
    pointLayerRef.current = pointLayer;
    lineLayerRef.current = lineLayer;

    const radiusLayer = new VectorLayer({
      source: radiusSourceRef.current,
      zIndex: 1,
      style: (feature) => {
        const color = (feature.get('color') as string) || '#999';
        return new Style({
          fill: new Fill({ color: color + '26' }),
          stroke: new Stroke({ color, width: 1, lineDash: [4, 4] }),
        });
      },
    });

    const placementPreviewLayer = new VectorLayer({
      source: placementPreviewSourceRef.current,
      zIndex: 6,
      style: (feature) =>
        placementPreviewStyles(feature.get('subtype') as string, useIconsRef.current),
    });

    const connectionLayer = new VectorLayer({
      source: connectionSourceRef.current,
      zIndex: 5,
      style: (feature) => {
        const base = lineStyleForStatus(feature.get('status') as string);
        const dist = feature.get('distance_km') as number | null | undefined;
        if (dist == null) return base;
        const geom = feature.getGeometry();
        if (!(geom instanceof LineString)) return base;
        const mid = geom.getCoordinateAt(0.5);
        return [
          base,
          new Style({
            geometry: new Point(mid),
            text: new Text({
              text: `${Number(dist).toFixed(1)} км`,
              font: '11px system-ui,sans-serif',
              fill: new Fill({ color: '#212121' }),
              stroke: new Stroke({ color: '#ffffff', width: 3 }),
              offsetY: -10,
            }),
          }),
        ];
      },
    });

    const basemapLayer = createBasemapLayer();
    basemapLayer.setVisible(showBasemap);
    basemapLayerRef.current = basemapLayer;

    const map = new OlMap({
      target: containerRef.current,
      layers: [
        basemapLayer,
        radiusLayer,
        connectionLayer,
        lineLayer,
        pointLayer,
        placementPreviewLayer,
      ],
      interactions: defaultInteractions({ doubleClickZoom: false }),
      view: (() => {
        const initial = resolveInitialMapView(
          viewStateIdRef.current,
          projectIdRef.current,
          viewStateScopeRef.current
        );
        return new View({
          center: fromLonLat([initial.centerLon, initial.centerLat]),
          zoom: initial.zoom,
        });
      })(),
    });

    const dragPan = map
      .getInteractions()
      .getArray()
      .find((i) => i instanceof DragPan) as DragPan | undefined;
    dragPanRef.current = dragPan ?? null;

    const select = new Select({
      condition: click,
      layers: [pointLayer, lineLayer],
      hitTolerance: 6,
    });
    const modify = new Modify({ features: select.getFeatures() });
    const dragBox = new DragBox({
      className: 'ol-dragbox-select',
      condition: (evt) => {
        if (!mouseActionButton(evt)) return false;
        if (drawModeRef.current !== 'select' || selectModeRef.current !== 'box') return false;
        if (pasteModeRef.current) return false;
        // While group is selected, drag moves features (Translate), not a new box.
        if (select.getFeatures().getLength() > 0) return false;
        return true;
      },
    });
    selectRef.current = select;
    modifyRef.current = modify;
    dragBoxRef.current = dragBox;

    select.on('select', (e) => {
      if (drawModeRef.current !== 'select' || selectModeRef.current !== 'single') return;
      const f = e.selected[0];
      if (!f) {
        onFeatureSelectRef.current?.(null);
        return;
      }
      const sel = resolveFeatureSelection(f);
      if (!sel) {
        onFeatureSelectRef.current?.(null);
        return;
      }
      onFeatureSelectRef.current?.(sel);
    });

    dragBox.on('boxend', () => {
      if (drawModeRef.current !== 'select' || selectModeRef.current !== 'box') return;

      const extent = dragBox.getGeometry().getExtent();
      const collection = select.getFeatures();
      collection.clear();

      const selections: MapFeatureSelection[] = [];
      const seen = new Set<string>();
      const addFeature = (layerFeature: Feature) => {
        const members = expandLayerFeatures(layerFeature);
        let addedVisual = false;
        for (const inner of members) {
          const sel = resolveFeatureSelection(inner);
          if (!sel || seen.has(sel.id)) continue;
          seen.add(sel.id);
          selections.push(sel);
          if (!addedVisual) {
            collection.push(layerFeature);
            addedVisual = true;
          }
        }
      };

      lineSourceRef.current.forEachFeatureIntersectingExtent(extent, (feature) => {
        addFeature(feature);
      });
      pointSourceRef.current.forEachFeatureIntersectingExtent(extent, (feature) => {
        addFeature(feature);
      });

      onFeatureGroupSelectRef.current?.(selections);
    });

    const resolveInfraPointAtPixel = (
      pixel: number[],
    ): { lon: number; lat: number; id: string } | null => {
      const hit = map.forEachFeatureAtPixel(
        pixel,
        (feat, layer) => {
          if (layer !== pointLayer) return undefined;
          const features = feat.get('features') as Feature[] | undefined;
          const inner = features?.length === 1 ? features[0] : feat;
          const subtype = inner.get('subtype') as string;
          const kind = inner.get('featureKind') as string;
          const id = inner.get('id') as string | undefined;
          if (!id || subtype === 'draft') return undefined;
          if (kind !== 'infra') return undefined;
          const geom = inner.getGeometry();
          if (!(geom instanceof Point)) return undefined;
          const [lon, lat] = transform(geom.getCoordinates(), 'EPSG:3857', 'EPSG:4326');
          return { lon, lat, id };
        },
        { hitTolerance: 20, layerFilter: (l) => l === pointLayer },
      );
      return hit ?? null;
    };

    const resolveInfraLineSplitAtPixel = (
      pixel: number[],
    ): MapClickHit['overLine'] | null => {
      const hit = map.forEachFeatureAtPixel(
        pixel,
        (feat, layer) => {
          if (layer !== lineLayer) return undefined;
          const features = feat.get('features') as Feature[] | undefined;
          const inner = features?.length === 1 ? features[0] : feat;
          const subtype = inner.get('subtype') as string;
          const kind = inner.get('featureKind') as string;
          const id = inner.get('id') as string | undefined;
          if (!id || subtype === 'draft' || kind !== 'infra') return undefined;
          if (!LINE_SUBTYPE_SET.has(subtype)) return undefined;
          const geom = inner.getGeometry();
          if (!(geom instanceof LineString)) return undefined;
          return { feature: inner, id, geom };
        },
        { hitTolerance: 16, layerFilter: (l) => l === lineLayer },
      );
      if (!hit) return null;

      const clickCoord = map.getCoordinateFromPixel(pixel);
      if (!clickCoord) return null;
      const [clickLon, clickLat] = transform(clickCoord, 'EPSG:3857', 'EPSG:4326');
      const coords = lineCoordsFromGeometry(hit.geom);
      const closest = closestPointOnPolyline([clickLon, clickLat], coords);
      if (!closest) return null;

      return {
        lineId: hit.id,
        lon: closest.point[0],
        lat: closest.point[1],
        segmentIndex: closest.segmentIndex,
      };
    };

    const lineEndpointMoved = (
      draft: [number, number],
      original: [number, number],
    ): boolean => Math.abs(draft[0] - original[0]) > 1e-6 || Math.abs(draft[1] - original[1]) > 1e-6;

    modify.on('modifystart', () => {
      const sessionId = ++modifySessionRef.current;
      suppressDataSyncRef.current = true;
      linkedLineDragRef.current = null;
      lineModifySessionRef.current = null;
      if (!editModeRef.current) return;
      const collection = select.getFeatures();
      const f = collection.item(0);
      if (!f) return;
      const members = f.get('features') as Feature[] | undefined;
      const inner = members?.length === 1 ? members[0] : f;
      const subtype = inner.get('subtype') as string;
      const kind = inner.get('featureKind') as string;
      const id = inner.get('id') as string;
      const geom = f.getGeometry();
      if (!id || kind !== 'infra') return;

      if (geom instanceof LineString && LINE_SUBTYPE_SET.has(subtype)) {
        const coords = lineCoordsFromGeometry(geom);
        if (coords.length < 2) return;
        const pool = infraObjectsRef.current.filter((o) => o.id !== id);
        const originalStart = coords[0] as [number, number];
        const originalFinish = coords[coords.length - 1] as [number, number];
        lineModifySessionRef.current = {
          sessionId,
          lineId: id,
          subtype,
          originalStart,
          originalFinish,
          originalStartAttach: findLineEndpointAttachment(subtype, 'start', originalStart, pool),
          originalFinishAttach: findLineEndpointAttachment(
            subtype,
            'finish',
            originalFinish,
            pool,
          ),
        };
        return;
      }

      if (!(geom instanceof Point)) return;
      const pointCoord = geom.getCoordinates();
      const links: LinkedLineDragState['links'] = [];
      lineSourceRef.current.getFeatures().forEach((lineFeature) => {
        const lineId = lineFeature.get('id') as string | undefined;
        const lineSubtype = lineFeature.get('subtype') as string | undefined;
        if (!lineId || !lineSubtype || lineSubtype === 'draft' || lineSubtype === 'measure') return;
        if (!LINE_SUBTYPES.includes(lineSubtype as typeof LINE_SUBTYPES[number])) return;
        const lineGeom = lineFeature.getGeometry();
        if (!(lineGeom instanceof LineString)) return;
        const coords = lineGeom.getCoordinates();
        if (coords.length < 2) return;
        const first = coords[0];
        const last = coords[coords.length - 1];
        const start = Math.hypot(first[0] - pointCoord[0], first[1] - pointCoord[1]) <= LINE_ENDPOINT_FOLLOW_TOLERANCE_M;
        const end = Math.hypot(last[0] - pointCoord[0], last[1] - pointCoord[1]) <= LINE_ENDPOINT_FOLLOW_TOLERANCE_M;
        if (!start && !end) return;
        links.push({ lineId, start, end, pointId: id });
      });
      if (links.length > 0) {
        linkedLineDragRef.current = { sessionId, links };
      }
    });

    modify.on('modifyend', (evt) => {
      const sessionId = modifySessionRef.current;
      const finishSession = () => {
        // Ignore stale completions from previous drags.
        if (sessionId !== modifySessionRef.current) return;
        linkedLineDragRef.current = null;
        lineModifySessionRef.current = null;
        suppressDataSyncRef.current = false;
        syncInfraDataToLayersRef.current?.();
      };
      if (!editModeRef.current) {
        finishSession();
        return;
      }
      const collection = select.getFeatures();
      const f = collection.item(0);
      if (!f) {
        finishSession();
        return;
      }
      const members = f.get('features') as Feature[] | undefined;
      const inner = members?.length === 1 ? members[0] : f;
      const kind = inner.get('featureKind') as string;
      const id = inner.get('id') as string;
      // Read geometry from the selected feature (`f`).
      const geom = f.getGeometry();
      if (!geom || !kind || !id) {
        finishSession();
        return;
      }
      if (members?.length === 1 && inner !== f && geom instanceof Point) {
        inner.setGeometry(geom.clone());
        pointLayerRef.current?.changed();
      }
      let save: void | Promise<void>;
      if (geom instanceof Point) {
        const [lon, lat] = transform(geom.getCoordinates(), 'EPSG:3857', 'EPSG:4326');
        save = onGeometryChangeRef.current?.(
          kind === 'poi' ? { kind: 'poi', id } : { kind: 'infra', id },
          lon,
          lat
        );
      } else if (geom instanceof LineString) {
        let coords = lineCoordsFromGeometry(geom);
        const session = lineModifySessionRef.current;
        if (session && session.lineId === id && session.sessionId === sessionId) {
          const pool = infraObjectsRef.current.filter((o) => o.id !== id);
          const pixel = evt.mapBrowserEvent?.pixel;
          const hit = pixel ? resolveInfraPointAtPixel(pixel) : null;
          const hitObject = hit ? pool.find((o) => o.id === hit.id) ?? null : null;
          const draftStart = coords[0] as [number, number];
          const draftFinish = coords[coords.length - 1] as [number, number];
          const startMoved = lineEndpointMoved(draftStart, session.originalStart);
          const finishMoved = lineEndpointMoved(draftFinish, session.originalFinish);
          const draftCoords = coords;
          const constrained = constrainLineCoordinatesOnEdit({
            lineSubtype: session.subtype,
            originalStart: session.originalStart,
            originalFinish: session.originalFinish,
            originalStartAttach: session.originalStartAttach,
            originalFinishAttach: session.originalFinishAttach,
            draftCoords,
            infraObjects: pool,
            cursorTargetStart: startMoved ? hitObject : null,
            cursorTargetFinish: finishMoved ? hitObject : null,
          });
          coords = constrained.coords;
          const coordsChanged =
            draftCoords.length !== coords.length ||
            draftCoords.some(
              (c, i) =>
                Math.abs(c[0]! - coords[i]![0]!) > 1e-9 ||
                Math.abs(c[1]! - coords[i]![1]!) > 1e-9,
            );
          if (coordsChanged) {
            const nextGeom = new LineString(coords.map((c) => fromLonLat([c[0], c[1]])));
            f.setGeometry(nextGeom);
            if (members?.length === 1 && inner !== f) {
              inner.setGeometry(nextGeom.clone());
            }
            lineLayerRef.current?.changed();
          }
          if (constrained.revertedStart || constrained.revertedFinish) {
            useAppStore.getState().pushToast(
              'info',
              'Конец линии возвращён к исходному точечному объекту — нельзя оставить его без привязки',
            );
          }
        }
        const [lon, lat] = coords[0]!;
        save = onGeometryChangeRef.current?.({ kind: 'infra', id }, lon, lat, coords);
      } else {
        finishSession();
        return;
      }
      if (save != null && typeof (save as Promise<void>).then === 'function') {
        (save as Promise<void>).finally(finishSession);
      } else {
        finishSession();
      }
    });

    const translate = new Translate({ features: select.getFeatures() });
    translateRef.current = translate;

    const readFeatureGeometry = (
      f: Feature,
    ): { sel: MapFeatureSelection; lon: number; lat: number; coords?: number[][] } | null => {
      const members = f.get('features') as Feature[] | undefined;
      const inner = members?.length === 1 ? members[0] : f;
      const kind = inner.get('featureKind') as string;
      const id = inner.get('id') as string;
      if (!id || !kind) return null;
      const sel: MapFeatureSelection =
        kind === 'poi' ? { kind: 'poi', id } : { kind: 'infra', id };
      const geom = f.getGeometry();
      if (geom instanceof Point) {
        const [lon, lat] = transform(geom.getCoordinates(), 'EPSG:3857', 'EPSG:4326');
        return { sel, lon, lat };
      }
      if (geom instanceof LineString) {
        const coords = lineCoordsFromGeometry(geom);
        if (coords.length < 2) return null;
        const [lon, lat] = coords[0]!;
        return { sel, lon, lat, coords };
      }
      return null;
    };

    const collectLinkedLinesForPoint = (
      pointId: string,
      pointCoord: number[],
      excludeLineIds: Set<string>,
    ): LinkedLineDragState['links'] => {
      const links: LinkedLineDragState['links'] = [];
      lineSourceRef.current.getFeatures().forEach((lineFeature) => {
        const lineId = lineFeature.get('id') as string | undefined;
        const lineSubtype = lineFeature.get('subtype') as string | undefined;
        if (!lineId || !lineSubtype || lineSubtype === 'draft' || lineSubtype === 'measure') return;
        if (!LINE_SUBTYPES.includes(lineSubtype as typeof LINE_SUBTYPES[number])) return;
        if (excludeLineIds.has(lineId)) return;
        const lineGeom = lineFeature.getGeometry();
        if (!(lineGeom instanceof LineString)) return;
        const coords = lineGeom.getCoordinates();
        if (coords.length < 2) return;
        const first = coords[0];
        const last = coords[coords.length - 1];
        const start =
          Math.hypot(first[0] - pointCoord[0], first[1] - pointCoord[1]) <=
          LINE_ENDPOINT_FOLLOW_TOLERANCE_M;
        const end =
          Math.hypot(last[0] - pointCoord[0], last[1] - pointCoord[1]) <=
          LINE_ENDPOINT_FOLLOW_TOLERANCE_M;
        if (!start && !end) return;
        links.push({ lineId, start, end, pointId });
      });
      return links;
    };

    translate.on('translatestart', () => {
      const sessionId = ++translateSessionRef.current;
      suppressDataSyncRef.current = true;
      translateStartGeomsRef.current.clear();
      linkedLineDragRef.current = null;
      if (!editModeRef.current || selectModeRef.current !== 'box') return;
      const collection = select.getFeatures();
      const selectedLineIds = new Set<string>();
      collection.forEach((f) => {
        const parsed = readFeatureGeometry(f);
        if (!parsed) return;
        translateStartGeomsRef.current.set(parsed.sel.id, parsed);
        if (parsed.coords && parsed.coords.length >= 2) selectedLineIds.add(parsed.sel.id);
      });

      const mergedLinks: LinkedLineDragState['links'] = [];
      collection.forEach((f) => {
        const members = f.get('features') as Feature[] | undefined;
        const inner = members?.length === 1 ? members[0] : f;
        const id = inner.get('id') as string | undefined;
        const kind = inner.get('featureKind') as string | undefined;
        const geom = f.getGeometry();
        if (!id || kind !== 'infra' || !(geom instanceof Point)) return;
        const pointCoord = geom.getCoordinates();
        mergedLinks.push(...collectLinkedLinesForPoint(id, pointCoord, selectedLineIds));
      });
      if (mergedLinks.length > 0) {
        linkedLineDragRef.current = { sessionId, links: mergedLinks };
      }
      void sessionId;
    });

    const applyLinkedLineDrag = () => {
      const dragState = linkedLineDragRef.current;
      if (!dragState || !editModeRef.current) return;
      const collection = select.getFeatures();
      const pointCoordsById = new Map<string, number[]>();
      collection.forEach((f) => {
        const members = f.get('features') as Feature[] | undefined;
        const inner = members?.length === 1 ? members[0] : f;
        const id = inner.get('id') as string | undefined;
        const geom = f.getGeometry();
        if (!id || !(geom instanceof Point)) return;
        pointCoordsById.set(id, geom.getCoordinates());
      });
      if (pointCoordsById.size === 0) return;

      for (const link of dragState.links) {
        const pointCoord = pointCoordsById.get(link.pointId);
        if (!pointCoord) continue;
        const lineFeature = lineSourceRef.current
          .getFeatures()
          .find((lf) => (lf.get('id') as string | undefined) === link.lineId);
        if (!lineFeature) continue;
        const lineGeom = lineFeature.getGeometry();
        if (!(lineGeom instanceof LineString)) continue;
        const current = lineGeom.getCoordinates();
        if (current.length < 2) continue;
        const next = current.map((c) => [c[0], c[1]]);
        if (link.start) next[0] = [pointCoord[0], pointCoord[1]];
        if (link.end) next[next.length - 1] = [pointCoord[0], pointCoord[1]];
        lineFeature.setGeometry(new LineString(next));
      }
      lineLayerRef.current?.changed();
    };

    translate.on('translating', applyLinkedLineDrag);

    translate.on('translateend', () => {
      const sessionId = translateSessionRef.current;
      const finishSession = () => {
        linkedLineDragRef.current = null;
        suppressDataSyncRef.current = false;
        syncInfraDataToLayersRef.current?.();
      };
      if (!editModeRef.current || selectModeRef.current !== 'box') {
        finishSession();
        return;
      }
      const collection = select.getFeatures();
      const changes: {
        sel: MapFeatureSelection;
        lon: number;
        lat: number;
        coords?: number[][];
      }[] = [];
      collection.forEach((f) => {
        const parsed = readFeatureGeometry(f);
        if (!parsed) return;
        const start = translateStartGeomsRef.current.get(parsed.sel.id);
        if (!start) return;
        const moved =
          Math.abs(parsed.lon - start.lon) > 1e-9 ||
          Math.abs(parsed.lat - start.lat) > 1e-9 ||
          (parsed.coords &&
            start.coords &&
            (parsed.coords.length !== start.coords.length ||
              parsed.coords.some(
                (c, i) =>
                  Math.abs(c[0]! - start.coords![i]![0]!) > 1e-9 ||
                  Math.abs(c[1]! - start.coords![i]![1]!) > 1e-9,
              )));
        if (moved) changes.push(parsed);
      });
      translateStartGeomsRef.current.clear();
      if (changes.length === 0) {
        finishSession();
        return;
      }
      const save = onBatchGeometryChangeRef.current?.(changes);
      if (save != null && typeof (save as Promise<void>).then === 'function') {
        (save as Promise<void>).finally(finishSession);
      } else {
        finishSession();
      }
      void sessionId;
    });

    map.addInteraction(select);
    map.addInteraction(modify);
    map.addInteraction(dragBox);
    map.addInteraction(translate);
    dragBox.setActive(false);
    translate.setActive(false);

    const DOUBLE_RMB_MS = 650;
    const DOUBLE_RMB_MAX_PX = 28;

    const finishAtFromPointerEvent = (
      e: MouseEvent | PointerEvent,
    ): {
      lon: number;
      lat: number;
      splitHint?: { lineId: string; segmentIndex: number; snapLon: number; snapLat: number };
    } | null => {
      const pixel = map.getEventPixel(e as UIEvent);
      const hit = resolveInfraPointAtPixel(pixel);
      if (hit) return hit;
      const overLine = resolveInfraLineSplitAtPixel(pixel);
      if (overLine) {
        return {
          lon: overLine.lon,
          lat: overLine.lat,
          splitHint: {
            lineId: overLine.lineId,
            segmentIndex: overLine.segmentIndex,
            snapLon: overLine.lon,
            snapLat: overLine.lat,
          },
        };
      }
      const mapCoord = map.getCoordinateFromPixel(pixel);
      if (!mapCoord) return null;
      const [lon, lat] = transform(mapCoord, 'EPSG:3857', 'EPSG:4326');
      return { lon, lat };
    };

    const tryFinishLineAtPointer = (e: MouseEvent | PointerEvent): boolean => {
      if (drawModeRef.current !== 'line') return false;
      const coords = draftLineRef.current || [];
      if (coords.length < 2) return false;
      const finishAt = finishAtFromPointerEvent(e);
      if (!finishAt) return false;
      const { lon, lat, splitHint } = finishAt;
      onFinishLineRef.current?.(coords, { lon, lat }, splitHint);
      return true;
    };

    const onLineContextMenu = (e: MouseEvent) => {
      if (drawModeRef.current !== 'line') return;
      e.preventDefault();
    };

    const onLinePointerDown = (e: PointerEvent) => {
      if (e.button !== 2) return;
      if (drawModeRef.current !== 'line') return;
      e.preventDefault();
      suppressMapClickRef.current = true;
      window.setTimeout(() => {
        suppressMapClickRef.current = false;
      }, 450);

      const now = Date.now();
      const prev = lineRightClickRef.current;
      const dist = Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
      if (prev.at > 0 && now - prev.at <= DOUBLE_RMB_MS && dist <= DOUBLE_RMB_MAX_PX) {
        lineRightClickRef.current = { at: 0, x: 0, y: 0 };
        tryFinishLineAtPointer(e);
      } else {
        lineRightClickRef.current = { at: now, x: e.clientX, y: e.clientY };
      }
    };

    map.on('click', (evt) => {
      const orig = evt.originalEvent;
      if (orig instanceof MouseEvent && orig.button !== 0) return;
      if (suppressMapClickRef.current) return;
      const mode = drawModeRef.current;
      if (mode !== 'select') {
        const [lon, lat] = transform(evt.coordinate, 'EPSG:3857', 'EPSG:4326');
        const overLine =
          mode === 'point' ? resolveInfraLineSplitAtPixel(evt.pixel) ?? undefined : undefined;
        const overPoint =
          mode === 'line' || (mode === 'point' && !overLine)
            ? resolveInfraPointAtPixel(evt.pixel) ?? undefined
            : undefined;
        onMapClickRef.current?.(lon, lat, {
          ...(overPoint ? { overPoint } : {}),
          ...(overLine ? { overLine } : {}),
        });
        return;
      }
      if (pasteModeRef.current) {
        const [lon, lat] = transform(evt.coordinate, 'EPSG:3857', 'EPSG:4326');
        onMapClickRef.current?.(lon, lat);
        return;
      }
      if (selectModeRef.current === 'box') {
        const hit = map.forEachFeatureAtPixel(
          evt.pixel,
          (feat, layer) => {
            if (layer !== pointLayer && layer !== lineLayer) return undefined;
            return resolveFeatureSelection(feat as Feature) ? feat : undefined;
          },
          { hitTolerance: 6, layerFilter: (l) => l === pointLayer || l === lineLayer }
        );
        if (!hit) {
          select.getFeatures().clear();
          onFeatureGroupSelectRef.current?.([]);
        }
      }
    });

    const tryRemoveLineVertexAtPixel = (pixel: number[]): boolean => {
      if (drawModeRef.current !== 'select') return false;
      if (!editModeRef.current || selectModeRef.current !== 'single') return false;

      const collection = select.getFeatures();
      const f = collection.item(0);
      if (!f) return false;

      const members = f.get('features') as Feature[] | undefined;
      const inner = members?.length === 1 ? members[0] : f;
      const kind = inner.get('featureKind') as string;
      const id = inner.get('id') as string;
      const subtype = inner.get('subtype') as string;
      const geom = f.getGeometry();
      if (kind !== 'infra' || !id || !LINE_SUBTYPE_SET.has(subtype) || !(geom instanceof LineString)) {
        return false;
      }

      const vertexIndex = findLineVertexIndexAtPixel(map, geom, pixel);
      const coords = lineCoordsFromGeometry(geom);
      if (
        vertexIndex == null ||
        coords.length <= 2 ||
        vertexIndex === 0 ||
        vertexIndex === coords.length - 1
      ) {
        return false;
      }

      const nextCoords = coords.filter((_, i) => i !== vertexIndex);
      const nextGeom = new LineString(nextCoords.map((c) => fromLonLat([c[0], c[1]])));
      suppressDataSyncRef.current = true;
      f.setGeometry(nextGeom);
      if (members?.length === 1 && inner !== f) {
        inner.setGeometry(nextGeom.clone());
      }
      lineLayer.changed();

      const [lon, lat] = nextCoords[0]!;
      const save = onGeometryChangeRef.current?.({ kind: 'infra', id }, lon, lat, nextCoords);
      if (save != null && typeof (save as Promise<void>).then === 'function') {
        (save as Promise<void>).finally(() => {
          suppressDataSyncRef.current = false;
        });
      } else {
        suppressDataSyncRef.current = false;
      }
      return true;
    };

    map.on('dblclick', (evt) => {
      const mode = drawModeRef.current;
      const orig = evt.originalEvent;
      if (orig instanceof MouseEvent && orig.button !== 0) return;

      if (mode === 'ruler') {
        evt.preventDefault();
        onFinishMeasureRef.current?.();
        return;
      }
      if (mode === 'select' && tryRemoveLineVertexAtPixel(evt.pixel)) {
        evt.preventDefault();
        return;
      }
      if (mode !== 'line') return;
      if ((draftLineRef.current || []).length < 2) return;
      evt.preventDefault();
      if (orig instanceof MouseEvent) {
        tryFinishLineAtPointer(orig);
      } else {
        const coords = draftLineRef.current || [];
        if (coords.length < 2) return;
        const overLine = resolveInfraLineSplitAtPixel(evt.pixel);
        const [lon, lat] = overLine
          ? [overLine.lon, overLine.lat]
          : transform(evt.coordinate, 'EPSG:3857', 'EPSG:4326');
        onFinishLineRef.current?.(
          coords,
          { lon, lat },
          overLine
            ? {
                lineId: overLine.lineId,
                segmentIndex: overLine.segmentIndex,
                snapLon: overLine.lon,
                snapLat: overLine.lat,
              }
            : undefined,
        );
      }
    });
    const refreshHover = (hit: string | null) => {
      if (hit === hoveredIdRef.current) return;
      hoveredIdRef.current = hit;
      pointLayer.changed();
      lineLayer.changed();
      if (containerRef.current) {
        const mode = drawModeRef.current;
        const inSelect = mode === 'select';
        const editing = editModeRef.current;
        containerRef.current.style.cursor = hit
          ? 'pointer'
          : mode === 'ruler' || mode === 'point' || mode === 'poi'
            ? 'crosshair'
            : !editing
              ? 'default'
              : inSelect
                ? selectModeRef.current === 'box'
                  ? 'crosshair'
                  : 'default'
                : 'crosshair';
      }
    };

    map.on('pointermove', (evt) => {
      const [lon, lat] = transform(evt.coordinate, 'EPSG:3857', 'EPSG:4326');
      const overPoint = resolveInfraPointAtPixel(evt.pixel);
      onPointerMoveRef.current?.(lon, lat, overPoint ?? undefined);
      const hit =
        map.forEachFeatureAtPixel(
          evt.pixel,
          (feat, layer) => {
            if (layer !== pointLayer && layer !== lineLayer) return undefined;
            const features = feat.get('features') as Feature[] | undefined;
            const inner = features?.length === 1 ? features[0] : feat;
            const id = inner.get('id') as string | undefined;
            const subtype = inner.get('subtype') as string | undefined;
            if (!id || subtype === 'draft') return undefined;
            return id;
          },
          { hitTolerance: 8, layerFilter: (l) => l === pointLayer || l === lineLayer }
        ) || null;
      refreshHover(hit);
    });

    map.on('pointerdrag', applyLinkedLineDrag);

    const viewport = map.getViewport();
    const onViewportLeave = () => {
      refreshHover(null);
      placementPreviewSourceRef.current.clear();
      onPointerLeaveRef.current?.();
    };
    viewport.addEventListener('mouseleave', onViewportLeave);
    viewport.addEventListener('contextmenu', onLineContextMenu, true);
    viewport.addEventListener('pointerdown', onLinePointerDown, true);

    const reportView = () => {
      const view = map.getView();
      const zoom = view.getZoom() ?? 0;
      const resolution = view.getResolution();
      const center = view.getCenter();
      let scaleLabel = '—';
      if (resolution != null && center) {
        const res = getPointResolution('EPSG:3857', resolution, center);
        const scale = Math.max(1, Math.round(res * 39.37 * 72));
        scaleLabel = `1:${scale.toLocaleString('ru-RU')}`;
      }
      onViewChangeRef.current?.({ zoom, scaleLabel });
    };

    const persistView = () => {
      if (!persistViewStateRef.current) return;
      const vid = viewStateIdRef.current;
      if (!vid) return;
      const view = map.getView();
      const center = view.getCenter();
      const zoom = view.getZoom();
      if (!center || zoom == null) return;
      const [centerLon, centerLat] = transform(center, 'EPSG:3857', 'EPSG:4326');
      const snap = { centerLon, centerLat, zoom };
      onViewStateSnapshotRef.current?.(snap);
      saveMapViewState(vid, projectIdRef.current, snap, viewStateScopeRef.current);
    };

    let bboxTimer: ReturnType<typeof setTimeout> | undefined;
    map.on('moveend', () => {
      reportView();
      persistView();
      if (!onBboxChangeRef.current) return;
      clearTimeout(bboxTimer);
      bboxTimer = setTimeout(() => {
        const extent = map.getView().calculateExtent(map.getSize());
        const [minX, minY, maxX, maxY] = extent;
        const [minLon, minLat] = transform([minX, minY], 'EPSG:3857', 'EPSG:4326');
        const [maxLon, maxLat] = transform([maxX, maxY], 'EPSG:3857', 'EPSG:4326');
        onBboxChangeRef.current?.(`${minLon},${minLat},${maxLon},${maxLat}`);
      }, 300);
    });
    reportView();

    const preserveViewOnResize = () => {
      const view = map.getView();
      const center = view.getCenter();
      const resolution = view.getResolution();
      map.updateSize();
      if (center && resolution != null) {
        view.setCenter(center);
        view.setResolution(resolution);
      }
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && containerRef.current
        ? new ResizeObserver(() => preserveViewOnResize())
        : null;
    resizeObserver?.observe(containerRef.current);

    mapRef.current = map;

    const zoomEl = containerRef.current.querySelector('.ol-zoom');
    if (zoomEl && !zoomEl.querySelector('.ol-fit-view')) {
      const fitBtn = document.createElement('button');
      fitBtn.type = 'button';
      fitBtn.className = 'ol-fit-view';
      fitBtn.title = 'Показать все объекты';
      fitBtn.setAttribute('aria-label', 'Показать все объекты');
      fitBtn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/></svg>';
      fitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        onFitViewRef.current?.();
      });
      zoomEl.appendChild(fitBtn);
    }

    return () => {
      clearTimeout(bboxTimer);
      resizeObserver?.disconnect();
      viewport.removeEventListener('mouseleave', onViewportLeave);
      viewport.removeEventListener('contextmenu', onLineContextMenu, true);
      viewport.removeEventListener('pointerdown', onLinePointerDown, true);
      containerRef.current?.querySelector('.ol-fit-view')?.remove();
      map.setTarget(undefined);
      map.dispose();
      mapRef.current = null;
      basemapLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const vid = viewStateId;
    if (!map || !vid || !persistViewState) return;

    if (prevProjectIdForViewRef.current === undefined) {
      prevProjectIdForViewRef.current = projectId;
      return;
    }
    if (prevProjectIdForViewRef.current === projectId) return;
    prevProjectIdForViewRef.current = projectId;

    const saved = loadMapViewState(vid, projectId, viewStateScope);
    const view = map.getView();
    if (saved) {
      view.setCenter(fromLonLat([saved.centerLon, saved.centerLat]));
      view.setZoom(saved.zoom);
    } else {
      const initial = resolveInitialMapView(vid, projectId, viewStateScope);
      view.setCenter(fromLonLat([initial.centerLon, initial.centerLat]));
      view.setZoom(initial.zoom);
    }
  }, [projectId, viewStateId, persistViewState]);

  useEffect(() => {
    const map = mapRef.current;
    const vid = viewStateId;
    if (!map || !vid || !viewStateScope || !persistViewState) return;

    const saved = loadMapViewState(vid, projectId, viewStateScope);
    if (!saved) return;
    const view = map.getView();
    view.setCenter(fromLonLat([saved.centerLon, saved.centerLat]));
    view.setZoom(saved.zoom);
  }, [viewStateScope, projectId, viewStateId, persistViewState]);

  useEffect(() => {
    const layer = basemapLayerRef.current;
    if (!layer) return;
    layer.setVisible(showBasemap);
  }, [showBasemap]);

  useEffect(() => {
    const isSelect = drawMode === 'select';
    const isRuler = drawMode === 'ruler';
    const isSingle = isSelect && selectMode === 'single';
    const isBox = isSelect && selectMode === 'box';
    const canModify = editMode && isSingle;
    const hasGroupSelection = selectedFeatureIds.length > 0;
    const canTranslate =
      editMode && isBox && hasGroupSelection && !!onBatchGeometryChangeRef.current;
    const pasteActive = pasteMode;
    selectRef.current?.setActive(isSingle && !pasteActive);
    modifyRef.current?.setActive(canModify && !pasteActive);
    translateRef.current?.setActive(canTranslate && !pasteActive);
    dragBoxRef.current?.setActive(isBox && !pasteActive && !hasGroupSelection);
    dragPanRef.current?.setActive(pasteActive || !isBox || hasGroupSelection);
    if (containerRef.current) {
      const isPointPlace = drawMode === 'point' || drawMode === 'poi';
      const cursor = pasteActive || isRuler || isPointPlace
        ? 'crosshair'
        : canTranslate
          ? 'grab'
          : !editMode
            ? 'default'
            : isBox
              ? 'crosshair'
              : isSelect
                ? 'default'
                : 'crosshair';
      containerRef.current.style.cursor = cursor;
    }
    if (!isSelect) {
      selectRef.current?.getFeatures().clear();
    }
  }, [drawMode, selectMode, editMode, pasteMode, selectedFeatureIds.length, onBatchGeometryChange]);

  useEffect(() => {
    if (!editMode) {
      suppressDataSyncRef.current = false;
    }
  }, [editMode]);

  useEffect(() => {
    pointLayerRef.current?.changed();
  }, [layers]);

  useEffect(() => {
    if (selectMode !== 'single' || drawMode !== 'select') return;
    const select = selectRef.current;
    if (!select) return;
    const collection = select.getFeatures();

    if (!selectedFeatureId) {
      if (collection.getLength() > 0) collection.clear();
      return;
    }

    const current = collection.item(0);
    const currentSel = current ? resolveFeatureSelection(current) : null;
    if (currentSel?.id === selectedFeatureId) return;

    collection.clear();
    const feature = findSelectableLayerFeature(
      pointSourceRef.current,
      lineSourceRef.current,
      selectedFeatureId
    );
    if (feature) collection.push(feature);
  }, [selectedFeatureId, selectMode, drawMode, editMode, pois, infraObjects]);

  useEffect(() => {
    if (selectMode !== 'box') return;
    const select = selectRef.current;
    if (!select) return;
    const collection = select.getFeatures();
    const targetIds = new Set(selectedFeatureIds);
    if (targetIds.size === 0) {
      collection.clear();
      return;
    }
    if (collection.getLength() > 0) {
      const currentIds = new Set<string>();
      collection.forEach((f) => {
        const sel = resolveFeatureSelection(f);
        if (sel) currentIds.add(sel.id);
      });
      if (
        currentIds.size === targetIds.size &&
        [...targetIds].every((id) => currentIds.has(id))
      ) {
        return;
      }
    }
    collection.clear();
    pointSourceRef.current.getFeatures().forEach((f) => {
      const id = f.get('id') as string;
      if (targetIds.has(id) && f.get('subtype') !== 'draft') collection.push(f);
    });
    lineSourceRef.current.getFeatures().forEach((f) => {
      const id = f.get('id') as string;
      if (targetIds.has(id) && f.get('subtype') !== 'draft') collection.push(f);
    });
  }, [selectedFeatureIds, selectMode, editMode, pois, infraObjects]);

  useEffect(() => {
    syncInfraDataToLayersRef.current = () => {
      const points = pointSourceRef.current;
      const lines = lineSourceRef.current;
      const snapPool = infraSnapPoolRef.current ?? infraObjectsRef.current;
      const infra = infraObjectsRef.current;
      const poisList = poisRef.current;

      const lineItems: { id: string; geometry: LineString; attrs: Record<string, unknown> }[] = [];
      const pointItems: { id: string; geometry: Point; attrs: Record<string, unknown> }[] = [];

      infra.forEach((obj) => {
        const lineGeom = infraLineGeometry(obj, snapPool);
        const attrs = {
          name: obj.name,
          subtype: normalizeInfraSubtype(obj.subtype),
          layer_id: obj.layer_id,
          featureKind: 'infra',
        };
        if (lineGeom) {
          lineItems.push({ id: obj.id, geometry: lineGeom, attrs });
        } else {
          pointItems.push({
            id: obj.id,
            geometry: new Point(fromLonLat([obj.lon, obj.lat])),
            attrs,
          });
        }
      });

      poisList.forEach((poi) => {
        pointItems.push({
          id: poi.id,
          geometry: new Point(fromLonLat([poi.lon, poi.lat])),
          attrs: { name: poi.name, subtype: 'poi', featureKind: 'poi' },
        });
      });

      syncFeaturesById(lines, lineItems, 'draft');
      syncFeaturesById(points, pointItems);
      lineLayerRef.current?.changed();
      pointLayerRef.current?.changed();
    };

    const nextIds = new Set(infraObjects.map((o) => o.id));
    const prevIds = infraIdsRef.current;
    const hasNewInfra = [...nextIds].some((id) => !prevIds.has(id));
    const hasRemovedInfra = [...prevIds].some((id) => !nextIds.has(id));
    infraIdsRef.current = nextIds;
    if (hasNewInfra || hasRemovedInfra || (!editModeRef.current && suppressDataSyncRef.current)) {
      suppressDataSyncRef.current = false;
    }
    if (suppressDataSyncRef.current) return;
    syncInfraDataToLayersRef.current();
  }, [pois, infraObjects, infraSnapPool]);

  useEffect(() => {
    if (suppressDataSyncRef.current) return;
    const lines = lineSourceRef.current;

    lines
      .getFeatures()
      .filter((f) =>
        f.get('subtype') === 'draft' ||
        f.get('subtype') === 'draft-preview' ||
        f.get('subtype') === 'draft-point'
      )
      .forEach((f) => lines.removeFeature(f));

    if (draftLine.length >= 2) {
      lines.addFeature(
        new Feature({
          geometry: new LineString(draftLine.map((c) => fromLonLat([c[0], c[1]]))),
          subtype: 'draft',
        })
      );
    }

    if (draftLine.length >= 1 && draftLinePreview) {
      const last = draftLine[draftLine.length - 1]!;
      lines.addFeature(
        new Feature({
          geometry: new LineString([
            fromLonLat([last[0], last[1]]),
            fromLonLat([draftLinePreview[0], draftLinePreview[1]]),
          ]),
          subtype: 'draft-preview',
        })
      );
    } else if (draftLine.length === 1) {
      const [lon, lat] = draftLine[0]!;
      lines.addFeature(
        new Feature({
          geometry: new Point(fromLonLat([lon, lat])),
          subtype: 'draft-point',
        })
      );
    }

    lines
      .getFeatures()
      .filter((f) => f.get('subtype') === 'measure')
      .forEach((f) => lines.removeFeature(f));

    measureCompletedLines.forEach((coords, i) => {
      if (coords.length < 2) return;
      lines.addFeature(
        new Feature({
          geometry: new LineString(coords.map((c) => fromLonLat([c[0], c[1]]))),
          subtype: 'measure',
          id: `measure-done-${i}`,
          measureFinished: true,
        })
      );
    });

    const activeCoords = [...measureLine];
    if (measurePreview && activeCoords.length >= 1) {
      activeCoords.push(measurePreview);
    }
    if (activeCoords.length >= 2) {
      lines.addFeature(
        new Feature({
          geometry: new LineString(activeCoords.map((c) => fromLonLat([c[0], c[1]]))),
          subtype: 'measure',
          id: 'measure-active',
          measureFinished: false,
        })
      );
    }
  }, [draftLine, draftLinePreview, measureLine, measurePreview, measureCompletedLines]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const makeLabelEl = (className: string) => {
      const el = document.createElement('div');
      el.className = className;
      return el;
    };

    if (!cursorMeasureOverlayRef.current) {
      const el = makeLabelEl('measure-label measure-label--cursor');
      const overlay = new Overlay({
        element: el,
        positioning: 'center-left',
        offset: [12, 0],
        stopEvent: false,
      });
      cursorMeasureOverlayRef.current = overlay;
      map.addOverlay(overlay);
    }

    const cursorOverlay = cursorMeasureOverlayRef.current;
    const cursorEl = cursorOverlay.getElement();
    if (measureCursorLabel && cursorEl) {
      cursorEl.textContent = measureCursorLabel.text;
      cursorOverlay.setPosition(fromLonLat([measureCursorLabel.lon, measureCursorLabel.lat]));
    } else {
      cursorOverlay.setPosition(undefined);
    }

    while (anchorMeasureOverlaysRef.current.length > measureAnchorLabels.length) {
      const extra = anchorMeasureOverlaysRef.current.pop();
      if (extra) map.removeOverlay(extra);
    }
    while (anchorMeasureOverlaysRef.current.length < measureAnchorLabels.length) {
      const el = makeLabelEl('measure-label measure-label--anchor');
      const overlay = new Overlay({
        element: el,
        positioning: 'bottom-center',
        offset: [0, -10],
        stopEvent: false,
      });
      anchorMeasureOverlaysRef.current.push(overlay);
      map.addOverlay(overlay);
    }
    measureAnchorLabels.forEach((label, i) => {
      const overlay = anchorMeasureOverlaysRef.current[i];
      const el = overlay.getElement();
      if (!el) return;
      el.textContent = label.text;
      overlay.setPosition(fromLonLat([label.lon, label.lat]));
    });
  }, [measureCursorLabel, measureAnchorLabels]);

  useEffect(() => {
    const select = selectRef.current;
    if (!select) return;
    const infraIds = new Set(infraObjects.map((o) => o.id));
    const selected = select.getFeatures();
    const stale: Feature[] = [];
    selected.forEach((f) => {
      if (f.get('featureKind') === 'infra' && !infraIds.has(f.get('id') as string)) {
        stale.push(f);
      }
    });
    stale.forEach((f) => selected.remove(f));
  }, [infraObjects]);

  useEffect(() => {
    const source = connectionSourceRef.current;
    source.clear();
    if (!selectedPoi) return;
    const poiCoord = fromLonLat([selectedPoi.lon, selectedPoi.lat]);
    connectionLines.forEach((row) => {
      if (!isValidAnalysisAnchor(row.anchor_lon, row.anchor_lat)) return;
      source.addFeature(
        new Feature({
          geometry: new LineString([
            poiCoord,
            fromLonLat([row.anchor_lon!, row.anchor_lat!]),
          ]),
          status: row.status,
          subtype: row.subtype,
          distance_km: row.distance_km,
        })
      );
    });
  }, [connectionLines, selectedPoi]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.getLayers().item(4)?.changed();
    mapRef.current.getLayers().item(5)?.changed();
  }, [layers]);

  useEffect(() => {
    const source = radiusSourceRef.current;
    source.clear();
    if (!showRadii || !selectedPoi) return;
    const centerLonLat: [number, number] = [selectedPoi.lon, selectedPoi.lat];
    thresholdCircles
      .filter((c) => c.visible && c.km > 0)
      .forEach((c) => {
        // Geodesic circle in lon/lat, then transform to map projection.
        const geom = circularPolygon(centerLonLat, c.km * 1000, 128).transform(
          'EPSG:4326',
          'EPSG:3857',
        );
        source.addFeature(
          new Feature({
            geometry: geom,
            color: c.color,
            key: c.key,
          })
        );
      });
  }, [thresholdCircles, selectedPoi, showRadii]);

  useEffect(() => {
    const source = placementPreviewSourceRef.current;
    source.clear();
    if (placementPreview) {
      source.addFeature(
        new Feature({
          geometry: new Point(fromLonLat([placementPreview.lon, placementPreview.lat])),
          subtype: placementPreview.subtype,
        }),
      );
    }
    for (const pt of clipboardPreviewPoints) {
      source.addFeature(
        new Feature({
          geometry: new Point(fromLonLat([pt.lon, pt.lat])),
          subtype: pt.subtype,
          clipboardPreview: true,
        }),
      );
    }
  }, [placementPreview, clipboardPreviewPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapFocus) return;
    const view = map.getView();
    if (mapFocus.extentLonLat) {
      const [minLon, minLat, maxLon, maxLat] = mapFocus.extentLonLat;
      const padLon = Math.max((maxLon - minLon) * 0.15, 0.008);
      const padLat = Math.max((maxLat - minLat) * 0.15, 0.008);
      const ext = boundingExtent([
        fromLonLat([minLon - padLon, minLat - padLat]),
        fromLonLat([maxLon + padLon, maxLat + padLat]),
      ]);
      view.fit(ext, { padding: [48, 48, 48, 48], maxZoom: 14, duration: 450 });
      return;
    }
    view.animate({
      center: fromLonLat([mapFocus.lon, mapFocus.lat]),
      zoom: Math.max(view.getZoom() ?? 9, 12),
      duration: 450,
    });
  }, [mapFocus?.nonce]);

  return (
    <div
      ref={containerRef}
      className="map-container"
      style={{
        height,
        background: showBasemap ? undefined : 'var(--bg, #e8ecef)',
      }}
      data-selected={selectedFeatureId || ''}
    />
  );
}
