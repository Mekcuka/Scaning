import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Shapes, Sparkles, Square } from 'lucide-react';
import { AppModal } from '../AppModal';
import {
  padEarthworkApi,
  type PadDemStatus,
  type PadEarthworkComputeResult,
  type PadTerrainMode,
} from '../../lib/api/padEarthworkApi';
import {
  createDefaultPlanSketch,
  createDefaultPolygonSketch,
  createEmptyPolygonSketch,
  DEFAULT_ENVELOPE_WRAP_WIDTH_M,
  estimateEnvelopeFillM3,
  estimateFillM3,
  isPlanPolygon,
  isPlanRectangle,
  isPolygonSketchClosed,
  PAD_SIZE_PRESETS,
  planFromFormFields,
  polygonBoundingBox,
  polygonPerimeterM,
  polygonToRectangle,
  rectangleToPolygon,
  shapeVerticesForEnvelope,
  sketchFootprintAreaM2,
  sketchToApiPayload,
  type PlanEditTool,
  type PlanPolygonSketch,
  type PlanRectangleSketch,
  type PlanShapeSketch,
  type PlanVertex,
  type PolygonEditTool,
  type ShapeMode,
  resolveInitialShapeMode,
} from '../../lib/padEarthworkSketch';
import {
  padWellFieldsFromForm,
  DEFAULT_PAD_GROUP_SPACING_M,
  DEFAULT_PAD_MARGIN_BOTTOM_M,
  DEFAULT_PAD_MARGIN_END_M,
  DEFAULT_PAD_MARGIN_LEFT_M,
  DEFAULT_PAD_MARGIN_TOP_M,
  DEFAULT_PAD_WELL_COUNT,
  DEFAULT_PAD_WELLS_PER_GROUP,
  DEFAULT_PAD_WELL_SPACING_M,
} from '../../lib/infraPadWells';
import { clampNdsDeg, DEFAULT_PAD_NDS_DEG, parseNdsDeg, resolveGeneratorNdsDeg } from '../../lib/infraPadEarthwork';
import { clampPlanSketchZoom, type PlanSketchPan } from '../../lib/planSketchViewport';
import { DimensionStepper } from './DimensionStepper';
import { ReferenceElevationDemMinButton } from './ReferenceElevationDemMinButton';
import { PlanGeneratorPanel } from './PlanGeneratorPanel';
import PlanPolygonEditor from './PlanPolygonEditor';
import { PlanRectangleEditor } from './PlanRectangleEditor';
import { PlanSketchToolbar } from './PlanSketchToolbar';
import { PlanViewToolbar } from './PlanViewToolbar';
import { PolygonSketchToolbar } from './PolygonSketchToolbar';
import { EnvelopeSection } from './EnvelopeSection';
import { EnvelopePlanLegend } from './EnvelopePlanLegend';
import { DemPlanLegend } from './DemPlanLegend';
import { formatElevationM } from '../../lib/padEarthworkDemPreview';
import { PadEarthworkScene3D, type PadEarthworkScene3DHandle } from './PadEarthworkScene3D';
import { PadScene3DToolbar } from './PadScene3DToolbar';
import { Scene3DLegend } from './Scene3DLegend';

export interface PadEarthworkSketchModalProps {
  projectId: string;
  objectId: string;
  readOnly: boolean;
  lengthM: string;
  widthM: string;
  heightM: string;
  rotationDeg: string;
  referenceElevationM: string;
  initialSketch?: PlanShapeSketch | null;
  initialWellsLocal?: PlanVertex[];
  initialEnvelope?: { enabled: boolean; wrap_width_m: number } | null;
  padWellCount?: string;
  setPadWellCount?: (value: string) => void;
  padWellsPerGroup?: string;
  setPadWellsPerGroup?: (value: string) => void;
  padWellSpacingM?: string;
  setPadWellSpacingM?: (value: string) => void;
  padGroupSpacingM?: string;
  setPadGroupSpacingM?: (value: string) => void;
  padMarginLeftM?: string;
  setPadMarginLeftM?: (value: string) => void;
  padMarginBottomM?: string;
  setPadMarginBottomM?: (value: string) => void;
  padMarginTopM?: string;
  setPadMarginTopM?: (value: string) => void;
  padMarginEndM?: string;
  setPadMarginEndM?: (value: string) => void;
  setRotationDeg?: (value: string) => void;
  onClose: () => void;
  onApplyToFields: (fields: {
    lengthM: string;
    widthM: string;
    rotationDeg: string;
    heightM: string;
    referenceElevationM: string;
  }) => void;
  onComputeSuccess: (result: PadEarthworkComputeResult) => void;
  onSaveSuccess?: () => void;
  onApplySandDemand: (fillM3: number) => void;
  demStatus?: PadDemStatus | null;
  terrainMode?: 'flat' | 'dem';
  /** Well-layout generator — only oil_pad / gas_pad. */
  showGenerator?: boolean;
}

type TabId = 'plan' | 'scene3d';

type GeneratorFields = {
  padWellCount: string;
  padWellsPerGroup: string;
  padWellSpacingM: string;
  padGroupSpacingM: string;
  padMarginLeftM: string;
  padMarginBottomM: string;
  padMarginTopM: string;
  padMarginEndM: string;
  rotationDeg: string;
};

function parseHeightRef(heightM: string, referenceElevationM: string) {
  const h = heightM.trim().replace(',', '.');
  const ref = referenceElevationM.trim().replace(',', '.');
  const height = h ? Number(h) : NaN;
  const reference = ref === '' ? 0 : Number(ref);
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(reference)) return null;
  return { height_m: height, reference_elevation_m: reference };
}

function initialSketchState(
  initialSketch: PlanShapeSketch | null | undefined,
  lengthM: string,
  widthM: string,
  rotationDeg: string,
): PlanShapeSketch {
  if (initialSketch) return initialSketch;
  return planFromFormFields(lengthM, widthM, rotationDeg) ?? createDefaultPlanSketch();
}

type GeneratorSnapshot = {
  sketch: PlanPolygonSketch;
  wellsLocal: PlanVertex[];
};

function cloneGeneratorSnapshot(sketch: PlanPolygonSketch, wellsLocal: PlanVertex[]): GeneratorSnapshot {
  return {
    sketch: {
      kind: 'plan_polygon',
      vertices: sketch.vertices.map((v) => ({ east_m: v.east_m, north_m: v.north_m })),
    },
    wellsLocal: wellsLocal.map((w) => ({ east_m: w.east_m, north_m: w.north_m })),
  };
}

export function PadEarthworkSketchModal({
  projectId,
  objectId,
  readOnly,
  lengthM,
  widthM,
  heightM,
  rotationDeg,
  referenceElevationM,
  initialSketch,
  initialWellsLocal,
  initialEnvelope,
  padWellCount = String(DEFAULT_PAD_WELL_COUNT),
  setPadWellCount,
  padWellsPerGroup = String(DEFAULT_PAD_WELLS_PER_GROUP),
  setPadWellsPerGroup,
  padWellSpacingM = String(DEFAULT_PAD_WELL_SPACING_M),
  setPadWellSpacingM,
  padGroupSpacingM = String(DEFAULT_PAD_GROUP_SPACING_M),
  setPadGroupSpacingM,
  padMarginLeftM = String(DEFAULT_PAD_MARGIN_LEFT_M),
  setPadMarginLeftM,
  padMarginBottomM = String(DEFAULT_PAD_MARGIN_BOTTOM_M),
  setPadMarginBottomM,
  padMarginTopM = String(DEFAULT_PAD_MARGIN_TOP_M),
  setPadMarginTopM,
  padMarginEndM = String(DEFAULT_PAD_MARGIN_END_M),
  setPadMarginEndM,
  setRotationDeg,
  onClose,
  onApplyToFields,
  onComputeSuccess,
  onSaveSuccess,
  onApplySandDemand,
  demStatus = null,
  terrainMode = 'flat',
  showGenerator = true,
}: PadEarthworkSketchModalProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>('plan');
  const [shapeMode, setShapeMode] = useState<ShapeMode>(() =>
    resolveInitialShapeMode(showGenerator, initialSketch),
  );
  const [rectTool, setRectTool] = useState<PlanEditTool>('corners');
  const [polygonTool, setPolygonTool] = useState<PolygonEditTool>('vertices');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showEdgeLengths, setShowEdgeLengths] = useState(true);
  const [lockAspect, setLockAspect] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [viewPan, setViewPan] = useState<PlanSketchPan>({ east_m: 0, north_m: 0 });
  const [fitViewNonce, setFitViewNonce] = useState(0);
  const [sketch, setSketch] = useState<PlanShapeSketch>(() =>
    initialSketchState(initialSketch, lengthM, widthM, rotationDeg),
  );
  const [localHeight, setLocalHeight] = useState(heightM);
  const [localRef, setLocalRef] = useState(referenceElevationM);
  const [result, setResult] = useState<PadEarthworkComputeResult | null>(null);
  const [sandDemandApplied, setSandDemandApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sketchDirty, setSketchDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [envelopeEnabled, setEnvelopeEnabled] = useState(() => initialEnvelope?.enabled ?? false);
  const [wrapWidthM, setWrapWidthM] = useState(
    () => initialEnvelope?.wrap_width_m ?? DEFAULT_ENVELOPE_WRAP_WIDTH_M,
  );
  const [wellsLocal, setWellsLocal] = useState<PlanVertex[]>(() =>
    showGenerator ? (initialWellsLocal ?? []) : [],
  );
  const generatorSnapshotRef = useRef<GeneratorSnapshot | null>(
    showGenerator &&
      initialSketch &&
      isPlanPolygon(initialSketch) &&
      (initialWellsLocal?.length ?? 0) > 0
      ? cloneGeneratorSnapshot(initialSketch, initialWellsLocal ?? [])
      : null,
  );
  const [generatorFields, setGeneratorFields] = useState<GeneratorFields>(() => ({
    padWellCount,
    padWellsPerGroup,
    padWellSpacingM,
    padGroupSpacingM,
    padMarginLeftM,
    padMarginBottomM,
    padMarginTopM,
    padMarginEndM,
    rotationDeg: resolveGeneratorNdsDeg(rotationDeg, (initialWellsLocal?.length ?? 0) > 0),
  }));
  const [localDemAssetId, setLocalDemAssetId] = useState<string | null>(demStatus?.asset_id ?? null);
  const [showDemOverlay, setShowDemOverlay] = useState(
    () => terrainMode === 'dem' && Boolean(demStatus?.asset_id),
  );
  const [debouncedPreviewKey, setDebouncedPreviewKey] = useState('');
  const scene3dRef = useRef<PadEarthworkScene3DHandle>(null);
  const [scene3dZoomPercent, setScene3dZoomPercent] = useState(100);

  useEffect(() => {
    if (demStatus?.asset_id) setLocalDemAssetId(demStatus.asset_id);
  }, [demStatus?.asset_id]);

  useEffect(() => {
    setSandDemandApplied(false);
  }, [result?.volumes.fill_m3]);

  const demAvailable = Boolean(localDemAssetId);
  const heightRefForPreview = parseHeightRef(localHeight, localRef);
  const previewRequestKey = useMemo(
    () =>
      JSON.stringify({
        sketch: sketchToApiPayload(sketch),
        params: heightRefForPreview,
      }),
    [sketch, heightRefForPreview],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedPreviewKey(previewRequestKey), 400);
    return () => window.clearTimeout(timer);
  }, [previewRequestKey]);

  const previewRequestBody = useMemo(() => {
    try {
      return JSON.parse(debouncedPreviewKey) as {
        sketch: ReturnType<typeof sketchToApiPayload>;
        params: { height_m: number; reference_elevation_m: number } | null;
      };
    } catch {
      return null;
    }
  }, [debouncedPreviewKey]);

  const demPreviewQuery = useQuery({
    queryKey: ['padDemPreview', projectId, objectId, debouncedPreviewKey, localDemAssetId],
    queryFn: () =>
      padEarthworkApi.fetchDemPreview(projectId, objectId, {
        sketch: previewRequestBody?.sketch,
        params: previewRequestBody?.params ?? undefined,
      }),
    enabled:
      demAvailable &&
      Boolean(previewRequestBody?.params) &&
      debouncedPreviewKey.length > 0 &&
      ((tab === 'plan' && showDemOverlay) || tab === 'scene3d'),
    staleTime: 30_000,
    retry: false,
  });

  const fetchDemMutation = useMutation({
    mutationFn: async () => {
      const params = heightRefForPreview;
      if (!params) throw new Error('Укажите высоту насыпи и опорную отметку');
      return padEarthworkApi.fetchDem(projectId, objectId, {
        sketch: sketchToApiPayload(sketch),
        params,
      });
    },
    onSuccess: (data) => {
      setLocalDemAssetId(data.dem_asset_id);
      setLocalRef(String(data.reference_elevation_m));
      setShowDemOverlay(true);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['padEarthworkLast', projectId, objectId] });
      void queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['padDemPreview', projectId, objectId] });
    },
    onError: (err: Error) => setError(err.message || 'Ошибка загрузки DEM'),
  });

  const demToolbarProps = {
    showDemOverlay,
    onShowDemOverlayChange: setShowDemOverlay,
    demAvailable,
    onFetchDem: () => fetchDemMutation.mutate(),
    fetchDemPending: fetchDemMutation.isPending,
    readOnly,
  };

  const demPreviewData =
    tab === 'scene3d'
      ? demAvailable
        ? demPreviewQuery.data ?? null
        : null
      : showDemOverlay
        ? demPreviewQuery.data ?? null
        : null;
  const demPreviewLoading =
    (tab === 'scene3d' || showDemOverlay) &&
    (demPreviewQuery.isFetching || debouncedPreviewKey !== previewRequestKey);

  const patchGeneratorField = useCallback(
    <K extends keyof GeneratorFields>(key: K, value: GeneratorFields[K]) => {
      setGeneratorFields((prev) => ({ ...prev, [key]: value }));
      switch (key) {
        case 'padWellCount':
          setPadWellCount?.(value);
          break;
        case 'padWellsPerGroup':
          setPadWellsPerGroup?.(value);
          break;
        case 'padWellSpacingM':
          setPadWellSpacingM?.(value);
          break;
        case 'padGroupSpacingM':
          setPadGroupSpacingM?.(value);
          break;
        case 'padMarginLeftM':
          setPadMarginLeftM?.(value);
          break;
        case 'padMarginBottomM':
          setPadMarginBottomM?.(value);
          break;
        case 'padMarginTopM':
          setPadMarginTopM?.(value);
          break;
        case 'padMarginEndM':
          setPadMarginEndM?.(value);
          break;
        case 'rotationDeg':
          setRotationDeg?.(value);
          break;
      }
    },
    [
      setPadWellCount,
      setPadWellsPerGroup,
      setPadWellSpacingM,
      setPadGroupSpacingM,
      setPadMarginLeftM,
      setPadMarginBottomM,
      setPadMarginTopM,
      setPadMarginEndM,
      setRotationDeg,
    ],
  );

  const updateSketch = useCallback((next: PlanShapeSketch | ((prev: PlanShapeSketch) => PlanShapeSketch)) => {
    setSketchDirty(true);
    setSaveMessage(null);
    setSketch(next);
  }, []);

  const rectangleSketch: PlanRectangleSketch = useMemo(() => {
    if (isPlanRectangle(sketch)) return sketch;
    return polygonToRectangle(sketch);
  }, [sketch]);

  const polygonSketch: PlanPolygonSketch = useMemo(() => {
    if (isPlanPolygon(sketch)) return sketch;
    return rectangleToPolygon(sketch);
  }, [sketch]);

  useEffect(() => {
    const fromForm = planFromFormFields(lengthM, widthM, rotationDeg);
    if (fromForm && shapeMode === 'rectangle' && !sketchDirty && wellsLocal.length === 0) {
      setSketch(fromForm);
    }
    setLocalHeight(heightM);
    setLocalRef(referenceElevationM);
  }, [lengthM, widthM, heightM, rotationDeg, referenceElevationM, shapeMode, sketchDirty, wellsLocal.length]);

  useEffect(() => {
    setWellsLocal(initialWellsLocal ?? []);
  }, [initialWellsLocal]);

  useEffect(() => {
    if (initialSketch) {
      setSketch(initialSketch);
      setSketchDirty(false);
      if (isPlanPolygon(initialSketch) && (initialWellsLocal?.length ?? 0) > 0) {
        generatorSnapshotRef.current = cloneGeneratorSnapshot(initialSketch, initialWellsLocal ?? []);
      }
    }
  }, [initialSketch, initialWellsLocal]);

  useEffect(() => {
    if (initialEnvelope) {
      setEnvelopeEnabled(initialEnvelope.enabled);
      setWrapWidthM(initialEnvelope.wrap_width_m);
    }
  }, [initialEnvelope]);

  const syncCardFields = useCallback(() => {
    const bbox = isPlanPolygon(sketch) ? polygonBoundingBox(sketch.vertices) : null;
    const rotDeg = showGenerator
      ? parseNdsDeg(generatorFields.rotationDeg)
      : isPlanRectangle(sketch)
        ? sketch.rotation_deg
        : (bbox?.rotation_deg ?? parseNdsDeg(rotationDeg));
    onApplyToFields({
      lengthM: String(bbox?.length_m ?? rectangleSketch.length_m),
      widthM: String(bbox?.width_m ?? rectangleSketch.width_m),
      rotationDeg: String(rotDeg),
      heightM: localHeight,
      referenceElevationM: localRef,
    });
  }, [
    sketch,
    rectangleSketch,
    showGenerator,
    generatorFields.rotationDeg,
    rotationDeg,
    localHeight,
    localRef,
    onApplyToFields,
  ]);

  const buildTerrain = useCallback((): PadTerrainMode => {
    if (localDemAssetId) {
      return { mode: 'dem', dem_asset_id: localDemAssetId };
    }
    return { mode: 'flat' };
  }, [localDemAssetId]);

  const computeMutation = useMutation({
    mutationFn: async () => {
      const heightRef = parseHeightRef(localHeight, localRef);
      if (!heightRef) throw new Error('Укажите высоту насыпи и опорную отметку');
      if (isPlanPolygon(sketch) && !isPolygonSketchClosed(sketch)) {
        throw new Error('Добавьте минимум 3 вершины для расчёта полигона');
      }
      return padEarthworkApi.compute(projectId, objectId, {
        sketch: sketchToApiPayload(sketch),
        params: heightRef,
        envelope: envelopeEnabled
          ? { enabled: true, wrap_width_m: wrapWidthM }
          : undefined,
        terrain: buildTerrain(),
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      onComputeSuccess(data);
    },
    onError: (err: Error) => setError(err.message || 'Ошибка расчёта'),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const heightRef = parseHeightRef(localHeight, localRef);
      if (!heightRef) throw new Error('Укажите высоту насыпи и опорную отметку');
      if (isPlanPolygon(sketch) && !isPolygonSketchClosed(sketch)) {
        throw new Error('Добавьте минимум 3 вершины для сохранения полигона');
      }
      return padEarthworkApi.saveSketch(projectId, objectId, {
        sketch: sketchToApiPayload(sketch),
        params: heightRef,
        envelope: envelopeEnabled
          ? { enabled: true, wrap_width_m: wrapWidthM }
          : { enabled: false, wrap_width_m: wrapWidthM },
        wells_local: showGenerator && wellsLocal.length > 0 ? wellsLocal : undefined,
        rotation_deg: showGenerator
          ? parseNdsDeg(generatorFields.rotationDeg)
          : isPlanRectangle(sketch)
            ? sketch.rotation_deg
            : parseNdsDeg(rotationDeg),
      });
    },
    onSuccess: () => {
      setSketchDirty(false);
      setSaveMessage('Схема сохранена. Объёмы обновляются только по кнопке «Рассчитать».');
      setError(null);
      syncCardFields();
      void queryClient.invalidateQueries({ queryKey: ['padEarthworkLast', projectId, objectId] });
      void queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
      onSaveSuccess?.();
    },
    onError: (err: Error) => setError(err.message || 'Ошибка сохранения'),
  });

  const buildGenerateBody = useCallback(() => {
    const fields = padWellFieldsFromForm({
      padWellCount: generatorFields.padWellCount,
      padWellsPerGroup: generatorFields.padWellsPerGroup,
      padWellSpacingM: generatorFields.padWellSpacingM,
      padGroupSpacingM: generatorFields.padGroupSpacingM,
      padMarginLeftM: generatorFields.padMarginLeftM,
      padMarginBottomM: generatorFields.padMarginBottomM,
      padMarginTopM: generatorFields.padMarginTopM,
      padMarginEndM: generatorFields.padMarginEndM,
    });
    const rotRaw = generatorFields.rotationDeg.trim().replace(',', '.');
    const rotation = rotRaw === '' ? DEFAULT_PAD_NDS_DEG : Number(rotRaw);
    return {
      well_count: fields.wellCount,
      wells_per_group: fields.wellsPerGroup,
      well_spacing_m: fields.wellSpacingM,
      group_spacing_m: fields.groupSpacingM,
      margins: {
        left_m: fields.leftM,
        bottom_m: fields.bottomM,
        top_m: fields.topM,
        end_m: fields.endM,
      },
      rotation_deg: Number.isFinite(rotation) ? clampNdsDeg(rotation) : DEFAULT_PAD_NDS_DEG,
    };
  }, [generatorFields]);

  const generateMutation = useMutation({
    mutationFn: async () => padEarthworkApi.generateSketch(projectId, objectId, buildGenerateBody()),
    onSuccess: (data) => {
      setSketch(data.sketch);
      setWellsLocal(data.wells_local);
      generatorSnapshotRef.current = cloneGeneratorSnapshot(data.sketch, data.wells_local);
      setSketchDirty(true);
      setSaveMessage(null);
      setResult(null);
      setError(null);
      onApplyToFields({
        lengthM: String(data.length_m),
        widthM: String(data.width_m),
        rotationDeg: String(data.rotation_deg),
        heightM: localHeight,
        referenceElevationM: localRef,
      });
      setGeneratorFields((prev) => ({ ...prev, rotationDeg: String(data.rotation_deg) }));
      setFitViewNonce((n) => n + 1);
    },
    onError: (err: Error) => setError(err.message || 'Ошибка автогенерации'),
  });

  const handleShapeModeChange = (mode: ShapeMode) => {
    if (mode === shapeMode) return;
    if (mode === 'generator' && !showGenerator) return;

    if (showGenerator && shapeMode === 'generator' && isPlanPolygon(sketch) && wellsLocal.length > 0) {
      generatorSnapshotRef.current = cloneGeneratorSnapshot(polygonSketch, wellsLocal);
    }
    if (
      shapeMode === 'polygon' &&
      mode === 'generator' &&
      isPlanPolygon(sketch) &&
      wellsLocal.length > 0 &&
      sketchDirty
    ) {
      generatorSnapshotRef.current = cloneGeneratorSnapshot(polygonSketch, wellsLocal);
    }

    setShapeMode(mode);
    setResult(null);
    setError(null);

    if (mode === 'generator') {
      const snap = generatorSnapshotRef.current;
      if (snap && wellsLocal.length > 0) {
        setSketch(snap.sketch);
        setWellsLocal(snap.wellsLocal);
      }
      return;
    }

    if (mode === 'polygon') {
      setSketch(isPlanPolygon(sketch) ? sketch : rectangleToPolygon(rectangleSketch));
      setPolygonTool(isPlanPolygon(sketch) && sketch.vertices.length === 0 ? 'draw' : 'vertices');
    } else {
      if (isPlanPolygon(sketch) && wellsLocal.length > 0 && !generatorSnapshotRef.current) {
        generatorSnapshotRef.current = cloneGeneratorSnapshot(polygonSketch, wellsLocal);
      }
      setSketch(isPlanRectangle(sketch) ? sketch : polygonToRectangle(polygonSketch));
    }
  };

  const handleApplyToFields = () => {
    syncCardFields();
  };

  const handleResetSketch = () => {
    if (shapeMode === 'generator') {
      setSketch(createEmptyPolygonSketch());
      setWellsLocal([]);
      generatorSnapshotRef.current = null;
    } else if (shapeMode === 'polygon') {
      setSketch(createDefaultPolygonSketch());
      setPolygonTool('vertices');
    } else {
      setSketch(createDefaultPlanSketch());
    }
    setZoom(1);
    setViewPan({ east_m: 0, north_m: 0 });
    setFitViewNonce((n) => n + 1);
    setResult(null);
    setError(null);
  };

  const handleFitView = () => {
    setZoom(1);
    setViewPan({ east_m: 0, north_m: 0 });
    setFitViewNonce((n) => n + 1);
  };

  const handleClearPolygon = () => {
    setSketch(createEmptyPolygonSketch());
    setPolygonTool('draw');
    setResult(null);
    setError(null);
  };

  const fillM3 = result?.volumes.fill_m3;

  const areaTop = sketchFootprintAreaM2(sketch);
  const heightNum = Number(localHeight.replace(',', '.'));
  const polygonClosed = isPlanPolygon(sketch) && isPolygonSketchClosed(sketch);
  const canCompute = shapeMode === 'rectangle' || polygonClosed;
  const envelopeParams =
    envelopeEnabled && wrapWidthM > 0 ? { enabled: true as const, wrap_width_m: wrapWidthM } : null;
  const envelopeActive = envelopeParams != null && canCompute;
  const bermPerimeterM = envelopeActive
    ? polygonPerimeterM(shapeVerticesForEnvelope(sketch))
    : null;
  const estimatedFill = envelopeActive
    ? estimateEnvelopeFillM3(sketch, heightNum, wrapWidthM)
    : estimateFillM3(sketch, heightNum);

  return (
    <AppModal
      title="Схема площадки"
      subtitle={
        tab === 'scene3d'
          ? 'Объём — площадка на рельефе DEM'
          : 'План (вид сверху) — прямоугольник или произвольный контур'
      }
      onClose={onClose}
      size="lg"
      overlayClassName="app-modal-overlay--pad-earthwork-sketch"
      footer={
        !readOnly ? (
          <div className="pad-earthwork-sketch-modal__footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Закрыть
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleApplyToFields}>
              Применить к полям
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={saveMutation.isPending || computeMutation.isPending || !canCompute}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'Сохранение…' : 'Сохранить'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={computeMutation.isPending || saveMutation.isPending || !canCompute}
              onClick={() => computeMutation.mutate()}
            >
              {computeMutation.isPending ? 'Расчёт…' : 'Рассчитать'}
            </button>
            {fillM3 != null && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={sandDemandApplied}
                onClick={() => {
                  onApplySandDemand(fillM3);
                  setSandDemandApplied(true);
                }}
              >
                {sandDemandApplied
                  ? 'Принято'
                  : `Применить ${fillM3.toLocaleString('ru-RU')} м³ к песку`}
              </button>
            )}
          </div>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Закрыть
          </button>
        )
      }
    >
      <div className="pad-earthwork-sketch-modal">
        <div className="pad-earthwork-sketch-modal__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'plan'}
            className={`pad-earthwork-sketch-modal__tab${tab === 'plan' ? ' pad-earthwork-sketch-modal__tab--active' : ''}`}
            onClick={() => setTab('plan')}
          >
            План
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'scene3d'}
            className={`pad-earthwork-sketch-modal__tab${tab === 'scene3d' ? ' pad-earthwork-sketch-modal__tab--active' : ''}`}
            onClick={() => setTab('scene3d')}
          >
            3D
          </button>
        </div>

        {tab === 'plan' && (
          <>
            <div className="pad-earthwork-sketch-modal__shape-toggle" role="group" aria-label="Тип контура">
              {showGenerator && (
                <button
                  type="button"
                  className={`pad-earthwork-sketch-modal__shape-btn${shapeMode === 'generator' ? ' pad-earthwork-sketch-modal__shape-btn--active' : ''}`}
                  disabled={readOnly}
                  onClick={() => handleShapeModeChange('generator')}
                >
                  <Sparkles size={16} aria-hidden />
                  Генератор
                </button>
              )}
              <button
                type="button"
                className={`pad-earthwork-sketch-modal__shape-btn${shapeMode === 'polygon' ? ' pad-earthwork-sketch-modal__shape-btn--active' : ''}`}
                disabled={readOnly}
                onClick={() => handleShapeModeChange('polygon')}
              >
                <Shapes size={16} aria-hidden />
                Произвольная
              </button>
              <button
                type="button"
                className={`pad-earthwork-sketch-modal__shape-btn${shapeMode === 'rectangle' ? ' pad-earthwork-sketch-modal__shape-btn--active' : ''}`}
                disabled={readOnly}
                onClick={() => handleShapeModeChange('rectangle')}
              >
                <Square size={16} aria-hidden />
                Прямоугольник
              </button>
            </div>

            {shapeMode === 'rectangle' ? (
              <PlanSketchToolbar
                tool={rectTool}
                onToolChange={setRectTool}
                snapEnabled={snapEnabled}
                onSnapChange={setSnapEnabled}
                lockAspect={lockAspect}
                onLockAspectChange={setLockAspect}
                showEdgeLengths={showEdgeLengths}
                onShowEdgeLengthsChange={setShowEdgeLengths}
                zoom={zoom}
                onZoomIn={() => setZoom((z) => clampPlanSketchZoom(z + 0.25))}
                onZoomOut={() => setZoom((z) => clampPlanSketchZoom(z - 0.25))}
                onFitView={handleFitView}
                readOnly={readOnly}
                {...demToolbarProps}
              />
            ) : shapeMode === 'polygon' ? (
              <PolygonSketchToolbar
                tool={polygonTool}
                onToolChange={setPolygonTool}
                snapEnabled={snapEnabled}
                onSnapChange={setSnapEnabled}
                showEdgeLengths={showEdgeLengths}
                onShowEdgeLengthsChange={setShowEdgeLengths}
                vertexCount={polygonSketch.vertices.length}
                closed={polygonClosed}
                zoom={zoom}
                onZoomIn={() => setZoom((z) => clampPlanSketchZoom(z + 0.25))}
                onZoomOut={() => setZoom((z) => clampPlanSketchZoom(z - 0.25))}
                onFitView={handleFitView}
                readOnly={readOnly}
                {...demToolbarProps}
              />
            ) : (
              <PlanViewToolbar
                snapEnabled={snapEnabled}
                onSnapChange={setSnapEnabled}
                showEdgeLengths={showEdgeLengths}
                onShowEdgeLengthsChange={setShowEdgeLengths}
                zoom={zoom}
                onZoomIn={() => setZoom((z) => clampPlanSketchZoom(z + 0.25))}
                onZoomOut={() => setZoom((z) => clampPlanSketchZoom(z - 0.25))}
                onFitView={handleFitView}
                meta={
                  polygonClosed
                    ? showGenerator
                      ? `${polygonSketch.vertices.length} верш. · ${wellsLocal.length} скв.`
                      : `${polygonSketch.vertices.length} верш.`
                    : showGenerator
                      ? 'Нажмите «Сгенерировать» для предпросмотра'
                      : 'Добавьте вершины контура'
                }
                {...demToolbarProps}
              />
            )}

            {shapeMode === 'rectangle' && (
              <p className="object-detail-panel__hint text-xs pad-earthwork-sketch-modal__shape-hint">
                Углы меняют размер от центра. Для произвольной формы переключите «Произвольная» или
                нажмите «Разбить в полигон».
              </p>
            )}

            {shapeMode === 'rectangle' && (
              <div className="pad-earthwork-sketch-modal__presets">
                <span className="pad-earthwork-sketch-modal__presets-label">Типовые размеры:</span>
                {PAD_SIZE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="pad-earthwork-sketch-modal__preset-chip"
                    disabled={readOnly}
                    onClick={() =>
                      updateSketch({
                        kind: 'plan_rectangle',
                        length_m: p.length_m,
                        width_m: p.width_m,
                        rotation_deg: rectangleSketch.rotation_deg,
                      })
                    }
                  >
                    {p.label} м
                  </button>
                ))}
                {!readOnly && (
                  <>
                    <button
                      type="button"
                      className="pad-earthwork-sketch-modal__preset-chip"
                      onClick={() => {
                        setShapeMode('polygon');
                        updateSketch(rectangleToPolygon(rectangleSketch));
                        setPolygonTool('vertices');
                      }}
                    >
                      Разбить в полигон
                    </button>
                    <button
                      type="button"
                      className="pad-earthwork-sketch-modal__preset-chip pad-earthwork-sketch-modal__preset-chip--ghost"
                      title="Сбросить к 120×80 м"
                      onClick={handleResetSketch}
                    >
                      <RotateCcw size={14} aria-hidden />
                      Сброс
                    </button>
                  </>
                )}
              </div>
            )}

            {shapeMode === 'polygon' && !readOnly && (
              <div className="pad-earthwork-sketch-modal__presets">
                <span className="pad-earthwork-sketch-modal__presets-label">Контур:</span>
                <button
                  type="button"
                  className="pad-earthwork-sketch-modal__preset-chip"
                  onClick={() => {
                    updateSketch(rectangleToPolygon(rectangleSketch));
                    setPolygonTool('vertices');
                  }}
                >
                  Из прямоугольника
                </button>
                <button
                  type="button"
                  className="pad-earthwork-sketch-modal__preset-chip pad-earthwork-sketch-modal__preset-chip--ghost"
                  onClick={handleClearPolygon}
                >
                  Очистить
                </button>
                <button
                  type="button"
                  className="pad-earthwork-sketch-modal__preset-chip pad-earthwork-sketch-modal__preset-chip--ghost"
                  onClick={handleResetSketch}
                >
                  <RotateCcw size={14} aria-hidden />
                  Сброс
                </button>
              </div>
            )}

            <div
              className={`pad-earthwork-sketch-modal__layout${
                shapeMode === 'generator' ? ' pad-earthwork-sketch-modal__layout--generator' : ''
              }`}
            >
              <div className="pad-earthwork-sketch-modal__canvas-col">
                {shapeMode === 'rectangle' ? (
                  <PlanRectangleEditor
                    sketch={rectangleSketch}
                    onChange={updateSketch}
                    tool={rectTool}
                    snapEnabled={snapEnabled}
                    lockAspect={lockAspect}
                    zoom={zoom}
                    onZoomChange={setZoom}
                    viewPan={viewPan}
                    onViewPanChange={setViewPan}
                    fitViewNonce={fitViewNonce}
                    readOnly={readOnly}
                    envelope={envelopeParams}
                    showEdgeLengths={showEdgeLengths}
                    showDemOverlay={showDemOverlay}
                    demPreview={demPreviewData}
                    demPreviewLoading={demPreviewLoading}
                  />
                ) : (
                  <PlanPolygonEditor
                    sketch={polygonSketch}
                    onChange={updateSketch}
                    tool={polygonTool}
                    snapEnabled={snapEnabled}
                    zoom={zoom}
                    onZoomChange={setZoom}
                    viewPan={viewPan}
                    onViewPanChange={setViewPan}
                    fitViewNonce={fitViewNonce}
                    readOnly={readOnly || shapeMode === 'generator'}
                    envelope={envelopeParams}
                    showEdgeLengths={showEdgeLengths}
                    wellsLocal={showGenerator ? wellsLocal : []}
                    showDemOverlay={showDemOverlay}
                    demPreview={demPreviewData}
                    demPreviewLoading={demPreviewLoading}
                  />
                )}
              </div>

              <aside className="pad-earthwork-sketch-modal__sidebar">
                {showGenerator &&
                  shapeMode === 'generator' &&
                  setPadWellCount &&
                  setPadWellsPerGroup &&
                  setPadWellSpacingM &&
                  setPadGroupSpacingM &&
                  setPadMarginLeftM &&
                  setPadMarginBottomM &&
                  setPadMarginTopM &&
                  setPadMarginEndM &&
                  setRotationDeg && (
                    <PlanGeneratorPanel
                      readOnly={readOnly}
                      padWellCount={generatorFields.padWellCount}
                      setPadWellCount={(value) => patchGeneratorField('padWellCount', value)}
                      padWellsPerGroup={generatorFields.padWellsPerGroup}
                      setPadWellsPerGroup={(value) => patchGeneratorField('padWellsPerGroup', value)}
                      padWellSpacingM={generatorFields.padWellSpacingM}
                      setPadWellSpacingM={(value) => patchGeneratorField('padWellSpacingM', value)}
                      padGroupSpacingM={generatorFields.padGroupSpacingM}
                      setPadGroupSpacingM={(value) => patchGeneratorField('padGroupSpacingM', value)}
                      padMarginLeftM={generatorFields.padMarginLeftM}
                      setPadMarginLeftM={(value) => patchGeneratorField('padMarginLeftM', value)}
                      padMarginBottomM={generatorFields.padMarginBottomM}
                      setPadMarginBottomM={(value) => patchGeneratorField('padMarginBottomM', value)}
                      padMarginTopM={generatorFields.padMarginTopM}
                      setPadMarginTopM={(value) => patchGeneratorField('padMarginTopM', value)}
                      padMarginEndM={generatorFields.padMarginEndM}
                      setPadMarginEndM={(value) => patchGeneratorField('padMarginEndM', value)}
                      rotationDeg={generatorFields.rotationDeg}
                      setRotationDeg={(value) => patchGeneratorField('rotationDeg', value)}
                      generating={generateMutation.isPending}
                      onGenerate={() => generateMutation.mutate()}
                      hasPreview={polygonClosed}
                      wellCountOnCanvas={wellsLocal.length}
                    />
                  )}

                <div className="pad-earthwork-sketch-modal__stats">
                  <div className="pad-earthwork-sketch-modal__stat-card">
                    <span className="pad-earthwork-sketch-modal__stat-label">
                      {envelopeActive ? 'Площадь площадки' : 'Площадь'}
                    </span>
                    <strong>{areaTop.toLocaleString('ru-RU')} м²</strong>
                  </div>
                  {envelopeActive && bermPerimeterM != null && (
                    <div className="pad-earthwork-sketch-modal__stat-card">
                      <span className="pad-earthwork-sketch-modal__stat-label">Периметр обваловки</span>
                      <strong>
                        {bermPerimeterM.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} м
                      </strong>
                    </div>
                  )}
                  {envelopeActive && (
                    <p className="object-detail-panel__hint text-xs pad-earthwork-sketch-modal__stats-hint">
                      Кольцо на верху насыпи: подошва W, бровка на H = (W−TW)/2, TW = W/3.
                    </p>
                  )}
                  {estimatedFill != null && canCompute && (
                    <div className="pad-earthwork-sketch-modal__stat-card pad-earthwork-sketch-modal__stat-card--accent">
                      <span className="pad-earthwork-sketch-modal__stat-label">
                        {envelopeActive ? 'Оценка отсыпки (обваловка)' : 'Оценка отсыпки'}
                      </span>
                      <strong>{estimatedFill.toLocaleString('ru-RU')} м³</strong>
                    </div>
                  )}
                </div>

                {showDemOverlay && demPreviewData && (
                  <div className="pad-earthwork-sketch-modal__section">
                    <h3 className="pad-earthwork-sketch-modal__section-title">Рельеф DEM</h3>
                    <DemPlanLegend preview={demPreviewData} />
                  </div>
                )}

                {shapeMode === 'rectangle' ? (
                  <div className="pad-earthwork-sketch-modal__section">
                    <h3 className="pad-earthwork-sketch-modal__section-title">Габариты</h3>
                    <DimensionStepper
                      label="Длина"
                      value={rectangleSketch.length_m}
                      step={snapEnabled ? 1 : 0.5}
                      readOnly={readOnly}
                      onChange={(n) => updateSketch({ ...rectangleSketch, length_m: n })}
                    />
                    <DimensionStepper
                      label="Ширина"
                      value={rectangleSketch.width_m}
                      step={snapEnabled ? 1 : 0.5}
                      readOnly={readOnly}
                      onChange={(n) => updateSketch({ ...rectangleSketch, width_m: n })}
                    />
                    <DimensionStepper
                      label="Поворот"
                      value={rectangleSketch.rotation_deg}
                      unit="°"
                      step={snapEnabled ? 5 : 1}
                      min={-180}
                      max={180}
                      decimals={0}
                      readOnly={readOnly}
                      onChange={(n) => updateSketch({ ...rectangleSketch, rotation_deg: n })}
                    />
                  </div>
                ) : shapeMode === 'polygon' ? (
                  <div className="pad-earthwork-sketch-modal__section">
                    <h3 className="pad-earthwork-sketch-modal__section-title">Контур</h3>
                    <p className="object-detail-panel__hint text-xs">
                      Вершин: <strong>{polygonSketch.vertices.length}</strong>
                      {polygonClosed && (
                        <>
                          {' '}
                          · периметр{' '}
                          <strong>
                            {polygonPerimeterM(polygonSketch.vertices).toLocaleString('ru-RU', {
                              maximumFractionDigits: 0,
                            })}{' '}
                            м
                          </strong>
                        </>
                      )}
                    </p>
                    {polygonClosed && (
                      <>
                        <DimensionStepper
                          label="Охват L (bbox)"
                          value={polygonBoundingBox(polygonSketch.vertices).length_m}
                          step={0.5}
                          readOnly
                          onChange={() => {}}
                        />
                        <DimensionStepper
                          label="Охват W (bbox)"
                          value={polygonBoundingBox(polygonSketch.vertices).width_m}
                          step={0.5}
                          readOnly
                          onChange={() => {}}
                        />
                      </>
                    )}
                  </div>
                ) : null}

                <EnvelopeSection
                  envelopeEnabled={envelopeEnabled}
                  onEnvelopeEnabledChange={setEnvelopeEnabled}
                  wrapWidthM={wrapWidthM}
                  onWrapWidthMChange={setWrapWidthM}
                  readOnly={readOnly}
                  disabled={!canCompute}
                  snapEnabled={snapEnabled}
                />

                {envelopeActive && <EnvelopePlanLegend />}

                <div className="pad-earthwork-sketch-modal__section">
                  <h3 className="pad-earthwork-sketch-modal__section-title">Высота и отметка</h3>
                  <DimensionStepper
                    label="Высота насыпи"
                    value={Number(localHeight) || 0}
                    step={0.1}
                    min={0.1}
                    max={20}
                    readOnly={readOnly}
                    onChange={(n) => setLocalHeight(n.toFixed(2))}
                  />
                  <DimensionStepper
                    label="Опорная отметка"
                    value={Number(localRef) || 0}
                    step={0.1}
                    min={-500}
                    max={5000}
                    readOnly={readOnly}
                    onChange={(n) => {
                      setLocalRef(n.toFixed(2));
                      setResult(null);
                    }}
                    trailingAction={
                      <ReferenceElevationDemMinButton
                        projectId={projectId}
                        objectId={objectId}
                        sketch={sketchToApiPayload(sketch)}
                        params={heightRefForPreview}
                        demAvailable={demAvailable}
                        readOnly={readOnly}
                        preview={
                          demPreviewData && debouncedPreviewKey === previewRequestKey
                            ? demPreviewData
                            : null
                        }
                        onApply={(n) => {
                          setLocalRef(n.toFixed(2));
                          setResult(null);
                        }}
                        onError={(msg) => setError(msg)}
                      />
                    }
                  />
                </div>

                {result && (
                  <div className="pad-earthwork-sketch-modal__section pad-earthwork-sketch-modal__result">
                    <h3 className="pad-earthwork-sketch-modal__section-title">Результат расчёта</h3>
                    <p>
                      Отсыпка: <strong>{result.volumes.fill_m3.toLocaleString('ru-RU')}</strong> м³
                    </p>
                    <p>
                      Выемка: <strong>{result.volumes.cut_m3.toLocaleString('ru-RU')}</strong> м³
                    </p>
                    <p className="object-detail-panel__hint text-xs">
                      Отсыпка и выемка считаются независимо: изъятый грунт не идёт в насыпь.
                    </p>
                    <p className="object-detail-panel__hint text-xs">
                      Верх площадки: {result.design.top_elevation_m} м
                      {demAvailable ? ' · по DEM' : ' · плоская опорная'}
                    </p>
                    {result.warnings?.includes('envelope_volume_is_truncated_pyramid_approximation') && (
                      <p className="object-detail-panel__hint text-xs">
                        Серверный объём — упрощённая усечённая пирамида (legacy planner). Оценка
                        обваловки в sidebar — кольцо по периметру (вариант A).
                      </p>
                    )}
                    {result.warnings?.includes('polygon_mesh_is_bbox_approximation') && (
                      <p className="object-detail-panel__hint text-xs">
                        3D-модель — упрощённый bounding box; объём по площади контура.
                      </p>
                    )}
                  </div>
                )}
                {error && (
                  <p className="object-detail-panel__hint text-red-600 text-xs">{error}</p>
                )}
                {saveMessage && (
                  <p className="object-detail-panel__hint text-xs">{saveMessage}</p>
                )}
              </aside>
            </div>
          </>
        )}

        {tab === 'scene3d' && (
          <>
            <PadScene3DToolbar
              zoomPercent={scene3dZoomPercent}
              onZoomIn={() => scene3dRef.current?.zoomIn()}
              onZoomOut={() => scene3dRef.current?.zoomOut()}
              onFitView={() => scene3dRef.current?.fitView()}
              onCameraPreset={(preset) => scene3dRef.current?.setCameraPreset(preset)}
              onOrbitLeft={() => scene3dRef.current?.orbitLeft()}
              onOrbitRight={() => scene3dRef.current?.orbitRight()}
              onTiltUp={() => scene3dRef.current?.tiltUp()}
              onTiltDown={() => scene3dRef.current?.tiltDown()}
            />
            <div className="pad-earthwork-sketch-modal__layout pad-earthwork-sketch-modal__layout--scene3d">
              <PadEarthworkScene3D
                ref={scene3dRef}
                sketch={sketch}
                referenceElevationM={heightRefForPreview?.reference_elevation_m ?? 0}
                heightM={heightRefForPreview?.height_m ?? 0}
                demPreview={demPreviewData}
                envelopeEnabled={envelopeEnabled}
                wrapWidthM={wrapWidthM}
                demAvailable={demAvailable}
                demLoading={demPreviewLoading}
                onCameraStateChange={({ zoomPercent }) => setScene3dZoomPercent(zoomPercent)}
              />
              <aside className="pad-earthwork-sketch-modal__sidebar">
                <div className="pad-earthwork-sketch-modal__section">
                  <h3 className="pad-earthwork-sketch-modal__section-title">Рельеф</h3>
                  <p className="object-detail-panel__hint text-xs">
                    {demAvailable
                      ? demPreviewData
                        ? `DEM preview ${demPreviewData.cols}×${demPreviewData.rows}, шаг ${demPreviewData.cell_size_m.toFixed(1)} м`
                        : demPreviewLoading
                          ? 'Загрузка сетки рельефа…'
                          : 'Укажите высоту и опорную отметку для preview'
                      : 'DEM не загружен — на вкладке «План» нажмите «Загрузить DEM»'}
                  </p>
                  {demPreviewData && (
                    <p className="object-detail-panel__hint text-xs">
                      Рельеф: {formatElevationM(demPreviewData.elev_min)} …{' '}
                      {formatElevationM(demPreviewData.elev_max)}
                    </p>
                  )}
                </div>
                <div className="pad-earthwork-sketch-modal__section">
                  <h3 className="pad-earthwork-sketch-modal__section-title">Отметки</h3>
                  <p className="object-detail-panel__hint text-xs">
                    Опорная:{' '}
                    <strong>
                      {heightRefForPreview
                        ? formatElevationM(heightRefForPreview.reference_elevation_m)
                        : '—'}
                    </strong>
                  </p>
                  <p className="object-detail-panel__hint text-xs">
                    Верх площадки:{' '}
                    <strong>
                      {heightRefForPreview
                        ? formatElevationM(
                            heightRefForPreview.reference_elevation_m + heightRefForPreview.height_m,
                          )
                        : '—'}
                    </strong>
                  </p>
                </div>
                <EnvelopeSection
                  envelopeEnabled={envelopeEnabled}
                  onEnvelopeEnabledChange={setEnvelopeEnabled}
                  wrapWidthM={wrapWidthM}
                  onWrapWidthMChange={setWrapWidthM}
                  readOnly={readOnly}
                  disabled={!canCompute}
                  snapEnabled={snapEnabled}
                />
                <Scene3DLegend demActive={Boolean(demPreviewData)} envelopeActive={envelopeActive} />
                {result && (
                  <div className="pad-earthwork-sketch-modal__section">
                    <h3 className="pad-earthwork-sketch-modal__section-title">Объёмы</h3>
                    <p className="object-detail-panel__hint text-xs">
                      Насыпь: <strong>{result.volumes.fill_m3.toFixed(1)} м³</strong>
                    </p>
                    <p className="object-detail-panel__hint text-xs">
                      Выемка: <strong>{result.volumes.cut_m3.toFixed(1)} м³</strong>
                    </p>
                  </div>
                )}
                {estimatedFill != null && !result && (
                  <div className="pad-earthwork-sketch-modal__section">
                    <h3 className="pad-earthwork-sketch-modal__section-title">Оценка</h3>
                    <p className="object-detail-panel__hint text-xs">
                      Насыпь ≈ <strong>{estimatedFill.toFixed(1)} м³</strong>
                    </p>
                  </div>
                )}
                {sketchDirty && !readOnly && (
                  <p className="object-detail-panel__hint text-xs pad-earthwork-sketch-modal__unsaved-hint">
                    Есть несохранённые изменения плана
                  </p>
                )}
              </aside>
            </div>
          </>
        )}
      </div>
    </AppModal>
  );
}

export function sketchFromLastResponse(sketch: unknown): PlanShapeSketch | null {
  return parseSketchFromLast(sketch);
}
