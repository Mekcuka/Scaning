import type { MapPageSidePanelsProps } from '../../../pages/map/MapPageSidePanels';
import type { BuildMapPageSectionsParams } from './types';

export function buildSidePanelsSection(
  params: Pick<
    BuildMapPageSectionsParams,
    'canWriteProject' | 'canWriteInfra' | 'edit' | 'data' | 'actions'
  >,
): MapPageSidePanelsProps {
  const { canWriteProject, canWriteInfra, edit, data, actions } = params;

  return {
    drawMode: edit.drawMode,
    selectMode: edit.selectMode,
    detailSelection: data.detailSelection,
    layers: data.layers,
    map3dCustomModels: data.map3dCustomModels,
    saveDetailPending: actions.saveDetailMut.isPending,
    canWriteProject,
    canWriteInfra,
    onCloseDetail: () => edit.setFeatureSel(null),
    onSaveDetail: (payload) => actions.saveDetailMut.mutate(payload),
    onDeleteDetail: actions.requestDeleteSelection,
    onCopyDetail: actions.canCopyMapSelection ? actions.copyMapSelection : undefined,
    onCutDetail: actions.canCutMapSelection ? actions.cutMapSelection : undefined,
    autoroadNetworkDetails: actions.autoroadNetworkDetails,
    autoroadNetworkPickMode: actions.autoroadNetworkPickMode,
    onAutoroadPickModeChange: actions.setAutoroadNetworkPickMode,
    onCloseAutoroad: edit.cancelDrawingSelection,
    onClearAutoroadTerminals: () => actions.setAutoroadNetworkTerminalIds([]),
    onRemoveAutoroadItem: (id) =>
      actions.setAutoroadNetworkTerminalIds((ids) => ids.filter((x) => x !== id)),
    onAddVisibleAutoroadTerminals: actions.handleAddVisibleAutoroadTerminals,
    onAddAutoroadTerminalsBySubtype: actions.handleAddAutoroadTerminalsBySubtype,
    visibleEligibleAutoroadCount: actions.visibleEligibleAutoroadTerminals.length,
    autoroadSubtypeBulkOptions: actions.autoroadSubtypeBulkOptions,
    onAutoroadPreview: () => {
      if (!actions.canAutoroadNetworkPreview || actions.runAutoroadNetworkFlow.isPending) return;
      actions.runAutoroadNetworkFlow.mutate(actions.autoroadNetworkTerminalIds);
    },
    canAutoroadNetworkPreview: actions.canAutoroadNetworkPreview,
    autoroadNetworkDisabledHint: actions.autoroadNetworkDisabledHint,
    autoroadNetworkPending: actions.runAutoroadNetworkFlow.isPending,
    autoroadPlannerOptions: actions.autoroadPlannerOptions,
    onAutoroadPlannerOptionsChange: actions.handleAutoroadPlannerOptionsChange,
    solverStatus: actions.solverStatus,
    solverStatusLoading: actions.solverStatusLoading,
    groupSelectionDetails: data.groupSelectionDetails,
    onClearGroupSelection: () => edit.setFeatureGroupSel([]),
    onCopyGroup: actions.copyMapSelection,
    onCutGroup: actions.cutMapSelection,
    onPasteGroup: actions.enterPasteMode,
    onDeleteGroup: actions.requestDeleteGroupSelection,
    canCopyMapSelection: actions.canCopyMapSelection,
    canCutMapSelection: actions.canCutMapSelection,
    canPasteMapClipboard: actions.canPasteMapClipboard,
    canDeleteCurrentSelection: actions.canDeleteCurrentSelection,
    deleteGroupPending: actions.deleteGroupMut.isPending,
  };
}
