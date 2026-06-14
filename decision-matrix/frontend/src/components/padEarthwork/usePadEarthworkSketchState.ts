import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createDefaultPlanSketch,
  createDefaultPolygonSketch,
  createEmptyPolygonSketch,
  DEFAULT_ENVELOPE_WRAP_WIDTH_M,
  isPlanPolygon,
  isPlanRectangle,
  planFromFormFields,
  polygonBoundingBox,
  polygonToRectangle,
  rectangleToPolygon,
  type PlanEditTool,
  type PlanPolygonSketch,
  type PlanRectangleSketch,
  type PlanShapeSketch,
  type PlanVertex,
  type PolygonEditTool,
  type ShapeMode,
  resolveInitialShapeMode,
} from '../../lib/padEarthworkSketch';
import { parseNdsDeg, resolveGeneratorNdsDeg } from '../../lib/infraPadEarthwork';
import type { PadEarthworkComputeResult } from '../../lib/api/padEarthworkApi';
import type { PlanSketchPan } from '../../lib/planSketchViewport';
import {
  cloneGeneratorSnapshot,
  DEFAULT_GENERATOR_FIELDS,
  initialSketchState,
  parseHeightRef,
  type GeneratorFields,
  type GeneratorSnapshot,
  type PadEarthworkSketchModalProps,
} from './padEarthworkSketchModalState';

export function usePadEarthworkSketchState({
  lengthM,
  widthM,
  heightM,
  rotationDeg,
  referenceElevationM,
  initialSketch,
  initialWellsLocal,
  initialEnvelope,
  padWellCount = DEFAULT_GENERATOR_FIELDS.padWellCount,
  setPadWellCount,
  padWellsPerGroup = DEFAULT_GENERATOR_FIELDS.padWellsPerGroup,
  setPadWellsPerGroup,
  padWellSpacingM = DEFAULT_GENERATOR_FIELDS.padWellSpacingM,
  setPadWellSpacingM,
  padGroupSpacingM = DEFAULT_GENERATOR_FIELDS.padGroupSpacingM,
  setPadGroupSpacingM,
  padMarginLeftM = DEFAULT_GENERATOR_FIELDS.padMarginLeftM,
  setPadMarginLeftM,
  padMarginBottomM = DEFAULT_GENERATOR_FIELDS.padMarginBottomM,
  setPadMarginBottomM,
  padMarginTopM = DEFAULT_GENERATOR_FIELDS.padMarginTopM,
  setPadMarginTopM,
  padMarginEndM = DEFAULT_GENERATOR_FIELDS.padMarginEndM,
  setPadMarginEndM,
  setRotationDeg,
  onApplyToFields,
  demStatus = null,
  terrainMode = 'flat',
  showGenerator = true,
}: PadEarthworkSketchModalProps) {
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
  const baselineWellsRef = useRef<PlanVertex[]>(
    (initialWellsLocal ?? []).map((w) => ({ east_m: w.east_m, north_m: w.north_m })),
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

  useEffect(() => {
    if (demStatus?.asset_id) setLocalDemAssetId(demStatus.asset_id);
  }, [demStatus?.asset_id]);

  const heightRefForPreview = parseHeightRef(localHeight, localRef);

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
    baselineWellsRef.current = (initialWellsLocal ?? []).map((w) => ({
      east_m: w.east_m,
      north_m: w.north_m,
    }));
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

  return {
    showGenerator,
    shapeMode,
    setShapeMode,
    rectTool,
    setRectTool,
    polygonTool,
    setPolygonTool,
    snapEnabled,
    setSnapEnabled,
    showEdgeLengths,
    setShowEdgeLengths,
    lockAspect,
    setLockAspect,
    zoom,
    setZoom,
    viewPan,
    setViewPan,
    fitViewNonce,
    setFitViewNonce,
    sketch,
    setSketch,
    localHeight,
    setLocalHeight,
    localRef,
    setLocalRef,
    result,
    setResult,
    error,
    setError,
    sketchDirty,
    setSketchDirty,
    saveMessage,
    setSaveMessage,
    envelopeEnabled,
    setEnvelopeEnabled,
    wrapWidthM,
    setWrapWidthM,
    wellsLocal,
    setWellsLocal,
    generatorSnapshotRef,
    baselineWellsRef,
    generatorFields,
    setGeneratorFields,
    localDemAssetId,
    setLocalDemAssetId,
    showDemOverlay,
    setShowDemOverlay,
    heightRefForPreview,
    patchGeneratorField,
    updateSketch,
    rectangleSketch,
    polygonSketch,
    syncCardFields,
    handleShapeModeChange,
    handleResetSketch,
    handleFitView,
    handleClearPolygon,
    setPadWellCount,
    setPadWellsPerGroup,
    setPadWellSpacingM,
    setPadGroupSpacingM,
    setPadMarginLeftM,
    setPadMarginBottomM,
    setPadMarginTopM,
    setPadMarginEndM,
    setRotationDeg,
    rotationDeg,
  };
}

export type PadEarthworkSketchCoreState = ReturnType<typeof usePadEarthworkSketchState>;
