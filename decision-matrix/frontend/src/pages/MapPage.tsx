import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BoxSelect,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  MousePointer2,
  PenLine,
  Pencil,
  Ruler,
  Search,
  Trash2,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
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
import { MapLayersPanel } from '../components/MapLayersPanel';
import { ObjectDetailPanel, type SelectedFeature } from '../components/ObjectDetailPanel';
import { PoiParamsForm } from '../components/PoiParamsForm';
import { formatCoord, parseCoord, roundCoord } from '../lib/coords';
import {
  emptyPoiFormValues,
  formValuesToPoiCreatePayload,
  nextPoiAutoName,
} from '../lib/poiParams';
import {
  MapView,
  type DrawMode,
  type MapFeatureSelection,
  type MapFocusTarget,
  type SelectMode,
  type ThresholdCircle,
} from '../components/MapView';
import { iconDataUrl } from '../lib/mapIcons';
import {
  LINE_SUBTYPES,
  createDefaultSubtypeFilter,
  MAP_DRAWABLE_POINT_SUBTYPES,
  SUBTYPE_LABELS,
  pointMenuLabel,
  api,
  normalizePoiAnalysisResponse,
  type AnalysisResult,
  type AnalysisRow,
  type Candidate,
  type InfraObject,
  type InfraObjectCreate,
  type PoiAnalysisResponse,
  type POI,
} from '../lib/api';
import { useActiveProject } from '../hooks/useActiveProject';
import { refreshMapQueries } from '../lib/mapQueries';
import { formatLengthMeters, lineLengthMeters } from '../lib/mapMeasure';
import { resolveLineEndpoint } from '../lib/lineEndpointRules';
import { linkedLineIdsForPoint } from '../lib/infraLinks';
import {
  defaultCapacityUnitForSubtype,
  mergeThroughputCapacity,
} from '../lib/infraCapacity';
import {
  infraDetailUndo,
  infraGeometryUndo,
  poiDetailUndo,
  poiGeometryUndo,
  useMapUndo,
} from '../lib/mapUndo';
import { useAppStore } from '../store';

const THRESHOLD_META: { subtype: string; color: string; label: string; defaultKm: number }[] = [
  { subtype: 'gas_processing', color: '#ff6f00', label: 'ГКС', defaultKm: 80 },
  { subtype: 'gtes', color: '#d84315', label: 'ИЭ', defaultKm: 60 },
  { subtype: 'substation', color: '#f9a825', label: 'ПС/ТП', defaultKm: 25 },
  { subtype: 'refinery', color: '#455a64', label: 'НПЗ', defaultKm: 100 },
];

const MOVE_MATCH_EPS = 1e-6;

function PointSubtypeMenuItem({
  st,
  selected,
  onPick,
}: {
  st: string;
  selected: boolean;
  onPick: (st: string) => void;
}) {
  return (
    <button
      type="button"
      className={`w-full text-left px-3 py-1.5 hover:bg-[var(--bg)] flex items-center gap-2 ${
        selected ? 'font-medium' : ''
      }`}
      onClick={() => onPick(st)}
    >
      <img src={iconDataUrl(st)} alt="" className="w-4 h-4 shrink-0" draggable={false} />
      <span className="truncate">{pointMenuLabel(st)}</span>
    </button>
  );
}

function sameCoord(a: number, b: number): boolean {
  return Math.abs(a - b) <= MOVE_MATCH_EPS;
}

function lineCoordsOrEndpoints(obj: InfraObject): [number, number][] | null {
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
  const { projectId } = useActiveProject();
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const [showBasemap, setShowBasemap] = useState(true);
  const [mapLayersOpen, setMapLayersOpen] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const mapCanvasRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<{ lon: number; lat: number } | null>(null);
  const [mapPointerInside, setMapPointerInside] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>('select');
  const [selectMode, setSelectMode] = useState<SelectMode>('single');
  const [selectMenuOpen, setSelectMenuOpen] = useState(false);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [showRadii, setShowRadii] = useState(false);
  const [radiusVisible, setRadiusVisible] = useState<Record<string, boolean>>({
    gas_processing: true,
    gtes: true,
    substation: true,
    refinery: true,
  });
  const [lineDraft, setLineDraft] = useState<number[][]>([]);
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
  const [subtypeFilter, setSubtypeFilter] = useState(createDefaultSubtypeFilter);
  const [mapFocus, setMapFocus] = useState<MapFocusTarget | null>(null);
  const [mapEditEnabled, setMapEditEnabled] = useState(false);
  const [showPoisOnMap, setShowPoisOnMap] = useState(true);
  const [mapScaleLabel, setMapScaleLabel] = useState('—');

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
    }
  }, [drawMode]);

  useEffect(() => {
    if (selectMode === 'single') setFeatureGroupSel([]);
    else setFeatureSel(null);
  }, [selectMode]);

  useEffect(() => {
    if (mapEditEnabled) {
      setFeatureSel(null);
      setFeatureGroupSel([]);
      setSelectMenuOpen(false);
      return;
    }
    setFeatureSel(null);
    setFeatureGroupSel([]);
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

  const cancelDrawingSelection = useCallback(() => {
    setDrawMode('select');
    setLineDraft([]);
    setSelectMenuOpen(false);
    setPointMenuOpen(false);
    setLineMenuOpen(false);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (deleteConfirm) {
        e.preventDefault();
        setDeleteConfirm(null);
        return;
      }
      if (modal) {
        e.preventDefault();
        setModal(null);
        return;
      }
      if (candidateSubtype) {
        e.preventDefault();
        setCandidateSubtype(null);
        setCandidateParamType('external');
        return;
      }
      if (searchOpen) {
        e.preventDefault();
        setSearchOpen(false);
        return;
      }

      const drawingActive =
        drawMode !== 'select' || pointMenuOpen || lineMenuOpen || selectMenuOpen;
      if (drawingActive) {
        e.preventDefault();
        cancelDrawingSelection();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    drawMode,
    pointMenuOpen,
    lineMenuOpen,
    selectMenuOpen,
    modal,
    deleteConfirm,
    candidateSubtype,
    searchOpen,
    cancelDrawingSelection,
  ]);

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
  });

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
    refetchOnMount: 'always',
  });

  const layerVisibilityMut = useMutation({
    mutationFn: ({ layerId, is_visible }: { layerId: string; is_visible: boolean }) =>
      api.updateLayer(projectId!, layerId, { is_visible }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['layers', projectId] }),
  });

  const setGroupSubtypesVisible = useCallback((subtypes: readonly string[], visible: boolean) => {
    setSubtypeFilter((prev) => {
      const next = { ...prev };
      for (const st of subtypes) next[st] = visible;
      return next;
    });
  }, []);

  const isGroupVisible = useCallback(
    (subtypes: readonly string[]) => subtypes.every((st) => subtypeFilter[st] !== false),
    [subtypeFilter],
  );

  const { data: infraObjects = [] } = useQuery({
    queryKey: ['infra', projectId],
    queryFn: () => api.getInfraObjects(projectId!),
    enabled: !!projectId,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
  });

  const searchFilteredInfra = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return infraObjects;
    return infraObjects.filter((o) => o.name.toLowerCase().includes(q));
  }, [infraObjects, searchQ]);

  const searchSuggestions = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [];
    const hits: { kind: 'poi' | 'infra'; id: string; name: string; subtitle: string }[] = [];
    for (const p of pois) {
      if (p.name.toLowerCase().includes(q)) {
        hits.push({ kind: 'poi', id: p.id, name: p.name, subtitle: 'Точка интереса' });
      }
    }
    for (const o of infraObjects) {
      if (o.name.toLowerCase().includes(q)) {
        hits.push({
          kind: 'infra',
          id: o.id,
          name: o.name,
          subtitle: SUBTYPE_LABELS[o.subtype] || o.subtype,
        });
      }
    }
    return hits.slice(0, 10);
  }, [searchQ, pois, infraObjects]);

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

  const visibleLayerIds = useMemo(
    () => new Set(layers.filter((l) => l.is_visible).map((l) => l.id)),
    [layers]
  );

  /** Objects on visible layers (analysis names/refs); independent of subtype filter. */
  const mapLayerVisibleInfra = useMemo(
    () => searchFilteredInfra.filter((o) => visibleLayerIds.has(o.layer_id)),
    [searchFilteredInfra, visibleLayerIds]
  );

  const filteredInfra = useMemo(
    () =>
      mapLayerVisibleInfra.filter((o) => subtypeFilter[o.subtype] !== false),
    [mapLayerVisibleInfra, subtypeFilter]
  );

  const selectedPoi = pois.find((p) => p.id === selectedPoiId) ?? pois[0] ?? null;

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

  const groupSelectionDetails = useMemo(() => {
    return featureGroupSel
      .map((sel) => {
        if (sel.kind === 'poi') {
          const poi = pois.find((p) => p.id === sel.id);
          return poi ? { id: sel.id, name: poi.name, kind: 'poi' as const } : null;
        }
        const obj = infraObjects.find((o) => o.id === sel.id);
        return obj
          ? { id: sel.id, name: obj.name, kind: 'infra' as const, subtitle: SUBTYPE_LABELS[obj.subtype] || obj.subtype }
          : null;
      })
      .filter(Boolean) as { id: string; name: string; kind: 'poi' | 'infra'; subtitle?: string }[];
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
      queryClient.setQueryData<InfraObject[]>(['infra', projectId], (prev) => {
        const list = prev ?? [];
        const idx = list.findIndex((o) => o.id === created.id);
        if (idx >= 0) {
          const next = [...list];
          next[idx] = created;
          return next;
        }
        return [...list, created];
      });
    },
    [projectId, queryClient],
  );

  const createInfraMut = useMutation({
    mutationFn: (data: Parameters<typeof api.createInfraObject>[1]) => api.createInfraObject(projectId!, data),
    onSuccess: (created) => {
      upsertInfraInCache(created);
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

  const analyzeMut = useMutation({
    mutationFn: () => {
      if (!projectId) {
        return Promise.reject(new Error('Выберите проект'));
      }
      if (pois.length === 0) {
        return Promise.reject(new Error('Нет точек интереса для анализа'));
      }
      return api.analyzeAllPois(projectId);
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
      await queryClient.invalidateQueries({ queryKey: ['scenarios', projectId] });
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
      const target = currentInfra.find((o) => o.id === id);
      if (!target) {
        await api.deleteInfraObject(projectId!, id);
        return [id];
      }
      const linkedLineIds = linkedLineIdsForPoint(target, currentInfra);
      const deleteIds = Array.from(new Set([id, ...linkedLineIds]));
      await Promise.all(deleteIds.map((objId) => api.deleteInfraObject(projectId!, objId)));
      return deleteIds;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
      const currentInfra = queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      const deleted =
        currentInfra.find((o) => o.id === id) ??
        infraObjects.find((o) => o.id === id);
      const linkedLineIds = deleted ? linkedLineIdsForPoint(deleted, currentInfra) : [];
      const deleteIds = new Set([id, ...linkedLineIds]);
      const deletedGroup = currentInfra
        .filter((o) => deleteIds.has(o.id))
        .map((o) => structuredClone(o));
      const snapshots = queryClient.getQueriesData<InfraObject[]>({ queryKey: ['infra', projectId] });
      queryClient.setQueriesData<InfraObject[]>({ queryKey: ['infra', projectId] }, (old) =>
        old ? old.filter((o) => !deleteIds.has(o.id)) : []
      );
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
      await queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['network-nodes', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['network-edges', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['analysis', projectId] });
      invalidateMap();
    },
  });

  const deleteGroupMut = useMutation({
    mutationFn: async (items: MapFeatureSelection[]) => {
      const currentInfra = queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      const selectedInfraIds = items.filter((sel) => sel.kind === 'infra').map((sel) => sel.id);
      const extraLineIds = new Set<string>();
      for (const infraId of selectedInfraIds) {
        const obj = currentInfra.find((o) => o.id === infraId);
        if (!obj) continue;
        for (const lineId of linkedLineIdsForPoint(obj, currentInfra)) extraLineIds.add(lineId);
      }
      const allInfraIds = Array.from(new Set([...selectedInfraIds, ...Array.from(extraLineIds)]));
      const poiIds = items.filter((sel) => sel.kind === 'poi').map((sel) => sel.id);

      await Promise.all([
        ...poiIds.map((poiId) => api.deletePoi(projectId!, poiId)),
        ...allInfraIds.map((infraId) => api.deleteInfraObject(projectId!, infraId)),
      ]);
    },
    onMutate: async (items) => {
      const currentInfra = queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      const poisSnap: POI[] = [];
      const infraSnap: InfraObject[] = [];
      const selectedInfraIds = items.filter((sel) => sel.kind === 'infra').map((sel) => sel.id);
      const extraLineIds = new Set<string>();
      for (const infraId of selectedInfraIds) {
        const obj = currentInfra.find((o) => o.id === infraId);
        if (!obj) continue;
        for (const lineId of linkedLineIdsForPoint(obj, currentInfra)) extraLineIds.add(lineId);
      }
      const allInfraIds = new Set([...selectedInfraIds, ...Array.from(extraLineIds)]);
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
      return { poisSnap, infraSnap };
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
      invalidateMap();
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось удалить объекты');
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pois', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['network-nodes', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['network-edges', projectId] });
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
    if (!projectId || selectedOnMapCount === 0) return;
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
        queryClient.setQueryData<InfraObject[]>(['infra', projectId], (old) =>
          old?.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)) ?? []
        );
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

  const saveCapacityMut = useMutation({
    mutationFn: async ({ object, value }: { object: InfraObject; value: number | null }) => {
      const unit = defaultCapacityUnitForSubtype(object.subtype);
      return api.updateInfraObject(projectId!, object.id, {
        properties: mergeThroughputCapacity(object.properties, value, unit),
      });
    },
    onMutate: ({ object, value }) => {
      if (!projectId) return { previous: object };
      const unit = defaultCapacityUnitForSubtype(object.subtype);
      queryClient.setQueryData<InfraObject[]>(['infra', projectId], (old) =>
        old?.map((o) =>
          o.id === object.id
            ? { ...o, properties: mergeThroughputCapacity(o.properties, value, unit) }
            : o
        ) ?? []
      );
      return { previous: object };
    },
    onSuccess: (updated) => {
      if (!projectId || !updated) return;
      queryClient.setQueryData<InfraObject[]>(['infra', projectId], (old) =>
        old?.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)) ?? []
      );
      pushToast('success', 'Пропускная способность сохранена');
    },
    onError: (err, _vars, ctx) => {
      if (!projectId || !ctx?.previous) return;
      queryClient.setQueryData<InfraObject[]>(['infra', projectId], (old) =>
        old?.map((o) => (o.id === ctx.previous.id ? ctx.previous : o)) ?? []
      );
      pushToast('error', err instanceof Error ? err.message : 'Не удалось сохранить пропускную способность');
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
      const rLon = roundCoord(lon);
      const rLat = roundCoord(lat);

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
          const roundedCoords = coords.map(([lo, la]) => [roundCoord(lo), roundCoord(la)] as [number, number]);
          const payload = {
            lon: roundedCoords[0][0],
            lat: roundedCoords[0][1],
            end_lon: roundedCoords[roundedCoords.length - 1][0],
            end_lat: roundedCoords[roundedCoords.length - 1][1],
            coordinates: roundedCoords,
          };
          queryClient.setQueriesData<InfraObject[]>({ queryKey: ['infra', projectId] }, (old) =>
            old?.map((o) => (o.id === sel.id ? { ...o, ...payload } : o)) ?? []
          );
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
            const oldLon = roundCoord(infraBefore.lon);
            const oldLat = roundCoord(infraBefore.lat);
            const currentInfra =
              queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
            const candidateLines = currentInfra.filter((o) => o.id !== sel.id && LINE_SUBTYPES.includes(o.subtype as typeof LINE_SUBTYPES[number]));

            for (const line of candidateLines) {
              const coords = lineCoordsOrEndpoints(line);
              if (!coords || coords.length < 2) continue;
              const first = coords[0]!;
              const last = coords[coords.length - 1]!;
              const firstMatches = sameCoord(roundCoord(first[0]), oldLon) && sameCoord(roundCoord(first[1]), oldLat);
              const lastMatches = sameCoord(roundCoord(last[0]), oldLon) && sameCoord(roundCoord(last[1]), oldLat);
              if (!firstMatches && !lastMatches) continue;

              const shifted = coords.map(([lo, la], i) => {
                if (i === 0 && firstMatches) return [rLon, rLat] as [number, number];
                if (i === coords.length - 1 && lastMatches) return [rLon, rLat] as [number, number];
                return [roundCoord(lo), roundCoord(la)] as [number, number];
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

          queryClient.setQueriesData<InfraObject[]>({ queryKey: ['infra', projectId] }, (old) =>
            old?.map((o) => {
              if (o.id === sel.id) return { ...o, lon: rLon, lat: rLat };
              const linePatch = updatedLinePayloads.find((p) => p.id === o.id);
              return linePatch ? { ...o, ...linePatch.payload } : o;
            }) ?? []
          );
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
        await refreshMapQueries(queryClient, projectId);
        queryClient.invalidateQueries({ queryKey: ['pois', projectId] });
      }
    },
    [projectId, queryClient, pois, infraObjects, pushUndo, pushToast]
  );

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
    const pt: [number, number] = [roundCoord(lon), roundCoord(lat)];
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
    (lon: number, lat: number) => {
      if (drawMode === 'ruler') {
        handleRulerClick(lon, lat);
        return;
      }
      if (drawMode === 'poi') {
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
        if (!projectId) return;
        const subtype = infraForm.subtype;
        createInfraMut.mutate({
          name: nextAutoName(subtype),
          subtype,
          lon: roundCoord(lon),
          lat: roundCoord(lat),
        });
        return;
      }
      if (drawMode === 'line') {
        // Keep click coordinates while drawing; endpoint snap runs on finish (avoids visible jump on first click).
        setLineDraft((prev) => [...prev, [lon, lat]]);
      }
    },
    [
      createInfraMut,
      drawMode,
      handleRulerClick,
      infraForm.subtype,
      infraObjects,
      nextAutoName,
      pois,
      projectId,
    ]
  );

  const finishLineDraft = useCallback(
    async (coords: number[][], finishAt?: { lon: number; lat: number }) => {
      if (!projectId) return;
      if (coords.length < 2) {
        pushToast('info', 'Добавьте минимум 2 точки линии (ЛКМ по карте)');
        return;
      }
      const subtype = infraForm.subtype;
      const draft = coords.map((c) => [c[0], c[1]] as [number, number]);
      if (finishAt) {
        draft[draft.length - 1] = [finishAt.lon, finishAt.lat];
      }

      let pool =
        queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      const createdNodeIds: string[] = [];

      const applyEndpoint = async (
        index: number,
        kind: 'start' | 'finish',
      ): Promise<boolean> => {
        const resolved = resolveLineEndpoint(subtype, kind, draft[index], pool);
        if (!resolved.ok) {
          pushToast('error', resolved.message);
          return false;
        }
        if (resolved.createNode) {
          try {
            const node = await api.createInfraObject(projectId, {
              name: nextAutoName('node'),
              subtype: 'node',
              lon: roundCoord(resolved.lon),
              lat: roundCoord(resolved.lat),
            });
            createdNodeIds.push(node.id);
            pool = [...pool, node];
            upsertInfraInCache(node);
            draft[index] = [node.lon, node.lat];
          } catch (err) {
            pushToast(
              'error',
              err instanceof Error ? err.message : 'Не удалось создать узел подключения',
            );
            return false;
          }
        } else {
          draft[index] = [resolved.lon, resolved.lat];
        }
        return true;
      };

      if (!(await applyEndpoint(0, 'start'))) return;
      if (!(await applyEndpoint(draft.length - 1, 'finish'))) return;

      const prepared = draft.map(([lo, la]) => [lo, la] as [number, number]);
      try {
        await createInfraMut.mutateAsync({
          name: nextAutoName(subtype),
          subtype,
          lon: roundCoord(prepared[0][0]),
          lat: roundCoord(prepared[0][1]),
          end_lon: roundCoord(prepared[prepared.length - 1][0]),
          end_lat: roundCoord(prepared[prepared.length - 1][1]),
          coordinates: prepared.map(([lo, la]) => [roundCoord(lo), roundCoord(la)]),
        });
        setLineDraft([]);
        if (createdNodeIds.length > 0) {
          pushToast(
            'info',
            createdNodeIds.length === 1
              ? 'Создан узел подключения и линия'
              : `Созданы узлы подключения (${createdNodeIds.length}) и линия`,
          );
        }
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
      nextAutoName,
      projectId,
      pushToast,
      upsertInfraInCache,
    ],
  );

  useEffect(() => {
    if (drawMode !== 'line') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      finishLineDraft(lineDraft);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawMode, lineDraft, finishLineDraft]);

  const submitPoi = () => {
    if (!projectId) {
      pushToast('error', 'Выберите проект в шапке приложения');
      return;
    }
    if (!modal || modal.type !== 'poi') return;
    const name = poiForm.name.trim() || nextPoiAutoName(pois);
    const lon = parseCoord(poiForm.lon || formatCoord(modal.lon));
    const lat = parseCoord(poiForm.lat || formatCoord(modal.lat));
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      pushToast('error', 'Укажите корректные координаты');
      return;
    }
    const payload = formValuesToPoiCreatePayload({
      ...poiForm,
      name,
      lon: formatCoord(lon),
      lat: formatCoord(lat),
    });
    createPoiMut.mutate(payload as Parameters<typeof api.createPoi>[1]);
  };

  return (
    <div className="map-page flex flex-1 flex-col min-h-0 overflow-hidden">
      <header className="page-header map-page-header shrink-0">
        <h1>Карта инфраструктуры</h1>
        {projectId && pois.length > 0 && (
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

      {!projectId && (
        <div className="card mb-3 shrink-0 text-sm" style={{ color: 'var(--text-muted)' }}>
          Выберите проект в шапке приложения.
        </div>
      )}

      <div className="card map-page-card flex flex-1 flex-col min-h-0 overflow-hidden">
          <div className="map-tools">
            <button
              type="button"
              className={`btn btn-sm map-tool-btn btn-secondary map-layers-toggle${
                mapLayersOpen ? ' btn-primary active' : ''
              }`}
              title="Слои и настройки карты"
              onClick={() => setMapLayersOpen((open) => !open)}
            >
              <Layers size={14} className="inline mr-1" />
              Слои
            </button>
            <div className="map-layers-toggle-sep w-px h-7 mx-0.5 shrink-0" style={{ background: 'var(--border)' }} aria-hidden />
            <button
              type="button"
              className="btn btn-sm map-tool-btn btn-secondary map-fullscreen-toggle"
              title={mapFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранная карта'}
              onClick={() => void toggleMapFullscreen()}
            >
              {mapFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <div className="map-fullscreen-sep w-px h-7 mx-0.5 shrink-0" style={{ background: 'var(--border)' }} aria-hidden />
            {projectId && pois.length > 0 && (
              <>
                <MapPoiSelect
                  pois={pois}
                  value={selectedPoiId ?? pois[0].id}
                  onChange={setSelectedPoiId}
                />
                <div
                  className="w-px h-7 mx-0.5 shrink-0"
                  style={{ background: 'var(--border)' }}
                  aria-hidden
                />
              </>
            )}
            <button
              type="button"
              className={`btn btn-sm map-tool-btn ${mapEditEnabled ? 'btn-primary active' : 'btn-secondary'}`}
              title={
                mapEditEnabled
                  ? 'Выключить редактирование на карте'
                  : 'Редактирование на карте: перемещение объектов, создание точек и линий'
              }
              onClick={() => setMapEditEnabled((on) => !on)}
            >
              <PenLine size={14} />
            </button>
            <button
              type="button"
              className="btn btn-sm map-tool-btn btn-secondary"
              title="Отменить последнее действие (Ctrl+Z)"
              disabled={!canUndo}
              onClick={() => void performUndo()}
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              className="btn btn-sm map-tool-btn btn-secondary"
              title={
                selectedOnMapCount > 0
                  ? `Удалить выбранные объекты (${selectedOnMapCount})`
                  : 'Выберите объект на карте (клик или рамка)'
              }
              disabled={
                !projectId ||
                selectedOnMapCount === 0 ||
                deleteGroupMut.isPending ||
                deleteInfraMut.isPending
              }
              onClick={requestDeleteSelection}
            >
              <Trash2 size={14} />
            </button>
            <div className="w-px h-7 mx-0.5 shrink-0" style={{ background: 'var(--border)' }} aria-hidden />
            <div ref={selectMenuAnchorRef} className="inline-block">
              <button
                type="button"
                className={`btn btn-sm map-tool-btn ${drawMode === 'select' || selectMenuOpen ? 'btn-primary active' : 'btn-secondary'}`}
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
                  <BoxSelect size={14} className="inline mr-1" />
                ) : (
                  <MousePointer2 size={14} className="inline mr-1" />
                )}
                Выбор
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
              className={`btn btn-sm map-tool-btn ${drawMode === 'poi' ? 'btn-primary active' : 'btn-secondary'}`}
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
              <MapPin size={14} className="inline mr-1" />
              POI
            </button>
            <div ref={pointMenuAnchorRef} className="inline-block">
              <button
                type="button"
                className={`btn btn-sm map-tool-btn ${drawMode === 'point' || pointMenuOpen ? 'btn-primary active' : 'btn-secondary'}`}
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
                <MapPin size={14} className="inline mr-1" />
                Точка
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
              </AnchoredMenu>
            </div>
            <div ref={lineMenuAnchorRef} className="inline-block">
            <button
              type="button"
              className={`btn btn-sm map-tool-btn ${drawMode === 'line' || lineMenuOpen ? 'btn-primary active' : 'btn-secondary'}`}
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
              <Pencil size={14} className="inline mr-1" />
              Линия
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
            <div className="w-px h-7 mx-0.5 shrink-0" style={{ background: 'var(--border)' }} aria-hidden />
            <button
              type="button"
              className={`btn btn-sm map-tool-btn ${drawMode === 'ruler' ? 'btn-primary active' : 'btn-secondary'}`}
              title="Измерить длину ломаной линии на карте (двойной клик — завершить)"
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
              <Ruler size={14} className="inline mr-1" />
              Линейка
            </button>
            {drawMode === 'ruler' && (
              <>
                {rulerPoints.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary text-sm"
                    onClick={() => setRulerPoints((d) => d.slice(0, -1))}
                    title="Удалить последнюю вершину"
                  >
                    <Minus size={14} className="inline mr-1" />
                    Шаг назад
                  </button>
                )}
                {rulerPoints.length >= 2 && (
                  <button
                    type="button"
                    className="btn btn-primary text-sm"
                    onClick={() => finishRulerMeasurement(false)}
                    title="Завершить измерение (или двойной клик на карте)"
                  >
                    <Ruler size={14} className="inline mr-1" />
                    Готово
                  </button>
                )}
                {(rulerPoints.length > 0 || rulerCompleted.length > 0) && (
                  <button
                    type="button"
                    className="btn btn-secondary text-sm"
                    onClick={() => {
                      setRulerPoints([]);
                      setRulerPreview(null);
                      setRulerCompleted([]);
                    }}
                    title="Сбросить все измерения"
                  >
                    <X size={14} className="inline mr-1" />
                    Сброс
                  </button>
                )}
              </>
            )}
            {drawMode === 'line' && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  disabled={lineDraft.length === 0}
                  onClick={() => setLineDraft((d) => d.slice(0, -1))}
                  title="Удалить последнюю точку"
                >
                  <Minus size={14} /> Шаг назад
                </button>
                <button
                  type="button"
                  className="btn btn-primary text-sm"
                  disabled={lineDraft.length < 2 || createInfraMut.isPending}
                  onClick={() => {
                    void finishLineDraft(lineDraft);
                  }}
                  title="Завершить линию (узлы подключения создаются автоматически)"
                >
                  <Pencil size={14} className="inline mr-1" />
                  Готово
                </button>
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  disabled={lineDraft.length === 0}
                  onClick={() => setLineDraft([])}
                >
                  <Minus size={14} /> Сброс
                </button>
              </>
            )}
            {projectId && (
              <div
                ref={searchAnchorRef}
                className="relative ml-auto min-w-[140px] max-w-[220px]"
              >
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                <input
                  type="search"
                  className="w-full text-sm py-1.5 pl-7 pr-2 rounded-md border bg-transparent"
                  style={{ borderColor: 'var(--border)' }}
                  placeholder="Поиск…"
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
                layerVisibilityPending={layerVisibilityMut.isPending}
                showPoisOnMap={showPoisOnMap}
                onShowPoisChange={setShowPoisOnMap}
                showRadii={showRadii}
                onShowRadiiChange={setShowRadii}
                radiusVisible={radiusVisible}
                onRadiusVisibleChange={(subtype, visible) =>
                  setRadiusVisible((v) => ({ ...v, [subtype]: visible }))
                }
                thresholdMeta={THRESHOLD_META}
                thresholdKm={thresholdKm}
                showBasemap={showBasemap}
                onShowBasemapChange={setShowBasemap}
                onClose={() => setMapLayersOpen(false)}
              />
            </aside>

            <div className="map-main-column">
              <div className="map-canvas-wrap" ref={mapCanvasRef}>
          <MapView
            viewStateId="main"
            pois={showPoisOnMap ? pois : []}
            infraObjects={filteredInfra}
            showBasemap={showBasemap}
            drawMode={drawMode}
            selectMode={selectMode}
            editMode={mapEditEnabled}
            onMapClick={
              drawMode === 'ruler' || (projectId && drawMode !== 'select')
                ? handleMapClick
                : undefined
            }
            onFinishLine={(coords, finishAt) => finishLineDraft(coords, finishAt)}
            onFinishMeasure={() => {
              if (drawMode === 'ruler') finishRulerMeasurement(true);
            }}
            onPointerMove={(lon, lat) => {
              const rLon = roundCoord(lon);
              const rLat = roundCoord(lat);
              setMapPointerInside(true);
              setCursor({ lon: rLon, lat: rLat });
              if (drawMode === 'ruler' && rulerPoints.length >= 1) {
                setRulerPreview([rLon, rLat]);
              } else if (rulerPreview) {
                setRulerPreview(null);
              }
            }}
            onPointerLeave={() => setMapPointerInside(false)}
            placementPreview={
              mapPointerInside && cursor
                ? drawMode === 'point'
                  ? { subtype: infraForm.subtype, lon: cursor.lon, lat: cursor.lat }
                  : drawMode === 'poi'
                    ? { subtype: 'poi', lon: cursor.lon, lat: cursor.lat }
                    : null
                : null
            }
            onFeatureSelect={
              drawMode === 'select' && selectMode === 'single' ? setFeatureSel : undefined
            }
            onFeatureGroupSelect={
              drawMode === 'select' && selectMode === 'box' ? setFeatureGroupSel : undefined
            }
            onGeometryChange={mapEditEnabled ? handleGeometryChange : undefined}
            onBboxChange={undefined}
            connectionLines={connectionLines}
            selectedPoi={selectedPoi}
            selectedFeatureId={featureSel?.id ?? null}
            selectedFeatureIds={featureGroupSel.map((s) => s.id)}
            thresholdCircles={thresholdCircles}
            draftLine={lineDraft}
            measureLine={rulerPoints}
            measurePreview={rulerPreview}
            measureCompletedLines={rulerCompleted}
            measureCursorLabel={measureCursorLabel}
            measureAnchorLabels={measureAnchorLabels}
            showRadii={showRadii}
            useMapIcons
            networkNodes={[]}
            networkEdges={[]}
            layers={layers}
            mapFocus={mapFocus}
            onFitView={handleFitMapView}
            onViewChange={({ scaleLabel }) => setMapScaleLabel(scaleLabel)}
          />

          {detailSelection && drawMode === 'select' && selectMode === 'single' && (
            <ObjectDetailPanel
              selection={detailSelection}
              layers={layers}
              saving={saveDetailMut.isPending}
              capacitySaving={saveCapacityMut.isPending}
              onClose={() => setFeatureSel(null)}
              onSave={(data) => saveDetailMut.mutate(data)}
              onSaveCapacity={
                detailSelection.kind === 'infra'
                  ? (value) =>
                      saveCapacityMut.mutate({ object: detailSelection.object, value })
                  : undefined
              }
              onDelete={requestDeleteSelection}
            />
          )}

          {mapEditEnabled &&
            drawMode === 'select' &&
            selectMode === 'box' &&
            groupSelectionDetails.length > 0 && (
            <div
              className="map-group-panel absolute top-3 left-3 z-10 card p-3 w-64 max-h-72 flex flex-col shadow-lg"
              style={{ background: 'var(--surface)' }}
            >
              <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
                <h3 className="font-semibold text-sm">Выбрано: {groupSelectionDetails.length}</h3>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon-touch p-1"
                  onClick={() => setFeatureGroupSel([])}
                  title="Сбросить выделение"
                  aria-label="Сбросить выделение"
                >
                  <X size={14} />
                </button>
              </div>
              <ul className="text-sm overflow-y-auto min-h-0 space-y-1">
                {groupSelectionDetails.map((item) => (
                  <li key={item.id} className="truncate py-0.5 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                    <div className="font-medium truncate">{item.name}</div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {item.kind === 'poi' ? 'Точка интереса' : item.subtitle}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs mt-2 shrink-0" style={{ color: 'var(--text-muted)' }}>
                Зажмите ЛКМ и выделите прямоугольником
              </p>
              <button
                type="button"
                className="btn btn-secondary text-xs mt-2 shrink-0 w-full py-1.5"
                onClick={requestDeleteGroupSelection}
                disabled={deleteGroupMut.isPending || !mapEditEnabled}
                title={!mapEditEnabled ? 'Включите режим редактирования' : undefined}
              >
                <Trash2 size={12} className="inline mr-1" />
                {deleteGroupMut.isPending ? 'Удаление…' : 'Удалить объекты'}
              </button>
            </div>
          )}

              </div>

              <div className="map-footer">
                <span>
                  Координаты:{' '}
                  <strong className="tabular">
                    {cursor
                      ? `${formatCoord(cursor.lat)}, ${formatCoord(cursor.lon)}`
                      : '—'}
                  </strong>
                </span>
                <span>
                  Масштаб: <strong>{mapScaleLabel}</strong>
                </span>
                {drawMode === 'ruler' && (
                  <span>
                    {rulerPoints.length === 0
                      ? 'Линейка: клик — вершина'
                      : 'Двойной клик или «Готово» — завершить'}
                  </span>
                )}
                {drawMode === 'line' && (
                  <span>
                    {lineDraft.length === 0
                      ? 'Линия: клик — вершина'
                      : '«Готово» или Enter — сохранить (узлы у концов создаются сами)'}
                  </span>
                )}
              </div>
            </div>
          </div>
      </div>

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
          <PoiParamsForm value={poiForm} onChange={setPoiForm} coordsReadOnly={false} />
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
