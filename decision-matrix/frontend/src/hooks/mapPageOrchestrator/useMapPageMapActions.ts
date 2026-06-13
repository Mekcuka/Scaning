import { useMapAnalysisActions } from './actions/useMapAnalysisActions';

import { useMapAutoroadActions } from './actions/useMapAutoroadActions';
import { useMapPadPlacementActions } from './actions/useMapPadPlacementActions';

import { useMapDisplayActions } from './actions/useMapDisplayActions';

import { useMapDrawAndCreateActions } from './actions/useMapDrawAndCreateActions';

import { useMapPageInteraction } from './actions/useMapPageInteraction';

import { useMapSelectionActions } from './actions/useMapSelectionActions';

import { useLineFootprintEdgePick } from '../useLineFootprintEdgePick';

import { useMapPageBottomholeDraw } from './useMapPageBottomholeDraw';

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
  const padPlacement = useMapPadPlacementActions(params);

  const draw = useMapDrawAndCreateActions(params);

  const bottomholeDraw = useMapPageBottomholeDraw(params, {

    placeBottomholeAt: draw.placeBottomholeAt,

    nextAutoName: data.nextAutoName,

  });

  const selection = useMapSelectionActions(params);

  const analysis = useMapAnalysisActions(params);

  const display = useMapDisplayActions(params);

  const interaction = useMapPageInteraction(params, {

    autoroad,

    padPlacement,

    draw,

    selection,

    lineFootprintEdgePick,

    bottomholeDraw,

  });

  const { needsDrawCursor: _omitNeedsDrawCursor, ...drawSlice } = draw;



  return {

    ...autoroad,

    ...padPlacement,

    ...drawSlice,

    ...selection,

    ...analysis,

    ...display,

    ...interaction,

    ...lineFootprintEdgePick,

    ...bottomholeDraw,

    autoroadConfirmModal,

    lineSplitConfirmModal,

  };

}

