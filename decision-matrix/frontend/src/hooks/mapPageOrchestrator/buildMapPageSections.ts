import type { MapPageCanvasProps } from '../../pages/map/MapPageCanvas';
import type { MapPageFooterProps } from '../../pages/map/MapPageFooter';
import type { MapPageHeaderProps } from '../../pages/map/MapPageHeader';
import type { MapPageLayersSidebarProps } from '../../pages/map/MapPageLayersSidebar';
import type { MapPageModalsProps } from '../../pages/map/MapPageModals';
import type { MapPageSidePanelsProps } from '../../pages/map/MapPageSidePanels';
import type { MapPageToolbarProps } from '../../pages/map/mapPageToolbar/types';
import type { useMapPageEditState } from './useMapPageEditState';
import type { useMapPageShellState } from './useMapPageShellState';
import type { useMapPageMapData } from './useMapPageMapData';
import type { useMapPageMapActions } from './useMapPageMapActions';
import type { useMapLayerPreferences } from '../useMapLayerPreferences';

type EditState = ReturnType<typeof useMapPageEditState>;
type ShellState = ReturnType<typeof useMapPageShellState>;
type MapData = ReturnType<typeof useMapPageMapData>;
type MapActions = ReturnType<typeof useMapPageMapActions>;

export type MapPageSections = {
  header: MapPageHeaderProps;
  toolbar: MapPageToolbarProps;
  layersSidebar: MapPageLayersSidebarProps;
  canvas: MapPageCanvasProps;
  sidePanels: MapPageSidePanelsProps;
  footer: MapPageFooterProps;
  modals: MapPageModalsProps;
};

export function buildMapPageSections(params: {
  projectId: string | null | undefined;
  canWriteProject: boolean;
  canWriteInfra: boolean;
  canEditMap: boolean;
  layerPrefs: ReturnType<typeof useMapLayerPreferences>['prefs'];
  setLayerPrefs: ReturnType<typeof useMapLayerPreferences>['setPrefs'];
  patchLayerPrefs: ReturnType<typeof useMapLayerPreferences>['patchPrefs'];
  setLayerOpenSections: ReturnType<typeof useMapLayerPreferences>['setOpenSections'];
  showBasemap: boolean;
  showTerrain: boolean;
  showModels: boolean;
  showPoisOnMap: boolean;
  showRadii: boolean;
  radiusVisible: ReturnType<typeof useMapLayerPreferences>['prefs']['radiusVisible'];
  layerOpenSections: ReturnType<typeof useMapLayerPreferences>['prefs']['openSections'];
  map3dFeatureEnabled: boolean;
  mapDisplayMode: '2d' | '3d';
  mapIn3d: boolean;
  shell: ShellState;
  edit: EditState;
  data: MapData;
  actions: MapActions;
}): MapPageSections {
  const {
    projectId,
    canWriteProject,
    canWriteInfra,
    canEditMap,
    layerPrefs,
    setLayerPrefs,
    patchLayerPrefs,
    setLayerOpenSections,
    showBasemap,
    showTerrain,
    showModels,
    showPoisOnMap,
    showRadii,
    radiusVisible,
    layerOpenSections,
    map3dFeatureEnabled,
    mapDisplayMode,
    mapIn3d,
    shell,
    edit,
    data,
    actions,
  } = params;

  const {
    pois,
    layers,
    layerVisibilityMut,
    setGroupSubtypesVisible,
    isGroupVisible,
    infraObjects,
    filteredInfra,
    selectedPoi,
    groupSelectionDetails,
    detailSelection,
    handleFitMapView,
    handleMapBboxChange,
    canUndo,
    performUndo,
  } = data;

  const {
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
    createPoiMut,
    geometrySavePending,
    handleGeometryChange,
    handleBatchGeometryChange,
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
    clipboardPreviewPoints,
  } = actions;

  const { cancelDrawingSelection } = edit;

  return {
    header: {
      projectId: projectId ?? null,
      poisCount: pois.length,
      canWriteProject,
      analyzePending: analyzeMut.isPending,
      onAnalyze: () => analyzeMut.mutate(),
    },
    toolbar: {
      map3dFeatureEnabled,
      mapDisplayMode,
      onDisplayModeChange: switchMapDisplayMode,
      mapLayersOpen: shell.mapLayersOpen,
      onToggleLayers: () => shell.setMapLayersOpen((open) => !open),
      mapFullscreen: shell.mapFullscreen,
      onToggleFullscreen: () => void shell.toggleMapFullscreen(),
      projectId: projectId ?? undefined,
      pois,
      selectedPoiId: edit.selectedPoiId,
      onSelectedPoiIdChange: edit.setSelectedPoiId,
      mapEditEnabled: edit.mapEditEnabled,
      onToggleMapEdit: () => edit.setMapEditEnabled((on) => !on),
      canEditMap,
      mapIn3d,
      canUndo,
      onUndo: () => void performUndo(),
      canCopy: canCopyMapSelection,
      onCopy: copyMapSelection,
      canPaste: canPasteMapClipboard,
      onPaste: enterPasteMode,
      canCut: canCutMapSelection,
      onCut: cutMapSelection,
      canDelete: canDeleteCurrentSelection,
      selectedOnMapCount,
      deletePending: deleteGroupMut.isPending || deleteInfraMut.isPending,
      onDelete: requestDeleteSelection,
      drawMode: edit.drawMode,
      onDrawModeChange: edit.setDrawMode,
      selectMode: edit.selectMode,
      onSelectModeChange: edit.setSelectMode,
      onResetDrawingMenus: resetDrawingMenusForToolbar,
      canWriteInfra,
      canWriteProject,
      projectJobBusy: data.projectJobBusy,
      infraFormSubtype: edit.infraForm.subtype,
      onInfraFormSubtypeChange: (subtype) => edit.setInfraForm((f) => ({ ...f, subtype })),
      pointMenuOpen: edit.pointMenuOpen,
      onPointMenuOpenChange: edit.setPointMenuOpen,
      lineMenuOpen: edit.lineMenuOpen,
      onLineMenuOpenChange: edit.setLineMenuOpen,
      onClearLineDraft: clearLineDraft,
      onClearRuler: clearRulerState,
      drawActionsVisible,
      drawStepBackDisabled,
      drawFinishDisabled,
      drawResetDisabled,
      onDrawStepBack: handleDrawStepBack,
      onDrawFinish: handleDrawFinish,
      onDrawReset: handleDrawReset,
      searchQ: edit.searchQ,
      onSearchQChange: edit.setSearchQ,
      searchOpen: edit.searchOpen,
      onSearchOpenChange: edit.setSearchOpen,
      searchSuggestions: data.searchSuggestions,
      onPickSearchResult: data.pickSearchResult,
    },
    layersSidebar: {
      open: shell.mapLayersOpen,
      onClose: () => shell.setMapLayersOpen(false),
      layers,
      isGroupVisible,
      onGroupVisibility: setGroupSubtypesVisible,
      onLayerVisibility: (layerId, is_visible) =>
        layerVisibilityMut.mutate({ layerId, is_visible }),
      layerVisibilityReadOnly: !canWriteInfra,
      layerVisibilityPending: layerVisibilityMut.isPending,
      showPoisOnMap,
      onShowPoisChange: (visible) => setLayerPrefs((p) => ({ ...p, showPoisOnMap: visible })),
      showRadii,
      onShowRadiiChange: (visible) => setLayerPrefs((p) => ({ ...p, showRadii: visible })),
      radiusVisible,
      onRadiusVisibleChange: (subtype, visible) =>
        setLayerPrefs((p) => ({
          ...p,
          radiusVisible: { ...p.radiusVisible, [subtype]: visible },
        })),
      openSections: layerOpenSections,
      onOpenSectionsChange: setLayerOpenSections,
      thresholdKm,
      showBasemap,
      onShowBasemapChange: (visible) => setLayerPrefs((p) => ({ ...p, showBasemap: visible })),
      showTerrain,
      onShowTerrainChange: (visible) => setLayerPrefs((p) => ({ ...p, showTerrain: visible })),
      mapIn3d,
      showModels,
      onShowModelsChange: (visible) => setLayerPrefs((p) => ({ ...p, showModels: visible })),
    },
    canvas: {
      map3dRef: shell.map3dRef,
      map3dFeatureEnabled,
      map3dKeepMounted,
      mapIn3d,
      showPoisOnMap,
      pois,
      filteredInfra,
      infraObjects,
      showBasemap,
      showTerrain,
      showModels,
      connectionLines,
      selectedPoi,
      featureSel: edit.featureSel,
      setFeatureSel: edit.setFeatureSel,
      thresholdCircles,
      showRadii,
      layers,
      mapFocus: edit.mapFocus,
      drawMode: edit.drawMode,
      selectMode: edit.selectMode,
      mapEditEnabled: edit.mapEditEnabled,
      projectId: projectId ?? undefined,
      pasteMode: edit.pasteMode,
      handleMapClick,
      finishLineDraft,
      finishRulerMeasurement,
      handlePointerMove,
      handlePointerLeave,
      mapPointerInside: edit.mapPointerInside,
      cursor: edit.cursor,
      infraFormSubtype: edit.infraForm.subtype,
      clipboardPreviewPoints,
      setFeatureGroupSel: edit.setFeatureGroupSel,
      autoroadNetworkPickMode,
      handleAutoroadNetworkDragBoxPick,
      autoroadNetworkTerminalIds,
      featureGroupSel: edit.featureGroupSel,
      handleGeometryChange,
      handleBatchGeometryChange,
      handleMapBboxChange,
      lineDraft,
      lineDraftPreview,
      autoroadPlanPreviewLines,
      rulerPoints,
      rulerPreview,
      rulerCompleted,
      measureCursorLabel,
      measureAnchorLabels,
      handleFitMapView,
      lineLodScaleThreshold: layerPrefs.lineLodScaleThreshold,
      onViewStateSnapshot: (s) => {
        shell.last2dViewRef.current = s;
      },
      onViewChange: ({ scaleLabel, scaleDenominator }) => {
        shell.setMapScaleLabel(scaleLabel);
        shell.setMapScaleDenominator(scaleDenominator);
      },
    },
    sidePanels: {
      drawMode: edit.drawMode,
      selectMode: edit.selectMode,
      detailSelection,
      layers,
      map3dCustomModels: data.map3dCustomModels,
      saveDetailPending: saveDetailMut.isPending,
      canWriteProject,
      canWriteInfra,
      onCloseDetail: () => edit.setFeatureSel(null),
      onSaveDetail: (payload) => saveDetailMut.mutate(payload),
      onDeleteDetail: requestDeleteSelection,
      onCopyDetail: canCopyMapSelection ? copyMapSelection : undefined,
      onCutDetail: canCutMapSelection ? cutMapSelection : undefined,
      autoroadNetworkDetails,
      autoroadNetworkPickMode,
      onAutoroadPickModeChange: setAutoroadNetworkPickMode,
      onCloseAutoroad: cancelDrawingSelection,
      onClearAutoroadTerminals: () => setAutoroadNetworkTerminalIds([]),
      onRemoveAutoroadItem: (id) =>
        setAutoroadNetworkTerminalIds((ids) => ids.filter((x) => x !== id)),
      onAddVisibleAutoroadTerminals: handleAddVisibleAutoroadTerminals,
      onAddAutoroadTerminalsBySubtype: handleAddAutoroadTerminalsBySubtype,
      visibleEligibleAutoroadCount: visibleEligibleAutoroadTerminals.length,
      autoroadSubtypeBulkOptions,
      onAutoroadPreview: () => {
        if (!canAutoroadNetworkPreview || runAutoroadNetworkFlow.isPending) return;
        runAutoroadNetworkFlow.mutate(autoroadNetworkTerminalIds);
      },
      canAutoroadNetworkPreview,
      autoroadNetworkDisabledHint,
      autoroadNetworkPending: runAutoroadNetworkFlow.isPending,
      autoroadPlannerOptions,
      onAutoroadPlannerOptionsChange: handleAutoroadPlannerOptionsChange,
      solverStatus,
      solverStatusLoading,
      groupSelectionDetails,
      onClearGroupSelection: () => edit.setFeatureGroupSel([]),
      onCopyGroup: copyMapSelection,
      onCutGroup: cutMapSelection,
      onPasteGroup: enterPasteMode,
      onDeleteGroup: requestDeleteGroupSelection,
      canCopyMapSelection,
      canCutMapSelection,
      canPasteMapClipboard,
      canDeleteCurrentSelection,
      deleteGroupPending: deleteGroupMut.isPending,
      canAutoroadConnect,
      autoroadConnectPending: autoroadConnectMut.isPending || data.projectJobBusy,
      onAutoroadConnect: canWriteInfra ? handleAutoroadConnect : undefined,
    },
    footer: {
      mapScaleLabel: shell.mapScaleLabel,
      geometrySavePending,
      drawMode: edit.drawMode,
      mapIn3d,
      mapFooterHint,
      rulerPointsLength: rulerPoints.length,
      autoroadNetworkPending: runAutoroadNetworkFlow.isPending,
      autoroadNetworkPickMode,
      lineDraftLength: lineDraft.length,
      lineLodScaleThreshold: layerPrefs.lineLodScaleThreshold,
      mapScaleDenominator: shell.mapScaleDenominator,
      onLineLodChange: (threshold) => patchLayerPrefs({ lineLodScaleThreshold: threshold }),
    },
    modals: {
      deleteConfirm,
      setDeleteConfirm,
      deletePending: deleteGroupMut.isPending || deleteInfraMut.isPending,
      poiModalOpen: edit.modal?.type === 'poi',
      onClosePoiModal: () => edit.setModal(null),
      poiForm: edit.poiForm,
      onPoiFormChange: edit.setPoiForm,
      canWriteProject,
      onSubmitPoi: submitPoi,
      createPoiPending: createPoiMut.isPending,
      projectId: projectId ?? undefined,
      selectedPoi,
      candidateSubtype: edit.candidateSubtype,
      candidateParamType: edit.candidateParamType,
      onCloseCandidates: () => {
        edit.setCandidateSubtype(null);
        edit.setCandidateParamType('external');
      },
      overrideMut,
    },
  };
}
