import { useCallback } from 'react';
import { emptyPoiFormValues, nextPoiAutoName } from '../../lib/poiParams';
import { formatCoord } from '../../lib/coords';
import {
  type MapClickHit,
} from '../../components/MapView';
import { useMapAutoroadNetwork } from '../useMapAutoroadNetwork';
import { useMapGeometrySave } from '../useMapGeometrySave';
import { useMapInfraCreate } from '../useMapInfraCreate';
import { useMapLineDrawing } from '../useMapLineDrawing';
import { useMap3dDisplay } from '../useMap3dDisplay';
import { useMapDeleteSelection } from '../useMapDeleteSelection';
import { useMapClipboard } from '../useMapClipboard';
import { useMapAnalysis } from '../useMapAnalysis';
import { useMapDetailSave } from '../useMapDetailSave';
import { useMapFooterHint } from '../useMapFooterHint';
import { useMapHotkeys } from '../../lib/mapHotkeys';
import { useAppStore } from '../../store';
import type { useMapPageEditState } from './useMapPageEditState';
import type { useMapPageShellState } from './useMapPageShellState';
import type { useMapPageMapData } from './useMapPageMapData';
import type { MapDisplayMode } from '../useMapDisplayMode';
import type { useMapLayerPreferences } from '../useMapLayerPreferences';
import { submitPoiCreate } from './submitPoi';

type EditState = ReturnType<typeof useMapPageEditState>;
type ShellState = ReturnType<typeof useMapPageShellState>;
type MapData = ReturnType<typeof useMapPageMapData>;

export function useMapPageMapActions(params: {
  projectId: string | null | undefined;
  mapRefreshNonce: number;
  canWriteProject: boolean;
  canWriteInfra: boolean;
  canEditMap: boolean;
  edit: EditState;
  shell: ShellState;
  data: MapData;
  layerPrefs: ReturnType<typeof useMapLayerPreferences>['prefs'];
  setLayerPrefs: ReturnType<typeof useMapLayerPreferences>['setPrefs'];
  mapDisplayMode: MapDisplayMode;
  setMapDisplayMode: (mode: MapDisplayMode) => void;
  mapIn3d: boolean;
  requestAutoroadConfirm: ReturnType<
    typeof import('../useAutoroadConnectConfirm').useAutoroadConnectConfirm
  >['requestConfirm'];
  autoroadConfirmModal: ReturnType<
    typeof import('../useAutoroadConnectConfirm').useAutoroadConnectConfirm
  >['modal'];
}) {
  const {
    projectId,
    mapRefreshNonce,
    canWriteProject,
    canWriteInfra,
    canEditMap,
    edit,
    shell,
    data,
    layerPrefs,
    setLayerPrefs,
    mapIn3d,
    setMapDisplayMode,
    requestAutoroadConfirm,
    autoroadConfirmModal,
  } = params;
  const effectiveProjectId = projectId ?? undefined;
  const { clearLineDraftRef, clearDrawingForModeSwitchRef, cursorRef } = edit;
  const { radiusVisible } = layerPrefs;
  const pushToast = useAppStore((s) => s.pushToast);

  const {
    pois,
    layers,
    distanceDefaults,
    projectJobBusy,
    infraObjects,
    mapBbox,
    upsertInfraInCache,
    removeInfraFromCaches,
    touchInfraOverlay,
    nextAutoName,
    mapLayerVisibleInfra,
    filteredInfra: _filteredInfra,
    selectedPoi,
    groupSelectionDetails,
    detailSelection,
    invalidateMap,
    pushUndo,
    layerVisibilityMut,
  } = data;

  const {
    terminalIds: autoroadNetworkTerminalIds,
    setTerminalIds: setAutoroadNetworkTerminalIds,
    pickMode: autoroadNetworkPickMode,
    setPickMode: setAutoroadNetworkPickMode,
    plannerOptions: autoroadPlannerOptions,
    handlePlannerOptionsChange: handleAutoroadPlannerOptionsChange,
    solverStatus,
    solverStatusLoading,
    planPreviewLines: autoroadPlanPreviewLines,
    networkDetails: autoroadNetworkDetails,
    visibleEligibleTerminals: visibleEligibleAutoroadTerminals,
    subtypeBulkOptions: autoroadSubtypeBulkOptions,
    handleDragBoxPick: handleAutoroadNetworkDragBoxPick,
    handleAddVisible: handleAddVisibleAutoroadTerminals,
    handleAddBySubtype: handleAddAutoroadTerminalsBySubtype,
    handleMapClick: handleAutoroadNetworkMapClick,
    canConnect: canAutoroadConnect,
    connectMut: autoroadConnectMut,
    handleConnect: handleAutoroadConnect,
    runNetworkFlow: runAutoroadNetworkFlow,
    canPreview: canAutoroadNetworkPreview,
    disabledHint: autoroadNetworkDisabledHint,
  } = useMapAutoroadNetwork({
    projectId: effectiveProjectId,
    drawMode: edit.drawMode,
    setDrawMode: edit.setDrawMode,
    infraObjects,
    mapBbox,
    groupSelectionDetails,
    canWriteInfra,
    projectJobBusy,
    requestAutoroadConfirm,
    pushToast,
    pushUndo,
    invalidateMap,
  });

  const {
    geometrySavePending,
    setGeometrySavePending,
    handleGeometryChange,
    handleBatchGeometryChange,
  } = useMapGeometrySave({
    projectId: effectiveProjectId,
    pois,
    infraObjects,
    pushUndo,
    pushToast,
    invalidateMap,
    touchInfraOverlay,
  });

  const { createPoiMut, createInfraMut, placeInfraPointAt } = useMapInfraCreate({
    projectId: effectiveProjectId,
    mapRefreshNonce,
    canWriteInfra,
    infraObjects,
    layers,
    layerVisibilityMut,
    setLayerPrefs,
    setFeatureSel: edit.setFeatureSel,
    setModal: edit.setModal,
    setDrawMode: edit.setDrawMode,
    clearLineDraftRef: edit.clearLineDraftRef,
    upsertInfraInCache,
    nextAutoName,
    pushUndo,
    pushToast,
    invalidateMap,
    lineHealSkipIdsRef: edit.lineHealSkipIdsRef,
  });

  const {
    lineDraft,
    lineDraftPreview,
    rulerPoints,
    rulerPreview,
    rulerCompleted,
    needsDrawCursor,
    clearLineDraft,
    clearRulerState,
    clearDrawingPreviews,
    clearDrawingForModeSwitch,
    resetDrawingMenus,
    updatePointerMove,
    handleRulerClick,
    handleLineClick,
    finishRulerMeasurement,
    finishLineDraft,
    lineDraftFinishAt,
    measureCursorLabel,
    measureAnchorLabels,
    drawActionsVisible,
    drawStepBackDisabled,
    drawFinishDisabled,
    drawResetDisabled,
    handleDrawStepBack,
    handleDrawFinish,
    handleDrawReset,
  } = useMapLineDrawing({
    projectId: effectiveProjectId,
    drawMode: edit.drawMode,
    infraSubtype: edit.infraForm.subtype,
    infraObjects,
    canWriteInfra,
    createInfraMut,
    pushToast,
    pushUndo,
    upsertInfraInCache,
    nextAutoName,
    setFeatureSel: edit.setFeatureSel,
  });

  clearLineDraftRef.current = clearLineDraft;
  clearDrawingForModeSwitchRef.current = clearDrawingForModeSwitch;

  const needsCursorState =
    edit.pasteMode || edit.drawMode === 'point' || edit.drawMode === 'poi';
  const needsCursorStateWithDrawing = needsCursorState || needsDrawCursor;

  const { map3dKeepMounted, switchMapDisplayMode } = useMap3dDisplay({
    projectId: effectiveProjectId,
    drawMode: edit.drawMode,
    setDrawMode: edit.setDrawMode,
    mapIn3d,
    setMapDisplayMode,
    pushToast,
    map3dRef: shell.map3dRef,
    last2dViewRef: shell.last2dViewRef,
    onClearDrawingForModeSwitch: () => edit.clearDrawingForModeSwitchRef.current(),
    setPointMenuOpen: edit.setPointMenuOpen,
    setLineMenuOpen: edit.setLineMenuOpen,
  });

  const {
    deleteConfirm,
    setDeleteConfirm,
    deleteInfraMut,
    deleteGroupMut,
    requestDeleteSelection,
    requestDeleteGroupSelection,
    canDeleteCurrentSelection,
    selectedOnMapCount,
  } = useMapDeleteSelection({
    projectId: effectiveProjectId,
    pois,
    infraObjects,
    canWriteProject,
    canWriteInfra,
    featureSel: edit.featureSel,
    featureGroupSel: edit.featureGroupSel,
    setFeatureSel: edit.setFeatureSel,
    setFeatureGroupSel: edit.setFeatureGroupSel,
    pushUndo,
    pushToast,
    invalidateMap,
    removeInfraFromCaches,
  });

  const {
    copyMapSelection,
    enterPasteMode,
    executePaste,
    cutMapSelection,
    clipboardPreviewPoints,
    canCopyMapSelection,
    canPasteMapClipboard,
    canCutMapSelection,
  } = useMapClipboard({
    projectId: effectiveProjectId,
    pois,
    infraObjects,
    canWriteProject,
    canWriteInfra,
    mapEditEnabled: edit.mapEditEnabled,
    selectMode: edit.selectMode,
    featureSel: edit.featureSel,
    featureGroupSel: edit.featureGroupSel,
    mapClipboard: edit.mapClipboard,
    setMapClipboard: edit.setMapClipboard,
    pasteMode: edit.pasteMode,
    setPasteMode: edit.setPasteMode,
    setDrawMode: edit.setDrawMode,
    setSelectMode: edit.setSelectMode,
    setFeatureSel: edit.setFeatureSel,
    setFeatureGroupSel: edit.setFeatureGroupSel,
    geometrySavePending,
    setGeometrySavePending,
    cursor: edit.cursor,
    nextPoiAutoName,
    nextAutoName,
    upsertInfraInCache,
    pushUndo,
    invalidateMap,
    pushToast,
    requestDeleteSelection,
    lineHealSkipIdsRef: edit.lineHealSkipIdsRef,
    canDeleteCurrentSelection,
  });

  const handleMapEscape = useCallback(() => {
    if (edit.pasteMode) {
      edit.setPasteMode(false);
      return;
    }
    if (deleteConfirm) {
      setDeleteConfirm(null);
      return;
    }
    if (edit.modal) {
      edit.setModal(null);
      return;
    }
    if (edit.candidateSubtype) {
      edit.setCandidateSubtype(null);
      edit.setCandidateParamType('external');
      return;
    }
    if (edit.searchOpen) {
      edit.setSearchOpen(false);
      return;
    }
    const drawingActive =
      edit.drawMode !== 'select' || edit.pointMenuOpen || edit.lineMenuOpen;
    if (drawingActive) {
      edit.cancelDrawingSelection();
    }
  }, [
    deleteConfirm,
    edit,
    setDeleteConfirm,
  ]);

  const { connectionLines, thresholdCircles, thresholdKm, analyzeMut, overrideMut } =
    useMapAnalysis({
      projectId: effectiveProjectId,
      selectedPoi,
      pois,
      infraObjects,
      layers,
      mapLayerVisibleInfra,
      radiusVisible,
      distanceDefaults,
      setMapFocus: edit.setMapFocus,
      pushToast,
      candidateSubtype: edit.candidateSubtype,
      setCandidateSubtype: edit.setCandidateSubtype,
      candidateParamType: edit.candidateParamType,
      setCandidateParamType: edit.setCandidateParamType,
    });

  const { saveDetailMut } = useMapDetailSave({
    projectId: effectiveProjectId,
    detailSelection,
    pushUndo,
    pushToast,
  });

  const handlePointerMove = useCallback(
    (lon: number, lat: number, overPoint?: { lon: number; lat: number }) => {
      edit.setMapPointerInside(true);
      cursorRef.current = { lon, lat };
      if (needsCursorStateWithDrawing) {
        edit.setCursor((prev) =>
          prev && prev.lon === lon && prev.lat === lat ? prev : { lon, lat },
        );
      }
      updatePointerMove(lon, lat, overPoint);
    },
    [needsCursorStateWithDrawing, updatePointerMove, edit],
  );

  const handlePointerLeave = useCallback(() => {
    edit.setMapPointerInside(false);
    clearDrawingPreviews();
  }, [clearDrawingPreviews, edit]);

  const handleMapClick = useCallback(
    (lon: number, lat: number, hit?: MapClickHit) => {
      if (edit.pasteMode) {
        void executePaste(lon, lat);
        return;
      }
      if (edit.drawMode === 'autoroad_network') {
        handleAutoroadNetworkMapClick(hit);
        return;
      }
      if (edit.drawMode === 'ruler') {
        handleRulerClick(lon, lat);
        return;
      }
      if (edit.drawMode === 'poi') {
        if (!canWriteProject) return;
        edit.setPoiForm(
          emptyPoiFormValues({
            name: nextPoiAutoName(pois),
            lon: formatCoord(lon),
            lat: formatCoord(lat),
          }),
        );
        edit.setModal({ type: 'poi', lon, lat });
        return;
      }
      if (edit.drawMode === 'point') {
        if (!canWriteInfra) return;
        if (!projectId) return;
        const subtype = edit.infraForm.subtype;
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
      if (edit.drawMode === 'line') {
        handleLineClick(lon, lat, hit);
      }
    },
    [
      edit,
      executePaste,
      handleAutoroadNetworkMapClick,
      handleRulerClick,
      handleLineClick,
      canWriteProject,
      canWriteInfra,
      nextPoiAutoName,
      placeInfraPointAt,
      pois,
      projectId,
    ],
  );

  useMapHotkeys({
    drawMode: edit.drawMode,
    canDelete:
      canDeleteCurrentSelection &&
      selectedOnMapCount > 0 &&
      !deleteConfirm &&
      !edit.modal &&
      !deleteGroupMut.isPending &&
      !deleteInfraMut.isPending,
    canToggleEdit: canEditMap,
    canCopy: canCopyMapSelection && !deleteConfirm && !edit.modal,
    canPaste: canPasteMapClipboard && !deleteConfirm && !edit.modal,
    canCut: canCutMapSelection && !deleteConfirm && !edit.modal,
    onEscape: handleMapEscape,
    onDelete: requestDeleteSelection,
    onCopy: copyMapSelection,
    onPaste: enterPasteMode,
    onCut: cutMapSelection,
    onToggleEdit: () => edit.setMapEditEnabled((on) => !on),
    onFinishLine:
      edit.drawMode === 'line'
        ? () => void finishLineDraft(lineDraft, lineDraftFinishAt())
        : undefined,
  });

  const mapFooterHint = useMapFooterHint({
    pasteMode: edit.pasteMode,
    drawMode: edit.drawMode,
    mapEditEnabled: edit.mapEditEnabled,
    detailSelection,
    selectMode: edit.selectMode,
    featureGroupCount: edit.featureGroupSel.length,
  });

  const resetDrawingMenusForToolbar = useCallback(() => {
    resetDrawingMenus();
    edit.setPointMenuOpen(false);
    edit.setLineMenuOpen(false);
  }, [resetDrawingMenus, edit]);

  const submitPoi = () =>
    submitPoiCreate({
      projectId,
      modal: edit.modal,
      poiForm: edit.poiForm,
      pois,
      pushToast,
      createPoiMut,
    });

  return {
    autoroadNetworkTerminalIds,
    setAutoroadNetworkTerminalIds,
    autoroadNetworkPickMode,
    setAutoroadNetworkPickMode,
    autoroadPlannerOptions,
    handleAutoroadPlannerOptionsChange,
    solverStatus,
    solverStatusLoading,
    autoroadPlanPreviewLines,
    autoroadNetworkDetails,
    visibleEligibleAutoroadTerminals,
    autoroadSubtypeBulkOptions,
    handleAutoroadNetworkDragBoxPick,
    handleAddVisibleAutoroadTerminals,
    handleAddAutoroadTerminalsBySubtype,
    canAutoroadConnect,
    autoroadConnectMut,
    handleAutoroadConnect,
    runAutoroadNetworkFlow,
    canAutoroadNetworkPreview,
    autoroadNetworkDisabledHint,
    geometrySavePending,
    handleGeometryChange,
    handleBatchGeometryChange,
    createPoiMut,
    lineDraft,
    lineDraftPreview,
    rulerPoints,
    rulerPreview,
    rulerCompleted,
    clearLineDraft,
    clearRulerState,
    measureCursorLabel,
    measureAnchorLabels,
    drawActionsVisible,
    drawStepBackDisabled,
    drawFinishDisabled,
    drawResetDisabled,
    handleDrawStepBack,
    handleDrawFinish,
    handleDrawReset,
    map3dKeepMounted,
    switchMapDisplayMode,
    deleteConfirm,
    setDeleteConfirm,
    deleteInfraMut,
    deleteGroupMut,
    requestDeleteSelection,
    requestDeleteGroupSelection,
    canDeleteCurrentSelection,
    selectedOnMapCount,
    copyMapSelection,
    enterPasteMode,
    cutMapSelection,
    clipboardPreviewPoints,
    canCopyMapSelection,
    canPasteMapClipboard,
    canCutMapSelection,
    connectionLines,
    thresholdCircles,
    thresholdKm,
    analyzeMut,
    overrideMut,
    saveDetailMut,
    handlePointerMove,
    handlePointerLeave,
    handleMapClick,
    finishLineDraft,
    finishRulerMeasurement,
    mapFooterHint,
    resetDrawingMenusForToolbar,
    submitPoi,
    autoroadConfirmModal,
  };
}
