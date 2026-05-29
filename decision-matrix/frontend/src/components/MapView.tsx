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
import { LINE_SUBTYPES, type InfraLayer } from '../lib/api';
import Select from 'ol/interaction/Select';
import Modify from 'ol/interaction/Modify';
import DragBox from 'ol/interaction/DragBox';
import DragPan from 'ol/interaction/DragPan';
import { defaults as defaultInteractions } from 'ol/interaction/defaults';
import { click } from 'ol/events/condition';
import Overlay from 'ol/Overlay';
import type { AnalysisRow, InfraObject, POI } from '../lib/api';
import { isValidAnalysisAnchor } from '../lib/analysisDisplay';
import { MAP_SUBTYPE_COLORS, iconDataUrl } from '../lib/mapIcons';
import {
  loadMapViewState,
  resolveInitialMapView,
  saveMapViewState,
  type MapViewStateId,
} from '../lib/mapViewState';
import { useAppStore } from '../store';
import 'ol/ol.css';

function infraLineGeometry(obj: InfraObject): LineString | null {
  if (obj.coordinates && obj.coordinates.length >= 2) {
    return new LineString(obj.coordinates.map((c) => fromLonLat([c[0], c[1]])));
  }
  if (obj.end_lon != null && obj.end_lat != null) {
    return new LineString([fromLonLat([obj.lon, obj.lat]), fromLonLat([obj.end_lon, obj.end_lat])]);
  }
  return null;
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

export interface NetworkNode {
  id: string;
  lon: number;
  lat: number;
}

export interface NetworkEdge {
  id: string;
  from_node_id: string;
  to_node_id: string;
}

interface MapViewProps {
  pois?: POI[];
  infraObjects?: InfraObject[];
  /** When false, Esri tile underlay is hidden (vectors/radii/network remain). */
  showBasemap?: boolean;
  drawMode?: DrawMode;
  selectMode?: SelectMode;
  onMapClick?: (lon: number, lat: number) => void;
  onFinishLine?: (coords: number[][], finishAt?: { lon: number; lat: number }) => void;
  /** Double-click / finish current measure polyline (ruler mode). */
  onFinishMeasure?: () => void;
  onPointerMove?: (lon: number, lat: number) => void;
  onPointerLeave?: () => void;
  onFeatureSelect?: (sel: MapFeatureSelection | null) => void;
  onFeatureGroupSelect?: (sels: MapFeatureSelection[]) => void;
  onGeometryChange?: (sel: MapFeatureSelection, lon: number, lat: number, coords?: number[][]) => void;
  onBboxChange?: (bbox: string) => void;
  onViewChange?: (info: { zoom: number; scaleLabel: string }) => void;
  height?: string;
  connectionLines?: AnalysisRow[];
  selectedPoi?: POI | null;
  selectedFeatureId?: string | null;
  selectedFeatureIds?: string[];
  thresholdCircles?: ThresholdCircle[];
  draftLine?: number[][];
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
  networkNodes?: NetworkNode[];
  networkEdges?: NetworkEdge[];
  nodeCoordLookup?: Record<string, { lon: number; lat: number }>;
  useMapIcons?: boolean;
  layers?: InfraLayer[];
  mapFocus?: MapFocusTarget | null;
  /** Fit map extent to all visible objects (button under OL zoom controls). */
  onFitView?: () => void;
  /** When false: view-only — no drag-edit of geometries (select/view still allowed). */
  editMode?: boolean;
  /** Ghost icon at cursor while placing point infrastructure. */
  placementPreview?: { subtype: string; lon: number; lat: number } | null;
  /** Remember pan/zoom per project when leaving the page (main / matrix / report). */
  viewStateId?: MapViewStateId;
  /** Optional sub-key (e.g. POI id on the report map). */
  viewStateScope?: string | null;
}

type LinkedLineDragState = {
  sessionId: number;
  pointId: string;
  links: { lineId: string; start: boolean; end: boolean }[];
};

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
  onBboxChange,
  onViewChange,
  height = '100%',
  connectionLines = [],
  selectedPoi = null,
  selectedFeatureId = null,
  selectedFeatureIds = [],
  thresholdCircles = [],
  draftLine = [],
  measureLine = [],
  measurePreview = null,
  measureCompletedLines = [],
  measureCursorLabel = null,
  measureAnchorLabels = [],
  showRadii = true,
  networkNodes = [],
  networkEdges = [],
  nodeCoordLookup,
  useMapIcons = true,
  layers = [],
  mapFocus = null,
  onFitView,
  editMode = false,
  placementPreview = null,
  viewStateId,
  viewStateScope = null,
}: MapViewProps) {
  const projectId = useAppStore((s) => s.currentProjectId);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OlMap | null>(null);
  const pointSourceRef = useRef(new VectorSource());
  const lineSourceRef = useRef(new VectorSource());
  const networkSourceRef = useRef(new VectorSource());
  const radiusSourceRef = useRef(new VectorSource());
  const placementPreviewSourceRef = useRef(new VectorSource());
  const connectionSourceRef = useRef(new VectorSource());
  const selectRef = useRef<Select | null>(null);
  const modifyRef = useRef<Modify | null>(null);
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
  const onBboxChangeRef = useRef(onBboxChange);
  const onViewChangeRef = useRef(onViewChange);
  const onFitViewRef = useRef(onFitView);
  const onFinishLineRef = useRef(onFinishLine);
  const onFinishMeasureRef = useRef(onFinishMeasure);
  const draftLineRef = useRef(draftLine);
  const cursorMeasureOverlayRef = useRef<Overlay | null>(null);
  const anchorMeasureOverlaysRef = useRef<Overlay[]>([]);
  const drawModeRef = useRef(drawMode);
  const editModeRef = useRef(editMode);
  const selectModeRef = useRef(selectMode);
  const useIconsRef = useRef(useMapIcons);
  const suppressDataSyncRef = useRef(false);
  const linkedLineDragRef = useRef<LinkedLineDragState | null>(null);
  const modifySessionRef = useRef(0);
  const suppressMapClickRef = useRef(false);
  const lineRightClickRef = useRef({ at: 0, x: 0, y: 0 });
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
  onBboxChangeRef.current = onBboxChange;
  onViewChangeRef.current = onViewChange;
  onFitViewRef.current = onFitView;
  onFinishLineRef.current = onFinishLine;
  onFinishMeasureRef.current = onFinishMeasure;
  draftLineRef.current = draftLine;
  drawModeRef.current = drawMode;
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
            stroke: new Stroke({ color: '#2196f3', width: 2, lineDash: [6, 6] }),
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

    const networkLayer = new VectorLayer({
      source: networkSourceRef.current,
      zIndex: 2,
      style: (feature) => {
        if (feature.get('edge')) {
          return new Style({
            stroke: new Stroke({ color: '#7b1fa2', width: 2, lineDash: [4, 4] }),
          });
        }
        return pointIconStyle('network_node', 0.8);
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
        networkLayer,
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

    modify.on('modifystart', () => {
      const sessionId = ++modifySessionRef.current;
      suppressDataSyncRef.current = true;
      linkedLineDragRef.current = null;
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
      if (!id || kind !== 'infra' || !(geom instanceof Point) || LINE_SUBTYPES.includes(subtype as typeof LINE_SUBTYPES[number])) {
        return;
      }
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
        links.push({ lineId, start, end });
      });
      if (links.length > 0) {
        linkedLineDragRef.current = { sessionId, pointId: id, links };
      }
    });

    modify.on('modifyend', () => {
      const sessionId = modifySessionRef.current;
      const finishSession = () => {
        // Ignore stale completions from previous drags.
        if (sessionId !== modifySessionRef.current) return;
        linkedLineDragRef.current = null;
        suppressDataSyncRef.current = false;
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
        const coords = geom.getCoordinates().map((c) => {
          const [lon, lat] = transform(c, 'EPSG:3857', 'EPSG:4326');
          return [lon, lat];
        });
        const [lon, lat] = coords[0];
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

    map.addInteraction(select);
    map.addInteraction(modify);
    map.addInteraction(dragBox);
    dragBox.setActive(false);

    const DOUBLE_RMB_MS = 650;
    const DOUBLE_RMB_MAX_PX = 28;

    const finishAtFromPointerEvent = (e: MouseEvent | PointerEvent): { lon: number; lat: number } | null => {
      const pixel = map.getEventPixel(e as UIEvent);
      const hit = map.forEachFeatureAtPixel(
        pixel,
        (feat, layer) => {
          if (layer !== pointLayer) return undefined;
          const features = feat.get('features') as Feature[] | undefined;
          const inner = features?.length === 1 ? features[0] : feat;
          const subtype = inner.get('subtype') as string;
          const kind = inner.get('featureKind') as string;
          if (!inner.get('id') || subtype === 'draft') return undefined;
          if (kind !== 'infra') return undefined;
          const geom = inner.getGeometry();
          if (!(geom instanceof Point)) return undefined;
          const [lon, lat] = transform(geom.getCoordinates(), 'EPSG:3857', 'EPSG:4326');
          return { lon, lat };
        },
        { hitTolerance: 20, layerFilter: (l) => l === pointLayer }
      );
      if (hit) return hit;
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
      onFinishLineRef.current?.(coords, finishAt);
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

    map.on('dblclick', (evt) => {
      const mode = drawModeRef.current;
      if (mode === 'ruler') {
        evt.preventDefault();
        onFinishMeasureRef.current?.();
        return;
      }
      if (mode !== 'line') return;
      if ((draftLineRef.current || []).length < 2) return;
      evt.preventDefault();
      const orig = evt.originalEvent;
      if (orig instanceof MouseEvent) {
        tryFinishLineAtPointer(orig);
      } else {
        const coords = draftLineRef.current || [];
        if (coords.length < 2) return;
        const [lon, lat] = transform(evt.coordinate, 'EPSG:3857', 'EPSG:4326');
        onFinishLineRef.current?.(coords, { lon, lat });
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
      onPointerMoveRef.current?.(lon, lat);
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

    map.on('pointerdrag', () => {
      const dragState = linkedLineDragRef.current;
      if (!dragState || !editModeRef.current) return;
      const collection = select.getFeatures();
      const f = collection.item(0);
      if (!f) return;
      const geom = f.getGeometry();
      if (!(geom instanceof Point)) return;
      const pointCoord = geom.getCoordinates();
      for (const link of dragState.links) {
        const lineFeature = lineSourceRef.current
          .getFeatures()
          .find((f) => (f.get('id') as string | undefined) === link.lineId);
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
      lineLayer.changed();
    });

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
      const vid = viewStateIdRef.current;
      if (!vid) return;
      const view = map.getView();
      const center = view.getCenter();
      const zoom = view.getZoom();
      if (!center || zoom == null) return;
      const [centerLon, centerLat] = transform(center, 'EPSG:3857', 'EPSG:4326');
      saveMapViewState(vid, projectIdRef.current, { centerLon, centerLat, zoom }, viewStateScopeRef.current);
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
    if (!map || !vid) return;

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
  }, [projectId, viewStateId]);

  useEffect(() => {
    const map = mapRef.current;
    const vid = viewStateId;
    if (!map || !vid || !viewStateScope) return;

    const saved = loadMapViewState(vid, projectId, viewStateScope);
    if (!saved) return;
    const view = map.getView();
    view.setCenter(fromLonLat([saved.centerLon, saved.centerLat]));
    view.setZoom(saved.zoom);
  }, [viewStateScope, projectId, viewStateId]);

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
    selectRef.current?.setActive(isSingle);
    modifyRef.current?.setActive(canModify);
    dragBoxRef.current?.setActive(isBox);
    dragPanRef.current?.setActive(!isBox);
    if (containerRef.current) {
      const isPointPlace = drawMode === 'point' || drawMode === 'poi';
      const cursor = isRuler || isPointPlace
        ? 'crosshair'
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
  }, [drawMode, selectMode, editMode]);

  useEffect(() => {
    pointLayerRef.current?.changed();
  }, [layers]);

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
    if (suppressDataSyncRef.current) return;

    const points = pointSourceRef.current;
    const lines = lineSourceRef.current;

    const lineItems: { id: string; geometry: LineString; attrs: Record<string, unknown> }[] = [];
    const pointItems: { id: string; geometry: Point; attrs: Record<string, unknown> }[] = [];

    infraObjects.forEach((obj) => {
      const lineGeom = infraLineGeometry(obj);
      const attrs = {
        name: obj.name,
        subtype: obj.subtype,
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

    pois.forEach((poi) => {
      pointItems.push({
        id: poi.id,
        geometry: new Point(fromLonLat([poi.lon, poi.lat])),
        attrs: { name: poi.name, subtype: 'poi', featureKind: 'poi' },
      });
    });

    syncFeaturesById(lines, lineItems, 'draft');
    syncFeaturesById(points, pointItems);

    pointLayerRef.current?.changed();
  }, [pois, infraObjects]);

  useEffect(() => {
    if (suppressDataSyncRef.current) return;
    const lines = lineSourceRef.current;

    const draftFeature = lines.getFeatures().find((f) => f.get('subtype') === 'draft');
    if (draftLine.length >= 2) {
      const draftGeom = new LineString(draftLine.map((c) => fromLonLat([c[0], c[1]])));
      if (draftFeature) {
        draftFeature.setGeometry(draftGeom);
      } else {
        lines.addFeature(new Feature({ geometry: draftGeom, subtype: 'draft' }));
      }
    } else if (draftFeature) {
      lines.removeFeature(draftFeature);
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
  }, [draftLine, measureLine, measurePreview, measureCompletedLines]);

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
    const src = networkSourceRef.current;
    src.clear();
    if (networkNodes.length === 0 && networkEdges.length === 0) {
      return;
    }
    const pos: Record<string, { lon: number; lat: number }> = {
      ...Object.fromEntries(networkNodes.map((n) => [n.id, { lon: n.lon, lat: n.lat }])),
      ...nodeCoordLookup,
    };
    networkEdges.forEach((e) => {
      const a = pos[e.from_node_id];
      const b = pos[e.to_node_id];
      if (!a || !b) return;
      src.addFeature(
        new Feature({
          geometry: new LineString([fromLonLat([a.lon, a.lat]), fromLonLat([b.lon, b.lat])]),
          edge: true,
        })
      );
    });
    networkNodes.forEach((n) => {
      src.addFeature(
        new Feature({
          geometry: new Point(fromLonLat([n.lon, n.lat])),
          subtype: 'network_node',
        })
      );
    });
  }, [networkNodes, networkEdges, nodeCoordLookup]);

  useEffect(() => {
    const source = placementPreviewSourceRef.current;
    source.clear();
    if (!placementPreview) return;
    source.addFeature(
      new Feature({
        geometry: new Point(fromLonLat([placementPreview.lon, placementPreview.lat])),
        subtype: placementPreview.subtype,
      })
    );
  }, [placementPreview]);

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
