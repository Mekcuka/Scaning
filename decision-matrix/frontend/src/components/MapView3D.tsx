import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import maplibregl, { type Map as MapLibreMap, type MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { AnalysisRow, InfraLayer, InfraObject, POI } from '../lib/api';
import { buildMap3dGeoJson } from '../lib/map3d/geoJson';
import { applyMap3dAtmosphere } from '../lib/map3d/map3dAtmosphere';
import { createMap3dBaseStyle } from '../lib/map3d/map3dBasemap';
import {
  collectSubtypesFromGeoJson,
  registerMap3dSubtypeIcons,
} from '../lib/map3d/map3dIcons';
import {
  addMap3dVectorLayers,
  getMap3dInteractiveLayerIds,
  setBasemapVisibility,
  setMap3dInfraLinesPickOnly,
  setMap3dPointSymbolsVisibility,
} from '../lib/map3d/map3dLayers';
import { buildMap3dLineInstances } from '../lib/map3d/map3dLineInstances';
import {
  ensureMap3dLinesLayer,
  Map3dLinesCustomLayer,
  setMap3dLinesLayerVisible,
} from '../lib/map3d/map3dLinesLayer';
import {
  DEFAULT_TERRAIN_EXAGGERATION,
  MAP3D_SOURCE_IDS,
} from '../lib/map3d/map3dConfig';
import { applyMap3dTerrain } from '../lib/map3d/map3dTerrain';
import { buildMap3dModelInstances } from '../lib/map3d/map3dModelInstances';
import {
  ensureMap3dModelsLayer,
  Map3dModelsCustomLayer,
  setMap3dModelsLayerVisible,
} from '../lib/map3d/map3dModelsLayer';
import {
  resolveInitialMapView3d,
  saveMapViewState3d,
  type MapViewStateId,
  type SavedMapViewState,
} from '../lib/mapViewState';
import { useAppStore } from '../store';
import type { MapFeatureSelection, MapFocusTarget, ThresholdCircle } from './MapView';

export type { MapFeatureSelection, MapFocusTarget, ThresholdCircle };

export type MapView3DHandle = {
  getViewSnapshot: () => SavedMapViewState & { pitch: number; bearing: number } | null;
  jumpToView: (state: SavedMapViewState & { pitch?: number; bearing?: number }) => void;
};

export interface MapView3DProps {
  pois?: POI[];
  infraObjects?: InfraObject[];
  layers?: InfraLayer[];
  showBasemap?: boolean;
  showTerrain?: boolean;
  terrainExaggeration?: number;
  /** Procedural 3D models for point objects (Three.js custom layer). */
  showModels?: boolean;
  showRadii?: boolean;
  connectionLines?: AnalysisRow[];
  selectedPoi?: POI | null;
  thresholdCircles?: ThresholdCircle[];
  selectedFeatureId?: string | null;
  onFeatureSelect?: (sel: MapFeatureSelection | null) => void;
  mapFocus?: MapFocusTarget | null;
  viewStateId?: MapViewStateId;
  viewStateScope?: string | null;
  persistViewState?: boolean;
  height?: string;
}

function selectionFromFeature(f: MapGeoJSONFeature): MapFeatureSelection | null {
  const props = f.properties;
  if (!props) return null;
  const id = (props.id as string) || (f.id as string);
  const subtype = props.subtype as string;
  if (!id || subtype === 'draft') return null;
  const kind = props.featureKind as string;
  if (kind === 'poi') return { kind: 'poi', id };
  if (kind === 'infra') return { kind: 'infra', id };
  return null;
}

function clearFeatureState(
  map: MapLibreMap,
  sourceId: string,
  featureId: string | number,
): void {
  try {
    map.removeFeatureState({ source: sourceId, id: featureId });
  } catch {
    /* feature may be gone */
  }
}

function setSelectedFeatureState(
  map: MapLibreMap,
  prevId: string | null,
  nextId: string | null,
): void {
  const sources = [
    MAP3D_SOURCE_IDS.infraLines,
    MAP3D_SOURCE_IDS.infraExtrusions,
    MAP3D_SOURCE_IDS.infraPoints,
    MAP3D_SOURCE_IDS.pois,
  ];
  if (prevId) {
    for (const source of sources) {
      clearFeatureState(map, source, prevId);
    }
  }
  if (nextId) {
    for (const source of sources) {
      try {
        map.setFeatureState({ source, id: nextId }, { selected: true });
      } catch {
        /* not in this source */
      }
    }
  }
}

const MapView3D = forwardRef<MapView3DHandle, MapView3DProps>(function MapView3D(
  {
    pois = [],
    infraObjects = [],
    layers,
    showBasemap = true,
    showTerrain = true,
    terrainExaggeration = DEFAULT_TERRAIN_EXAGGERATION,
    showModels = true,
    showRadii = true,
    connectionLines = [],
    selectedPoi = null,
    thresholdCircles = [],
    selectedFeatureId = null,
    onFeatureSelect,
    mapFocus = null,
    viewStateId,
    viewStateScope = null,
    persistViewState = true,
    height = '100%',
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const linesLayerRef = useRef(new Map3dLinesCustomLayer());
  const modelsLayerRef = useRef(new Map3dModelsCustomLayer());
  const prevSelectedRef = useRef<string | null>(null);
  const projectId = useAppStore((s) => s.currentProjectId);
  const viewStateIdRef = useRef(viewStateId);
  const projectIdRef = useRef(projectId);
  const persistRef = useRef(persistViewState);
  const onSelectRef = useRef(onFeatureSelect);

  viewStateIdRef.current = viewStateId;
  projectIdRef.current = projectId;
  persistRef.current = persistViewState;
  onSelectRef.current = onFeatureSelect;

  useImperativeHandle(ref, () => ({
    getViewSnapshot: () => {
      const map = mapRef.current;
      if (!map) return null;
      const c = map.getCenter();
      return {
        centerLon: c.lng,
        centerLat: c.lat,
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      };
    },
    jumpToView: (state) => {
      const map = mapRef.current;
      if (!map) return;
      map.jumpTo({
        center: [state.centerLon, state.centerLat],
        zoom: state.zoom,
        pitch: state.pitch ?? map.getPitch(),
        bearing: state.bearing ?? map.getBearing(),
      });
    },
  }));

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initial = resolveInitialMapView3d(
      viewStateIdRef.current,
      projectIdRef.current,
      viewStateScope,
    );

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createMap3dBaseStyle(),
      center: [initial.centerLon, initial.centerLat],
      zoom: initial.zoom,
      pitch: initial.pitch,
      bearing: initial.bearing,
      maxPitch: 85,
      attributionControl: {},
      canvasContextAttributes: { antialias: true },
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    const linesLayer = linesLayerRef.current;
    const modelsLayer = modelsLayerRef.current;

    map.on('load', () => {
      addMap3dVectorLayers(map);
      ensureMap3dLinesLayer(map, linesLayer);
      ensureMap3dModelsLayer(map, modelsLayer);
      setBasemapVisibility(map, showBasemap);
      applyMap3dTerrain(map, showTerrain, terrainExaggeration);
      applyMap3dAtmosphere(map);
      linesLayer.setInstances(
        buildMap3dLineInstances(map, {
          infraObjects,
          layers,
          selectedFeatureId,
        }),
      );
      setMap3dLinesLayerVisible(linesLayer, true);
      setMap3dInfraLinesPickOnly(map, true);
      if (showModels) {
        modelsLayer.setInstances(
          buildMap3dModelInstances({
            infraObjects,
            pois,
            layers,
            selectedFeatureId,
          }),
        );
      }
      setMap3dModelsLayerVisible(modelsLayer, showModels);
      setMap3dPointSymbolsVisibility(map, !showModels);
    });

    map.on('click', (e) => {
      const layerIds = getMap3dInteractiveLayerIds().filter((id) => map.getLayer(id));
      const hits = map.queryRenderedFeatures(e.point, { layers: [...layerIds] });
      const top = hits.find((f) => selectionFromFeature(f));
      onSelectRef.current?.(top ? selectionFromFeature(top) : null);
    });

    map.on('moveend', () => {
      if (!persistRef.current || !viewStateIdRef.current) return;
      const c = map.getCenter();
      saveMapViewState3d(viewStateIdRef.current, projectIdRef.current, {
        centerLon: c.lng,
        centerLat: c.lat,
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      }, viewStateScope);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [viewStateScope]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (mapRef.current) setBasemapVisibility(mapRef.current, showBasemap);
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [showBasemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (mapRef.current) {
        applyMap3dTerrain(mapRef.current, showTerrain, terrainExaggeration);
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [showTerrain, terrainExaggeration]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyLines = () => {
      if (!map.getLayer(linesLayerRef.current.id)) {
        ensureMap3dLinesLayer(map, linesLayerRef.current);
      }
      linesLayerRef.current.setInstances(
        buildMap3dLineInstances(map, {
          infraObjects,
          layers,
          selectedFeatureId,
        }),
      );
      setMap3dLinesLayerVisible(linesLayerRef.current, true);
      setMap3dInfraLinesPickOnly(map, true);
    };

    if (map.isStyleLoaded()) applyLines();
    else map.once('load', applyLines);
  }, [infraObjects, layers, selectedFeatureId, showTerrain]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyModels = () => {
      if (!map.getLayer(modelsLayerRef.current.id)) {
        ensureMap3dModelsLayer(map, modelsLayerRef.current);
      }
      setMap3dModelsLayerVisible(modelsLayerRef.current, showModels);
      if (showModels) {
        modelsLayerRef.current.setInstances(
          buildMap3dModelInstances({
            infraObjects,
            pois,
            layers,
            selectedFeatureId,
          }),
        );
      } else {
        modelsLayerRef.current.setInstances([]);
      }
      setMap3dPointSymbolsVisibility(map, !showModels);
    };

    if (map.isStyleLoaded()) applyModels();
    else map.once('load', applyModels);
  }, [showModels, infraObjects, pois, layers, selectedFeatureId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = async () => {
      const bundle = buildMap3dGeoJson({
        infraObjects,
        pois,
        layers,
        thresholdCircles: showRadii ? thresholdCircles : [],
        thresholdCenter: selectedPoi ? { lon: selectedPoi.lon, lat: selectedPoi.lat } : null,
        connectionLines,
        selectedPoi,
      });

      await registerMap3dSubtypeIcons(
        map,
        collectSubtypesFromGeoJson(infraObjects, pois),
      );

      const setSource = (id: string, data: GeoJSON.FeatureCollection) => {
        const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
        if (src) src.setData(data);
      };

      setSource(MAP3D_SOURCE_IDS.infraLines, bundle.infraLines);
      setSource(MAP3D_SOURCE_IDS.infraExtrusions, bundle.infraExtrusions);
      setSource(MAP3D_SOURCE_IDS.infraPoints, bundle.infraPoints);
      setSource(MAP3D_SOURCE_IDS.pois, bundle.pois);
      setSource(MAP3D_SOURCE_IDS.thresholds, bundle.thresholds);
      setSource(MAP3D_SOURCE_IDS.analysisLines, bundle.analysisLines);
      setSource(MAP3D_SOURCE_IDS.analysisLabels, bundle.analysisLabels);
      setSource(MAP3D_SOURCE_IDS.infraLineLabels, bundle.infraLineLabels);

      const prev = prevSelectedRef.current;
      if (prev !== selectedFeatureId) {
        setSelectedFeatureState(map, prev, selectedFeatureId);
        prevSelectedRef.current = selectedFeatureId;
      }
    };

    if (map.isStyleLoaded()) void apply();
    else map.once('load', () => void apply());
  }, [
    infraObjects,
    pois,
    layers,
    thresholdCircles,
    selectedPoi,
    connectionLines,
    showRadii,
    selectedFeatureId,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapFocus) return;

    const run = () => {
      if (mapFocus.extentLonLat) {
        const [minLon, minLat, maxLon, maxLat] = mapFocus.extentLonLat;
        const padLon = Math.max((maxLon - minLon) * 0.15, 0.008);
        const padLat = Math.max((maxLat - minLat) * 0.15, 0.008);
        map.fitBounds(
          [
            [minLon - padLon, minLat - padLat],
            [maxLon + padLon, maxLat + padLat],
          ],
          { padding: 48, maxZoom: 14, duration: 450 },
        );
        return;
      }
      map.flyTo({
        center: [mapFocus.lon, mapFocus.lat],
        zoom: Math.max(map.getZoom(), 12),
        duration: 450,
      });
    };

    if (map.isStyleLoaded()) run();
    else map.once('load', run);
  }, [mapFocus?.nonce]);

  return (
    <div
      ref={containerRef}
      className="map-container map-container--3d"
      style={{
        height,
        width: '100%',
        background: showBasemap ? undefined : 'var(--bg, #e8ecef)',
      }}
      data-selected={selectedFeatureId || ''}
    />
  );
});

export default MapView3D;
