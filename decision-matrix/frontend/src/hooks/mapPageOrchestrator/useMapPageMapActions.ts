import { useMapAnalysisActions } from './actions/useMapAnalysisActions';
import { useMapAutoroadActions } from './actions/useMapAutoroadActions';
import { useMapDisplayActions } from './actions/useMapDisplayActions';
import { useMapDrawAndCreateActions } from './actions/useMapDrawAndCreateActions';
import { useMapPageInteraction } from './actions/useMapPageInteraction';
import { useMapSelectionActions } from './actions/useMapSelectionActions';
import { useLineFootprintEdgePick } from '../useLineFootprintEdgePick';
import { useAppStore } from '../../store';
import type { MapPageActionsParams } from './mapPageActionsTypes';

export type { MapPageActionsParams } from './mapPageActionsTypes';

export function useMapPageMapActions(params: MapPageActionsParams) {
  const { autoroadConfirmModal, lineSplitConfirmModal, edit, data, projectId, canWriteInfra, mapInFootprints } = params;
  const pushToast = useAppStore((s) => s.pushToast);
  const { pushUndo } = data;

  const lineFootprintEdgePick = useLineFootprintEdgePick({
    projectId: projectId ?? undefined,
    mapInFootprints,
    canWriteInfra,
    detailSelection: data.detailSelection,
    infraObjects: data.infraObjects,
    footprintLineConnectPickSubtype: edit.footprintLineConnectPickSubtype,
    setFootprintLineConnectPickSubtype: edit.setFootprintLineConnectPickSubtype,
    pushUndo,
    pushToast,
  });

  const autoroad = useMapAutoroadActions(params);
  const draw = useMapDrawAndCreateActions(params);
  const selection = useMapSelectionActions(params);
  const analysis = useMapAnalysisActions(params);
  const display = useMapDisplayActions(params);
  const interaction = useMapPageInteraction(params, {
    autoroad,
    draw,
    selection,
    lineFootprintEdgePick,
  });
  const { needsDrawCursor: _omitNeedsDrawCursor, ...drawSlice } = draw;

  return {
    ...autoroad,
    ...drawSlice,
    ...selection,
    ...analysis,
    ...display,
    ...interaction,
    ...lineFootprintEdgePick,
    autoroadConfirmModal,
    lineSplitConfirmModal,
  };
}
