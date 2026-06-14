import { useEffect, useRef, useState } from 'react';
import {
  estimateEnvelopeFillM3,
  estimateFillM3,
  isPlanPolygon,
  isPolygonSketchClosed,
  polygonPerimeterM,
  shapeVerticesForEnvelope,
  sketchFootprintAreaM2,
} from '../../lib/padEarthworkSketch';
import type { PadEarthworkScene3DHandle } from './PadEarthworkScene3D';
import type { PadEarthworkSketchScene3dTabProps } from './PadEarthworkSketchScene3dTab';
import type { PadEarthworkSketchPlanTabProps } from './PadEarthworkSketchPlanTab';
import type {
  PadEarthworkSketchModalProps,
  PadEarthworkSketchTabId,
} from './padEarthworkSketchModalState';
import { usePadEarthworkSketchDemPreview } from './usePadEarthworkSketchDemPreview';
import { usePadEarthworkSketchMutations } from './usePadEarthworkSketchMutations';
import { usePadEarthworkSketchState } from './usePadEarthworkSketchState';

export function usePadEarthworkSketchModal(props: PadEarthworkSketchModalProps) {
  const {
    projectId,
    objectId,
    readOnly,
    onClose,
    onApplySandDemand,
  } = props;

  const [tab, setTab] = useState<PadEarthworkSketchTabId>('plan');
  const [sandDemandApplied, setSandDemandApplied] = useState(false);
  const scene3dRef = useRef<PadEarthworkScene3DHandle>(null);
  const [scene3dZoomPercent, setScene3dZoomPercent] = useState(100);

  const core = usePadEarthworkSketchState(props);

  const dem = usePadEarthworkSketchDemPreview({
    projectId,
    objectId,
    readOnly,
    tab,
    sketch: core.sketch,
    localHeight: core.localHeight,
    localRef: core.localRef,
    localDemAssetId: core.localDemAssetId,
    showDemOverlay: core.showDemOverlay,
    setShowDemOverlay: core.setShowDemOverlay,
    setLocalDemAssetId: core.setLocalDemAssetId,
    setLocalRef: core.setLocalRef,
    setError: core.setError,
  });

  const { computeMutation, saveMutation, generateMutation } = usePadEarthworkSketchMutations({
    projectId,
    objectId,
    rotationDeg: props.rotationDeg,
    onApplyToFields: props.onApplyToFields,
    onComputeSuccess: props.onComputeSuccess,
    onSaveSuccess: props.onSaveSuccess,
    core,
  });

  useEffect(() => {
    setSandDemandApplied(false);
  }, [core.result?.volumes.fill_m3]);

  const handleApplyToFields = () => {
    core.syncCardFields();
  };

  const fillM3 = core.result?.volumes.fill_m3;
  const areaTop = sketchFootprintAreaM2(core.sketch);
  const heightNum = Number(core.localHeight.replace(',', '.'));
  const polygonClosed = isPlanPolygon(core.sketch) && isPolygonSketchClosed(core.sketch);
  const canCompute = core.shapeMode === 'rectangle' || polygonClosed;
  const envelopeParams =
    core.envelopeEnabled && core.wrapWidthM > 0
      ? { enabled: true as const, wrap_width_m: core.wrapWidthM }
      : null;
  const envelopeActive = envelopeParams != null && canCompute;
  const bermPerimeterM = envelopeActive
    ? polygonPerimeterM(shapeVerticesForEnvelope(core.sketch))
    : null;
  const estimatedFill = envelopeActive
    ? estimateEnvelopeFillM3(core.sketch, heightNum, core.wrapWidthM)
    : estimateFillM3(core.sketch, heightNum);

  const planTabProps: PadEarthworkSketchPlanTabProps = {
    projectId,
    objectId,
    showGenerator: core.showGenerator,
    readOnly,
    shapeMode: core.shapeMode,
    handleShapeModeChange: core.handleShapeModeChange,
    rectTool: core.rectTool,
    setRectTool: core.setRectTool,
    polygonTool: core.polygonTool,
    setPolygonTool: core.setPolygonTool,
    snapEnabled: core.snapEnabled,
    setSnapEnabled: core.setSnapEnabled,
    lockAspect: core.lockAspect,
    setLockAspect: core.setLockAspect,
    showEdgeLengths: core.showEdgeLengths,
    setShowEdgeLengths: core.setShowEdgeLengths,
    zoom: core.zoom,
    setZoom: core.setZoom,
    viewPan: core.viewPan,
    setViewPan: core.setViewPan,
    fitViewNonce: core.fitViewNonce,
    handleFitView: core.handleFitView,
    handleResetSketch: core.handleResetSketch,
    handleClearPolygon: core.handleClearPolygon,
    demToolbarProps: dem.demToolbarProps,
    rectangleSketch: core.rectangleSketch,
    polygonSketch: core.polygonSketch,
    polygonClosed,
    sketch: core.sketch,
    updateSketch: core.updateSketch,
    setShapeMode: core.setShapeMode,
    wellsLocal: core.wellsLocal,
    envelopeParams,
    showDemOverlay: core.showDemOverlay,
    demPreviewData: dem.demPreviewData,
    demPreviewLoading: dem.demPreviewLoading,
    setPadWellCount: core.setPadWellCount,
    setPadWellsPerGroup: core.setPadWellsPerGroup,
    setPadWellSpacingM: core.setPadWellSpacingM,
    setPadGroupSpacingM: core.setPadGroupSpacingM,
    setPadMarginLeftM: core.setPadMarginLeftM,
    setPadMarginBottomM: core.setPadMarginBottomM,
    setPadMarginTopM: core.setPadMarginTopM,
    setPadMarginEndM: core.setPadMarginEndM,
    setRotationDeg: core.setRotationDeg,
    generatorFields: core.generatorFields,
    patchGeneratorField: core.patchGeneratorField,
    generateMutation,
    areaTop,
    envelopeActive,
    bermPerimeterM,
    estimatedFill,
    canCompute,
    envelopeEnabled: core.envelopeEnabled,
    setEnvelopeEnabled: core.setEnvelopeEnabled,
    wrapWidthM: core.wrapWidthM,
    setWrapWidthM: core.setWrapWidthM,
    localHeight: core.localHeight,
    setLocalHeight: core.setLocalHeight,
    localRef: core.localRef,
    setLocalRef: core.setLocalRef,
    heightRefForPreview: core.heightRefForPreview,
    debouncedPreviewKey: dem.debouncedPreviewKey,
    previewRequestKey: dem.previewRequestKey,
    demAvailable: dem.demAvailable,
    setResult: core.setResult,
    setError: core.setError,
    result: core.result,
    error: core.error,
    saveMessage: core.saveMessage,
  };

  const scene3dTabProps: PadEarthworkSketchScene3dTabProps = {
    scene3dRef,
    scene3dZoomPercent,
    onScene3dZoomPercentChange: setScene3dZoomPercent,
    sketch: core.sketch,
    heightRefForPreview: core.heightRefForPreview,
    demPreviewData: dem.demPreviewData,
    demAvailable: dem.demAvailable,
    demPreviewLoading: dem.demPreviewLoading,
    envelopeEnabled: core.envelopeEnabled,
    wrapWidthM: core.wrapWidthM,
    onEnvelopeEnabledChange: core.setEnvelopeEnabled,
    onWrapWidthMChange: core.setWrapWidthM,
    readOnly,
    canCompute,
    snapEnabled: core.snapEnabled,
    envelopeActive,
    result: core.result,
    estimatedFill,
    sketchDirty: core.sketchDirty,
  };

  return {
    tab,
    setTab,
    readOnly,
    onClose,
    footer: {
      handleApplyToFields,
      saveMutation,
      computeMutation,
      canCompute,
      fillM3,
      sandDemandApplied,
      setSandDemandApplied,
      onApplySandDemand,
    },
    planTabProps,
    scene3dTabProps,
  };
}
