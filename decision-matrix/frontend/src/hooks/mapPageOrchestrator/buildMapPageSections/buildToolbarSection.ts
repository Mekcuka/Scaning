import type { MapPageToolbarProps } from '../../../pages/map/mapPageToolbar/types';
import type { BuildMapPageSectionsParams } from './types';

export function buildToolbarSection(
  params: Pick<
    BuildMapPageSectionsParams,
    | 'projectId'
    | 'canWriteProject'
    | 'canWriteInfra'
    | 'canEditMap'
    | 'map3dFeatureEnabled'
    | 'mapDisplayMode'
    | 'mapIn3d'
    | 'shell'
    | 'edit'
    | 'data'
    | 'actions'
  >,
): MapPageToolbarProps {
  const {
    projectId,
    canWriteProject,
    canWriteInfra,
    canEditMap,
    map3dFeatureEnabled,
    mapDisplayMode,
    mapIn3d,
    shell,
    edit,
    data,
    actions,
  } = params;

  return {
    map3dFeatureEnabled,
    mapDisplayMode,
    onDisplayModeChange: actions.switchMapDisplayMode,
    mapLayersOpen: shell.mapLayersOpen,
    onToggleLayers: () => shell.setMapLayersOpen((open) => !open),
    mapFullscreen: shell.mapFullscreen,
    onToggleFullscreen: () => void shell.toggleMapFullscreen(),
    projectId: projectId ?? undefined,
    pois: data.pois,
    selectedPoiId: edit.selectedPoiId,
    onSelectedPoiIdChange: edit.setSelectedPoiId,
    mapEditEnabled: edit.mapEditEnabled,
    onToggleMapEdit: () => edit.setMapEditEnabled((on) => !on),
    canEditMap,
    mapIn3d,
    canUndo: data.canUndo,
    onUndo: () => void data.performUndo(),
    canCopy: actions.canCopyMapSelection,
    onCopy: actions.copyMapSelection,
    canPaste: actions.canPasteMapClipboard,
    onPaste: actions.enterPasteMode,
    canCut: actions.canCutMapSelection,
    onCut: actions.cutMapSelection,
    canDelete: actions.canDeleteCurrentSelection,
    selectedOnMapCount: actions.selectedOnMapCount,
    deletePending: actions.deleteGroupMut.isPending || actions.deleteInfraMut.isPending,
    onDelete: actions.requestDeleteSelection,
    drawMode: edit.drawMode,
    onDrawModeChange: edit.setDrawMode,
    selectMode: edit.selectMode,
    onSelectModeChange: edit.setSelectMode,
    onResetDrawingMenus: actions.resetDrawingMenusForToolbar,
    canWriteInfra,
    canWriteProject,
    projectJobBusy: data.projectJobBusy,
    infraFormSubtype: edit.infraForm.subtype,
    onInfraFormSubtypeChange: (subtype) => edit.setInfraForm((f) => ({ ...f, subtype })),
    pointMenuOpen: edit.pointMenuOpen,
    onPointMenuOpenChange: edit.setPointMenuOpen,
    lineMenuOpen: edit.lineMenuOpen,
    onLineMenuOpenChange: edit.setLineMenuOpen,
    bottomholeMenuOpen: edit.bottomholeMenuOpen,
    onBottomholeMenuOpenChange: edit.setBottomholeMenuOpen,
    onClearLineDraft: actions.clearLineDraft,
    onClearRuler: actions.clearRulerState,
    drawActionsVisible: actions.drawActionsVisible,
    drawStepBackDisabled: actions.drawStepBackDisabled,
    drawFinishDisabled: actions.drawFinishDisabled,
    drawResetDisabled: actions.drawResetDisabled,
    onDrawStepBack: actions.handleDrawStepBack,
    onDrawFinish: actions.handleDrawFinish,
    onDrawReset: actions.handleDrawReset,
    searchQ: edit.searchQ,
    onSearchQChange: edit.setSearchQ,
    searchOpen: edit.searchOpen,
    onSearchOpenChange: edit.setSearchOpen,
    searchSuggestions: data.searchSuggestions,
    onPickSearchResult: data.pickSearchResult,
  };
}
