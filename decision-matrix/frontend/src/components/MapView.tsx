import { useEffect, useRef } from 'react';
import OlMap from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import Cluster from 'ol/source/Cluster';
import { fromLonLat, transform } from 'ol/proj';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { Circle as CircleGeom } from 'ol/geom';
import { Circle as CircleStyle, Fill, Icon, Stroke, Style, Text } from 'ol/style';
import type { InfraLayer } from '../lib/api';
import Select from 'ol/interaction/Select';
import Modify from 'ol/interaction/Modify';
import DragBox from 'ol/interaction/DragBox';
import DragPan from 'ol/interaction/DragPan';
import { defaults as defaultInteractions } from 'ol/interaction/defaults';
import { click } from 'ol/events/condition';
import type { AnalysisRow, InfraObject, POI } from '../lib/api';
import { iconDataUrl } from '../lib/mapIcons';
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

const SUBTYPE_COLORS: Record<string, string> = {
  autoroad: '#78909c',
  oil_pipeline: '#5d4037',
  gas_pipeline: '#2e7d32',
  water_pipeline: '#0288d1',
  power_line: '#fbc02d',
  gas_processing: '#ff6f00',
  gtes: '#d84315',
  substation: '#f9a825',
  refinery: '#455a64',
};

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

export type DrawMode = 'select' | 'poi' | 'point' | 'line';

export type SelectMode = 'single' | 'box';

export type MapFeatureSelection =
  | { kind: 'poi'; id: string }
  | { kind: 'infra'; id: string };

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
  basemap?: 'osm' | 'satellite' | 'terrain';
  drawMode?: DrawMode;
  selectMode?: SelectMode;
  onMapClick?: (lon: number, lat: number) => void;
  onFinishLine?: (coords: number[][]) => void;
  onPointerMove?: (lon: number, lat: number) => void;
  onFeatureSelect?: (sel: MapFeatureSelection | null) => void;
  onFeatureGroupSelect?: (sels: MapFeatureSelection[]) => void;
  onGeometryChange?: (sel: MapFeatureSelection, lon: number, lat: number, coords?: number[][]) => void;
  onBboxChange?: (bbox: string) => void;
  height?: string;
  connectionLines?: AnalysisRow[];
  selectedPoi?: POI | null;
  selectedFeatureId?: string | null;
  selectedFeatureIds?: string[];
  thresholdCircles?: ThresholdCircle[];
  draftLine?: number[][];
  showRadii?: boolean;
  networkNodes?: NetworkNode[];
  networkEdges?: NetworkEdge[];
  nodeCoordLookup?: Record<string, { lon: number; lat: number }>;
  useMapIcons?: boolean;
  layers?: InfraLayer[];
}

function layerOpacityMap(layers: InfraLayer[] | undefined): Record<string, number> {
  const m: Record<string, number> = {};
  layers?.forEach((l) => {
    if (l.is_visible) m[l.id] = l.opacity ?? 1;
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

function createBasemap(type: string): TileLayer {
  if (type === 'satellite') {
    return new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: 'Esri',
      }),
    });
  }
  if (type === 'terrain') {
    return new TileLayer({
      source: new XYZ({
        url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
        attributions: 'OpenTopoMap',
      }),
    });
  }
  return new TileLayer({ source: new OSM() });
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
  const color = subtype === 'poi' ? '#e53935' : SUBTYPE_COLORS[subtype] || '#666';
  return new Style({
    image: new CircleStyle({
      radius: (subtype === 'poi' ? 10 : 7) * scale,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: '#fff', width: 2 }),
    }),
  });
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
  basemap = 'osm',
  drawMode = 'select',
  selectMode = 'single',
  onMapClick,
  onFinishLine,
  onPointerMove,
  onFeatureSelect,
  onFeatureGroupSelect,
  onGeometryChange,
  onBboxChange,
  height = 'min(70vh, 720px)',
  connectionLines = [],
  selectedPoi = null,
  selectedFeatureId = null,
  selectedFeatureIds = [],
  thresholdCircles = [],
  draftLine = [],
  showRadii = true,
  networkNodes = [],
  networkEdges = [],
  nodeCoordLookup,
  useMapIcons = true,
  layers = [],
}: MapViewProps) {
  const opacityByLayer = layerOpacityMap(layers);
  const colorByLayer = layerColorMap(layers);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OlMap | null>(null);
  const pointSourceRef = useRef(new VectorSource());
  const lineSourceRef = useRef(new VectorSource());
  const networkSourceRef = useRef(new VectorSource());
  const clusterSourceRef = useRef(new Cluster({ distance: 40, source: pointSourceRef.current }));
  const radiusSourceRef = useRef(new VectorSource());
  const connectionSourceRef = useRef(new VectorSource());
  const selectRef = useRef<Select | null>(null);
  const modifyRef = useRef<Modify | null>(null);
  const dragBoxRef = useRef<DragBox | null>(null);
  const dragPanRef = useRef<DragPan | null>(null);
  const pointLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const lineLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const onPointerMoveRef = useRef(onPointerMove);
  const onFeatureSelectRef = useRef(onFeatureSelect);
  const onFeatureGroupSelectRef = useRef(onFeatureGroupSelect);
  const onGeometryChangeRef = useRef(onGeometryChange);
  const onBboxChangeRef = useRef(onBboxChange);
  const onFinishLineRef = useRef(onFinishLine);
  const draftLineRef = useRef(draftLine);
  const drawModeRef = useRef(drawMode);
  const selectModeRef = useRef(selectMode);
  const useIconsRef = useRef(useMapIcons);
  const suppressDataSyncRef = useRef(false);

  onMapClickRef.current = onMapClick;
  onPointerMoveRef.current = onPointerMove;
  onFeatureSelectRef.current = onFeatureSelect;
  onFeatureGroupSelectRef.current = onFeatureGroupSelect;
  onGeometryChangeRef.current = onGeometryChange;
  onBboxChangeRef.current = onBboxChange;
  onFinishLineRef.current = onFinishLine;
  draftLineRef.current = draftLine;
  drawModeRef.current = drawMode;
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
        const id = feature.get('id') as string;
        const hovered = id && hoveredIdRef.current === id;
        const layerId = feature.get('layer_id') as string | undefined;
        const op = layerId ? opacityByLayer[layerId] ?? 1 : 1;
        const custom = layerId ? colorByLayer[layerId] : undefined;
        const color = custom || SUBTYPE_COLORS[subtype] || '#666';
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
      source: clusterSourceRef.current,
      zIndex: 4,
      style: (feature) => {
        const features = feature.get('features') as Feature[] | undefined;
        const inner = features?.length === 1 ? features[0] : feature;
        const size = features?.length ?? 1;
        if (size > 1) {
          return new Style({
            image: new CircleStyle({
              radius: 12,
              fill: new Fill({ color: '#607d8b' }),
              stroke: new Stroke({ color: '#fff', width: 2 }),
            }),
          });
        }
        const subtype = inner.get('subtype') as string;
        const id = inner.get('id') as string;
        const layerId = inner.get('layer_id') as string | undefined;
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

    const map = new OlMap({
      target: containerRef.current,
      layers: [createBasemap(basemap), radiusLayer, networkLayer, connectionLayer, lineLayer, pointLayer],
      interactions: defaultInteractions({ doubleClickZoom: false }),
      view: new View({
        center: fromLonLat([37.6176, 55.7558]),
        zoom: 9,
      }),
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
      clusterSourceRef.current.forEachFeatureIntersectingExtent(extent, (feature) => {
        addFeature(feature);
      });

      onFeatureGroupSelectRef.current?.(selections);
    });

    modify.on('modifystart', () => {
      suppressDataSyncRef.current = true;
    });

    modify.on('modifyend', () => {
      const collection = select.getFeatures();
      const f = collection.item(0);
      if (!f) {
        suppressDataSyncRef.current = false;
        return;
      }
      const features = f.get('features') as Feature[] | undefined;
      const inner = features?.length === 1 ? features[0] : f;
      const kind = inner.get('featureKind') as string;
      const id = inner.get('id') as string;
      const geom = inner.getGeometry();
      if (!geom || !kind || !id) {
        suppressDataSyncRef.current = false;
        return;
      }
      const releaseSync = () => {
        suppressDataSyncRef.current = false;
      };
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
        releaseSync();
        return;
      }
      if (save != null && typeof (save as Promise<void>).then === 'function') {
        (save as Promise<void>).finally(releaseSync);
      } else {
        releaseSync();
      }
    });

    map.addInteraction(select);
    map.addInteraction(modify);
    map.addInteraction(dragBox);
    dragBox.setActive(false);

    map.on('click', (evt) => {
      if (drawModeRef.current !== 'select') {
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
      if (drawModeRef.current !== 'line') return;
      const coords = draftLineRef.current || [];
      if (coords.length < 2) return;
      evt.preventDefault();
      onFinishLineRef.current?.(coords);
    });
    const refreshHover = (hit: string | null) => {
      if (hit === hoveredIdRef.current) return;
      hoveredIdRef.current = hit;
      pointLayer.changed();
      lineLayer.changed();
      if (containerRef.current) {
        const inSelect = drawModeRef.current === 'select';
        containerRef.current.style.cursor = hit
          ? 'pointer'
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

    const viewport = map.getViewport();
    const onViewportLeave = () => refreshHover(null);
    viewport.addEventListener('mouseleave', onViewportLeave);

    let bboxTimer: ReturnType<typeof setTimeout> | undefined;
    map.on('moveend', () => {
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

    mapRef.current = map;
    return () => {
      clearTimeout(bboxTimer);
      viewport.removeEventListener('mouseleave', onViewportLeave);
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.getLayers().setAt(0, createBasemap(basemap));
  }, [basemap]);

  useEffect(() => {
    const isSelect = drawMode === 'select';
    const isSingle = isSelect && selectMode === 'single';
    const isBox = isSelect && selectMode === 'box';
    selectRef.current?.setActive(isSingle);
    modifyRef.current?.setActive(isSingle);
    dragBoxRef.current?.setActive(isBox);
    dragPanRef.current?.setActive(!isBox);
    if (containerRef.current) {
      containerRef.current.style.cursor = isBox ? 'crosshair' : isSelect ? 'default' : 'crosshair';
    }
    if (!isSelect) {
      selectRef.current?.getFeatures().clear();
    }
  }, [drawMode, selectMode]);

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
    const clusterFeatures = clusterSourceRef.current.getFeatures();
    clusterFeatures.forEach((cf) => {
      const members = cf.get('features') as Feature[] | undefined;
      if (members?.some((m) => targetIds.has(m.get('id') as string))) {
        collection.push(cf);
      }
    });
    lineSourceRef.current.getFeatures().forEach((f) => {
      const id = f.get('id') as string;
      if (targetIds.has(id) && f.get('subtype') !== 'draft') collection.push(f);
    });
  }, [selectedFeatureIds, selectMode, pois, infraObjects]);

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

    clusterSourceRef.current.refresh();
  }, [pois, infraObjects, draftLine]);

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
    connectionLines
      .filter((row) => row.param_type === 'external' && row.anchor_lon != null && row.anchor_lat != null)
      .forEach((row) => {
        source.addFeature(
          new Feature({
            geometry: new LineString([poiCoord, fromLonLat([row.anchor_lon!, row.anchor_lat!])]),
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
    const center = fromLonLat([selectedPoi.lon, selectedPoi.lat]);
    thresholdCircles
      .filter((c) => c.visible && c.km > 0)
      .forEach((c) => {
        source.addFeature(
          new Feature({
            geometry: new CircleGeom(center, c.km * 1000),
            color: c.color,
            key: c.key,
          })
        );
      });
  }, [thresholdCircles, selectedPoi, showRadii]);

  useEffect(() => {
    const src = networkSourceRef.current;
    src.clear();
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

  return (
    <div
      ref={containerRef}
      className="map-container rounded-xl overflow-hidden border"
      style={{ height, borderColor: 'var(--border)' }}
      data-selected={selectedFeatureId || ''}
    />
  );
}
