import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BoxSelect,
  ClipboardPaste,
  Copy,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  MousePointer2,
  PenLine,
  Pencil,
  Route,
  Ruler,
  Scissors,
  Search,
  Trash2,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import { DevPortBanner } from '../components/DevPortBanner';
import { CandidatesModal } from '../components/CandidatesModal';
import { AppModal } from '../components/AppModal';
import { AnchoredMenu } from '../components/AnchoredMenu';
import { MapPoiSelect } from '../components/MapPoiSelect';
import {
  alignAnalysisRowsToMapObjects,
  buildAnalysisResultMapFocus,
  buildMapFitAllFocus,
  connectionLinesFromAnalysis,
} from '../lib/analysisDisplay';
import { AutoroadNetworkPanel } from '../components/AutoroadNetworkPanel';
import {
  MapGroupSelectionPanel,
  type MapGroupSelectionItem,
} from '../components/MapGroupSelectionPanel';
import { isAutoroadNetworkTerminal } from '../lib/autoroadNetwork';
import {
  linesFromNetworkPlanResponse,
  networkPlanToConnectPreview,
  type AutoroadPlanPreviewLine,
} from '../lib/autoroadPlanPreview';
import { MapDisplayModeToggle } from '../components/MapDisplayModeToggle';
import { MapLayersPanel } from '../components/MapLayersPanel';
import { ObjectDetailPanel, type SelectedFeature } from '../components/ObjectDetailPanel';
import { PoiParamsForm } from '../components/PoiParamsForm';
import { coordForSave, formatCoord, parseCoord, roundCoord } from '../lib/coords';
import {
  emptyPoiFormValues,
  formValuesToPoiCreatePayload,
  nextPoiAutoName,
} from '../lib/poiParams';
import {
  MapView,
  type DrawMode,
  type MapClickHit,
  type MapFeatureSelection,
  type MapFocusTarget,
  type SelectMode,
  type ThresholdCircle,
} from '../components/MapView';
import { iconDataUrl } from '../lib/mapIcons';
import { useMapDisplayMode } from '../hooks/useMapDisplayMode';
import { useAutoroadConnectConfirm } from '../hooks/useAutoroadConnectConfirm';
import {
  isMaptilerTerrainAvailable,
  MAP3D_TERRAIN_TOAST_KEY,
} from '../lib/map3d/map3dConfig';
import { setProjectCustomGltfAssets } from '../lib/map3d/map3dCustomAssets';
import { clearGltfPrototypeCache } from '../lib/map3d/map3dGltfLoader';
import {
  loadMapViewState,
  resolveInitialMapView3d,
  saveMapViewState,
  type SavedMapViewState,
} from '../lib/mapViewState';
import type { MapView3DHandle } from '../components/MapView3D';

const MapView3D = lazy(() => import('../components/MapView3D'));
import {
  LINE_SUBTYPES,
  MAP_DRAWABLE_POINT_SUBTYPES,
  SUBTYPE_LABELS,
  api,
  normalizePoiAnalysisResponse,
  type AnalysisResult,
  type AnalysisRow,
  type Candidate,
  type InfraLayer,
  type InfraObject,
  type InfraObjectCreate,
  type PoiAnalysisResponse,
  type AutoroadConnectResult,
  type AutoroadNetworkApplyResult,
  type POI,
} from '../lib/api';
import { analyzeAllPoisAndWait } from '../lib/runApiJob';
import { useActiveProject } from '../hooks/useActiveProject';
import { useMapLayerPreferences } from '../hooks/useMapLayerPreferences';
import {
  clampLineLodScaleThreshold,
  formatScaleDenominator,
  LINE_LOD_SCALE_MAX,
  LINE_LOD_SCALE_MIN,
  LINE_LOD_SCALE_STEP,
  lineLodForScale,
} from '../lib/mapLineLod';
import { usePermissions } from '../hooks/usePermissions';
import {
  patchInfraObjectsInQueries,
  refreshMapQueries,
  removeInfraObjectsFromQueries,
  upsertInfraObjectInQueries,
} from '../lib/mapQueries';
import {
  MAP_INFRA_STALE_MS,
  MAP_VIEWPORT_MIN_OBJECTS,
  clearLineHealDoneForProject,
  expandMapBbox,
  isLineHealDoneForProject,
  markLineHealDoneForProject,
  mergeInfraForMapDisplay,
  shouldUpdateMapBbox,
} from '../lib/mapBboxUtils';
import { formatLengthMeters, lineLengthMeters } from '../lib/mapMeasure';
import { isProjectJobCreateResponse, pollProjectJobUntilDone } from '../lib/pollProjectJob';
import { taskLog } from '../lib/taskLog/store';
import { useActiveProjectJob } from '../hooks/useActiveProjectJob';
import { lineDraftFinishCoordinates } from '../lib/mapLineDraftFinish';
import {
  resolveLineEndpoint,
  snapLineDrawPoint,
  isLineEndpointSnapped,
  lineEndpointAttachmentsFromObject,
  constrainLineCoordinatesOnEdit,
  normalizeLinePathEndpoints,
} from '../lib/lineEndpointRules';
import { isLineSubtype, lineEndpointHealPayload } from '../lib/infraGeometry';
import { InfraPointSnapIndex } from '../lib/infraSnapIndex';
import {
  applyInfraLineSplit,
  resolveLineSplitCandidate,
  type LineSplitHint,
} from '../lib/applyInfraLineSplit';
import {
  expandInfraDeleteIds,
  infraDeleteApiIds,
} from '../lib/infraLinks';
import {
  accumulateLineEndpointPatches,
  buildMovedPositionsMap,
  constrainGroupMovedLine,
  lineEndpointPatchesToResults,
  type MovedPointUpdate,
} from '../lib/mapGroupLinePatches';
import { mergeInfraPropertiesForSave } from '../lib/mergeInfraPropertiesForSave';
import {
  infraDetailUndo,
  infraGeometryUndo,
  poiDetailUndo,
  poiGeometryUndo,
  useMapUndo,
} from '../lib/mapUndo';
import { useAppStore } from '../store';
import { useMapHotkeys } from '../lib/mapHotkeys';
import {
  applyOffsetToClipboard,
  buildClipboardFromSelection,
  clipboardPreviewAt,
  infraClipboardToCreatePayload,
  partitionClipboardForPaste,
  poiClipboardToCreatePayload,
  createInfraFromPasteSnapshot,
  remapLineEndpointsForPaste,
  type MapClipboardItem,
} from '../lib/mapClipboard';
import { buildMapSearchHits, filterInfraByMapQuery } from '../lib/mapSearch';
import { THRESHOLD_META, MOVE_MATCH_EPS } from './map/mapConstants';
import { PointSubtypeMenuItem } from './map/PointSubtypeMenuItem';

export { mergeInfraPropertiesForSave } from '../lib/mergeInfraPropertiesForSave';

export function sameCoord(a: number, b: number): boolean {
  return Math.abs(a - b) <= MOVE_MATCH_EPS;
}

export function linkCoordMatch(a: number, b: number): boolean {
  return sameCoord(a, b) || roundCoord(a) === roundCoord(b);
}

export function lineCoordsOrEndpoints(obj: InfraObject): [number, number][] | null {
  if (obj.coordinates && obj.coordinates.length >= 2) {
    return obj.coordinates.map(([lon, lat]) => [lon, lat]);
  }
  if (obj.end_lon != null && obj.end_lat != null) {
    return [
      [obj.lon, obj.lat],
      [obj.end_lon, obj.end_lat],
    ];
  }
  return null;
}

export function MapPage() {
  const { canWriteProject, canWriteInfra } = usePermissions();
  const { requestConfirm: requestAutoroadConfirm, modal: autoroadConfirmModal } =
    useAutoroadConnectConfirm();
  const canEditMap = canWriteProject || canWriteInfra;
  const { projectId } = useActiveProject();
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const mapRefreshNonce = useAppStore((s) => s.mapRefreshNonce);
  const [mapBbox, setMapBbox] = useState<string | null>(null);
  /** Local create/update visible in viewport mode until bbox refetch includes them. */
  const [infraOverlayIds, setInfraOverlayIds] = useState<Set<string>>(() => new Set());
  const { prefs: layerPrefs, setPrefs: setLayerPrefs, patchPrefs: patchLayerPrefs, setOpenSections: setLayerOpenSections } =
    useMapLayerPreferences(projectId ?? null);
  const {
    showBasemap,
    showTerrain,
    showModels,
    showPoisOnMap,
    showRadii,
    radiusVisible,
    subtypeFilter,
    openSections: layerOpenSections,
  } = layerPrefs;
  const { is3dEnabled: map3dFeatureEnabled, displayMode: mapDisplayMode, setDisplayMode: setMapDisplayMode, mapIn3d } =
    useMapDisplayMode();
  /** Keep 3D map mounted after first open to avoid reloading tiles on each 2D↔3D toggle. */
  const [map3dKeepMounted, setMap3dKeepMounted] = useState(false);
  const map3dRef = useRef<MapView3DHandle | null>(null);
  const last2dViewRef = useRef<SavedMapViewState | null>(null);
  const lineHealAttemptedRef = useRef<Set<string>>(new Set());
  /** Lines just pasted from clipboard — skip auto-heal so geometry stays exact. */
  const lineHealSkipIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (mapIn3d) setMap3dKeepMounted(true);
  }, [mapIn3d]);

  const [mapLayersOpen, setMapLayersOpen] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const mapCanvasRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<{ lon: number; lat: number } | null>(null);
  const cursorRef = useRef<{ lon: number; lat: number } | null>(null);
  const [mapPointerInside, setMapPointerInside] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>('select');
  const [selectMode, setSelectMode] = useState<SelectMode>('single');
  const [autoroadNetworkTerminalIds, setAutoroadNetworkTerminalIds] = useState<string[]>([]);
  const [autoroadPlanPreviewLines, setAutoroadPlanPreviewLines] = useState<AutoroadPlanPreviewLine[]>(
    [],
  );
  const [selectMenuOpen, setSelectMenuOpen] = useState(false);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [lineDraft, setLineDraft] = useState<number[][]>([]);
  const [lineDraftPreview, setLineDraftPreview] = useState<[number, number] | null>(null);
  const [rulerPoints, setRulerPoints] = useState<number[][]>([]);
  const [rulerPreview, setRulerPreview] = useState<[number, number] | null>(null);
  const [rulerCompleted, setRulerCompleted] = useState<number[][][]>([]);
  const [modal, setModal] = useState<
    | null
    | { type: 'poi'; lon: number; lat: number }
  >(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [poiForm, setPoiForm] = useState(emptyPoiFormValues);
  const [infraForm, setInfraForm] = useState({ subtype: 'gas_processing' });
  const [searchQ, setSearchQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchBlurRef = useRef<number | null>(null);
  const selectMenuAnchorRef = useRef<HTMLDivElement>(null);
  const pointMenuAnchorRef = useRef<HTMLDivElement>(null);
  const lineMenuAnchorRef = useRef<HTMLDivElement>(null);
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const rulerClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [featureSel, setFeatureSel] = useState<MapFeatureSelection | null>(null);
  const [featureGroupSel, setFeatureGroupSel] = useState<MapFeatureSelection[]>([]);
  const [candidateSubtype, setCandidateSubtype] = useState<string | null>(null);
  const [candidateParamType, setCandidateParamType] = useState<'external' | 'external_linear'>('external');
  const [pointMenuOpen, setPointMenuOpen] = useState(false);
  const [lineMenuOpen, setLineMenuOpen] = useState(false);
  const [mapFocus, setMapFocus] = useState<MapFocusTarget | null>(null);
  const [mapEditEnabled, setMapEditEnabled] = useState(false);
  const [mapClipboard, setMapClipboard] = useState<MapClipboardItem[] | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [mapScaleLabel, setMapScaleLabel] = useState('—');
  const [mapScaleDenominator, setMapScaleDenominator] = useState(0);

  useEffect(() => {
    if (!canEditMap) {
      setMapEditEnabled(false);
      setDrawMode('select');
      setPointMenuOpen(false);
      setLineMenuOpen(false);
    }
  }, [canEditMap]);

  useEffect(() => {
    if (!canWriteProject && drawMode === 'poi') setDrawMode('select');
    if (
      !canWriteInfra &&
      (drawMode === 'point' || drawMode === 'line' || drawMode === 'autoroad_network')
    ) {
      setDrawMode('select');
    }
  }, [canWriteProject, canWriteInfra, drawMode]);

  const toggleMapFullscreen = useCallback(async () => {
    const el = mapCanvasRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore unsupported fullscreen */
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setMapFullscreen(document.fullscreenElement === mapCanvasRef.current);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (drawMode !== 'select') {
      setFeatureSel(null);
      setFeatureGroupSel([]);
      setPasteMode(false);
    }
    if (drawMode !== 'autoroad_network') {
      setAutoroadNetworkTerminalIds([]);
      setAutoroadPlanPreviewLines([]);
    }
  }, [drawMode]);

  useEffect(() => {
    if (selectMode === 'single') setFeatureGroupSel([]);
    else setFeatureSel(null);
  }, [selectMode]);

  useEffect(() => {
    if (mapEditEnabled) {
      setSelectMenuOpen(false);
      return;
    }
    setFeatureSel(null);
    setFeatureGroupSel([]);
    setPasteMode(false);
    setDrawMode((m) => (m === 'ruler' ? m : 'select'));
    setLineDraft([]);
    setSelectMenuOpen(false);
    setPointMenuOpen(false);
    setLineMenuOpen(false);
  }, [mapEditEnabled]);

  useEffect(() => {
    if (drawMode !== 'ruler') {
      setRulerPoints([]);
      setRulerPreview(null);
      setRulerCompleted([]);
    }
  }, [drawMode]);

  useEffect(() => {
    if (drawMode !== 'line') setLineDraftPreview(null);
  }, [drawMode]);

  useEffect(() => {
    if (lineDraft.length === 0) setLineDraftPreview(null);
  }, [lineDraft.length]);

  const cancelDrawingSelection = useCallback(() => {
    setDrawMode('select');
    setLineDraft([]);
    setLineDraftPreview(null);
    setSelectMenuOpen(false);
    setPointMenuOpen(false);
    setLineMenuOpen(false);
  }, []);

  const [geometrySavePending, setGeometrySavePending] = useState(0);

  useEffect(
    () => () => {
      if (rulerClickTimerRef.current) clearTimeout(rulerClickTimerRef.current);
    },
    [],
  );

  const { data: pois = [] } = useQuery({
    queryKey: ['pois', projectId],
    queryFn: () => api.getPois(projectId!),
    enabled: !!projectId,
    staleTime: MAP_INFRA_STALE_MS,
  });

  const { projectJobBusy } = useActiveProjectJob(projectId);

  useEffect(() => {
    if (pois.length > 0 && !selectedPoiId) setSelectedPoiId(pois[0].id);
  }, [pois, selectedPoiId]);

  const { data: distanceDefaults } = useQuery({
    queryKey: ['distance-defaults', projectId],
    queryFn: () => api.getDistanceDefaults(projectId!),
    enabled: !!projectId,
  });

  const { data: layers = [] } = useQuery({
    queryKey: ['layers', projectId],
    queryFn: () => api.getLayers(projectId!),
    enabled: !!projectId,
    staleTime: MAP_INFRA_STALE_MS,
  });

  const layerVisibilityMut = useMutation({
    mutationFn: ({ layerId, is_visible }: { layerId: string; is_visible: boolean }) =>
      api.updateLayer(projectId!, layerId, { is_visible }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['layers', projectId] }),
  });

  const setGroupSubtypesVisible = useCallback((subtypes: readonly string[], visible: boolean) => {
    setLayerPrefs((prev) => {
      const subtypeFilter = { ...prev.subtypeFilter };
      for (const st of subtypes) subtypeFilter[st] = visible;
      return { ...prev, subtypeFilter };
    });
  }, [setLayerPrefs]);

  const isGroupVisible = useCallback(
    (subtypes: readonly string[]) => subtypes.every((st) => subtypeFilter[st] !== false),
    [subtypeFilter],
  );

  const {
    data: infraObjects = [],
    isError: infraLoadError,
    error: infraLoadErr,
  } = useQuery({
    queryKey: ['infra', projectId],
    queryFn: () => api.getInfraObjects(projectId!),
    enabled: !!projectId,
    staleTime: MAP_INFRA_STALE_MS,
    placeholderData: keepPreviousData,
  });

  const useViewportInfraLoad =
    !mapEditEnabled &&
    infraObjects.length >= MAP_VIEWPORT_MIN_OBJECTS &&
    mapBbox != null;

  const displayKeepIds = useMemo(() => {
    const ids = new Set<string>();
    if (featureSel?.kind === 'infra') ids.add(featureSel.id);
    for (const sel of featureGroupSel) {
      if (sel.kind === 'infra') ids.add(sel.id);
    }
    return ids;
  }, [featureSel, featureGroupSel]);

  const { data: infraViewport = [] } = useQuery({
    queryKey: ['infra', projectId, 'bbox', mapBbox],
    queryFn: () =>
      api.getInfraObjects(projectId!, {
        bbox: expandMapBbox(mapBbox!),
        visibleLayersOnly: true,
      }),
    enabled: !!projectId && useViewportInfraLoad,
    staleTime: MAP_INFRA_STALE_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const mapInfraSource = useMemo(() => {
    if (!useViewportInfraLoad) return infraObjects;
    return mergeInfraForMapDisplay(
      infraViewport,
      infraObjects,
      displayKeepIds,
      infraOverlayIds,
    );
  }, [useViewportInfraLoad, infraViewport, infraObjects, displayKeepIds, infraOverlayIds]);

  const infraSnapIndex = useMemo(
    () => new InfraPointSnapIndex(infraObjects),
    [infraObjects],
  );

  const needsCursorState =
    pasteMode ||
    drawMode === 'point' ||
    drawMode === 'poi' ||
    (drawMode === 'ruler' && rulerPoints.length >= 1) ||
    (drawMode === 'line' && lineDraft.length >= 1);

  useEffect(() => {
    if (!useViewportInfraLoad || infraViewport.length === 0) return;
    setInfraOverlayIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const o of infraViewport) {
        if (next.delete(o.id)) changed = true;
      }
      return changed ? next : prev;
    });
  }, [infraViewport, useViewportInfraLoad]);

  useEffect(() => {
    if (!projectId || mapEditEnabled) return;
    if (infraObjects.length < MAP_VIEWPORT_MIN_OBJECTS) return;
    void queryClient.invalidateQueries({
      queryKey: ['infra', projectId],
      predicate: (q) => q.queryKey[2] === 'bbox',
    });
  }, [mapEditEnabled, projectId, infraObjects.length, queryClient]);

  const handleMapBboxChange = useCallback((bbox: string) => {
    setMapBbox((prev) => (shouldUpdateMapBbox(prev, bbox) ? bbox : prev));
  }, []);

  const { data: map3dCustomModels = [] } = useQuery({
    queryKey: ['map3d-custom-models', projectId],
    queryFn: () => api.listMap3dCustomModels(projectId!),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (!projectId) {
      setProjectCustomGltfAssets('', []);
      clearGltfPrototypeCache();
      return;
    }
    setProjectCustomGltfAssets(projectId, map3dCustomModels);
    clearGltfPrototypeCache();
  }, [projectId, map3dCustomModels]);

  useEffect(() => {
    if (!infraLoadError || !projectId) return;
    const msg =
      infraLoadErr instanceof Error ? infraLoadErr.message : 'Не удалось загрузить объекты карты';
    pushToast('error', msg);
  }, [infraLoadError, infraLoadErr, projectId, pushToast]);

  const searchContext = useMemo(
    () => ({ layers, subtypeLabels: SUBTYPE_LABELS }),
    [layers],
  );

  const searchFilteredInfra = useMemo(
    () => filterInfraByMapQuery(mapInfraSource, searchQ, searchContext),
    [mapInfraSource, searchQ, searchContext],
  );

  const searchSuggestions = useMemo(
    () => buildMapSearchHits(pois, infraObjects, searchQ, searchContext, 10),
    [searchQ, pois, infraObjects, searchContext],
  );

  const pickSearchResult = useCallback(
    (hit: { kind: 'poi' | 'infra'; id: string; name: string }) => {
      setSearchQ(hit.name);
      setSearchOpen(false);
                setDrawMode('select');
                setSelectMenuOpen(false);
                setPointMenuOpen(false);
      setLineMenuOpen(false);
      if (hit.kind === 'poi') {
        setSelectedPoiId(hit.id);
        setFeatureSel({ kind: 'poi', id: hit.id });
      } else {
        setFeatureSel({ kind: 'infra', id: hit.id });
      }
    },
    []
  );

  const nextAutoName = useCallback(
    (subtype: string) => {
      const label = SUBTYPE_LABELS[subtype] || subtype;
      const base =
        queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      const re = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\\\]/g, '\\\\$&')}_([0-9]+)$`);
      let maxN = 0;
      for (const o of base || []) {
        if (o.subtype !== subtype) continue;
        const m = (o.name || '').match(re);
        if (m) maxN = Math.max(maxN, Number(m[1] || 0));
      }
      return `${label}_${maxN + 1}`;
    },
    [infraObjects, projectId, queryClient]
  );

  /** Objects on visible layers; while layers load — show all from API (filter applies when layers arrive). */
  const mapLayerVisibleInfra = useMemo(() => {
    if (layers.length === 0) return searchFilteredInfra;
    const layerById = new Map(layers.map((l) => [l.id, l]));
    return searchFilteredInfra.filter((o) => {
      if (!o.layer_id) return true;
      const layer = layerById.get(o.layer_id);
      if (!layer) return true;
      return layer.is_visible;
    });
  }, [searchFilteredInfra, layers]);

  const filteredInfra = useMemo(
    () =>
      mapLayerVisibleInfra.filter((o) => subtypeFilter[o.subtype] !== false),
    [mapLayerVisibleInfra, subtypeFilter]
  );

  const selectedPoi = pois.find((p) => p.id === selectedPoiId) ?? pois[0] ?? null;
  const switchMapDisplayMode = useCallback(
    (mode: '2d' | '3d') => {
      if (mode === '3d' && drawMode !== 'select') {
        setDrawMode('select');
        setAutoroadNetworkTerminalIds([]);
        setLineDraft([]);
        setLineDraftPreview(null);
        setRulerPoints([]);
        setRulerPreview(null);
        setPointMenuOpen(false);
        setLineMenuOpen(false);
        setSelectMenuOpen(false);
        pushToast('info', 'Рисование доступно только в режиме 2D');
      }
      if (mode === '3d') {
        const base =
          last2dViewRef.current ??
          (projectId ? loadMapViewState('main', projectId) : null) ?? {
            centerLon: 37.6176,
            centerLat: 55.7558,
            zoom: 9,
          };
        const saved3d = resolveInitialMapView3d('main', projectId ?? null);
        setMapDisplayMode('3d');
        if (import.meta.env.DEV && !isMaptilerTerrainAvailable()) {
          try {
            if (!sessionStorage.getItem(MAP3D_TERRAIN_TOAST_KEY)) {
              sessionStorage.setItem(MAP3D_TERRAIN_TOAST_KEY, '1');
              pushToast('info', 'Задайте VITE_MAPTILER_KEY в frontend/.env для рельефа');
            }
          } catch {
            /* sessionStorage unavailable */
          }
        }
        requestAnimationFrame(() => {
          map3dRef.current?.jumpToView({
            ...base,
            pitch: saved3d.pitch,
            bearing: saved3d.bearing,
          });
        });
        return;
      }
      const snap = map3dRef.current?.getViewSnapshot();
      if (snap && projectId) {
        saveMapViewState('main', projectId, {
          centerLon: snap.centerLon,
          centerLat: snap.centerLat,
          zoom: snap.zoom,
        });
      }
      setMapDisplayMode('2d');
    },
    [drawMode, pushToast, projectId, setMapDisplayMode],
  );

  const handleFitMapView = useCallback(() => {
    const visiblePois = showPoisOnMap ? pois : [];
    const focus = buildMapFitAllFocus(visiblePois, filteredInfra);
    if (!focus) {
      pushToast('info', 'На карте нет объектов для отображения');
      return;
    }
    setMapFocus({ ...focus, nonce: Date.now() });
  }, [pois, filteredInfra, showPoisOnMap, pushToast]);

  const { data: analysisData, error: analysisQueryError } = useQuery({
    queryKey: ['analysis', projectId, selectedPoi?.id],
    queryFn: async () => {
      try {
        const raw = await api.getPoiAnalysis(projectId!, selectedPoi!.id);
        return normalizePoiAnalysisResponse(raw);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/no analysis found|404|not found/i.test(msg)) return null;
        throw e;
      }
    },
    enabled: !!projectId && !!selectedPoi?.id,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const analysisRowsRaw: AnalysisRow[] =
    analysisData?.rows ?? analysisData?.analysis ?? [];

  useEffect(() => {
    if (!analysisQueryError) return;
    if (analysisRowsRaw.length > 0) return;
    const msg =
      analysisQueryError instanceof Error
        ? analysisQueryError.message
        : 'Не удалось загрузить результат анализа окружения';
    pushToast('error', msg);
  }, [analysisQueryError, analysisRowsRaw.length, pushToast]);

  const analysisRowsForMap = useMemo(
    () => alignAnalysisRowsToMapObjects(analysisRowsRaw, mapLayerVisibleInfra),
    [analysisRowsRaw, mapLayerVisibleInfra]
  );

  const connectionLines = useMemo(
    () => connectionLinesFromAnalysis(analysisRowsForMap, mapLayerVisibleInfra),
    [analysisRowsForMap, mapLayerVisibleInfra]
  );

  const thresholdKm = (subtype: string, fallback: number) => {
    if (!selectedPoi) return fallback;
    const poiKey = `threshold_${subtype}_km` as keyof typeof selectedPoi;
    const poiVal = selectedPoi[poiKey];
    if (typeof poiVal === 'number' && poiVal > 0) return poiVal;
    if (distanceDefaults) {
      const dKey = `threshold_${subtype}_km` as keyof typeof distanceDefaults;
      const dv = distanceDefaults[dKey];
      if (typeof dv === 'number') return dv;
    }
    return fallback;
  };

  const thresholdCircles: ThresholdCircle[] = useMemo(() => {
    if (!selectedPoi) return [];
    return THRESHOLD_META.map((m) => ({
      key: m.subtype,
      km: thresholdKm(m.subtype, m.defaultKm),
      color: m.color,
      visible: radiusVisible[m.subtype] ?? true,
    }));
  }, [selectedPoi, radiusVisible, distanceDefaults]);

  const groupSelectionDetails = useMemo((): MapGroupSelectionItem[] => {
    const out: MapGroupSelectionItem[] = [];
    for (const sel of featureGroupSel) {
      if (sel.kind === 'poi') {
        const poi = pois.find((p) => p.id === sel.id);
        if (poi) {
          out.push({
            id: sel.id,
            name: poi.name,
            kind: 'poi',
            subtitle: 'Точка интереса',
          });
        }
        continue;
      }
      const obj = infraObjects.find((o) => o.id === sel.id);
      if (obj) {
        out.push({
          id: sel.id,
          name: obj.name,
          kind: 'infra',
          subtype: obj.subtype,
          subtitle: SUBTYPE_LABELS[obj.subtype] || obj.subtype,
        });
      }
    }
    return out;
  }, [featureGroupSel, pois, infraObjects]);

  const detailSelection: SelectedFeature | null = useMemo(() => {
    if (!featureSel) return null;
    if (featureSel.kind === 'poi') {
      const poi = pois.find((p) => p.id === featureSel.id);
      return poi ? { kind: 'poi', poi } : null;
    }
    const obj = infraObjects.find((o) => o.id === featureSel.id);
    return obj ? { kind: 'infra', object: obj } : null;
  }, [featureSel, pois, infraObjects]);

  const invalidateMap = () => {
    if (!projectId) return;
    setInfraOverlayIds(new Set());
    setMapBbox(null);
    queryClient.invalidateQueries({ queryKey: ['pois', projectId] });
    void refreshMapQueries(queryClient, projectId);
  };

  const { pushUndo, performUndo, canUndo, lastUndoMessage, setLastUndoMessage } = useMapUndo({
    projectId,
    enabled: !!projectId,
    queryClient,
    invalidateMap,
    onUndoError: (msg) => pushToast('error', msg),
  });

  useEffect(() => {
    if (!lastUndoMessage) return;
    pushToast('info', lastUndoMessage);
    setLastUndoMessage(null);
  }, [lastUndoMessage, setLastUndoMessage, pushToast]);

  const createPoiMut = useMutation({
    mutationFn: (data: Parameters<typeof api.createPoi>[1]) => api.createPoi(projectId!, data),
    onSuccess: (created) => {
      pushUndo({
        kind: 'create_poi',
        poiId: created.id,
        label: `создание «${created.name}»`,
      });
      pushToast('success', `Точка «${created.name}» создана`);
      invalidateMap();
      setModal(null);
      setDrawMode('select');
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось сохранить точку интереса');
    },
  });

  const upsertInfraInCache = useCallback(
    (created: InfraObject) => {
      if (!projectId) return;
      upsertInfraObjectInQueries(queryClient, projectId, created);
      setInfraOverlayIds((prev) => {
        if (prev.has(created.id)) return prev;
        const next = new Set(prev);
        next.add(created.id);
        return next;
      });
    },
    [projectId, queryClient],
  );

  const removeInfraFromCaches = useCallback(
    (ids: Iterable<string>) => {
      if (!projectId) return;
      removeInfraObjectsFromQueries(queryClient, projectId, ids);
      setInfraOverlayIds((prev) => {
        const drop = new Set(ids);
        let changed = false;
        const next = new Set(prev);
        for (const id of drop) {
          if (next.delete(id)) changed = true;
        }
        return changed ? next : prev;
      });
    },
    [projectId, queryClient],
  );

  useEffect(() => {
    lineHealAttemptedRef.current.clear();
    setMapBbox(null);
    setInfraOverlayIds(new Set());
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    clearLineHealDoneForProject(projectId);
    lineHealAttemptedRef.current.clear();
  }, [projectId, mapRefreshNonce]);

  useEffect(() => {
    if (!projectId || !canWriteInfra || infraObjects.length === 0) return;
    if (isLineHealDoneForProject(projectId)) return;
    let cancelled = false;
    let healed = 0;
    void (async () => {
      for (const line of infraObjects) {
        if (!isLineSubtype(line.subtype)) continue;
        if (lineHealAttemptedRef.current.has(line.id)) continue;
        if (lineHealSkipIdsRef.current.has(line.id)) continue;
        lineHealAttemptedRef.current.add(line.id);
        const payload = lineEndpointHealPayload(line, infraObjects);
        if (!payload || cancelled) continue;
        try {
          const updated = await api.updateInfraObject(projectId, line.id, payload);
          if (!cancelled) {
            upsertInfraInCache(updated);
            healed += 1;
          }
        } catch {
          /* display snap still applies */
        }
      }
      if (!cancelled) {
        markLineHealDoneForProject(projectId);
        if (healed > 0) {
          pushToast('info', `Выровнены концы ${healed} линейных объектов по привязке`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [infraObjects, projectId, canWriteInfra, upsertInfraInCache, pushToast]);

  const createInfraMut = useMutation({
    mutationFn: (data: Parameters<typeof api.createInfraObject>[1]) =>
      api.createInfraObject(projectId!, {
        ...data,
        properties: mergeInfraPropertiesForSave(data.subtype, data.properties),
      }),
    onMutate: async () => {
      if (!projectId) return;
      await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
    },
    onSuccess: async (created) => {
      if (!projectId) return;
      await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
      upsertInfraInCache(created);

      const layerList =
        queryClient.getQueryData<InfraLayer[]>(['layers', projectId]) ?? layers;
      const layer = layerList.find((l) => l.id === created.layer_id);
      if (layer && !layer.is_visible) {
        queryClient.setQueryData<InfraLayer[]>(['layers', projectId], (old) =>
          old?.map((l) => (l.id === created.layer_id ? { ...l, is_visible: true } : l)) ?? old
        );
        try {
          await layerVisibilityMut.mutateAsync({ layerId: created.layer_id, is_visible: true });
        } catch {
          /* cache already updated; map will show the object */
        }
      } else if (!layer) {
        void queryClient.invalidateQueries({ queryKey: ['layers', projectId] });
      }

      setLayerPrefs((prev) => ({
        ...prev,
        subtypeFilter: { ...prev.subtypeFilter, [created.subtype]: true },
      }));
      setFeatureSel(null);

      pushUndo({
        kind: 'create_infra',
        objectId: created.id,
        label: `создание «${created.name}»`,
      });
      pushToast('success', `Объект «${created.name}» создан`);
      setModal(null);
      setLineDraft([]);
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось сохранить объект инфраструктуры');
    },
  });

  const afterInfraPointCreated = useCallback(
    async (created: InfraObject) => {
      if (!projectId) return;
      await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
      upsertInfraInCache(created);

      const layerList =
        queryClient.getQueryData<InfraLayer[]>(['layers', projectId]) ?? layers;
      const layer = layerList.find((l) => l.id === created.layer_id);
      if (layer && !layer.is_visible) {
        queryClient.setQueryData<InfraLayer[]>(['layers', projectId], (old) =>
          old?.map((l) => (l.id === created.layer_id ? { ...l, is_visible: true } : l)) ?? old
        );
        try {
          await layerVisibilityMut.mutateAsync({ layerId: created.layer_id, is_visible: true });
        } catch {
          /* cache already updated */
        }
      } else if (!layer) {
        void queryClient.invalidateQueries({ queryKey: ['layers', projectId] });
      }

      setLayerPrefs((prev) => ({
        ...prev,
        subtypeFilter: { ...prev.subtypeFilter, [created.subtype]: true },
      }));
      setFeatureSel(null);
      setModal(null);
      setLineDraft([]);
    },
    [projectId, queryClient, layers, layerVisibilityMut, upsertInfraInCache, setLayerPrefs],
  );

  const placeInfraPointAt = useCallback(
    async (
      subtype: string,
      lon: number,
      lat: number,
      splitHint?: { lineId: string; segmentIndex: number; snapLon?: number; snapLat?: number },
    ) => {
      if (!projectId || !canWriteInfra) return;
      const pool = queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;

      const splitFound = resolveLineSplitCandidate(lon, lat, pool, splitHint);
      const rLon = splitFound?.snapLon ?? lon;
      const rLat = splitFound?.snapLat ?? lat;

      try {
        await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
        const created = await api.createInfraObject(projectId, {
          name: nextAutoName(subtype),
          subtype,
          lon: rLon,
          lat: rLat,
          properties: mergeInfraPropertiesForSave(subtype, undefined),
        });

        if (splitFound) {
          try {
            const splitResult = await applyInfraLineSplit({
              projectId,
              split: splitFound,
              splitLon: rLon,
              splitLat: rLat,
            });
            if (splitResult) {
              const { updated, second } = splitResult;
              upsertInfraInCache(created);
              upsertInfraInCache(updated);
              upsertInfraInCache(second);
              pushUndo({
                kind: 'split_line_create_point',
                pointId: created.id,
                secondLineId: second.id,
                lineId: splitFound.line.id,
                lineBefore: infraGeometryUndo(splitFound.line),
                label: `вставка «${created.name}» в «${splitFound.line.name}»`,
              });
              pushToast(
                'success',
                `Объект «${created.name}» создан; линия «${splitFound.line.name}» разделена на две`,
              );
              await afterInfraPointCreated(created);
              return;
            }
          } catch (splitErr) {
            try {
              await api.deleteInfraObject(projectId, created.id);
            } catch {
              /* ignore rollback failure */
            }
            throw splitErr;
          }
        }

        await afterInfraPointCreated(created);
        pushUndo({
          kind: 'create_infra',
          objectId: created.id,
          label: `создание «${created.name}»`,
        });
        pushToast('success', `Объект «${created.name}» создан`);
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : 'Не удалось сохранить объект');
        void refreshMapQueries(queryClient, projectId);
      }
    },
    [
      projectId,
      canWriteInfra,
      queryClient,
      infraObjects,
      nextAutoName,
      upsertInfraInCache,
      afterInfraPointCreated,
      pushUndo,
      pushToast,
    ],
  );

  const analyzeMut = useMutation({
    mutationFn: () => {
      if (!projectId) {
        return Promise.reject(new Error('Выберите проект'));
      }
      if (pois.length === 0) {
        return Promise.reject(new Error('Нет точек интереса для анализа'));
      }
      return analyzeAllPoisAndWait(projectId);
    },
    onMutate: async () => {
      if (projectId) {
        await queryClient.cancelQueries({ queryKey: ['analysis', projectId] });
      }
    },
    onSuccess: async (batch) => {
      if (!projectId) return;
      for (const item of batch.results) {
        const normalized = normalizePoiAnalysisResponse(item);
        queryClient.setQueryData(['analysis', projectId, item.poi_id], normalized);
      }
      const poiForFocus = selectedPoi ?? pois[0];
      if (poiForFocus) {
        const normalized =
          queryClient.getQueryData<PoiAnalysisResponse>([
            'analysis',
            projectId,
            poiForFocus.id,
          ]) ?? null;
        const rawRows = normalized?.rows ?? normalized?.analysis ?? [];
        const infra =
          queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
        const layerList = queryClient.getQueryData<typeof layers>(['layers', projectId]) ?? layers;
        const visibleIds = new Set(
          (layerList ?? []).filter((l) => l.is_visible).map((l) => l.id)
        );
        const onMap = infra.filter((o) => visibleIds.has(o.layer_id));
        const aligned = alignAnalysisRowsToMapObjects(rawRows, onMap);
        const focus = buildAnalysisResultMapFocus(
          { lon: poiForFocus.lon, lat: poiForFocus.lat },
          aligned
        );
        if (focus) setMapFocus({ ...focus, nonce: Date.now() });
      }
      pushToast(
        'success',
        batch.analyzed_count === 1
          ? 'Анализ окружения выполнен для 1 точки'
          : `Анализ окружения выполнен для ${batch.analyzed_count} точек`
      );
      await queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['layers', projectId] });
    },
    onError: (err) => {
      pushToast(
        'error',
        err instanceof Error ? err.message : 'Не удалось выполнить анализ окружения'
      );
    },
  });

  const deleteInfraMut = useMutation({
    mutationFn: async (id: string) => {
      const currentInfra = queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      const deleteIds = expandInfraDeleteIds([id], currentInfra);
      await api.deleteInfraObject(projectId!, id);
      return [...deleteIds];
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
      const currentInfra = queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      const deleted =
        currentInfra.find((o) => o.id === id) ??
        infraObjects.find((o) => o.id === id);
      const deleteIds = expandInfraDeleteIds([id], currentInfra);
      const deletedGroup = currentInfra
        .filter((o) => deleteIds.has(o.id))
        .map((o) => structuredClone(o));
      const snapshots = queryClient.getQueriesData<InfraObject[]>({ queryKey: ['infra', projectId] });
      removeInfraFromCaches(deleteIds);
      return { snapshots, deleted, deletedGroup, deleteIds };
    },
    onError: (err, _id, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      pushToast('error', err instanceof Error ? err.message : 'Не удалось удалить объект');
    },
    onSuccess: (_deletedIds, id, ctx) => {
      if (ctx?.deletedGroup && ctx.deletedGroup.length > 1) {
        pushUndo({
          kind: 'restore_group',
          pois: [],
          infra: ctx.deletedGroup,
          label: `удаление ${ctx.deletedGroup.length} объектов`,
        });
        pushToast('success', `Удалено объектов: ${ctx.deletedGroup.length}`);
      } else if (ctx?.deleted) {
        pushUndo({
          kind: 'restore_infra',
          snapshot: ctx.deleted,
          label: `удаление «${ctx.deleted.name}»`,
        });
        pushToast('success', `Объект «${ctx.deleted.name}» удалён`);
      } else {
        pushToast('success', 'Объект удалён');
      }
      setFeatureSel((sel) => (sel && ctx?.deleteIds?.has(sel.id) ? null : sel?.id === id ? null : sel));
    },
    onSettled: async () => {
      if (!projectId) return;
      await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['analysis', projectId] });
    },
  });

  const deleteGroupMut = useMutation({
    mutationFn: async (items: MapFeatureSelection[]) => {
      const currentInfra = queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      const selectedInfraIds = items.filter((sel) => sel.kind === 'infra').map((sel) => sel.id);
      const allInfraIds = expandInfraDeleteIds(selectedInfraIds, currentInfra);
      const infraApiIds = infraDeleteApiIds(allInfraIds, currentInfra);
      const poiIds = items.filter((sel) => sel.kind === 'poi').map((sel) => sel.id);

      await api.batchDeleteMapObjects(projectId!, {
        object_ids: infraApiIds,
        poi_ids: poiIds,
      });
    },
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
      await queryClient.cancelQueries({ queryKey: ['pois', projectId] });
      const currentInfra = queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      const poisSnap: POI[] = [];
      const infraSnap: InfraObject[] = [];
      const selectedInfraIds = items.filter((sel) => sel.kind === 'infra').map((sel) => sel.id);
      const allInfraIds = expandInfraDeleteIds(selectedInfraIds, currentInfra);
      const poiIds = new Set(items.filter((sel) => sel.kind === 'poi').map((sel) => sel.id));
      const infraSnapshots = queryClient.getQueriesData<InfraObject[]>({ queryKey: ['infra', projectId] });
      const poiSnapshots = queryClient.getQueriesData<POI[]>({ queryKey: ['pois', projectId] });
      removeInfraFromCaches(allInfraIds);
      queryClient.setQueriesData<POI[]>({ queryKey: ['pois', projectId] }, (old) =>
        old ? old.filter((p) => !poiIds.has(p.id)) : []
      );
      for (const sel of items) {
        if (sel.kind === 'poi') {
          const poi = pois.find((p) => p.id === sel.id);
          if (poi) poisSnap.push(structuredClone(poi));
        } else {
          const obj = currentInfra.find((o) => o.id === sel.id) ?? infraObjects.find((o) => o.id === sel.id);
          if (obj) infraSnap.push(structuredClone(obj));
        }
      }
      for (const infraId of allInfraIds) {
        if (infraSnap.some((o) => o.id === infraId)) continue;
        const linked = currentInfra.find((o) => o.id === infraId);
        if (linked) infraSnap.push(structuredClone(linked));
      }
      return { poisSnap, infraSnap, infraSnapshots, poiSnapshots };
    },
    onSuccess: (_data, items, ctx) => {
      const poiCount = ctx?.poisSnap.length ?? 0;
      const infraCount = ctx?.infraSnap.length ?? 0;
      const total = poiCount + infraCount;
      if (ctx && total > 0) {
        pushUndo({
          kind: 'restore_group',
          pois: ctx.poisSnap,
          infra: ctx.infraSnap,
          label: `удаление ${total} объектов`,
        });
      }
      if (total === 1 && ctx?.poisSnap[0]) {
        pushToast('success', `Точка «${ctx.poisSnap[0].name}» удалена`);
      } else if (total === 1 && ctx?.infraSnap[0]) {
        pushToast('success', `Объект «${ctx.infraSnap[0].name}» удалён`);
      } else if (total > 0) {
        const parts: string[] = [];
        if (poiCount > 0) parts.push(`${poiCount} ${poiCount === 1 ? 'точка' : poiCount < 5 ? 'точки' : 'точек'}`);
        if (infraCount > 0) {
          parts.push(
            `${infraCount} ${infraCount === 1 ? 'объект' : infraCount < 5 ? 'объекта' : 'объектов'}`
          );
        }
        pushToast('success', `Удалено: ${parts.join(', ')}`);
      } else if (items.length > 0) {
        pushToast('success', `Удалено объектов: ${items.length}`);
      }
      const deletedIds = new Set(items.map((s) => s.id));
      setFeatureGroupSel([]);
      setFeatureSel((sel) => (sel && deletedIds.has(sel.id) ? null : sel));
    },
    onError: (err, _items, ctx) => {
      ctx?.infraSnapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      ctx?.poiSnapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      pushToast('error', err instanceof Error ? err.message : 'Не удалось удалить объекты');
    },
    onSettled: async () => {
      if (!projectId) return;
      await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
      await queryClient.cancelQueries({ queryKey: ['pois', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['pois', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['analysis', projectId] });
    },
  });

  const objectCountLabel = (count: number) =>
    count === 1 ? 'объект' : count < 5 ? 'объекта' : 'объектов';

  const executeDeleteGroupSelection = () => {
    if (!projectId || featureGroupSel.length === 0 || deleteGroupMut.isPending) return;
    deleteGroupMut.mutate(featureGroupSel);
  };

  const requestDeleteGroupSelection = () => {
    if (!projectId || featureGroupSel.length === 0 || deleteGroupMut.isPending) return;
    const count = featureGroupSel.length;
    setDeleteConfirm({
      title: 'Удалить объекты?',
      message: `Будет удалено ${count} ${objectCountLabel(count)} с карты и из базы данных.`,
      onConfirm: executeDeleteGroupSelection,
    });
  };

  const selectedOnMapCount =
    featureGroupSel.length > 0 ? featureGroupSel.length : featureSel ? 1 : 0;

  const canDeleteCurrentSelection = useMemo(() => {
    if (!projectId) return false;
    const sels =
      featureGroupSel.length > 0 ? featureGroupSel : featureSel ? [featureSel] : [];
    if (sels.length === 0) return false;
    return sels.every((sel) => (sel.kind === 'poi' ? canWriteProject : canWriteInfra));
  }, [projectId, featureGroupSel, featureSel, canWriteProject, canWriteInfra]);

  const autoroadConnectObjectIds = useMemo(() => {
    return groupSelectionDetails
      .filter(
        (item) =>
          item.kind === 'infra' &&
          item.subtype != null &&
          !isLineSubtype(item.subtype) &&
          isAutoroadNetworkTerminal(item.kind, item.subtype),
      )
      .map((item) => item.id);
  }, [groupSelectionDetails]);

  const autoroadNetworkDetails = useMemo((): MapGroupSelectionItem[] => {
    const byId = new Map(infraObjects.map((o) => [o.id, o]));
    const out: MapGroupSelectionItem[] = [];
    for (const id of autoroadNetworkTerminalIds) {
      const o = byId.get(id);
      if (!o) continue;
      out.push({
        id: o.id,
        name: o.name,
        kind: 'infra',
        subtype: o.subtype,
        subtitle: o.subtype,
      });
    }
    return out;
  }, [autoroadNetworkTerminalIds, infraObjects]);

  const canAutoroadConnect =
    canWriteInfra &&
    !projectJobBusy &&
    autoroadConnectObjectIds.length >= 2 &&
    autoroadConnectObjectIds.length === groupSelectionDetails.length;

  const autoroadConnectMut = useMutation({
    mutationFn: async (objectIds: string[]) => {
      const flowId = taskLog.startHttpFlow(
        projectId!,
        'autoroad_connect',
        'Соединение автодорогами',
      );
      try {
        const preview = (await api.autoroadConnect(projectId!, {
          object_ids: objectIds,
          dry_run: true,
        })) as AutoroadConnectResult;
        if (!(await requestAutoroadConfirm(preview, 'connect'))) {
          taskLog.endHttpFlow(flowId, 'cancelled');
          return null;
        }
        const applyRes = await api.autoroadConnect(projectId!, {
          object_ids: objectIds,
          dry_run: false,
        });
        if (isProjectJobCreateResponse(applyRes)) {
          const job = await pollProjectJobUntilDone(projectId!, applyRes.job_id, {
            timeoutMs: 600_000,
          });
          taskLog.endHttpFlow(flowId, 'completed');
          return job.result as unknown as AutoroadConnectResult;
        }
        taskLog.endHttpFlow(flowId, 'completed');
        return applyRes;
      } catch (e) {
        taskLog.endHttpFlow(flowId, 'failed');
        throw e;
      }
    },
    onSuccess: (result) => {
      if (!result) return;
      void queryClient.invalidateQueries({ queryKey: ['activeJob', projectId] });
      const createdIds = [...(result.created_line_ids ?? []), ...(result.created_node_ids ?? [])];
      if (createdIds.length > 0) {
        pushUndo({
          kind: 'create_clipboard_group',
          poiIds: [],
          infraIds: createdIds,
          label: 'соединение автодорогами',
        });
      }
      const parts: string[] = [];
      if (result.created_lines > 0) parts.push(`${result.created_lines} линий`);
      if (result.created_nodes > 0) parts.push(`${result.created_nodes} узлов`);
      pushToast(
        'success',
        parts.length > 0
          ? `Соединение выполнено: ${parts.join(', ')}`
          : 'Объекты уже связаны по существующей сети',
      );
      invalidateMap();
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось соединить автодорогами');
    },
  });

  const handleAutoroadConnect = () => {
    if (!canAutoroadConnect || autoroadConnectMut.isPending) return;
    autoroadConnectMut.mutate(autoroadConnectObjectIds);
  };

  const runAutoroadNetworkFlow = useMutation({
    mutationFn: async (objectIds: string[]) => {
      const flowId = taskLog.startHttpFlow(
        projectId!,
        'autoroad_network',
        'Построение сети автодорог',
      );
      try {
        const planRequest = await api.autoroadNetworkBuildRequest(projectId!, {
          object_ids: objectIds,
          full_network_rebuild: true,
        });
        const plan = await api.autoroadNetworkCompute(projectId!, planRequest);
        setAutoroadPlanPreviewLines(linesFromNetworkPlanResponse(plan));
        const previewForModal = networkPlanToConnectPreview(plan);
        if (!(await requestAutoroadConfirm(previewForModal, 'network'))) {
          setAutoroadPlanPreviewLines([]);
          taskLog.endHttpFlow(flowId, 'cancelled');
          return null;
        }
        const applyRes = await api.autoroadNetworkApply(projectId!, {
          object_ids: objectIds,
          plan,
          full_network_rebuild: true,
        });
        if (isProjectJobCreateResponse(applyRes)) {
          const job = await pollProjectJobUntilDone(projectId!, applyRes.job_id, {
            timeoutMs: 600_000,
          });
          taskLog.endHttpFlow(flowId, 'completed');
          return job.result as unknown as AutoroadNetworkApplyResult;
        }
        taskLog.endHttpFlow(flowId, 'completed');
        return applyRes;
      } catch (e) {
        taskLog.endHttpFlow(flowId, 'failed');
        throw e;
      }
    },
    onSuccess: (result) => {
      setAutoroadPlanPreviewLines([]);
      if (!result) return;
      void queryClient.invalidateQueries({ queryKey: ['activeJob', projectId] });
      const createdIds = [...(result.created_line_ids ?? []), ...(result.created_node_ids ?? [])];
      if (createdIds.length > 0) {
        pushUndo({
          kind: 'create_clipboard_group',
          poiIds: [],
          infraIds: createdIds,
          label: 'построение сети автодорог',
        });
      }
      pushToast(
        'success',
        result.created_lines || result.created_nodes
          ? `Сеть построена: ${result.created_lines ?? 0} линий, ${result.created_nodes ?? 0} узлов`
          : 'Объекты уже связаны по существующей сети',
      );
      setAutoroadNetworkTerminalIds([]);
      setDrawMode('select');
      invalidateMap();
    },
    onError: (err) => {
      setAutoroadPlanPreviewLines([]);
      pushToast('error', err instanceof Error ? err.message : 'Не удалось построить сеть');
    },
  });

  const canAutoroadNetworkPreview =
    canWriteInfra && !projectJobBusy && autoroadNetworkTerminalIds.length >= 2;

  const executeDeleteSingleSelection = () => {
    if (!projectId || !featureSel) return;
    if (featureSel.kind === 'poi') {
      const poi = pois.find((p) => p.id === featureSel.id);
      if (!poi) return;
      api
        .deletePoi(projectId, poi.id)
        .then(() => {
          pushUndo({
            kind: 'restore_poi',
            snapshot: poi,
            label: `удаление «${poi.name}»`,
          });
          setFeatureSel(null);
          invalidateMap();
        })
        .catch((err) => {
          pushToast('error', err instanceof Error ? err.message : 'Не удалось удалить объект');
        });
      return;
    }
    deleteInfraMut.mutate(featureSel.id);
  };

  const requestDeleteSelection = () => {
    if (!canDeleteCurrentSelection || selectedOnMapCount === 0) return;
    if (featureGroupSel.length > 0) {
      requestDeleteGroupSelection();
      return;
    }
    if (!featureSel) return;
    const name =
      featureSel.kind === 'poi'
        ? pois.find((p) => p.id === featureSel.id)?.name
        : infraObjects.find((o) => o.id === featureSel.id)?.name;
    setDeleteConfirm({
      title: 'Удалить объект?',
      message: `«${name || 'объект'}» будет удалён с карты и из базы данных.`,
      onConfirm: executeDeleteSingleSelection,
    });
  };

  const handleMapEscape = useCallback(() => {
    if (pasteMode) {
      setPasteMode(false);
      return;
    }
    if (deleteConfirm) {
      setDeleteConfirm(null);
      return;
    }
    if (modal) {
      setModal(null);
      return;
    }
    if (candidateSubtype) {
      setCandidateSubtype(null);
      setCandidateParamType('external');
      return;
    }
    if (searchOpen) {
      setSearchOpen(false);
      return;
    }
    const drawingActive =
      drawMode !== 'select' || pointMenuOpen || lineMenuOpen || selectMenuOpen;
    if (drawingActive) {
      cancelDrawingSelection();
    }
  }, [
    deleteConfirm,
    modal,
    candidateSubtype,
    searchOpen,
    drawMode,
    pointMenuOpen,
    lineMenuOpen,
    selectMenuOpen,
    cancelDrawingSelection,
    pasteMode,
  ]);

  const saveDetailMut = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (!detailSelection) return;
      if (detailSelection.kind === 'poi') {
        return api.updatePoi(projectId!, detailSelection.poi.id, data as Partial<POI> & {
          lon?: number;
          lat?: number;
        });
      }
      return api.updateInfraObject(projectId!, detailSelection.object.id, {
        name: data.name as string,
        description: data.description as string,
        subtype: data.subtype as string,
        layer_id: data.layer_id as string,
        lon: data.lon as number,
        lat: data.lat as number,
        ...(Array.isArray(data.coordinates)
          ? {
              coordinates: data.coordinates as number[][],
              end_lon: data.end_lon as number,
              end_lat: data.end_lat as number,
            }
          : {}),
        ...(data.properties ? { properties: data.properties as Record<string, unknown> } : {}),
      });
    },
    onMutate: () => {
      if (!detailSelection) return;
      if (detailSelection.kind === 'poi') {
        return {
          undo: {
            kind: 'patch_poi_detail' as const,
            poiId: detailSelection.poi.id,
            before: poiDetailUndo(detailSelection.poi),
            label: `изменение «${detailSelection.poi.name}»`,
          },
        };
      }
      return {
        undo: {
          kind: 'patch_infra_detail' as const,
          objectId: detailSelection.object.id,
          before: infraDetailUndo(detailSelection.object),
          label: `изменение «${detailSelection.object.name}»`,
        },
      };
    },
    onSuccess: (updated, _vars, ctx) => {
      if (ctx?.undo) pushUndo(ctx.undo);
      if (!projectId || !updated || !detailSelection) return;
      if (detailSelection.kind === 'poi') {
        queryClient.setQueryData<POI[]>(['pois', projectId], (old) =>
          old?.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)) ?? []
        );
        void queryClient.invalidateQueries({ queryKey: ['analysis', projectId] });
        void queryClient.invalidateQueries({
          queryKey: ['flow-schematic', projectId, updated.id],
        });
      } else {
        upsertInfraObjectInQueries(queryClient, projectId, updated as InfraObject);
      }
      const label =
        detailSelection.kind === 'poi'
          ? detailSelection.poi.name
          : detailSelection.object.name;
      pushToast('success', label ? `Сохранено: «${label}»` : 'Изменения сохранены');
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось сохранить');
    },
  });

  const overrideMut = useMutation({
    mutationFn: (
      payload:
        | Candidate
        | { subtype: string; force_construction: boolean; param_type: 'external' | 'external_linear' }
    ) => {
      if ('force_construction' in payload) {
        return api.overrideAnalysis(projectId!, selectedPoi!.id, payload.subtype, {
          force_construction: payload.force_construction,
          param_type: payload.param_type,
        });
      }
      return api.overrideAnalysis(projectId!, selectedPoi!.id, candidateSubtype!, {
        nearest_object_id: payload.object_id ?? undefined,
        nearest_node_id: payload.nearest_node_id ?? undefined,
        param_type: candidateParamType,
      });
    },
    onSuccess: (data) => {
      setCandidateSubtype(null);
      setCandidateParamType('external');
      if (projectId && selectedPoi && data && typeof data === 'object' && 'rows' in data) {
        queryClient.setQueryData(
          ['analysis', projectId, selectedPoi.id],
          normalizePoiAnalysisResponse(data as AnalysisResult | PoiAnalysisResponse)
        );
      }
      pushToast('success', 'Анализ обновлён');
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось обновить анализ');
    },
  });

  const geometrySaveSeqRef = useRef(0);

  const handleGeometryChange = useCallback(
    async (sel: MapFeatureSelection, lon: number, lat: number, coords?: number[][]) => {
      if (!projectId) return;
      const saveSeq = ++geometrySaveSeqRef.current;
      const rLon = lon;
      const rLat = lat;

      const poiBefore =
        sel.kind === 'poi'
          ? queryClient.getQueryData<POI[]>(['pois', projectId])?.find((p) => p.id === sel.id) ??
            pois.find((p) => p.id === sel.id)
          : null;
      const infraBefore =
        sel.kind === 'infra'
          ? queryClient.getQueryData<InfraObject[]>(['infra', projectId])?.find((o) => o.id === sel.id) ??
            infraObjects.find((o) => o.id === sel.id)
          : null;

      let lineRollbackPatches: {
        id: string;
        before: {
          lon: number;
          lat: number;
          end_lon?: number | null;
          end_lat?: number | null;
          coordinates?: number[][] | null;
        };
      }[] = [];

      setGeometrySavePending((p) => p + 1);
      try {
        if (sel.kind === 'poi') {
          queryClient.setQueriesData<POI[]>({ queryKey: ['pois', projectId] }, (old) =>
            old?.map((p) => (p.id === sel.id ? { ...p, lon: rLon, lat: rLat } : p)) ?? []
          );
          await api.updatePoi(projectId, sel.id, { lon: rLon, lat: rLat });
          if (saveSeq !== geometrySaveSeqRef.current) return;
          if (poiBefore) {
            pushUndo({
              kind: 'patch_poi_geometry',
              poiId: sel.id,
              before: poiGeometryUndo(poiBefore),
              label: `перемещение «${poiBefore.name}»`,
            });
          }
        } else if (coords && coords.length >= 2) {
          let roundedCoords = coords.map(([lo, la]) => [lo, la] as [number, number]);
          const currentInfra =
            queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
          const pointPool = currentInfra.filter((o) => o.id !== sel.id);
          if (infraBefore && isLineSubtype(infraBefore.subtype)) {
            const endpoints = lineEndpointAttachmentsFromObject(infraBefore, pointPool);
            if (endpoints) {
              const constrained = constrainLineCoordinatesOnEdit({
                lineSubtype: infraBefore.subtype,
                originalStart: endpoints.start,
                originalFinish: endpoints.finish,
                originalStartAttach: endpoints.startAttach,
                originalFinishAttach: endpoints.finishAttach,
                draftCoords: roundedCoords,
                infraObjects: pointPool,
              });
              roundedCoords = constrained.coords.map(([lo, la]) => [lo, la] as [number, number]);
              roundedCoords = normalizeLinePathEndpoints(
                infraBefore.subtype,
                roundedCoords,
                pointPool,
              );
            }
          }
          const payload = {
            lon: roundedCoords[0][0],
            lat: roundedCoords[0][1],
            end_lon: roundedCoords[roundedCoords.length - 1][0],
            end_lat: roundedCoords[roundedCoords.length - 1][1],
            coordinates: roundedCoords,
          };
          patchInfraObjectsInQueries(queryClient, projectId, (o) =>
            o.id === sel.id ? { ...o, ...payload } : o,
          );
          setInfraOverlayIds((prev) => new Set(prev).add(sel.id));
          await api.updateInfraObject(projectId, sel.id, payload);
          if (saveSeq !== geometrySaveSeqRef.current) return;
          if (infraBefore) {
            pushUndo({
              kind: 'patch_infra_geometry',
              objectId: sel.id,
              before: infraGeometryUndo(infraBefore),
              label: `изменение геометрии «${infraBefore.name}»`,
            });
          }
        } else {
          // If a point object is moved, drag connected line endpoints with it.
          const isMovedPoint = !!infraBefore && !LINE_SUBTYPES.includes(infraBefore.subtype as typeof LINE_SUBTYPES[number]);
          const updatedLinePayloads: {
            id: string;
            payload: Partial<InfraObjectCreate>;
            before: { lon: number; lat: number; end_lon?: number | null; end_lat?: number | null; coordinates?: number[][] | null };
          }[] = [];
          if (isMovedPoint && infraBefore) {
            const oldLon = infraBefore.lon;
            const oldLat = infraBefore.lat;
            const currentInfra =
              queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
            const candidateLines = currentInfra.filter((o) => o.id !== sel.id && LINE_SUBTYPES.includes(o.subtype as typeof LINE_SUBTYPES[number]));

            for (const line of candidateLines) {
              const coords = lineCoordsOrEndpoints(line);
              if (!coords || coords.length < 2) continue;
              const first = coords[0]!;
              const last = coords[coords.length - 1]!;
              const firstMatches =
                linkCoordMatch(first[0], oldLon) && linkCoordMatch(first[1], oldLat);
              const lastMatches =
                linkCoordMatch(last[0], oldLon) && linkCoordMatch(last[1], oldLat);
              if (!firstMatches && !lastMatches) continue;

              const shifted = coords.map(([lo, la], i) => {
                if (i === 0 && firstMatches) return [rLon, rLat] as [number, number];
                if (i === coords.length - 1 && lastMatches) return [rLon, rLat] as [number, number];
                return [lo, la] as [number, number];
              });
              const payload = {
                lon: shifted[0][0],
                lat: shifted[0][1],
                end_lon: shifted[shifted.length - 1][0],
                end_lat: shifted[shifted.length - 1][1],
                coordinates: shifted,
              };
              updatedLinePayloads.push({
                id: line.id,
                payload,
                before: {
                  lon: line.lon,
                  lat: line.lat,
                  end_lon: line.end_lon,
                  end_lat: line.end_lat,
                  coordinates: line.coordinates,
                },
              });
            }
          }

          lineRollbackPatches = updatedLinePayloads.map((linePatch) => ({
            id: linePatch.id,
            before: linePatch.before,
          }));

          const touchedIds = new Set<string>([sel.id, ...updatedLinePayloads.map((p) => p.id)]);
          patchInfraObjectsInQueries(queryClient, projectId, (o) => {
            if (o.id === sel.id) return { ...o, lon: rLon, lat: rLat };
            const linePatch = updatedLinePayloads.find((p) => p.id === o.id);
            return linePatch ? { ...o, ...linePatch.payload } : o;
          });
          setInfraOverlayIds((prev) => {
            const next = new Set(prev);
            for (const id of touchedIds) next.add(id);
            return next;
          });
          await api.updateInfraObject(projectId, sel.id, { lon: rLon, lat: rLat });
          for (const linePatch of updatedLinePayloads) {
            await api.updateInfraObject(projectId, linePatch.id, linePatch.payload);
          }
          if (saveSeq !== geometrySaveSeqRef.current) return;
          if (infraBefore) {
            if (updatedLinePayloads.length > 0) {
              pushUndo({
                kind: 'patch_infra_batch',
                entries: [
                  { objectId: sel.id, before: infraGeometryUndo(infraBefore) },
                  ...updatedLinePayloads.map((linePatch) => ({
                    objectId: linePatch.id,
                    before: linePatch.before,
                  })),
                ],
                label: `перемещение «${infraBefore.name}»`,
              });
            } else {
              pushUndo({
                kind: 'patch_infra_geometry',
                objectId: sel.id,
                before: infraGeometryUndo(infraBefore),
                label: `перемещение «${infraBefore.name}»`,
              });
            }
          }
        }
      } catch (e) {
        if (saveSeq !== geometrySaveSeqRef.current) return;
        pushToast('error', e instanceof Error ? e.message : 'Не удалось сохранить геометрию');
        if (poiBefore) {
          queryClient.setQueriesData<POI[]>({ queryKey: ['pois', projectId] }, (old) =>
            old?.map((p) => (p.id === sel.id ? poiBefore : p)) ?? []
          );
        }
        if (infraBefore) {
          queryClient.setQueriesData<InfraObject[]>({ queryKey: ['infra', projectId] }, (old) =>
            old?.map((o) => {
              if (o.id === sel.id) return infraBefore;
              const linePatch = lineRollbackPatches.find((p) => p.id === o.id);
              if (linePatch) return { ...o, ...linePatch.before };
              return o;
            }) ?? []
          );
        }
      } finally {
        if (saveSeq === geometrySaveSeqRef.current) {
          setGeometrySavePending((p) => Math.max(0, p - 1));
        }
      }
    },
    [projectId, queryClient, pois, infraObjects, pushUndo, pushToast]
  );

  const getActiveMapSelections = useCallback((): MapFeatureSelection[] => {
    if (selectMode === 'box' && featureGroupSel.length > 0) return featureGroupSel;
    if (featureSel) return [featureSel];
    return [];
  }, [selectMode, featureGroupSel, featureSel]);

  const filterSelectionsForCopy = useCallback(
    (selections: MapFeatureSelection[]) => {
      const allowed: MapFeatureSelection[] = [];
      let skipped = 0;
      for (const sel of selections) {
        if (sel.kind === 'poi' && canWriteProject) allowed.push(sel);
        else if (sel.kind === 'infra' && canWriteInfra) allowed.push(sel);
        else skipped += 1;
      }
      return { allowed, skipped };
    },
    [canWriteProject, canWriteInfra],
  );

  const copyMapSelection = useCallback((): boolean => {
    const { allowed, skipped } = filterSelectionsForCopy(getActiveMapSelections());
    if (allowed.length === 0) {
      pushToast('info', 'Нет объектов для копирования');
      return false;
    }
    const items = buildClipboardFromSelection(pois, infraObjects, allowed);
    setMapClipboard(items);
    if (skipped > 0) {
      pushToast('info', `Скопировано ${items.length}; без прав: ${skipped}`);
    } else {
      pushToast('success', `Скопировано объектов: ${items.length}`);
    }
    return true;
  }, [filterSelectionsForCopy, getActiveMapSelections, pois, infraObjects, pushToast]);

  const enterPasteMode = useCallback(() => {
    if (!mapClipboard?.length) {
      pushToast('info', 'Буфер пуст — сначала скопируйте объекты (Ctrl+C)');
      return;
    }
    if (geometrySavePending > 0) {
      pushToast('info', 'Дождитесь сохранения геометрии');
      return;
    }
    setPasteMode(true);
    setDrawMode('select');
    setSelectMenuOpen(false);
    pushToast('info', 'Кликните на карте — место вставки');
  }, [mapClipboard, geometrySavePending, pushToast]);

  const executePaste = useCallback(
    async (anchorLon: number, anchorLat: number) => {
      if (!projectId || !mapClipboard?.length) return;
      if (geometrySavePending > 0) {
        pushToast('info', 'Дождитесь сохранения геометрии');
        return;
      }
      setPasteMode(false);
      const offsetItems = applyOffsetToClipboard(mapClipboard, anchorLon, anchorLat);
      const { pois: poiItems, pointInfra, lineInfra } = partitionClipboardForPaste(offsetItems);
      const createdPoiIds: string[] = [];
      const createdInfraIds: string[] = [];
      const sourceIdToCreated = new Map<string, InfraObject>();

      setGeometrySavePending((p) => p + 1);
      try {
        let poiList = queryClient.getQueryData<POI[]>(['pois', projectId]) ?? pois;
        for (const item of poiItems) {
          if (!canWriteProject) continue;
          const payload = poiClipboardToCreatePayload(item.snapshot);
          payload.name = nextPoiAutoName(poiList);
          const created = await api.createPoi(projectId, payload);
          createdPoiIds.push(created.id);
          poiList = [...poiList, created];
          queryClient.setQueriesData<POI[]>({ queryKey: ['pois', projectId] }, (old) =>
            [...(old ?? []), created],
          );
        }

        for (const item of pointInfra) {
          if (!canWriteInfra || item.kind !== 'infra') continue;
          const name = nextAutoName(item.snapshot.subtype);
          const created = await createInfraFromPasteSnapshot(projectId, item.snapshot, name, {
            createInfraObject: api.createInfraObject,
            createFacilityInfraObject: api.createFacilityInfraObject,
            updateInfraObject: api.updateInfraObject,
            mergeProperties: mergeInfraPropertiesForSave,
          });
          createdInfraIds.push(created.id);
          sourceIdToCreated.set(item.sourceId, created);
          upsertInfraInCache(created);
        }

        for (const item of lineInfra) {
          if (!canWriteInfra || item.kind !== 'infra') continue;
          const { snap, line_snap_start_object_id, line_snap_finish_object_id } =
            remapLineEndpointsForPaste(
              item.snapshot,
              item.endpointAttach,
              sourceIdToCreated,
            );
          const name = nextAutoName(snap.subtype);
          const payload = infraClipboardToCreatePayload(snap, name, {
            line_snap_start_object_id,
            line_snap_finish_object_id,
            line_preserve_geometry: true,
          });
          const created = await api.createInfraObject(projectId, {
            ...payload,
            properties: mergeInfraPropertiesForSave(payload.subtype, payload.properties),
          });
          createdInfraIds.push(created.id);
          lineHealSkipIdsRef.current.add(created.id);
          upsertInfraInCache(created);
        }

        const total = createdPoiIds.length + createdInfraIds.length;
        if (total === 0) {
          pushToast('error', 'Не удалось вставить объекты — проверьте права или состав буфера');
          return;
        }
        if (total > 0) {
          pushUndo({
            kind: 'create_clipboard_group',
            poiIds: createdPoiIds,
            infraIds: createdInfraIds,
            label: `вставка ${total} объектов`,
          });
          if (lineInfra.length > 0) {
            try {
              await api.buildNetwork(projectId);
            } catch {
              /* best-effort */
            }
          }
          invalidateMap();
          pushToast('success', `Вставлено объектов: ${total}`);
          if (createdPoiIds[0]) {
            setFeatureSel({ kind: 'poi', id: createdPoiIds[0] });
            setSelectMode('single');
            setFeatureGroupSel([]);
          } else if (createdInfraIds[0]) {
            setFeatureSel({ kind: 'infra', id: createdInfraIds[0] });
            setSelectMode('single');
            setFeatureGroupSel([]);
          }
        }
      } catch (e) {
        pushToast('error', e instanceof Error ? e.message : 'Не удалось вставить объекты');
      } finally {
        setGeometrySavePending((p) => Math.max(0, p - 1));
      }
    },
    [
      projectId,
      mapClipboard,
      geometrySavePending,
      queryClient,
      pois,
      canWriteProject,
      canWriteInfra,
      nextPoiAutoName,
      nextAutoName,
      upsertInfraInCache,
      pushUndo,
      invalidateMap,
      pushToast,
    ],
  );

  const cutMapSelection = useCallback(() => {
    if (!copyMapSelection()) return;
    requestDeleteSelection();
  }, [copyMapSelection, requestDeleteSelection]);

  const handleBatchGeometryChange = useCallback(
    async (
      items: { sel: MapFeatureSelection; lon: number; lat: number; coords?: number[][] }[],
    ) => {
      if (!projectId || items.length === 0) return;

      const currentInfra =
        queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      const currentPois = queryClient.getQueryData<POI[]>(['pois', projectId]) ?? pois;

      const poiEntries: { poiId: string; before: ReturnType<typeof poiGeometryUndo> }[] = [];
      const infraEntries: { objectId: string; before: ReturnType<typeof infraGeometryUndo> }[] = [];

      const poiSaves: { id: string; lon: number; lat: number }[] = [];
      const pointSaves: { id: string; lon: number; lat: number; before: InfraObject }[] = [];
      const lineSaves: { id: string; payload: Partial<InfraObjectCreate>; before: InfraObject }[] =
        [];
      const pendingLineMoves: {
        id: string;
        coords: number[][];
        infraBefore: InfraObject;
      }[] = [];

      const movedLineIds = new Set<string>();
      const movedPointUpdates: MovedPointUpdate[] = [];
      const movedPositionEntries: { id: string; lon: number; lat: number }[] = [];

      for (const item of items) {
        const { sel, lon: rLon, lat: rLat, coords } = item;
        if (sel.kind === 'poi') {
          const poiBefore = currentPois.find((p) => p.id === sel.id);
          if (!poiBefore) continue;
          poiEntries.push({ poiId: sel.id, before: poiGeometryUndo(poiBefore) });
          poiSaves.push({ id: sel.id, lon: rLon, lat: rLat });
          movedPositionEntries.push({ id: sel.id, lon: rLon, lat: rLat });
          continue;
        }

        const infraBefore = currentInfra.find((o) => o.id === sel.id);
        if (!infraBefore) continue;

        if (coords && coords.length >= 2) {
          movedLineIds.add(sel.id);
          movedPositionEntries.push({ id: sel.id, lon: rLon, lat: rLat });
          pendingLineMoves.push({ id: sel.id, coords, infraBefore });
          continue;
        }

        if (LINE_SUBTYPES.includes(infraBefore.subtype as (typeof LINE_SUBTYPES)[number])) continue;

        infraEntries.push({ objectId: sel.id, before: infraGeometryUndo(infraBefore) });
        pointSaves.push({ id: sel.id, lon: rLon, lat: rLat, before: infraBefore });
        movedPointUpdates.push({
          id: sel.id,
          oldLon: infraBefore.lon,
          oldLat: infraBefore.lat,
          newLon: rLon,
          newLat: rLat,
        });
        movedPositionEntries.push({ id: sel.id, lon: rLon, lat: rLat });
      }

      const movedPositions = buildMovedPositionsMap(movedPositionEntries);
      for (const { id, coords, infraBefore } of pendingLineMoves) {
        const roundedCoords = constrainGroupMovedLine(
          infraBefore,
          coords,
          movedPositions,
          currentInfra,
        );
        const payload = {
          lon: roundedCoords[0]![0],
          lat: roundedCoords[0]![1],
          end_lon: roundedCoords[roundedCoords.length - 1]![0],
          end_lat: roundedCoords[roundedCoords.length - 1]![1],
          coordinates: roundedCoords,
        };
        infraEntries.push({ objectId: id, before: infraGeometryUndo(infraBefore) });
        lineSaves.push({ id, payload, before: infraBefore });
      }

      const linkedLinePatches = lineEndpointPatchesToResults(
        accumulateLineEndpointPatches(currentInfra, movedPointUpdates, movedLineIds),
      );
      for (const patch of linkedLinePatches) {
        infraEntries.push({ objectId: patch.lineId, before: patch.before });
        lineSaves.push({
          id: patch.lineId,
          payload: patch.payload,
          before: currentInfra.find((o) => o.id === patch.lineId) ?? ({
            ...patch.before,
            id: patch.lineId,
          } as InfraObject),
        });
      }

      setGeometrySavePending((p) => p + 1);
      try {
        if (poiSaves.length > 0) {
          queryClient.setQueriesData<POI[]>({ queryKey: ['pois', projectId] }, (old) =>
            old?.map((p) => {
              const save = poiSaves.find((s) => s.id === p.id);
              return save ? { ...p, lon: save.lon, lat: save.lat } : p;
            }) ?? [],
          );
          for (const save of poiSaves) {
            await api.updatePoi(projectId, save.id, { lon: save.lon, lat: save.lat });
          }
        }

        if (pointSaves.length > 0 || lineSaves.length > 0) {
          const touchedIds = new Set([
            ...pointSaves.map((s) => s.id),
            ...lineSaves.map((s) => s.id),
          ]);
          patchInfraObjectsInQueries(queryClient, projectId, (o) => {
            const pointSave = pointSaves.find((s) => s.id === o.id);
            if (pointSave) return { ...o, lon: pointSave.lon, lat: pointSave.lat };
            const lineSave = lineSaves.find((s) => s.id === o.id);
            return lineSave ? { ...o, ...lineSave.payload } : o;
          });
          setInfraOverlayIds((prev) => {
            const next = new Set(prev);
            for (const id of touchedIds) next.add(id);
            return next;
          });
          for (const save of pointSaves) {
            await api.updateInfraObject(projectId, save.id, { lon: save.lon, lat: save.lat });
          }
          for (const save of lineSaves) {
            await api.updateInfraObject(projectId, save.id, save.payload);
          }
        }

        const total = poiEntries.length + infraEntries.length;
        if (total > 0) {
          pushUndo({
            kind: 'patch_geometry_group',
            poiEntries,
            infraEntries,
            label: `перемещение ${items.length} объектов`,
          });
        }
      } catch (e) {
        pushToast('error', e instanceof Error ? e.message : 'Не удалось сохранить геометрию');
        invalidateMap();
      } finally {
        setGeometrySavePending((p) => Math.max(0, p - 1));
      }
    },
    [projectId, queryClient, pois, infraObjects, pushUndo, pushToast, invalidateMap],
  );

  const clipboardPreviewPoints = useMemo(() => {
    if (!pasteMode || !mapClipboard?.length || !cursor) return [];
    return clipboardPreviewAt(mapClipboard, cursor.lon, cursor.lat);
  }, [pasteMode, mapClipboard, cursor]);

  const handlePointerMove = useCallback(
    (lon: number, lat: number, overPoint?: { lon: number; lat: number }) => {
      setMapPointerInside(true);
      cursorRef.current = { lon, lat };
      if (needsCursorState) {
        setCursor((prev) =>
          prev && prev.lon === lon && prev.lat === lat ? prev : { lon, lat },
        );
      }
      if (drawMode === 'ruler' && rulerPoints.length >= 1) {
        setRulerPreview([lon, lat]);
      } else if (rulerPreview) {
        setRulerPreview(null);
      }
      if (drawMode === 'line' && lineDraft.length >= 1) {
        setLineDraftPreview(
          snapLineDrawPoint(
            infraForm.subtype,
            [lon, lat],
            infraObjects,
            overPoint,
            'finish',
          ),
        );
      } else if (lineDraftPreview) {
        setLineDraftPreview(null);
      }
    },
    [
      needsCursorState,
      drawMode,
      rulerPoints.length,
      rulerPreview,
      lineDraft.length,
      lineDraftPreview,
      infraForm.subtype,
      infraObjects,
      infraSnapIndex,
    ],
  );

  const handlePointerLeave = useCallback(() => {
    setMapPointerInside(false);
    setLineDraftPreview(null);
    setRulerPreview(null);
  }, []);

  const finishRulerMeasurement = useCallback(
    (appendPreview = false) => {
      if (rulerClickTimerRef.current) {
        clearTimeout(rulerClickTimerRef.current);
        rulerClickTimerRef.current = null;
      }
      let coords = rulerPoints;
      if (appendPreview && rulerPreview && coords.length >= 1) {
        coords = [...coords, rulerPreview];
      }
      if (coords.length < 2) return;
      setRulerCompleted((prev) => [...prev, coords]);
      setRulerPoints([]);
      setRulerPreview(null);
    },
    [rulerPoints, rulerPreview],
  );

  const handleRulerClick = useCallback((lon: number, lat: number) => {
    const pt: [number, number] = [lon, lat];
    if (rulerClickTimerRef.current) clearTimeout(rulerClickTimerRef.current);
    rulerClickTimerRef.current = setTimeout(() => {
      rulerClickTimerRef.current = null;
      setRulerPoints((prev) => [...prev, pt]);
      setRulerPreview(null);
    }, 220);
  }, []);

  const measureCursorLabel = useMemo(() => {
    if (drawMode !== 'ruler' || !rulerPreview || rulerPoints.length < 1) return null;
    const coords = [...rulerPoints, rulerPreview];
    if (coords.length < 2) return null;
    return {
      lon: rulerPreview[0],
      lat: rulerPreview[1],
      text: formatLengthMeters(lineLengthMeters(coords)),
    };
  }, [drawMode, rulerPoints, rulerPreview]);

  const measureAnchorLabels = useMemo(() => {
    const labels = rulerCompleted
      .filter((coords) => coords.length >= 2)
      .map((coords) => {
        const last = coords[coords.length - 1]!;
        return {
          lon: last[0],
          lat: last[1],
          text: formatLengthMeters(lineLengthMeters(coords)),
        };
      });
    if (drawMode === 'ruler' && rulerPoints.length >= 2) {
      const last = rulerPoints[rulerPoints.length - 1]!;
      labels.push({
        lon: last[0],
        lat: last[1],
        text: formatLengthMeters(lineLengthMeters(rulerPoints)),
      });
    }
    return labels;
  }, [drawMode, rulerCompleted, rulerPoints]);

  const handleMapClick = useCallback(
    (lon: number, lat: number, hit?: MapClickHit) => {
      if (pasteMode) {
        void executePaste(lon, lat);
        return;
      }
      if (drawMode === 'autoroad_network') {
        if (!canWriteInfra) return;
        const over = hit?.overPoint;
        if (!over?.id) {
          pushToast('info', 'Кликните по точечному объекту инфраструктуры');
          return;
        }
        const obj = infraObjects.find((o) => o.id === over.id);
        if (!obj) return;
        if (!isAutoroadNetworkTerminal('infra', obj.subtype)) {
          pushToast('info', 'Узлы (Узел / метанол / ЛЭП) не выбираются — только перекрёстки');
          return;
        }
        setAutoroadNetworkTerminalIds((ids) =>
          ids.includes(obj.id) ? ids.filter((x) => x !== obj.id) : [...ids, obj.id],
        );
        return;
      }
      if (drawMode === 'ruler') {
        handleRulerClick(lon, lat);
        return;
      }
      if (drawMode === 'poi') {
        if (!canWriteProject) return;
        setPoiForm(
          emptyPoiFormValues({
            name: nextPoiAutoName(pois),
            lon: formatCoord(lon),
            lat: formatCoord(lat),
          })
        );
        setModal({ type: 'poi', lon, lat });
        return;
      }
      if (drawMode === 'point') {
        if (!canWriteInfra) return;
        if (!projectId) return;
        const subtype = infraForm.subtype;
        void placeInfraPointAt(
          subtype,
          lon,
          lat,
          hit?.overLine
            ? {
                lineId: hit.overLine.lineId,
                segmentIndex: hit.overLine.segmentIndex,
                snapLon: hit.overLine.lon,
                snapLat: hit.overLine.lat,
              }
            : undefined,
        );
        return;
      }
      if (drawMode === 'line') {
        if (!canWriteInfra) return;
        const overPoint = hit?.overPoint;
        const endpointKind = lineDraft.length === 0 ? 'start' : 'finish';
        const snapped = snapLineDrawPoint(
          infraForm.subtype,
          [lon, lat],
          infraObjects,
          overPoint,
          endpointKind,
        );
        if (lineDraft.length === 0) {
          if (!overPoint?.id) {
            pushToast('error', 'Начало линии — клик по точечному объекту на карте');
            return;
          }
          if (!isLineEndpointSnapped(infraForm.subtype, 'start', snapped, infraObjects)) {
            pushToast('error', 'Начало линии — клик по точечному объекту на карте');
            return;
          }
          setLineDraft([snapped]);
        } else {
          // Промежуточные вершины — свободно (без snap к ближайшему объекту).
          setLineDraft((prev) => [...prev, [lon, lat]]);
        }
        setLineDraftPreview(null);
      }
    },
    [
      pasteMode,
      executePaste,
      canWriteProject,
      canWriteInfra,
      drawMode,
      infraObjects,
      pushToast,
      handleRulerClick,
      infraForm.subtype,
      infraObjects,
      lineDraft.length,
      infraSnapIndex,
      nextAutoName,
      nextPoiAutoName,
      placeInfraPointAt,
      pois,
      projectId,
      pushToast,
    ]
  );

  const finishLineDraft = useCallback(
    async (
      coords: number[][],
      finishAt?: { lon: number; lat: number; id?: string },
      splitHint?: LineSplitHint,
    ) => {
      if (!projectId) return;
      if (coords.length < 2) {
        pushToast('info', 'Добавьте минимум 2 точки линии (ЛКМ по карте)');
        return;
      }
      const subtype = infraForm.subtype;
      const draft = coords.map((c) => [c[0], c[1]] as [number, number]);
      if (finishAt) {
        draft[draft.length - 1] = snapLineDrawPoint(
          subtype,
          [finishAt.lon, finishAt.lat],
          infraObjects,
          finishAt.id
            ? { lon: finishAt.lon, lat: finishAt.lat, id: finishAt.id }
            : null,
          'finish',
        );
      }

      const infraPool =
        queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      let pool = infraPool;
      let lineSnapStartId: string | undefined;
      let lineSnapFinishId: string | undefined;

      const applyEndpoint = async (
        index: number,
        kind: 'start' | 'finish',
      ): Promise<boolean> => {
        const resolved = resolveLineEndpoint(subtype, kind, draft[index]!, pool);
        if (!resolved.ok) {
          pushToast('error', resolved.message);
          return false;
        }
        if (resolved.createNode) {
          const splitFound =
            kind === 'finish'
              ? resolveLineSplitCandidate(
                  resolved.lon,
                  resolved.lat,
                  pool,
                  splitHint,
                )
              : null;
          const rLon = splitFound?.snapLon ?? resolved.lon;
          const rLat = splitFound?.snapLat ?? resolved.lat;
          try {
            const node = await api.createInfraObject(projectId, {
              name: nextAutoName('node'),
              subtype: 'node',
              lon: rLon,
              lat: rLat,
            });
            pool = [...pool, node];
            upsertInfraInCache(node);
            draft[index] = [node.lon, node.lat];
            if (kind === 'finish') lineSnapFinishId = node.id;

            if (splitFound) {
              try {
                const splitResult = await applyInfraLineSplit({
                  projectId,
                  split: splitFound,
                  splitLon: rLon,
                  splitLat: rLat,
                });
                if (splitResult) {
                  const { updated, second } = splitResult;
                  upsertInfraInCache(updated);
                  upsertInfraInCache(second);
                  pushUndo({
                    kind: 'split_line_create_point',
                    pointId: node.id,
                    secondLineId: second.id,
                    lineId: splitFound.line.id,
                    lineBefore: infraGeometryUndo(splitFound.line),
                    label: `узел «${node.name}» на «${splitFound.line.name}»`,
                  });
                  pushToast(
                    'success',
                    `Узел «${node.name}» создан; линия «${splitFound.line.name}» разделена на две`,
                  );
                }
              } catch (splitErr) {
                try {
                  await api.deleteInfraObject(projectId, node.id);
                } catch {
                  /* ignore rollback failure */
                }
                pushToast(
                  'error',
                  splitErr instanceof Error
                    ? splitErr.message
                    : 'Не удалось разделить линию в точке узла',
                );
                return false;
              }
            }
          } catch (err) {
            pushToast(
              'error',
              err instanceof Error ? err.message : 'Не удалось создать узел подключения',
            );
            return false;
          }
        } else {
          draft[index] = [resolved.lon, resolved.lat];
          if (resolved.attachedTo) {
            if (kind === 'start') lineSnapStartId = resolved.attachedTo.id;
            else lineSnapFinishId = resolved.attachedTo.id;
          }
        }
        return true;
      };

      if (!(await applyEndpoint(0, 'start'))) return;
      if (!(await applyEndpoint(draft.length - 1, 'finish'))) return;

      const prepared = normalizeLinePathEndpoints(subtype, draft, pool);
      try {
        await createInfraMut.mutateAsync({
          name: nextAutoName(subtype),
          subtype,
          lon: prepared[0][0],
          lat: prepared[0][1],
          end_lon: prepared[prepared.length - 1][0],
          end_lat: prepared[prepared.length - 1][1],
          coordinates: prepared.map(([lo, la]) => [lo, la] as [number, number]),
          ...(lineSnapStartId ? { line_snap_start_object_id: lineSnapStartId } : {}),
          ...(lineSnapFinishId ? { line_snap_finish_object_id: lineSnapFinishId } : {}),
        });
        setFeatureSel(null);
        setLineDraft([]);
        setLineDraftPreview(null);
      } catch (err) {
        pushToast(
          'error',
          err instanceof Error ? err.message : 'Не удалось сохранить линейный объект',
        );
      }
    },
    [
      createInfraMut,
      infraForm.subtype,
      infraObjects,
      infraSnapIndex,
      nextAutoName,
      projectId,
      pushToast,
      pushUndo,
      queryClient,
      upsertInfraInCache,
    ],
  );

  const lineDraftFinishAt = useCallback(
    () => lineDraftFinishCoordinates(lineDraftPreview),
    [lineDraftPreview],
  );

  const hasMapSelection = getActiveMapSelections().length > 0;
  const canCopyMapSelection =
    mapEditEnabled && hasMapSelection && (canWriteProject || canWriteInfra);
  const canPasteMapClipboard = mapEditEnabled && (mapClipboard?.length ?? 0) > 0;
  const canCutMapSelection = canCopyMapSelection && canDeleteCurrentSelection;

  useMapHotkeys({
    drawMode,
    canDelete:
      canDeleteCurrentSelection &&
      selectedOnMapCount > 0 &&
      !deleteConfirm &&
      !modal &&
      !deleteGroupMut.isPending &&
      !deleteInfraMut.isPending,
    canToggleEdit: canEditMap,
    canCopy: canCopyMapSelection && !deleteConfirm && !modal,
    canPaste: canPasteMapClipboard && !deleteConfirm && !modal,
    canCut: canCutMapSelection && !deleteConfirm && !modal,
    onEscape: handleMapEscape,
    onDelete: requestDeleteSelection,
    onCopy: copyMapSelection,
    onPaste: enterPasteMode,
    onCut: cutMapSelection,
    onToggleEdit: () => setMapEditEnabled((on) => !on),
    onFinishLine:
      drawMode === 'line'
        ? () => void finishLineDraft(lineDraft, lineDraftFinishAt())
        : undefined,
  });

  const mapFooterHint = useMemo(() => {
    if (pasteMode) {
      return 'Кликните на карте — вставить · Esc — отмена';
    }
    if (drawMode === 'autoroad_network') {
      return 'Клик по точке — добавить/убрать терминал · панель справа — предпросмотр';
    }
    if (drawMode !== 'select') return null;
    if (mapEditEnabled) {
      if (
        detailSelection?.kind === 'infra' &&
        isLineSubtype(detailSelection.object.subtype)
      ) {
        return 'Перетащите вершину; двойной ЛКМ по средней — удалить; концы — на точечных объектах (точные координаты), иначе возврат · Del — удалить · Ctrl+Z — отмена';
      }
      if (detailSelection) {
        return 'Перетащите объект · Ctrl+C/V/X · Del · Ctrl+Z — отмена';
      }
      if (selectMode === 'box') {
        return featureGroupSel.length > 0
          ? 'Перетащите выделение · клик в пустое — снять выделение · Ctrl+C/V/X · Del · Ctrl+Z'
          : 'Рамка — выделить объекты · Ctrl+C/V/X';
      }
      return 'Выберите объект или включите инструмент рисования · E — редактирование';
    }
    return 'Включите редактирование (E) для перемещения объектов';
  }, [drawMode, mapEditEnabled, detailSelection, selectMode, pasteMode, featureGroupSel.length]);

  const drawActionsVisible = drawMode === 'line' || drawMode === 'ruler';
  const drawStepBackDisabled =
    drawMode === 'line'
      ? lineDraft.length === 0
      : drawMode === 'ruler'
        ? rulerPoints.length === 0
        : true;
  const drawFinishDisabled =
    drawMode === 'line'
      ? lineDraft.length < 2 || createInfraMut.isPending
      : drawMode === 'ruler'
        ? rulerPoints.length < 2
        : true;
  const drawResetDisabled =
    drawMode === 'line'
      ? lineDraft.length === 0
      : drawMode === 'ruler'
        ? rulerPoints.length === 0 && rulerCompleted.length === 0
        : true;

  const handleDrawStepBack = () => {
    if (drawMode === 'line') setLineDraft((d) => d.slice(0, -1));
    else if (drawMode === 'ruler') setRulerPoints((d) => d.slice(0, -1));
  };

  const handleDrawFinish = () => {
    if (drawMode === 'line') void finishLineDraft(lineDraft, lineDraftFinishAt());
    else if (drawMode === 'ruler') finishRulerMeasurement(false);
  };

  const handleDrawReset = () => {
    if (drawMode === 'line') {
      setLineDraft([]);
      setLineDraftPreview(null);
    } else if (drawMode === 'ruler') {
      setRulerPoints([]);
      setRulerPreview(null);
      setRulerCompleted([]);
    }
  };

  const submitPoi = () => {
    if (!projectId) {
      pushToast('error', 'Выберите проект в шапке приложения');
      return;
    }
    if (!modal || modal.type !== 'poi') return;
    const name = poiForm.name.trim() || nextPoiAutoName(pois);
    const lonDisplay = poiForm.lon || formatCoord(modal.lon);
    const latDisplay = poiForm.lat || formatCoord(modal.lat);
    const lon = coordForSave(parseCoord(lonDisplay), modal.lon, lonDisplay);
    const lat = coordForSave(parseCoord(latDisplay), modal.lat, latDisplay);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      pushToast('error', 'Укажите корректные координаты');
      return;
    }
    createPoiMut.mutate({
      ...formValuesToPoiCreatePayload({ ...poiForm, name }),
      lon,
      lat,
    } as Parameters<typeof api.createPoi>[1]);
  };

  return (
    <div className="map-page flex flex-1 flex-col min-h-0 overflow-hidden">
      <header className="page-header map-page-header shrink-0">
        <h1>Карта инфраструктуры</h1>
        {projectId && pois.length > 0 && canWriteProject && (
          <button
            type="button"
            className="btn btn-primary shrink-0"
            onClick={() => analyzeMut.mutate()}
            disabled={analyzeMut.isPending}
            title={
              pois.length > 1
                ? `Пересчитать анализ для всех ${pois.length} точек интереса`
                : 'Пересчитать анализ окружения'
            }
          >
            <Zap size={16} className="inline mr-1" />
            {analyzeMut.isPending
              ? 'Расчёт…'
              : pois.length > 1
                ? (
                  <>
                    <span className="map-analyze-label">Анализировать все точки ({pois.length})</span>
                    <span className="map-analyze-label-short">Анализ ({pois.length})</span>
                  </>
                )
                : (
                  <>
                    <span className="map-analyze-label">Анализировать окружение</span>
                    <span className="map-analyze-label-short">Анализ</span>
                  </>
                )}
          </button>
        )}
      </header>

      <DevPortBanner />

      {!projectId && (
        <div className="card mb-3 shrink-0 text-sm" style={{ color: 'var(--text-muted)' }}>
          Выберите проект в шапке приложения.
        </div>
      )}

      <div className="card map-page-card flex flex-1 flex-col min-h-0 overflow-hidden">
          <div className="map-tools">
            <div className="map-tools-group map-tools-group--view">
              {map3dFeatureEnabled && (
                <>
                  <MapDisplayModeToggle
                    mode={mapDisplayMode}
                    onChange={switchMapDisplayMode}
                  />
                  <div className="map-tools-sep map-display-mode-sep map-layers-toggle-sep" aria-hidden />
                </>
              )}
              <button
                type="button"
                className={`btn btn-sm map-tool-btn map-tool-btn--with-label btn-secondary map-layers-toggle${
                  mapLayersOpen ? ' btn-primary active' : ''
                }`}
                title="Слои и настройки карты"
                aria-label="Слои и настройки карты"
                onClick={() => setMapLayersOpen((open) => !open)}
              >
                <Layers size={14} className="shrink-0" aria-hidden />
                <span className="map-tool-label">Слои</span>
              </button>
              <div className="map-tools-sep map-layers-toggle-sep map-fullscreen-sep" aria-hidden />
              <button
                type="button"
                className="btn btn-sm map-tool-btn btn-secondary map-fullscreen-toggle"
                title={mapFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранная карта'}
                aria-label={mapFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранная карта'}
                onClick={() => void toggleMapFullscreen()}
              >
                {mapFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
            {projectId && pois.length > 0 && (
              <div className="map-tools-group map-tools-group--poi">
                <MapPoiSelect
                  pois={pois}
                  value={selectedPoiId ?? pois[0].id}
                  onChange={setSelectedPoiId}
                />
              </div>
            )}
            <div className="map-tools-group map-tools-group--edit">
            <button
              type="button"
              className={`btn btn-sm map-tool-btn ${mapEditEnabled ? 'btn-primary active' : 'btn-secondary'}`}
              title={
                !canEditMap
                  ? 'Редактирование недоступно в режиме просмотра'
                  : mapEditEnabled
                    ? 'Выключить редактирование на карте (E)'
                    : 'Редактирование на карте: перемещение объектов, создание точек и линий (E)'
              }
              aria-label={
                mapEditEnabled ? 'Выключить редактирование на карте' : 'Включить редактирование на карте'
              }
              disabled={!canEditMap || mapIn3d}
              onClick={() => setMapEditEnabled((on) => !on)}
            >
              <PenLine size={14} />
            </button>
            <button
              type="button"
              className="btn btn-sm map-tool-btn btn-secondary"
              title="Отменить последнее действие (Ctrl+Z)"
              aria-label="Отменить"
              disabled={!canEditMap || !canUndo}
              onClick={() => void performUndo()}
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              className="btn btn-sm map-tool-btn btn-secondary"
              title="Копировать (Ctrl+C)"
              aria-label="Копировать"
              disabled={!canCopyMapSelection}
              onClick={copyMapSelection}
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              className="btn btn-sm map-tool-btn btn-secondary"
              title="Вставить (Ctrl+V)"
              aria-label="Вставить"
              disabled={!canPasteMapClipboard}
              onClick={enterPasteMode}
            >
              <ClipboardPaste size={14} />
            </button>
            <button
              type="button"
              className="btn btn-sm map-tool-btn btn-secondary"
              title="Вырезать (Ctrl+X)"
              aria-label="Вырезать"
              disabled={!canCutMapSelection}
              onClick={cutMapSelection}
            >
              <Scissors size={14} />
            </button>
            <button
              type="button"
              className="btn btn-sm map-tool-btn btn-secondary"
              title={
                !canDeleteCurrentSelection
                  ? selectedOnMapCount === 0
                    ? 'Выберите объект на карте (клик или рамка)'
                    : 'Недостаточно прав для удаления выбранных объектов'
                  : `Удалить выбранные объекты (${selectedOnMapCount})`
              }
              disabled={
                !canDeleteCurrentSelection ||
                selectedOnMapCount === 0 ||
                deleteGroupMut.isPending ||
                deleteInfraMut.isPending
              }
              aria-label="Удалить выбранное"
              onClick={requestDeleteSelection}
            >
              <Trash2 size={14} />
            </button>
            </div>
            <div className="map-tools-group map-tools-group--draw">
            <div ref={selectMenuAnchorRef} className="inline-block">
              <button
                type="button"
                className={`btn btn-sm map-tool-btn map-tool-btn--with-label ${drawMode === 'select' || selectMenuOpen ? 'btn-primary active' : 'btn-secondary'}`}
                title="Режим выбора объектов"
                aria-label="Выбор"
                onClick={() => {
                  if (drawMode === 'select') {
                    setSelectMenuOpen((open) => !open);
                    return;
                  }
                  setLineDraft([]);
                  setPointMenuOpen(false);
                  setLineMenuOpen(false);
                  setDrawMode('select');
                  setSelectMenuOpen(true);
                }}
              >
                {selectMode === 'box' ? (
                  <BoxSelect size={14} className="shrink-0" aria-hidden />
                ) : (
                  <MousePointer2 size={14} className="shrink-0" aria-hidden />
                )}
                <span className="map-tool-label">Выбор</span>
              </button>
              <AnchoredMenu
                anchorRef={selectMenuAnchorRef}
                open={selectMenuOpen}
                onClose={() => setSelectMenuOpen(false)}
                width={224}
                className="app-anchored-menu--flat"
                ariaLabel="Режим выбора"
              >
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 hover:bg-[var(--bg)] flex items-center gap-2 ${
                    drawMode === 'select' && selectMode === 'single' ? 'font-medium' : ''
                  }`}
                  onClick={() => {
                    setSelectMode('single');
                    setDrawMode('select');
                    setSelectMenuOpen(false);
                    setLineDraft([]);
                    setPointMenuOpen(false);
                    setLineMenuOpen(false);
                  }}
                >
                  <MousePointer2 size={14} className="shrink-0 opacity-70" />
                  <span>Один объект</span>
                </button>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 hover:bg-[var(--bg)] flex items-center gap-2 ${
                    drawMode === 'select' && selectMode === 'box' ? 'font-medium' : ''
                  }`}
                  onClick={() => {
                    setSelectMode('box');
                    setDrawMode('select');
                    setSelectMenuOpen(false);
                    setLineDraft([]);
                    setPointMenuOpen(false);
                    setLineMenuOpen(false);
                  }}
                >
                  <BoxSelect size={14} className="shrink-0 opacity-70" />
                  <span>Группа объектов</span>
                </button>
              </AnchoredMenu>
            </div>
            <button
              type="button"
              className={`btn btn-sm map-tool-btn map-tool-btn--with-label ${drawMode === 'autoroad_network' ? 'btn-primary active' : 'btn-secondary'}`}
              disabled={!canWriteInfra || mapIn3d || projectJobBusy}
              title={
                mapIn3d
                  ? 'Только в режиме 2D'
                  : 'Построить сеть автодорог между выбранными точками'
              }
              aria-label="Построить сеть автодорог"
              onClick={() => {
                if (drawMode === 'autoroad_network') {
                  setDrawMode('select');
                  return;
                }
                setLineDraft([]);
                setPointMenuOpen(false);
                setLineMenuOpen(false);
                setSelectMenuOpen(false);
                setDrawMode('autoroad_network');
              }}
            >
              <Route size={14} className="shrink-0" aria-hidden />
              <span className="map-tool-label">Сеть</span>
            </button>
            <button
              type="button"
              className={`btn btn-sm map-tool-btn map-tool-btn--with-label ${drawMode === 'poi' ? 'btn-primary active' : 'btn-secondary'}`}
              disabled={!canWriteProject || mapIn3d}
              title={
                mapIn3d
                  ? 'Рисование доступно только в режиме 2D'
                  : !canWriteProject
                    ? 'Создание POI недоступно в режиме просмотра'
                    : 'Создать точку интереса'
              }
              aria-label="Точка интереса (POI)"
              onClick={() => {
                if (drawMode === 'poi') {
                  setDrawMode('select');
                  return;
                }
                setDrawMode('poi');
                setLineDraft([]);
                setSelectMenuOpen(false);
                setPointMenuOpen(false);
                setLineMenuOpen(false);
              }}
            >
              <MapPin size={14} className="shrink-0" aria-hidden />
              <span className="map-tool-label">POI</span>
            </button>
            <div ref={pointMenuAnchorRef} className="inline-block">
              <button
                type="button"
                className={`btn btn-sm map-tool-btn map-tool-btn--with-label ${drawMode === 'point' || pointMenuOpen ? 'btn-primary active' : 'btn-secondary'}`}
                disabled={!canWriteInfra || mapIn3d}
                title={
                  mapIn3d
                    ? 'Рисование доступно только в режиме 2D'
                    : !canWriteInfra
                      ? 'Создание объектов недоступно в режиме просмотра'
                      : 'Создать точечный объект'
                }
                aria-label="Точка"
                onClick={() => {
                  if (drawMode === 'point') {
                setDrawMode('select');
                setSelectMenuOpen(false);
                setPointMenuOpen(false);
                    return;
                  }
                  if (pointMenuOpen) {
                    setPointMenuOpen(false);
                    return;
                  }
                  setLineDraft([]);
                  setSelectMenuOpen(false);
                  setLineMenuOpen(false);
                  setPointMenuOpen(true);
                }}
              >
                <MapPin size={14} className="shrink-0" aria-hidden />
                <span className="map-tool-label">Точка</span>
              </button>
              <AnchoredMenu
                anchorRef={pointMenuAnchorRef}
                open={pointMenuOpen}
                onClose={() => setPointMenuOpen(false)}
                width={220}
                className="app-anchored-menu--flat"
                ariaLabel="Тип точечного объекта"
              >
                {MAP_DRAWABLE_POINT_SUBTYPES.map((st) => (
                  <PointSubtypeMenuItem
                    key={st}
                    st={st}
                    selected={infraForm.subtype === st}
                    onPick={(subtype) => {
                      setInfraForm((f) => ({ ...f, subtype }));
                      setPointMenuOpen(false);
                      setSelectMenuOpen(false);
                      setDrawMode('point');
                    }}
                  />
                ))}
                <p className="px-3 py-2 text-xs border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                  Клик по линии — объект вставляется на трассу и делит её на две части.
                </p>
              </AnchoredMenu>
            </div>
            <div ref={lineMenuAnchorRef} className="inline-block">
            <button
              type="button"
              className={`btn btn-sm map-tool-btn map-tool-btn--with-label ${drawMode === 'line' || lineMenuOpen ? 'btn-primary active' : 'btn-secondary'}`}
              disabled={!canWriteInfra || mapIn3d}
              title={
                mapIn3d
                  ? 'Рисование доступно только в режиме 2D'
                  : !canWriteInfra
                    ? 'Рисование линий недоступно в режиме просмотра'
                    : 'Создать линейный объект'
              }
              aria-label="Линия"
              onClick={() => {
                if (drawMode === 'line') {
                  setDrawMode('select');
                  setLineDraft([]);
                  setLineMenuOpen(false);
                  return;
                }
                if (lineMenuOpen) {
                  setLineMenuOpen(false);
                  return;
                }
                setLineDraft([]);
                setSelectMenuOpen(false);
                setPointMenuOpen(false);
                setLineMenuOpen(true);
              }}
            >
              <Pencil size={14} className="shrink-0" aria-hidden />
              <span className="map-tool-label">Линия</span>
            </button>
            <AnchoredMenu
              anchorRef={lineMenuAnchorRef}
              open={lineMenuOpen}
              onClose={() => setLineMenuOpen(false)}
              width={200}
              className="app-anchored-menu--flat"
              ariaLabel="Тип линейного объекта"
            >
              {LINE_SUBTYPES.map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`w-full text-left px-3 py-1.5 hover:bg-[var(--bg)] flex items-center gap-2 ${
                    infraForm.subtype === st ? 'font-medium' : ''
                  }`}
                  onClick={() => {
                    setInfraForm((f) => ({ ...f, subtype: st }));
                    setLineMenuOpen(false);
                    setSelectMenuOpen(false);
                    setDrawMode('line');
                  }}
                >
                  <img src={iconDataUrl(st)} alt="" className="w-4 h-4 shrink-0" draggable={false} />
                  <span className="truncate">{SUBTYPE_LABELS[st] || st}</span>
                </button>
              ))}
            </AnchoredMenu>
            </div>
            <button
              type="button"
              className={`btn btn-sm map-tool-btn map-tool-btn--with-label ${drawMode === 'ruler' ? 'btn-primary active' : 'btn-secondary'}`}
              disabled={mapIn3d}
              title={
                mapIn3d
                  ? 'Линейка доступна только в режиме 2D'
                  : 'Измерить длину ломаной линии на карте (двойной клик — завершить)'
              }
              aria-label="Линейка"
              onClick={() => {
                if (drawMode === 'ruler') {
                  setDrawMode('select');
                  return;
                }
                setLineDraft([]);
                setRulerPoints([]);
                setRulerPreview(null);
                setRulerCompleted([]);
                setSelectMenuOpen(false);
                setPointMenuOpen(false);
                setLineMenuOpen(false);
                setDrawMode('ruler');
              }}
            >
              <Ruler size={14} className="shrink-0" aria-hidden />
              <span className="map-tool-label">Линейка</span>
            </button>
            </div>
            <div
              className={`map-tools-draw-actions${drawActionsVisible ? ' map-tools-draw-actions--visible' : ''}`}
              aria-hidden={!drawActionsVisible}
            >
              <button
                type="button"
                className="btn btn-sm map-tool-btn map-tool-btn--action btn-secondary"
                disabled={drawStepBackDisabled}
                onClick={handleDrawStepBack}
                title="Удалить последнюю вершину"
              >
                <Minus size={14} className="shrink-0" aria-hidden />
                <span className="map-tool-label">Назад</span>
              </button>
              <button
                type="button"
                className="btn btn-sm map-tool-btn map-tool-btn--action btn-primary"
                disabled={drawFinishDisabled}
                onClick={handleDrawFinish}
                title={
                  drawMode === 'line'
                    ? 'Завершить линию (двойной ЛКМ/ПКМ; в пустом месте — узел)'
                    : 'Завершить измерение (или двойной клик на карте)'
                }
              >
                {drawMode === 'line' ? (
                  <Pencil size={14} className="shrink-0" aria-hidden />
                ) : (
                  <Ruler size={14} className="shrink-0" aria-hidden />
                )}
                <span className="map-tool-label">Готово</span>
              </button>
              <button
                type="button"
                className="btn btn-sm map-tool-btn map-tool-btn--action btn-secondary"
                disabled={drawResetDisabled}
                onClick={handleDrawReset}
                title={drawMode === 'line' ? 'Сбросить линию' : 'Сбросить все измерения'}
              >
                <X size={14} className="shrink-0" aria-hidden />
                <span className="map-tool-label">Сброс</span>
              </button>
            </div>
            {projectId && (
              <div
                ref={searchAnchorRef}
                className="map-tools-group map-tools-group--search relative"
              >
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                <input
                  type="search"
                  className="w-full text-sm py-1.5 pl-7 pr-2 rounded-md border bg-transparent"
                  style={{ borderColor: 'var(--border)' }}
                  placeholder="Название, подтип, свойства…"
                  value={searchQ}
                  onChange={(e) => {
                    setSearchQ(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => {
                    if (searchBlurRef.current) window.clearTimeout(searchBlurRef.current);
                    setSearchOpen(true);
                  }}
                  onBlur={() => {
                    searchBlurRef.current = window.setTimeout(() => setSearchOpen(false), 150);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setSearchOpen(false);
                    if (e.key === 'Enter' && searchSuggestions[0]) {
                      e.preventDefault();
                      pickSearchResult(searchSuggestions[0]);
                    }
                  }}
                />
                <AnchoredMenu
                  anchorRef={searchAnchorRef}
                  open={searchOpen && !!searchQ.trim()}
                  onClose={() => setSearchOpen(false)}
                  className="app-anchored-menu--flat"
                  ariaLabel="Результаты поиска"
                >
                  {searchSuggestions.length === 0 ? (
                    <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      Ничего не найдено
                    </div>
                  ) : (
                    searchSuggestions.map((hit) => (
                      <button
                        key={`${hit.kind}-${hit.id}`}
                        type="button"
                        className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg)] border-b last:border-b-0"
                        style={{ borderColor: 'var(--border)' }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickSearchResult(hit)}
                      >
                        <div className="truncate font-medium">{hit.name}</div>
                        <div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                          {hit.subtitle}
                        </div>
                      </button>
                    ))
                  )}
                </AnchoredMenu>
              </div>
            )}
          </div>

          <div className="map-layout">
            {mapLayersOpen && (
              <button
                type="button"
                className="map-sidebar-backdrop"
                aria-label="Закрыть панель слоёв"
                onClick={() => setMapLayersOpen(false)}
              />
            )}
            <aside
              className={`map-sidebar-panel${mapLayersOpen ? ' map-sidebar-panel--open' : ''}`}
            >
              <MapLayersPanel
                layers={layers}
                isGroupVisible={isGroupVisible}
                onGroupVisibility={setGroupSubtypesVisible}
                onLayerVisibility={(layerId, is_visible) =>
                  layerVisibilityMut.mutate({ layerId, is_visible })
                }
                layerVisibilityReadOnly={!canWriteInfra}
                layerVisibilityPending={layerVisibilityMut.isPending}
                showPoisOnMap={showPoisOnMap}
                onShowPoisChange={(visible) => setLayerPrefs((p) => ({ ...p, showPoisOnMap: visible }))}
                showRadii={showRadii}
                onShowRadiiChange={(visible) => setLayerPrefs((p) => ({ ...p, showRadii: visible }))}
                radiusVisible={radiusVisible}
                onRadiusVisibleChange={(subtype, visible) =>
                  setLayerPrefs((p) => ({
                    ...p,
                    radiusVisible: { ...p.radiusVisible, [subtype]: visible },
                  }))
                }
                openSections={layerOpenSections}
                onOpenSectionsChange={setLayerOpenSections}
                thresholdMeta={THRESHOLD_META}
                thresholdKm={thresholdKm}
                showBasemap={showBasemap}
                onShowBasemapChange={(visible) => setLayerPrefs((p) => ({ ...p, showBasemap: visible }))}
                showTerrain={showTerrain}
                onShowTerrainChange={(visible) => setLayerPrefs((p) => ({ ...p, showTerrain: visible }))}
                terrainToggleEnabled={mapIn3d && isMaptilerTerrainAvailable()}
                terrainToggleHint={
                  !isMaptilerTerrainAvailable()
                    ? 'Задайте VITE_MAPTILER_KEY в frontend/.env'
                    : !mapIn3d
                      ? 'Доступно в режиме 3D'
                      : undefined
                }
                showModels={showModels}
                onShowModelsChange={(visible) => setLayerPrefs((p) => ({ ...p, showModels: visible }))}
                modelsToggleEnabled={mapIn3d}
                onClose={() => setMapLayersOpen(false)}
              />
            </aside>

            <div className="map-main-column">
              <div className="map-canvas-wrap" ref={mapCanvasRef}>
          {map3dFeatureEnabled && (map3dKeepMounted || mapIn3d) && (
            <div
              className="map-3d-host"
              style={{
                display: mapIn3d ? 'block' : 'none',
                height: '100%',
                width: '100%',
              }}
              aria-hidden={!mapIn3d}
            >
              <Suspense
                fallback={
                  <div className="map-container flex items-center justify-center text-sm" style={{ height: '100%', color: 'var(--text-muted)' }}>
                    Загрузка 3D…
                  </div>
                }
              >
                <MapView3D
                  ref={map3dRef}
                  viewStateId="main"
                  pois={showPoisOnMap ? pois : []}
                  infraObjects={filteredInfra}
                  infraSnapPool={infraObjects}
                  showBasemap={showBasemap}
                  showTerrain={showTerrain}
                  showModels={showModels}
                  connectionLines={connectionLines}
                  selectedPoi={selectedPoi}
                  selectedFeatureId={featureSel?.id ?? null}
                  onFeatureSelect={
                    drawMode === 'select' && selectMode === 'single' ? setFeatureSel : undefined
                  }
                  thresholdCircles={thresholdCircles}
                  showRadii={showRadii}
                  layers={layers}
                  mapFocus={mapFocus}
                  height="100%"
                />
              </Suspense>
            </div>
          )}
          {!mapIn3d && (
          <MapView
            viewStateId="main"
            onViewStateSnapshot={(s) => {
              last2dViewRef.current = s;
            }}
            pois={showPoisOnMap ? pois : []}
            infraObjects={filteredInfra}
            infraSnapPool={infraObjects}
            showBasemap={showBasemap}
            drawMode={drawMode}
            selectMode={selectMode}
            editMode={mapEditEnabled}
            onMapClick={
              pasteMode ||
              drawMode === 'ruler' ||
              drawMode === 'autoroad_network' ||
              (projectId && drawMode !== 'select')
                ? handleMapClick
                : undefined
            }
            onFinishLine={(coords, finishAt, splitHint) =>
              finishLineDraft(coords, finishAt, splitHint)
            }
            onFinishMeasure={() => {
              if (drawMode === 'ruler') finishRulerMeasurement(true);
            }}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            placementPreview={
              !pasteMode && mapPointerInside && cursor
                ? drawMode === 'point'
                  ? { subtype: infraForm.subtype, lon: cursor.lon, lat: cursor.lat }
                  : drawMode === 'poi'
                    ? { subtype: 'poi', lon: cursor.lon, lat: cursor.lat }
                    : null
                : null
            }
            clipboardPreviewPoints={clipboardPreviewPoints}
            pasteMode={pasteMode}
            onFeatureSelect={
              drawMode === 'select' && selectMode === 'single' ? setFeatureSel : undefined
            }
            onFeatureGroupSelect={
              drawMode === 'select' && selectMode === 'box' ? setFeatureGroupSel : undefined
            }
            selectedFeatureIds={
              drawMode === 'autoroad_network'
                ? autoroadNetworkTerminalIds
                : featureGroupSel.map((s) => s.id)
            }
            onGeometryChange={mapEditEnabled ? handleGeometryChange : undefined}
            onBatchGeometryChange={
              mapEditEnabled && selectMode === 'box' ? handleBatchGeometryChange : undefined
            }
            onBboxChange={handleMapBboxChange}
            connectionLines={connectionLines}
            selectedPoi={selectedPoi}
            selectedFeatureId={featureSel?.id ?? null}
            thresholdCircles={thresholdCircles}
            draftLine={lineDraft}
            draftLinePreview={lineDraftPreview}
            autoroadPlanPreviewLines={autoroadPlanPreviewLines}
            measureLine={rulerPoints}
            measurePreview={rulerPreview}
            measureCompletedLines={rulerCompleted}
            measureCursorLabel={measureCursorLabel}
            measureAnchorLabels={measureAnchorLabels}
            showRadii={showRadii}
            useMapIcons
            layers={layers}
            mapFocus={mapFocus}
            onFitView={handleFitMapView}
            lineLodScaleThreshold={layerPrefs.lineLodScaleThreshold}
            onViewChange={({ scaleLabel, scaleDenominator }) => {
              setMapScaleLabel(scaleLabel);
              setMapScaleDenominator(scaleDenominator);
            }}
          />
          )}

          {detailSelection && drawMode === 'select' && selectMode === 'single' && (
            <ObjectDetailPanel
              selection={detailSelection}
              layers={layers}
              map3dCustomModels={map3dCustomModels}
              saving={saveDetailMut.isPending}
              readOnly={
                detailSelection.kind === 'poi' ? !canWriteProject : !canWriteInfra
              }
              onClose={() => setFeatureSel(null)}
              onSave={(data) => saveDetailMut.mutate(data)}
              onDelete={requestDeleteSelection}
              onCopy={canCopyMapSelection ? copyMapSelection : undefined}
              onCut={canCutMapSelection ? cutMapSelection : undefined}
            />
          )}

          {drawMode === 'autoroad_network' && (
            <AutoroadNetworkPanel
              items={autoroadNetworkDetails}
              onClose={cancelDrawingSelection}
              onClear={() => setAutoroadNetworkTerminalIds([])}
              onPreview={() => {
                if (!canAutoroadNetworkPreview || runAutoroadNetworkFlow.isPending) return;
                runAutoroadNetworkFlow.mutate(autoroadNetworkTerminalIds);
              }}
              canPreview={canAutoroadNetworkPreview}
              pending={runAutoroadNetworkFlow.isPending}
            />
          )}

          {drawMode === 'select' &&
            selectMode === 'box' &&
            groupSelectionDetails.length > 0 && (
            <MapGroupSelectionPanel
              items={groupSelectionDetails}
              onClear={() => setFeatureGroupSel([])}
              onCopy={copyMapSelection}
              onCut={cutMapSelection}
              onPaste={enterPasteMode}
              onDelete={requestDeleteGroupSelection}
              canCopy={canCopyMapSelection}
              canCut={canCutMapSelection}
              canPaste={canPasteMapClipboard}
              canDelete={canDeleteCurrentSelection}
              deletePending={deleteGroupMut.isPending}
              canAutoroadConnect={canAutoroadConnect}
              autoroadConnectPending={autoroadConnectMut.isPending || projectJobBusy}
              onAutoroadConnect={canWriteInfra ? handleAutoroadConnect : undefined}
            />
          )}

              </div>

              <div className="map-footer">
                <span>
                  Масштаб: <strong>{mapScaleLabel}</strong>
                </span>
                {geometrySavePending > 0 && <span>Сохранение геометрии…</span>}
                {geometrySavePending === 0 && drawMode === 'ruler' && (
                  <span>
                    {rulerPoints.length === 0
                      ? 'Линейка: клик — вершина'
                      : 'Двойной клик или «Готово» — завершить'}
                  </span>
                )}
                {geometrySavePending === 0 && drawMode === 'line' && (
                  <span>
                    {lineDraft.length === 0
                      ? 'Линия: первая точка — клик по точечному объекту на карте'
                      : 'Промежуточные вершины — свободно; двойной ЛКМ/ПКМ, Enter или «Готово» — завершить (в пустом месте — узел)'}
                  </span>
                )}
                {mapIn3d && (
                  <span>ПКМ + перетаскивание — поворот камеры; колёсико — масштаб</span>
                )}
                {!mapIn3d && geometrySavePending === 0 && drawMode === 'select' && mapFooterHint && (
                  <span>{mapFooterHint}</span>
                )}
                {!mapIn3d && (
                  <div
                    className="map-footer-lod"
                    title="При масштабе карты 1:N не детальнее порога линия показывается только между концами (без промежуточных вершин)"
                  >
                    <span className="map-footer-lod-label">Упр. линий</span>
                    <input
                      type="range"
                      className="map-footer-lod-slider"
                      min={LINE_LOD_SCALE_MIN}
                      max={LINE_LOD_SCALE_MAX}
                      step={LINE_LOD_SCALE_STEP}
                      value={layerPrefs.lineLodScaleThreshold}
                      onChange={(e) =>
                        patchLayerPrefs({
                          lineLodScaleThreshold: clampLineLodScaleThreshold(Number(e.target.value)),
                        })
                      }
                      aria-label="Порог масштаба упрощения линий"
                    />
                    <span className="map-footer-lod-value">
                      от 1:{formatScaleDenominator(layerPrefs.lineLodScaleThreshold)}
                      {mapScaleDenominator > 0 &&
                      lineLodForScale(mapScaleDenominator, layerPrefs.lineLodScaleThreshold) ===
                        'endpoints'
                        ? ' · вкл.'
                        : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
      </div>

      {autoroadConfirmModal}

      {deleteConfirm && (
        <AppModal
          title={deleteConfirm.title}
          titleId="delete-confirm-title"
          onClose={() => setDeleteConfirm(null)}
          size="sm"
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteGroupMut.isPending || deleteInfraMut.isPending}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={deleteGroupMut.isPending || deleteInfraMut.isPending}
                onClick={() => {
                  const action = deleteConfirm.onConfirm;
                  setDeleteConfirm(null);
                  action();
                }}
              >
                {deleteGroupMut.isPending || deleteInfraMut.isPending ? 'Удаление…' : 'Удалить'}
              </button>
            </>
          }
        >
          <p className="text-sm mb-2">{deleteConfirm.message}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Отменить действие можно через Ctrl+Z.
          </p>
        </AppModal>
      )}

      {modal?.type === 'poi' && (
        <AppModal
          title="Новая точка интереса"
          onClose={() => setModal(null)}
          size="lg"
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitPoi}
                disabled={createPoiMut.isPending}
              >
                Сохранить точку
              </button>
            </>
          }
        >
          <PoiParamsForm value={poiForm} onChange={setPoiForm} coordsReadOnly={false} readOnly={!canWriteProject} />
        </AppModal>
      )}

      {candidateSubtype && selectedPoi && projectId && (
        <CandidatesModal
          projectId={projectId}
          poiId={selectedPoi.id}
          subtype={candidateSubtype}
          paramType={candidateParamType}
          onClose={() => {
            setCandidateSubtype(null);
            setCandidateParamType('external');
          }}
          onSelect={(c) => overrideMut.mutate(c)}
        />
      )}

      {/* Infrastructure objects are created immediately (no modal). */}
    </div>
  );
}
