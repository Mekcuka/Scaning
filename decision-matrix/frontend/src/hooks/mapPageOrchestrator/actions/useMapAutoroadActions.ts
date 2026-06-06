import { useMapAutoroadNetwork } from '../../useMapAutoroadNetwork';
import { useAppStore } from '../../../store';
import type { MapPageActionsParams } from '../mapPageActionsTypes';

export function useMapAutoroadActions(params: MapPageActionsParams) {
  const { projectId, canWriteInfra, edit, data, requestAutoroadConfirm } = params;
  const effectiveProjectId = projectId ?? undefined;
  const pushToast = useAppStore((s) => s.pushToast);
  const { projectJobBusy, infraObjects, mapBbox, groupSelectionDetails, pushUndo, invalidateMap } =
    data;

  const network = useMapAutoroadNetwork({
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

  return {
    autoroadNetworkTerminalIds: network.terminalIds,
    setAutoroadNetworkTerminalIds: network.setTerminalIds,
    autoroadNetworkPickMode: network.pickMode,
    setAutoroadNetworkPickMode: network.setPickMode,
    autoroadPlannerOptions: network.plannerOptions,
    handleAutoroadPlannerOptionsChange: network.handlePlannerOptionsChange,
    solverStatus: network.solverStatus,
    solverStatusLoading: network.solverStatusLoading,
    autoroadPlanPreviewLines: network.planPreviewLines,
    autoroadNetworkDetails: network.networkDetails,
    visibleEligibleAutoroadTerminals: network.visibleEligibleTerminals,
    autoroadSubtypeBulkOptions: network.subtypeBulkOptions,
    handleAutoroadNetworkDragBoxPick: network.handleDragBoxPick,
    handleAddVisibleAutoroadTerminals: network.handleAddVisible,
    handleAddAutoroadTerminalsBySubtype: network.handleAddBySubtype,
    handleMapClick: network.handleMapClick,
    canAutoroadConnect: network.canConnect,
    autoroadConnectMut: network.connectMut,
    handleAutoroadConnect: network.handleConnect,
    runAutoroadNetworkFlow: network.runNetworkFlow,
    canAutoroadNetworkPreview: network.canPreview,
    autoroadNetworkDisabledHint: network.disabledHint,
  };
}
